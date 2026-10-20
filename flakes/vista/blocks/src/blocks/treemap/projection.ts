/**
 * Pure projection for the treemap block (decision 0055) — mirrors
 * `system-explorer/projection.ts`'s `project({ model, lens }) -> scene` +
 * `layoutSignature` relayout pattern, adapted to a synchronous geometry step.
 *
 * The split that matters (the round-2 learning):
 *   - STRUCTURAL lens fields (rootId, maxDepth, minAreaPct, layout) change the
 *     *derived tree* and thus the geometry → a new `layoutSignature` → relayout.
 *   - RESTYLE fields (query, selectedId, colorBy, hover) NEVER touch the derived
 *     tree or geometry; they resolve to cheap per-tile Set lookups / fills applied
 *     over the memoized rects. Hover / search-mute / focus / recolor are free.
 *
 * Unlike `system-explorer` (elk is async, so it lays out in the component), the
 * treemap geometry is d3-hierarchy `treemap()` / `partition()` — pure, synchronous
 * math with no DOM — so `project` itself returns the laid-out rects. `size` is a
 * pixel input (the header/padding are fixed px) but is DELIBERATELY excluded from
 * `layoutSignature`: only a structural change is a "relayout" for the caller's memo.
 */
import { tokens } from '@vista/ui/tokens.stylex'
import {
  hierarchy,
  partition,
  treemap,
  treemapResquarify,
  type HierarchyRectangularNode,
} from 'd3-hierarchy'

import type { TreemapColorBy, TreemapLayout, TreemapModel, TreemapNode } from '../../model.ts'

// ─────────────────────────────────────────────────────────── model index ────

/**
 * A flattened record for one node in the whole-tree index: optional parent id, absolute depth from
 * the root, exact post-order aggregated value, label path, and child and leaf counts.
 */
export interface IndexEntry {
  readonly node: TreemapNode
  readonly parentId?: string
  /** Absolute depth from the model root (root = 0). */
  readonly depth: number
  /** Post-order sum (exact): a leaf's own `value`, a container's descendant sum. */
  readonly value: number
  /** Labels root → this node. */
  readonly path: readonly string[]
  readonly childCount: number
  readonly leafCount: number
}

/**
 * The whole-tree lookup result: entries keyed by node id plus the root node and the grand total
 * used to compute percentages.
 */
export interface ModelIndex {
  readonly byId: ReadonlyMap<string, IndexEntry>
  readonly root: TreemapNode
  readonly total: number
}

/** Build the whole-tree index once (post-order sums, paths, counts). Pure. */
export const buildIndex = (root: TreemapNode): ModelIndex => {
  const byId = new Map<string, IndexEntry>()

  const visit = (
    node: TreemapNode,
    parentId: string | undefined,
    depth: number,
    path: readonly string[],
  ): { value: number; leaves: number } => {
    const here = [...path, node.label]
    const base = { node, depth, path: here } as const
    const parent = parentId !== undefined ? { parentId } : {}
    if (!node.children || node.children.length === 0) {
      const value = node.value ?? 0
      byId.set(node.id, { ...base, ...parent, value, childCount: 0, leafCount: 1 })
      return { value, leaves: 1 }
    }
    let value = 0
    let leaves = 0
    for (const child of node.children) {
      const r = visit(child, node.id, depth + 1, here)
      value += r.value
      leaves += r.leaves
    }
    byId.set(node.id, {
      ...base,
      ...parent,
      value,
      childCount: node.children.length,
      leafCount: leaves,
    })
    return { value, leaves }
  }

  visit(root, undefined, 0, [])
  return { byId, root, total: byId.get(root.id)?.value ?? 0 }
}

// ───────────────────────────────────────────────────────────── filter ───────

/**
 * Every leaf id under (and including) `node`. Leaves are the unit the hierarchical
 * filter stores (decision 0055): a leaf-id Set sidesteps the cut-point / split-
 * ancestor bookkeeping a subtree-root Set would need — the tri-state parent view and
 * the prune both derive purely from leaf membership. Pure; a node with `children` is a
 * container even if it also carries a `value` (matches `buildIndex`'s leaf rule).
 */
export const collectLeafIds = (node: TreemapNode, into: Set<string> = new Set()): Set<string> => {
  if (!node.children || node.children.length === 0) {
    into.add(node.id)
    return into
  }
  for (const c of node.children) collectLeafIds(c, into)
  return into
}

