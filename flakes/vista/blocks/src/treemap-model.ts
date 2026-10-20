/**
 * Treemap MODEL BUILDERS — turn a flat list of path→magnitude leaves into a
 * `TreemapModel` (decision 0055). Pure logic, node-safe: this module imports ONLY
 * the kit TYPES from `./model.ts` (no react / d3-hierarchy / geist / browser
 * globals), so a node-side app module can `import` it during the publish-time
 * projection (decision 0054 / MED.AUTH-R59) without pulling any browser graph.
 *
 * The generic core is {@link buildTreemapModel}: it nests entries on a path
 * separator, sums duplicate paths, and emits a stable tree where every LEAF
 * carries its own `value` + `metrics` and every intermediate directory is a pure
 * container with NO own `value` — the `treemap` block sums descendants via
 * d3-hierarchy, so pre-summing container values into the model would double-count.
 *
 * FULL TREE BY DEFAULT. The `maxDepth` / `foldBelowFraction` knobs are OPT-IN, for
 * frozen size-bounded snapshots only: when set, deeper subtrees and tiny siblings
 * collapse into aggregate leaves whose value + summed metrics EXACTLY preserve the
 * folded totals (MED.KIT-R61). Unset = every node preserved for interactive drill/search.
 *
 * Two adapters feed the core:
 *  - {@link fromGitDiff}: `git diff --numstat` → per-file churn leaves.
 *  - {@link fromDu}: `du -k` cumulative dir sizes → per-dir own-size `(files)`
 *    residual leaves (bytes), the same math as the disk-fixture generator.
 */
import type { TreemapModel, TreemapNode } from './model.ts'

// --- generic core -----------------------------------------------------------

/** One LEAF handed to {@link buildTreemapModel}: path segments, its own magnitude, optional secondary metrics. */
export interface TreemapEntry {
  /** A separator-delimited path, or already-structured segments when separators are valid label text. */
  readonly path: string | readonly string[]
  readonly value: number
  /** Optional secondary dimensions (e.g. `{ insertions, deletions }`) merged additively across duplicate paths. */
  readonly metrics?: Readonly<Record<string, number>>
  /**
   * Optional categorical facets (e.g. `{ provenance: 'generated' }`) — the categorical twin of
   * numeric `metrics`. Assigned on the leaf (last-wins across duplicate paths); a pure container
   * carries none, and a folded/depth-capped aggregate carries only the facets its whole subtree
   * agrees on (unanimous), so an all-generated collapse stays hideable (decision 0068).
   */
  readonly facets?: Readonly<Record<string, string>>
}

/** Options for {@link buildTreemapModel}. The bounding knobs are OPT-IN (see module doc). */
export interface BuildTreemapOptions {
  /** Label for the synthetic root node (default `'root'`). */
  readonly rootLabel?: string
  /** Value unit for formatting, e.g. `'bytes'`, `'lines'`. */
  readonly unit?: string
  /** Human noun for the value in tooltip/detail, e.g. `'size'`, `'churn'`. */
  readonly valueNoun?: string
  /** Path segment separator (default `'/'`). */
  readonly separator?: string
  /**
   * OPT-IN: cap render depth below the root. A container at exactly `maxDepth`
   * collapses to an aggregate leaf carrying its whole subtree's value + metrics
   * (keeps its own label). Unset = full tree.
   */
  readonly maxDepth?: number
  /**
   * OPT-IN: fold sibling subtrees whose aggregate value is below this fraction of
   * their parent's aggregate into a single `"N more"` leaf that preserves the
   * summed value + metrics. Unset = keep every sibling.
   */
  readonly foldBelowFraction?: number
}

/** Mutable build node: `own*` is this path's direct-entry contribution; children are nested paths. */
interface MutableNode {
  readonly id: string
  label: string
  /** Sum of direct entries assigned to this exact path (duplicate-path summing). */
  ownValue: number
  /** True once at least one entry terminates here — i.e. this path is a leaf, not just an intermediate. */
  hasEntry: boolean
  readonly ownMetrics: Record<string, number>
  /** Categorical facets assigned where an entry terminates (last-wins across duplicate paths). */
  readonly ownFacets: Record<string, string>
  readonly children: Map<string, MutableNode>
  /** Memoized subtree aggregate — the tree is not mutated during serialization, so this is safe to cache. */
  agg?: Aggregate
}

