/**
 * Pyroscope flamebearer → `@grafana/flamegraph` nested-set rows (decision 0041,
 * the edge adaptation). PURE and dependency-free — NO `@grafana/data` import — so
 * the service-side fixture test can import it by path and assert the
 * reconstruction against a real captured profile (the island chunk itself is
 * never node-importable: `@grafana/data` touches `window` at eval). `island.tsx`
 * wraps the output in a `createDataFrame` at mount time.
 *
 * The `pyroscope` provider emits the backend-faithful flamebearer: a `names`
 * table, BFS `levels` (each a flat quad list), and `total`/`maxSelf`. This file
 * reconstructs the call tree and emits it in the DFS PRE-ORDER nested-set shape
 * `@grafana/flamegraph` consumes (its `nestedSetToLevels` rebuilds the tree from
 * row order + the `level` column via a running-parent stack, so a node's children
 * MUST immediately follow it with `level = parent.level + 1`).
 */

/**
 * Pyroscope's flamebearer (the `SelectMergeStacktraces` response, int64 strings
 * already coerced to numbers by the provider Schema). `levels` is BFS: `levels[d]`
 * is a flat array of 4-tuples `[offsetDelta, total, self, nameIndex]` per node, in
 * left-to-right order, where `offsetDelta` is the gap from the previous sibling's
 * right edge in the same level (so absolute x = running sum of deltas + widths).
 */
export interface Flamebearer {
  readonly names: ReadonlyArray<string>
  readonly levels: ReadonlyArray<ReadonlyArray<number>>
  readonly total: number
  readonly maxSelf: number
}

/** One nested-set row: a `@grafana/flamegraph` DataFrame field tuple. */
export interface FlameNode {
  readonly label: string
  readonly level: number
  readonly value: number
  readonly self: number
}

interface TreeNode {
  readonly start: number
  readonly value: number
  readonly self: number
  readonly label: string
  readonly level: number
  readonly children: TreeNode[]
}

/** Decode one BFS level's flat quad list into absolute-positioned nodes. */
const parseLevel = (
  level: ReadonlyArray<number>,
  names: ReadonlyArray<string>,
  depth: number,
): TreeNode[] => {
  const nodes: TreeNode[] = []
  let x = 0
  for (let i = 0; i + 3 < level.length; i += 4) {
    x += level[i]! // offset delta from the previous sibling's right edge
    nodes.push({
      start: x,
      value: level[i + 1]!,
      self: level[i + 2]!,
      label: names[level[i + 3]!] ?? '',
      level: depth,
      children: [],
    })
    x += level[i + 1]! // advance past this node's width
  }
  return nodes
}

/**
 * Reconstruct the call tree from the flamebearer and emit it as DFS pre-order
 * nested-set rows. Parents are assigned by interval containment: a level-`d` node
 * at `[start, start+value)` is a child of the level-`(d-1)` node whose interval
 * contains `start`. Both levels are sorted ascending by `start` and child regions
 * nest strictly within parent regions, so a single monotonic pointer per level
 * finds every parent in linear time.
 */
export const flamebearerToNestedSet = (fb: Flamebearer): FlameNode[] => {
  const levels = fb.levels.map((level, depth) => parseLevel(level, fb.names, depth))
  if (levels.length === 0 || levels[0]!.length === 0) return []

  for (let depth = 1; depth < levels.length; depth++) {
    const parents = levels[depth - 1]!
    let pi = 0
    for (const node of levels[depth]!) {
      // Advance past parents whose right edge is at or before this node's start.
      while (pi < parents.length && parents[pi]!.start + parents[pi]!.value <= node.start) pi++
      const parent = parents[pi]
      if (parent !== undefined && parent.start <= node.start) parent.children.push(node)
    }
  }

  // DFS pre-order; reverse-push children so the leftmost child is emitted first.
  const rows: FlameNode[] = []
  const stack: TreeNode[] = [levels[0]![0]!]
  while (stack.length > 0) {
    const node = stack.pop()!
    rows.push({ label: node.label, level: node.level, value: node.value, self: node.self })
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]!)
  }
  return rows
}