/**
 * Expand a set of node ids (each a leaf OR a subtree root) to the leaf ids it covers —
 * used only to SEED the filter state from a `defaultExcludedIds` prop (so a story /
 * app can pre-exclude whole subtrees by root id). Pure.
 */
export const expandToLeafIds = (model: TreemapModel, ids: readonly string[]): Set<string> => {
  const index = buildIndex(model.root)
  const out = new Set<string>()
  for (const id of ids) {
    const entry = index.byId.get(id)
    if (entry) collectLeafIds(entry.node, out)
  }
  return out
}

/**
 * Leaf ids whose facets match a lens's `hiddenFacets` policy (e.g. `{ provenance:
 * ['generated'] }`) — used to SEED the exclusion filter so a facet value is hidden by
 * default yet stays counted, drillable, searchable, and revealable (decision 0068,
 * MED.BLK.TREE-R73; the completeness guarantee MED.BLK.TREE-R61 holds via the same
 * remove+re-sum path as any manual exclusion). A leaf is hidden if, for ANY policy key,
 * its `facets[key]` is one of the listed values. Containers carry no facet, so only
 * leaves match. Pure; `undefined`/empty policy → empty set.
 */
export const resolveHiddenFacetLeafIds = (
  model: TreemapModel,
  hiddenFacets: Readonly<Record<string, readonly string[]>> | undefined,
): Set<string> => {
  const out = new Set<string>()
  const entries = hiddenFacets ? Object.entries(hiddenFacets) : []
  if (entries.length === 0) return out
  const walk = (node: TreemapNode): void => {
    if (!node.children || node.children.length === 0) {
      const f = node.facets
      if (f !== undefined) {
        for (const [key, values] of entries) {
          const v = f[key]
          if (v !== undefined && values.includes(v)) {
            out.add(node.id)
            break
          }
        }
      }
      return
    }
    for (const c of node.children) walk(c)
  }
  walk(model.root)
  return out
}

/**
 * Prune the model to the tiles the filter keeps: drop every excluded LEAF (by id) and
 * any container the prune leaves empty, then let `project` (via `buildIndex`) RE-SUM the
 * survivors so the remaining tiles reflow over the visible set (decision 0055 remove+
 * re-sum). Pure — never mutates the model. Applied BEFORE `project`, over the WHOLE model
 * (independent of the zoom root) so the filter is global and persists across drill /
 * layout / search. Empty set → identity (the caller memo stays referentially stable).
 */
export const pruneModel = (
  model: TreemapModel,
  excludedLeafIds: ReadonlySet<string>,
): TreemapModel => {
  if (excludedLeafIds.size === 0) return model
  const prune = (node: TreemapNode): TreemapNode | undefined => {
    if (!node.children || node.children.length === 0) {
      return excludedLeafIds.has(node.id) ? undefined : node
    }
    const kids: TreemapNode[] = []
    for (const c of node.children) {
      const k = prune(c)
      if (k !== undefined) kids.push(k)
    }
    if (kids.length === 0) return undefined
    return { ...node, children: kids }
  }
  const root = prune(model.root)
  // Root fully pruned → keep a structurally-empty root so the block degrades, not crashes.
  return { ...model, root: root ?? { ...model.root, children: [] } }
}

// ─────────────────────────────────────────────────────────────── lens ───────

/**
 * The structural + encoding inputs `project` reads. `colorBy` is accepted but
 * NEVER affects the geometry or the `layoutSignature` (it is a pure restyle) — it
 * lives here only so a caller/test can prove signature-invariance under a recolor.
 */
export interface TreemapProjectionLens {
  readonly layout: TreemapLayout
  /** Display (zoom) root. `undefined` = whole model. May be a synthetic `…::more`. */
  readonly rootId?: string | undefined
  /** Levels below the display root to render before summarizing (structural). */
  readonly maxDepth: number
  /** Fold siblings whose value < `minAreaPct` × parent value into one aggregate. */
  readonly minAreaPct: number
  /** Restyle only: ignored by geometry + signature. */
  readonly colorBy?: TreemapColorBy | undefined
}

// ───────────────────────────────────────────────────────── derived tree ─────

/**
 * Classifies a projected treemap tile as a real container with children, a leaf value, a
 * summarized subtree collapsed into a single synthetic tile, or an aggregate bucket holding
 * folded-away overflow siblings.
 */
export type DerivedKind = 'container' | 'leaf' | 'summarized' | 'aggregate'