const makeNode = (id: string, label: string): MutableNode => ({
  id,
  label,
  ownValue: 0,
  hasEntry: false,
  ownMetrics: {},
  ownFacets: {},
  children: new Map(),
})

const mergeMetricsInto = (
  target: Record<string, number>,
  src: Readonly<Record<string, number>>,
): void => {
  for (const [k, v] of Object.entries(src)) target[k] = (target[k] ?? 0) + v
}

/** Aggregate value + metrics + unanimous facets of a whole subtree; used for sorting and fold-collapse. */
interface Aggregate {
  readonly value: number
  readonly metrics: Record<string, number>
  /** Facets shared by EVERY terminal leaf in the subtree (unanimous); empty if they disagree or lack them. */
  readonly facets: Record<string, string>
}

/**
 * The facets shared by EVERY child aggregate — same key AND value. A key survives only when all
 * children agree, so an all-`generated` folded/depth-capped subtree carries `provenance:'generated'`
 * and stays hideable (decision 0068, MED.BLK.TREE-R73), while a mixed subtree carries none (correctly
 * NOT hidden, since it still contains non-generated leaves).
 */
const unanimousFacets = (aggs: readonly Aggregate[]): Record<string, string> => {
  const first = aggs[0]
  if (first === undefined) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(first.facets)) {
    if (aggs.every((a) => a.facets[k] === v)) out[k] = v
  }
  return out
}

const aggregateOf = (node: MutableNode): Aggregate => {
  if (node.agg !== undefined) return node.agg
  // Terminal leaf: its own facets are trivially unanimous for the singleton subtree.
  if (node.children.size === 0) {
    const result: Aggregate = {
      value: node.ownValue,
      metrics: { ...node.ownMetrics },
      facets: { ...node.ownFacets },
    }
    node.agg = result
    return result
  }
  const metrics: Record<string, number> = { ...node.ownMetrics }
  let value = node.ownValue
  const childAggs: Aggregate[] = []
  for (const child of node.children.values()) {
    const agg = aggregateOf(child)
    value += agg.value
    mergeMetricsInto(metrics, agg.metrics)
    childAggs.push(agg)
  }
  const result: Aggregate = { value, metrics, facets: unanimousFacets(childAggs) }
  node.agg = result
  return result
}

const hasKeys = (r: Readonly<Record<string, number>>): boolean => Object.keys(r).length > 0

/** Assemble build options, adding the opt-in bounding knobs only when set (exactOptionalPropertyTypes). */
const withBounding = (
  base: BuildTreemapOptions,
  maxDepth: number | undefined,
  foldBelowFraction: number | undefined,
): BuildTreemapOptions => {
  const out: { -readonly [K in keyof BuildTreemapOptions]: BuildTreemapOptions[K] } = { ...base }
  if (maxDepth !== undefined) out.maxDepth = maxDepth
  if (foldBelowFraction !== undefined) out.foldBelowFraction = foldBelowFraction
  return out
}

/** A pure leaf node (no children): emit own value + metrics + facets, conditionally (exactOptionalPropertyTypes). */
const leafNode = (
  id: string,
  label: string,
  value: number,
  metrics: Readonly<Record<string, number>>,
  facets: Readonly<Record<string, string>> = {},
): TreemapNode => {
  const out: { -readonly [K in keyof TreemapNode]: TreemapNode[K] } = { id, label }
  out.value = value
  if (hasKeys(metrics)) out.metrics = metrics
  if (Object.keys(facets).length > 0) out.facets = facets
  return out
}

const sortChildren = (nodes: readonly MutableNode[]): MutableNode[] =>
  nodes.toSorted((a, b) => {
    const av = aggregateOf(a).value
    const bv = aggregateOf(b).value
    if (bv !== av) return bv - av
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0
  })

const serialize = (
  node: MutableNode,
  depth: number,
  maxDepth: number | undefined,
  foldBelowFraction: number | undefined,
): TreemapNode => {
  // Pure leaf: no nested paths under it.
  if (node.children.size === 0) {
    return leafNode(node.id, node.label, node.ownValue, node.ownMetrics, node.ownFacets)
  }

  // OPT-IN depth cap: collapse this container to an aggregate leaf (keeps its own label, MED.KIT-R61).
  // The aggregate carries the subtree's unanimous facets so a depth-capped all-generated subtree
  // stays hideable (decision 0068, MED.BLK.TREE-R73).
  if (maxDepth !== undefined && depth >= maxDepth) {
    const agg = aggregateOf(node)
    return leafNode(node.id, node.label, agg.value, agg.metrics, agg.facets)
  }

  const sorted = sortChildren([...node.children.values()])

  let kept = sorted
  let tiny: MutableNode[] = []
  if (foldBelowFraction !== undefined) {
    const threshold = aggregateOf(node).value * foldBelowFraction
    kept = []
    tiny = []
    for (const child of sorted) {
      if (aggregateOf(child).value >= threshold) kept.push(child)
      else tiny.push(child)
    }
  }

  const children: TreemapNode[] = kept.map((child) =>
    serialize(child, depth + 1, maxDepth, foldBelowFraction),
  )

  if (tiny.length > 0) {
    const merged: Record<string, number> = {}
    let value = 0
    const tinyAggs: Aggregate[] = []
    for (const t of tiny) {
      const agg = aggregateOf(t)
      value += agg.value
      mergeMetricsInto(merged, agg.metrics)
      tinyAggs.push(agg)
    }
    // The folded aggregate carries the tiny siblings' unanimous facets, so an all-generated
    // fold stays hideable (decision 0068, MED.BLK.TREE-R73).
    children.push(
      leafNode(
        `${node.id}/__more`,
        `${tiny.length} more`,
        value,
        merged,
        unanimousFacets(tinyAggs),
      ),
    )
  }

  // Container: NO own value — the block sums leaves via d3-hierarchy (do not pre-sum).
  return { id: node.id, label: node.label, children }
}

/**
 * Build a {@link TreemapModel} from a flat list of path→magnitude leaves. Nests
 * entries on `separator`, sums duplicate paths (value + additive metrics), orders
 * children deterministically (aggregate value desc, then label), and preserves
 * every node by default. See {@link BuildTreemapOptions} for the opt-in bounding.
 *
 * Entry paths must be LEAF paths: no path may be a strict prefix of another (e.g.
 * both `a/b` and `a/b/c`). A path that turns into an intermediate directory becomes
 * a pure container and its own `value` is dropped. The adapters never hit this —
 * `fromDu` uses a `(files)` residual suffix and git files can't also be directories.
 *
 * Structured segment arrays are lossless: a segment may itself contain the
 * configured separator. Node ids escape `%` and `/` so those labels cannot
 * collide with an equivalent multi-segment path.
 */
export const buildTreemapModel = (
  entries: readonly TreemapEntry[],
  opts: BuildTreemapOptions = {},
): TreemapModel => {
  const { rootLabel = 'root', unit, valueNoun, separator = '/', maxDepth, foldBelowFraction } = opts

  const root = makeNode('root', rootLabel)
  for (const entry of entries) {
    const path = typeof entry.path === 'string' ? entry.path.split(separator) : entry.path
    const segs = path.filter(Boolean)
    if (segs.length === 0) continue
    let node = root
    let id = 'root'
    for (const seg of segs) {
      const idSegment = seg.replaceAll('%', '%25').replaceAll('/', '%2F')
      id += `/${idSegment}`
      let child = node.children.get(seg)
      if (child === undefined) {
        child = makeNode(id, seg)
        node.children.set(seg, child)
      }
      node = child
    }
    node.hasEntry = true
    node.ownValue += entry.value
    if (entry.metrics !== undefined) mergeMetricsInto(node.ownMetrics, entry.metrics)
    if (entry.facets !== undefined) Object.assign(node.ownFacets, entry.facets)
  }

  const serialized = serialize(root, 0, maxDepth, foldBelowFraction)
  const model: { -readonly [K in keyof TreemapModel]: TreemapModel[K] } = { root: serialized }
  if (unit !== undefined) model.unit = unit
  if (valueNoun !== undefined) model.valueNoun = valueNoun
  return model
}

// --- fromGitDiff -------------------------------------------------------------

/** Which numstat metric drives a file's tile area. */
export type GitDiffValueField = 'insertions' | 'deletions' | 'total'