/**
 * Immutable projected treemap tile carrying its display label, aggregate value, and the
 * real/synthetic id pair (realId, drillId) plus optional folded-child metadata, which together
 * drive rendering, detail, drilldown, and selection.
 */
export interface DerivedNode {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly kind: DerivedKind
  /** Real model id this tile represents (for detail/selection). Synthetics: parent. */
  readonly realId: string
  /** Real id to drill to (summarized → its own id; aggregate → `${parent}::more`). */
  readonly drillId?: string
  /** For summarized/aggregate labels: how many children were folded away. */
  readonly childCount?: number
  readonly children?: readonly DerivedNode[]
}

const AGG = '::more'

/** Resolve the display-root's real id; a `…::more` id resolves to its real parent. */
const realAnchorId = (rootId: string | undefined): string | undefined =>
  rootId?.endsWith(AGG) ? rootId.slice(0, -AGG.length) : rootId

/**
 * Build the derived render tree from a real node, capping at `maxDepth` levels and
 * folding sub-threshold siblings into a labelled, countable, drillable "N more"
 * aggregate. Completeness (MED.KIT-R61): every folded/summarized node stays represented —
 * Σ of emitted tile values always equals the source node value.
 */
const buildDerived = (
  node: TreemapNode,
  entry: IndexEntry,
  index: ModelIndex,
  relDepth: number,
  maxDepth: number,
  threshold: number,
): DerivedNode => {
  const kids = node.children
  if (!kids || kids.length === 0) {
    return { id: node.id, label: node.label, value: entry.value, kind: 'leaf', realId: node.id }
  }
  // Depth cap: draw this whole subtree as one summarized container (drillable).
  if (relDepth >= maxDepth) {
    return {
      id: node.id,
      label: node.label,
      value: entry.value,
      kind: 'summarized',
      realId: node.id,
      drillId: node.id,
      childCount: entry.leafCount,
    }
  }

  const derivedKids = kids.map((c) =>
    buildDerived(c, index.byId.get(c.id)!, index, relDepth + 1, maxDepth, threshold),
  )

  // Fold sub-threshold siblings into one aggregate (only if it collapses ≥ 2).
  const cut = threshold * entry.value
  const small = derivedKids.filter((d) => d.value < cut)
  if (small.length >= 2) {
    const kept = derivedKids.filter((d) => d.value >= cut)
    const folded = small.toSorted((a, b) => b.value - a.value)
    const aggValue = folded.reduce((s, d) => s + d.value, 0)
    const aggregate: DerivedNode = {
      id: `${node.id}${AGG}`,
      label: `${folded.length} more`,
      value: aggValue,
      kind: 'aggregate',
      realId: node.id,
      drillId: `${node.id}${AGG}`,
      childCount: folded.length,
      children: folded,
    }
    return {
      id: node.id,
      label: node.label,
      value: entry.value,
      kind: 'container',
      realId: node.id,
      drillId: node.id,
      children: [...kept, aggregate],
    }
  }

  return {
    id: node.id,
    label: node.label,
    value: entry.value,
    kind: 'container',
    realId: node.id,
    drillId: node.id,
    children: derivedKids,
  }
}

/** A d3-laid-out tile: the derived node plus its resolved rect (pixel space). */
export interface SceneRect {
  readonly node: DerivedNode
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  /** Hierarchy depth from the derived (display) root. */
  readonly depth: number
  readonly hasChildren: boolean
}

/**
 * The `value`-encoding domain, computed over the DRAWN layout leaves only (min→max):
 * both ends plus their `log1p` transforms. `tileColor` normalizes over `[logMin, logMax]`
 * and the legend labels `min`/`max`, so the faintest tile is the min leaf and the
 * brightest the max leaf — one shared, view-relative scale (decision 0055).
 */
export interface ValueDomain {
  readonly min: number
  readonly max: number
  readonly logMin: number
  readonly logMax: number
}

/** The resolved scene a lens projects from a model: laid-out rects + metadata. */
export interface ProjectedScene {
  readonly rects: readonly SceneRect[]
  /** The derived render tree (depth-capped + folded) the rects were laid out from. */
  readonly derived: DerivedNode
  /** The whole-model index (search / detail / breadcrumb resolve against this). */
  readonly index: ModelIndex
  /** Real display-root entry (the `…::more` anchor for aggregate roots). */
  readonly anchor: IndexEntry
  readonly total: number
  /** True when the display root is an aggregate-expanded pseudo-root. */
  readonly isAggregateRoot: boolean
  /**
   * View-relative value domain over the DRAWN layout leaves (min→max), for the
   * `value` ramp AND its legend. Both the tile fills (`tileColor`) and the legend
   * endpoints read this ONE domain so they never describe different scales.
   */
  readonly valueDomain: ValueDomain
  /**
   * Stable signature of the structural inputs (zoom root + depth cap + layout kind
   * + fold threshold). Geometry relayouts only when THIS changes — never on
   * hover / search-mute / focus / recolor. Size is intentionally excluded.
   */
  readonly layoutSignature: string
}