/** Options for {@link fromGitDiff}. Adds `valueField` + the shared bounding knobs. */
export interface FromGitDiffOptions {
  /** Which metric drives the tile area (default `'total'`). */
  readonly valueField?: GitDiffValueField
  /** Root label (default `'diff'`). */
  readonly rootLabel?: string
  /** Value unit (default `'lines'`). */
  readonly unit?: string
  /** Value noun (default `'lines changed'`). */
  readonly valueNoun?: string
  /** OPT-IN depth cap (see {@link BuildTreemapOptions.maxDepth}). */
  readonly maxDepth?: number
  /** OPT-IN tiny-sibling fold fraction (see {@link BuildTreemapOptions.foldBelowFraction}). */
  readonly foldBelowFraction?: number
}

/**
 * Normalize a git rename path. `git diff --numstat` renders a rename as either
 * `{old => new}/rest`, `dir/{old => new}`, or a whole-path `old => new`; the
 * brace form is replaced in place, and a bare ` => ` (no braces) collapses to the
 * new side.
 */
const normalizeRenamePath = (raw: string): string => {
  const braced = raw.replace(
    /\{([^}]*?) => ([^}]*?)\}/g,
    (_all, _old: string, next: string) => next,
  )
  if (braced.includes(' => ')) {
    const idx = braced.indexOf(' => ')
    return braced.slice(idx + 4)
  }
  // Collapse any `a//b` a rename-with-empty-side can produce.
  return braced.replace(/\/{2,}/g, '/')
}

/**
 * A file's origin classification, derived from git's own attributes at author time
 * (decision 0068). A closed enum at the git-adapter boundary that maps into the
 * generic categorical {@link TreemapNode} `facets`; the treemap component never
 * interprets it.
 */
export type Provenance = 'authored' | 'generated' | 'vendored'

/**
 * One changed file: its churn plus optional origin. The reusable unit the impure
 * author-time git helper emits and {@link fromGitDiff} consumes — a batched
 * `git check-attr linguist-generated` maps `.gitattributes` to `provenance`. An
 * omitted `provenance` (e.g. a file from a bare `numstat` string, or one outside a
 * git repo) is treated as authored and stamps no facet.
 */
export interface FileChange {
  readonly path: string
  readonly insertions: number
  readonly deletions: number
  readonly provenance?: Provenance
}

/**
 * Parse `git diff --numstat` (tab-separated `insertions<TAB>deletions<TAB>path`,
 * rename-normalized) into {@link FileChange}s. Binary files (numstat `-`) are
 * skipped; provenance is unknown from numstat alone, so it is left unset.
 */
const parseNumstat = (numstatText: string): FileChange[] => {
  const changes: FileChange[] = []
  for (const rawLine of numstatText.split('\n')) {
    const line = rawLine.trim()
    if (line === '') continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [insText, delText, ...rest] = parts
    // Binary files show `-` for both counts; they have no line churn to size by.
    if (insText === '-' || delText === '-') continue
    const insertions = Number(insText)
    const deletions = Number(delText)
    if (Number.isNaN(insertions) || Number.isNaN(deletions)) continue
    changes.push({ path: normalizeRenamePath(rest.join('\t')), insertions, deletions })
  }
  return changes
}

/**
 * Build a {@link TreemapModel} where each file is a leaf, from either a raw
 * `git diff --numstat` string (no provenance) or an enriched {@link FileChange}[]
 * (the author-time helper's output, carrying `provenance`). `value` is chosen by
 * `valueField` (default `'total'`); `metrics` always carries `{ insertions,
 * deletions }`; a set `provenance` stamps `facets.provenance` on the leaf so a lens
 * can hide it by default (decision 0068, MED.BLK.TREE-R73).
 */
export const fromGitDiff = (
  input: string | readonly FileChange[],
  opts: FromGitDiffOptions = {},
): TreemapModel => {
  const {
    valueField = 'total',
    rootLabel = 'diff',
    unit = 'lines',
    valueNoun = 'lines changed',
    maxDepth,
    foldBelowFraction,
  } = opts

  const changes = typeof input === 'string' ? parseNumstat(input) : input
  const entries: TreemapEntry[] = changes.map((c) => {
    const value =
      valueField === 'insertions'
        ? c.insertions
        : valueField === 'deletions'
          ? c.deletions
          : c.insertions + c.deletions
    const entry: { -readonly [K in keyof TreemapEntry]: TreemapEntry[K] } = {
      path: c.path,
      value,
      metrics: { insertions: c.insertions, deletions: c.deletions },
    }
    if (c.provenance !== undefined) entry.facets = { provenance: c.provenance }
    return entry
  })

  return buildTreemapModel(
    entries,
    withBounding({ rootLabel, unit, valueNoun }, maxDepth, foldBelowFraction),
  )
}