/** A derived node is a layout leaf if the d3 tiling must not descend into it. */
const isLayoutLeaf = (d: DerivedNode): boolean =>
  d.kind === 'aggregate' || d.kind === 'summarized' || !d.children || d.children.length === 0

/**
 * The value domain over the DRAWN layout leaves only (min→max) — the exact set of
 * tiles the `value` ramp colors. The walk mirrors the d3 descent rule (`isLayoutLeaf`
 * → stop): it early-returns at an aggregate/summarized/leaf tile and never descends
 * into an aggregate's folded children (those are NOT drawn), so the domain matches
 * what is on screen. Empty tree → `{ min: 0, max: 0 }`.
 */
export const derivedValueDomain = (d: DerivedNode): ValueDomain => {
  let min = Infinity
  let max = 0
  const walk = (n: DerivedNode): void => {
    if (isLayoutLeaf(n)) {
      if (n.value < min) min = n.value
      if (n.value > max) max = n.value
      return
    }
    n.children?.forEach(walk)
  }
  walk(d)
  if (min === Infinity) min = 0
  return { min, max, logMin: Math.log1p(min), logMax: Math.log1p(max) }
}

/** Container header row + tile padding (treemap only) — fixed pixels. */
const PAD = 2
/**
 * Fixed pixel height reserved for the treemap header strip so layout geometry and rendering share
 * a single agreed offset.
 */
export const TREEMAP_HEADER_HEIGHT = 24

/**
 * Project `(model, lens, size)` → laid-out rects + `layoutSignature`. Pure: never
 * mutates the model. Depends structurally only on layout/rootId/maxDepth/minAreaPct
 * (+ pixel size for geometry); `colorBy` and all interaction restyles are applied
 * by the caller over the returned rects.
 */
export const project = ({
  model,
  lens,
  size,
}: {
  model: TreemapModel
  lens: TreemapProjectionLens
  size: { readonly width: number; readonly height: number }
}): ProjectedScene => {
  const index = buildIndex(model.root)
  const anchorId = realAnchorId(lens.rootId) ?? index.root.id
  const anchor = index.byId.get(anchorId) ?? index.byId.get(index.root.id)!
  const isAggregateRoot = lens.rootId?.endsWith(AGG) === true

  let derived: DerivedNode
  if (isAggregateRoot) {
    // Rebuild the anchor's fold set and expand exactly the folded children.
    const node = anchor.node
    const kids = node.children ?? []
    const derivedKids = kids.map((c) =>
      buildDerived(c, index.byId.get(c.id)!, index, 1, lens.maxDepth, lens.minAreaPct),
    )
    const cut = lens.minAreaPct * anchor.value
    const folded = derivedKids.filter((d) => d.value < cut).toSorted((a, b) => b.value - a.value)
    const aggValue = folded.reduce((s, d) => s + d.value, 0)
    derived = {
      id: `${node.id}${AGG}`,
      label: `${folded.length} more · ${node.label}`,
      value: aggValue,
      kind: 'container',
      realId: node.id,
      children: folded,
    }
  } else {
    derived = buildDerived(anchor.node, anchor, index, 0, lens.maxDepth, lens.minAreaPct)
  }

  const valueDomain = derivedValueDomain(derived)

  const width = Math.max(1, size.width)
  const height = Math.max(1, size.height)
  const h = hierarchy<DerivedNode>(derived, (d) =>
    isLayoutLeaf(d) ? null : ((d.children as DerivedNode[] | undefined) ?? null),
  )
    .sum((d) => (isLayoutLeaf(d) ? d.value : 0))
    // eslint-disable-next-line unicorn/no-array-sort -- D3 hierarchy exposes mutating sort for layout order.
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const laid: HierarchyRectangularNode<DerivedNode> =
    lens.layout === 'treemap'
      ? treemap<DerivedNode>()
          .size([width, height])
          .paddingOuter(PAD)
          .paddingInner(PAD)
          .paddingTop(TREEMAP_HEADER_HEIGHT)
          .round(true)
          .tile(treemapResquarify)(h)
      : partition<DerivedNode>().size([width, height]).padding(1).round(true)(h)

  const rects: SceneRect[] = laid
    .descendants()
    .filter((n) => n.depth >= 1)
    .map((n) => ({
      node: n.data,
      x0: n.x0,
      y0: n.y0,
      x1: n.x1,
      y1: n.y1,
      depth: n.depth,
      hasChildren: !!n.children && n.children.length > 0,
    }))

  const layoutSignature = `${lens.layout}|${lens.rootId ?? ''}|${lens.maxDepth}|${lens.minAreaPct}`
  return {
    rects,
    derived,
    index,
    anchor,
    total: index.total,
    isAggregateRoot,
    valueDomain,
    layoutSignature,
  }
}