// --- fromDu ------------------------------------------------------------------

/** Options for {@link fromDu}. */
export interface FromDuOptions {
  /** Root label (default: the du root's basename, or `'du'` for a forest). */
  readonly rootLabel?: string
  /** Value unit (default `'bytes'`). */
  readonly unit?: string
  /** Value noun (default `'size'`). */
  readonly valueNoun?: string
  /** OPT-IN depth cap (see {@link BuildTreemapOptions.maxDepth}). */
  readonly maxDepth?: number
  /** OPT-IN tiny-sibling fold fraction (see {@link BuildTreemapOptions.foldBelowFraction}). */
  readonly foldBelowFraction?: number
}

const KB_TO_BYTES = 1024

/** du paths are always `/`-separated regardless of the model separator. */
const duParent = (path: string): string | undefined => {
  const idx = path.lastIndexOf('/')
  return idx <= 0 ? undefined : path.slice(0, idx)
}

const basename = (path: string): string => {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? path : path.slice(idx + 1)
}

/**
 * Parse `du -k` output (`SIZE_KB<TAB>PATH`, cumulative per directory) into a
 * {@link TreemapModel}. Each directory contributes an OWN-SIZE residual leaf
 * `<dir>/(files)` = `du(dir) − Σ du(listed children)` when positive, in BYTES
 * (`KB × 1024`, so `unit:'bytes'` renders GB/TB). This is the same math as the
 * disk-fixture generator and preserves the exact du total: summing every residual
 * leaf equals the root's cumulative size. When the input has exactly one root, its
 * prefix is stripped so the tree roots at that directory.
 */
export const fromDu = (duText: string, opts: FromDuOptions = {}): TreemapModel => {
  const { rootLabel, unit = 'bytes', valueNoun = 'size', maxDepth, foldBelowFraction } = opts

  const kb = new Map<string, number>()
  for (const rawLine of duText.split('\n')) {
    if (rawLine === '') continue
    const tab = rawLine.indexOf('\t')
    if (tab < 0) continue
    const size = Number(rawLine.slice(0, tab))
    const path = rawLine.slice(tab + 1)
    if (Number.isNaN(size) || path === '') continue
    kb.set(path, size)
  }

  // Children present in the map, keyed by parent path.
  const childrenOf = new Map<string, string[]>()
  const roots: string[] = []
  for (const path of kb.keys()) {
    const parent = duParent(path)
    if (parent !== undefined && kb.has(parent)) {
      const list = childrenOf.get(parent)
      if (list === undefined) childrenOf.set(parent, [path])
      else list.push(path)
    } else {
      roots.push(path)
    }
  }

  const residualKb = (path: string): number => {
    let sum = 0
    for (const c of childrenOf.get(path) ?? []) sum += kb.get(c) ?? 0
    return (kb.get(path) ?? 0) - sum
  }

  // Single-root: strip the prefix so the tree roots at that directory. Otherwise
  // keep full paths under a synthetic root (forest).
  const singleRoot = roots.length === 1 ? roots[0]! : undefined
  const toRelative = (path: string): string =>
    singleRoot === undefined ? path : path === singleRoot ? '' : path.slice(singleRoot.length + 1)

  const entries: TreemapEntry[] = []
  for (const path of kb.keys()) {
    const residual = residualKb(path)
    if (residual <= 0) continue
    const rel = toRelative(path)
    const entryPath = rel === '' ? '(files)' : `${rel}/(files)`
    entries.push({ path: entryPath, value: residual * KB_TO_BYTES })
  }

  const resolvedRootLabel = rootLabel ?? (singleRoot !== undefined ? basename(singleRoot) : 'du')
  return buildTreemapModel(
    entries,
    withBounding({ rootLabel: resolvedRootLabel, unit, valueNoun }, maxDepth, foldBelowFraction),
  )
}