// ────────────────────────────────────────────────────────────── search ──────

/**
 * A single label-search match describing the node's id, display label, ancestry path from the
 * root, and numeric value.
 */
export interface SearchResult {
  readonly id: string
  readonly label: string
  readonly path: readonly string[]
  readonly value: number
}

/**
 * Groups the directly matched ids, their full ancestor set (kept un-muted so the path to root
 * stays visible), and the ordered capped result list produced by searchMatches.
 */
export interface SearchState {
  /** Directly matching ids (bright). */
  readonly matched: ReadonlySet<string>
  /** Matches + all their ancestors (kept un-muted so the path-to-root shows). */
  readonly onPath: ReadonlySet<string>
  readonly results: readonly SearchResult[]
}

const EMPTY_SEARCH: SearchState = { matched: new Set(), onPath: new Set(), results: [] }

/** Case-insensitive label-substring search over the WHOLE resident tree. */
export const searchMatches = (index: ModelIndex, query: string, limit = 40): SearchState => {
  const q = query.trim().toLowerCase()
  if (q === '') return EMPTY_SEARCH
  const matched = new Set<string>()
  const onPath = new Set<string>()
  const results: SearchResult[] = []
  for (const [id, e] of index.byId) {
    if (!e.node.label.toLowerCase().includes(q)) continue
    matched.add(id)
    results.push({ id, label: e.node.label, path: e.path, value: e.value })
    // Mark the ancestor chain so a match's path-to-root stays visible.
    let cur: string | undefined = id
    while (cur !== undefined) {
      if (onPath.has(cur)) break
      onPath.add(cur)
      cur = index.byId.get(cur)?.parentId
    }
  }
  results.sort((a, b) => b.value - a.value)
  return { matched, onPath, results: results.slice(0, limit) }
}

// ────────────────────────────────────────────────────────────── color ───────

/**
 * Geist semantic-token color encodings (KR07 — NO hardcoded hex). Fills are low-%
 * `color-mix` tints over the semantic background so foreground label text stays
 * legible in both themes; hue carries the encoding, and the tile stroke carries
 * the fuller token so categories stay distinguishable when the fill is faint.
 *   - group → one of four categorical semantic tokens by hue.
 *   - depth → blue accent intensity (deeper = more saturated).
 *   - value → red "heat" intensity (bigger = hotter).
 */
export const GROUP_TOKENS = [
  tokens['--ds-blue-700'],
  tokens['--ds-green-900'],
  tokens['--ds-amber-900'],
  tokens['--ds-red-900'],
] as const

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))

/**
 * A tile's resolved fill paired with its group-encoding stroke, which the caller is expected to
 * override for selected, hovered, or matched tiles.
 */
export interface TileColor {
  readonly fill: string
  /** Encoding stroke — the caller overrides it for selected/hover/match tiles. */
  readonly stroke: string
}

/**
 * Categorical group fill + stroke for the `i`-th child of the display root. THE
 * single source of the `group` encoding — both the tiles (via `tileColor`) and the
 * detail-panel legend derive their swatch from this, so they never diverge (KR07).
 */
export const groupColor = (i: number): TileColor => {
  const token = GROUP_TOKENS[i % GROUP_TOKENS.length]!
  return {
    fill: `color-mix(in srgb, ${token} 26%, ${tokens['--ds-background-100']})`,
    stroke: token,
  }
}

/**
 * Intensity-ramp domains for the non-categorical encodings. Shared by
 * `tileColor` (per-tile fill) and the legend gradient swatch so the ramp the
 * viewer reads is the ramp the tiles use.
 */
export const DEPTH_RAMP = { token: tokens['--ds-blue-700'], min: 22, max: 67 } as const
/**
 * Color ramp for value-encoded treemap tiles, pairing the --ds-red-900 token with min (12) and max
 * (62) stops that bound how a tile's domain value is interpolated into its shade.
 */
export const VALUE_RAMP = { token: tokens['--ds-red-900'], min: 12, max: 62 } as const

/** Resolve a tile's encoded fill + stroke (pure restyle). */
export const tileColor = ({
  d,
  colorBy,
  index,
  displayRootId,
  valueDomain,
}: {
  d: DerivedNode
  colorBy: TreemapColorBy
  index: ModelIndex
  displayRootId: string
  valueDomain: ValueDomain
}): TileColor => {
  if (colorBy === 'value') {
    // Normalize over the drawn-leaf domain `[logMin, logMax]` so the min leaf renders
    // at VALUE_RAMP.min% and the max leaf at VALUE_RAMP.max% (view-relative, legend-matched).
    const t =
      valueDomain.logMax > valueDomain.logMin
        ? clamp01(
            (Math.log1p(d.value) - valueDomain.logMin) / (valueDomain.logMax - valueDomain.logMin),
          )
        : 0
    const pct = VALUE_RAMP.min + t * (VALUE_RAMP.max - VALUE_RAMP.min)
    return {
      fill: `color-mix(in srgb, ${VALUE_RAMP.token} ${pct.toFixed(0)}%, ${tokens['--ds-background-100']})`,
      stroke: `color-mix(in srgb, ${tokens['--ds-red-900']} 70%, ${tokens['--ds-background-100']})`,
    }
  }
  if (colorBy === 'depth') {
    const e = index.byId.get(d.realId)
    const root = index.byId.get(displayRootId)
    const rel = e && root ? e.depth - root.depth : 0
    const pct = DEPTH_RAMP.min + clamp01(rel / 6) * (DEPTH_RAMP.max - DEPTH_RAMP.min)
    return {
      fill: `color-mix(in srgb, ${DEPTH_RAMP.token} ${pct.toFixed(0)}%, ${tokens['--ds-background-100']})`,
      stroke: `color-mix(in srgb, ${tokens['--ds-blue-700']} 70%, ${tokens['--ds-background-100']})`,
    }
  }
  // group: index of the ancestor that is a direct child of the display root.
  return groupColor(groupIndex({ d, index, displayRootId }))
}

/**
 * The `group` bucket for a tile: the index (into the display root's children) of the
 * ancestor that is a direct child of the display root. The legend maps the SAME
 * `anchor.node.children` array through this index → `groupColor`, so swatch ⇄ tile match.
 */
export const groupIndex = ({
  d,
  index,
  displayRootId,
}: {
  d: DerivedNode
  index: ModelIndex
  displayRootId: string
}): number => {
  let cur = index.byId.get(d.realId)
  const root = index.byId.get(displayRootId)
  const rootDepth = root?.depth ?? 0
  while (cur && cur.depth > rootDepth + 1) {
    cur = cur.parentId ? index.byId.get(cur.parentId) : undefined
  }
  const groupNode = cur?.node
  const siblings = root?.node.children ?? []
  return groupNode
    ? Math.max(
        0,
        siblings.findIndex((c) => c.id === groupNode.id),
      )
    : 0
}

/**
 * Max `log1p(value)` across a derived tree's tiles. Superseded by `derivedValueDomain`
 * for the `value` ramp (which pins BOTH ends over the drawn leaves); retained only as a
 * public barrel export (`src/index.ts`). Prefer `derivedValueDomain`.
 */
export const derivedLogMax = (d: DerivedNode): number => {
  let m = 0
  const walk = (n: DerivedNode): void => {
    m = Math.max(m, Math.log1p(n.value))
    n.children?.forEach(walk)
  }
  walk(d)
  return m
}

// ─────────────────────────────────────────────────────── label truncation ───

/**
 * Truncate a label to fit `avail` px at `fontSize` (monospace ≈ 0.6em/char),
 * appending an ellipsis. Returns '' when nothing fits — the caller then draws no
 * label rather than letting text bleed across tile bounds (MED.KIT-R61 legibility).
 */
export const truncate = (label: string, avail: number, fontSize: number): string => {
  const charW = fontSize * 0.6
  const max = Math.floor(avail / charW)
  if (max <= 0) return ''
  if (label.length <= max) return label
  if (max <= 1) return ''
  return label.slice(0, max - 1) + '…'
}
