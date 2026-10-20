/** Genuine typed data models consumed directly by Vista's reusable React components. */
import { Schema } from 'effect'

/** Per-decision status bucket. Exactly one per decision (decision 0019). */
export type DecisionStatus = 'locked' | 'open' | 'awaiting-sign-off'

/** Fork-branch verdict. A separate axis from the decision status bucket. */
export type BranchVerdict = 'chosen' | 'rejected' | 'deferred'

/** Light/dark theme token, mirrored onto `data-theme` on the document root. */
export type Theme = 'light' | 'dark'
/** The canonical fail-closed notice when a snapshot uses an older contract. */
export const snapshotUnsupportedMessage = (found?: number): string =>
  `This published snapshot is skewed or malformed${
    found !== undefined ? ` (snapshot apiVersion ${found})` : ''
  } and can no longer be rendered. It is NOT shown live — a frozen review is a point-in-time copy.`

/** The canonical fail-closed notice when snapshot absence could not be established. */
export const snapshotUnavailableMessage = (): string =>
  'This published snapshot is unavailable. It is NOT shown live because only a confirmed missing snapshot identifies a draft.'

/** The app's shape, selecting the doctrine spine and default block set. */
export type Template =
  | 'architecture-review'
  | 'options-comparison'
  | 'plan-signoff'
  | 'telemetry-exploration'
  | 'code-recap'

/** A recommendation the app wants the reviewer to sign off. */
export interface Recommendation {
  readonly id: string
  readonly title: string
  /** One-line lean: the author's current recommendation. */
  readonly lean: string
  /** In-doc anchor (a block id) to the supporting evidence. */
  readonly evidenceRef?: string
  readonly awaitingSignoff: boolean
}

/** An open question needing a verdict. */
export interface OpenQuestion {
  readonly id: string
  /** Short stable code, e.g. `O-backend-fields`. */
  readonly code: string
  readonly question: string
  readonly lean: string
  readonly evidenceRef?: string
}

/** Fields shared by every fork branch regardless of verdict. */
interface ForkBranchBase {
  readonly id: string
  /** Short label, e.g. `A`. */
  readonly label: string
  readonly name: string
  readonly thesis: string
  /** Why this branch won/lost. */
  readonly why: string
  readonly pros?: readonly string[]
  readonly cons?: readonly string[]
}

/**
 * One branch of a decision-tree fork, discriminated by `verdict`. A `rejected`
 * branch MUST name the shared driver(s) it failed on (decision 0021) — making
 * `failedDrivers` required on that variant is the schema-level guard against
 * alternatives theater. `chosen`/`deferred` branches carry no failed-driver set.
 */
export type ForkBranch =
  | (ForkBranchBase & { readonly verdict: 'chosen' | 'deferred' })
  | (ForkBranchBase & {
      readonly verdict: 'rejected'
      /** The shared driver(s) this rejected branch failed on (decision 0021). */
      readonly failedDrivers: readonly string[]
      /** Optional citation backing a factual rejection; advisory if absent (decision 0021). */
      readonly proofRef?: string
    })

/** A locked decision shown in the collapsed SETTLED section. */
export interface SettledDecision {
  readonly id: string
  readonly title: string
  readonly summary: string
}

/** One option in an `options-grid` comparison. */
export interface OptionCard {
  readonly id: string
  readonly name: string
  readonly pros: readonly string[]
  readonly cons: readonly string[]
  readonly verdict?: string
  readonly recommended?: boolean
}

/** One row in a `responsibilities-table`: an owner and what they own. */
export interface ResponsibilityRow {
  readonly id: string
  readonly owner: string
  readonly responsibility: string
  readonly notes?: string
}

/** One row in an `interfaces-table`: a named signature and its description. */
export interface InterfaceRow {
  readonly id: string
  readonly name: string
  readonly signature: string
  readonly description: string
}

/** The semantic kind of a `callout` block, driving its accent and icon. */
export type CalloutKind = 'finding' | 'tradeoff' | 'constraint' | 'open-question'

// --- diff / file-tree (decision 0024) ---

/** How a `diff` block is authored. A unified-diff/patch string, or an old/new file pair. */
export type DiffSource =
  | { readonly _tag: 'patch'; readonly patch: string }
  | {
      readonly _tag: 'files'
      readonly path: string
      readonly oldContents: string
      readonly newContents: string
    }

/** Initial layout for a diff; the block also exposes a runtime split⇄unified toggle. */
export type DiffView = 'split' | 'unified'

/** Word-level inline-diff granularity passed through to `@pierre/diffs`. */
export type DiffWordLevel = 'word' | 'char' | 'none'

/** Per-path git status, mirrored from `@pierre/trees`' own status vocabulary. */
export type GitStatus = 'added' | 'deleted' | 'ignored' | 'modified' | 'renamed' | 'untracked'

/** One entry in a `file-tree` block: a path plus its git status. */
export interface FileTreeEntry {
  readonly path: string
  readonly status?: GitStatus
}

// --- system-explorer (decision 0018) ---

/** C4-ish containment level; `parent` containment (not this scalar) drives semantic zoom. */
export type SystemLevel = 'context' | 'container' | 'component'

/** A concern dimension. Parallel edges keyed by `aspect` are the multi-dimensionality. */
export type SystemAspect = 'dataflow' | 'controlflow' | 'ownership' | 'telemetry'

/** A node in the typed system graph (system-explorer spike model). */
export interface SystemNode {
  readonly id: string
  readonly label: string
  readonly blurb?: string
  readonly level: SystemLevel
  /** Explicit containment parent — what makes drill / semantic-zoom work. */
  readonly parent?: string
  readonly domain?: string
  readonly lifecycle?: string
  readonly trust?: string
}

/** A directed edge tagged with the concern it belongs to. */
export interface SystemEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly aspect: SystemAspect
  readonly label?: string
}

/** A directly supplied typed system graph. */
export interface SystemModel {
  readonly nodes: readonly SystemNode[]
  readonly edges: readonly SystemEdge[]
}

/** Graph layout direction handed to elk. */
export type SystemLayout = 'layered-right' | 'layered-down'

/**
 * A pure, serializable projection spec: `(model, lens) -> scene` never mutates
 * the model. The default lens is the zero-interaction overview.
 */
export interface SystemLens {
  readonly id: string
  /** Active concern dimensions; a dimension toggle filters edges by aspect. */
  readonly aspects: readonly SystemAspect[]
  /** Semantic-zoom floor: deepest level shown before per-node drill. */
  readonly maxLevel: SystemLevel
  /** Per-node drill overrides that expand one container below the floor. */
  readonly expanded?: readonly string[]
  /** Focus+context: the focused node's neighborhood stays bright, the rest fades. */
  readonly focus?: string
  /** Attribute-mute lens: fade nodes whose `muteBy.key` !== `muteBy.value`. */
  readonly muteBy?: { readonly key: 'lifecycle' | 'trust'; readonly keep: string }
  readonly layout: SystemLayout
}

// --- treemap (value-proportioned hierarchy; decision 0055) ---

/**
 * A node in a value-proportioned hierarchy. A leaf carries its own `value`; a
 * container's magnitude is the sum of its descendants (never authored). `metrics`
 * carries optional secondary dimensions for color encoding (MED.KIT-R60, decision 0055).
 * Self-referential via `children` — the decode schema uses `Schema.suspend`.
 */
export interface TreemapNode {
  readonly id: string
  readonly label: string
  readonly value?: number
  readonly children?: readonly TreemapNode[]
  readonly metrics?: Readonly<Record<string, number>>
  /**
   * Optional categorical facets — the categorical twin of numeric `metrics` (MED.BLK.TREE-R73,
   * decision 0068). A leaf carries its own class labels (e.g. `{ provenance: 'generated' }`);
   * the block never interprets a facet's meaning. Drives group colour and a lens's
   * `hiddenFacets` default-hide. A pure container carries none; a folded/depth-capped aggregate
   * carries only the facets its whole subtree agrees on (unanimous).
   */
  readonly facets?: Readonly<Record<string, string>>
}

/** A directly supplied value-proportioned hierarchy. */
export interface TreemapModel {
  readonly root: TreemapNode
  /** Value unit for formatting, e.g. `'bytes'`, `'lines'` (free-form). */
  readonly unit?: string
  /** Human noun for the value in tooltip/detail, e.g. `'size'`, `'churn'`. */
  readonly valueNoun?: string
}

/** Space-filling layout: area-packed treemap, or depth-on-axis partition (MED.KIT-R63). */
export type TreemapLayout = 'treemap' | 'icicle'

/** How a tile's color encodes meaning — a free restyle, never a relayout (0055). */
export type TreemapColorBy = 'group' | 'depth' | 'value'

/**
 * A pure, serializable projection spec: `(model, lens) -> scene` never mutates
 * the model. The default lens is the zero-interaction overview (MED.KIT-R44).
 */
export interface TreemapLens {
  readonly id: string
  readonly layout: TreemapLayout
  /** Render-depth cap below the current zoom root; deeper subtrees summarize. */
  readonly maxDepth?: number
  readonly colorBy?: TreemapColorBy
  /** Zero-interaction zoom root id (defaults to the model root). */
  readonly rootId?: string
  /** Fold siblings below this fraction of the parent into a "+N more" aggregate. */
  readonly minAreaPct?: number
  /**
   * Facet values hidden by default, e.g. `{ provenance: ['generated'] }` (MED.BLK.TREE-R73,
   * decision 0068). Seeds the exclusion filter once (leaves whose `facets[key]` matches a listed
   * value): hidden nodes stay counted, drillable, searchable, and revealed via the "N hidden"
   * filter, so the completeness guarantee (MED.BLK.TREE-R61) holds. A lens without `hiddenFacets`
   * hides nothing.
   */
  readonly hiddenFacets?: Readonly<Record<string, readonly string[]>>
}

// --- telemetry trace (Grafana island; decisions 0040/0042/0046) ---

/**
 * A single OTLP key/value attribute (decision 0041, LENIENT): queried OTLP
 * attributes come from arbitrary instrumentation and legitimately violate
 * otel-contract's strict emission scalars, so both `key` and `value` decode as
 * plain `Schema.String` (NOT `OtelAttributeKey`) — tightening would REJECT valid
 * lenient payloads.
 */
const TraceAttribute = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
}).annotate({ identifier: 'Vista.TraceAttribute' })

/** One OTLP span event — a timestamped annotation. `timeUnixNano` is a string. */
export const TraceSpanEvent = Schema.Struct({
  name: Schema.String,
  timeUnixNano: Schema.String,
  attributes: Schema.optionalKey(Schema.Array(TraceAttribute)),
}).annotate({ identifier: 'Vista.TraceSpanEvent' })
export type TraceSpanEvent = typeof TraceSpanEvent.Type

/**
 * One span of an OTLP-faithful trace (decision 0041) — exactly the `trace`
 * provider's flattened `TraceResult.spans` shape, and what the island's
 * `mountTrace` adapts to the Jaeger model. Nano timestamps are strings; an empty
 * `parentSpanId` (or one absent from the trace) marks a root / orphan — the
 * island's single adapter synthesizes a placeholder root for partial traces
 * (decision 0040, no first-party fallback).
 */
export const TraceSpan = Schema.Struct({
  spanId: Schema.String,
  parentSpanId: Schema.String,
  name: Schema.String,
  serviceName: Schema.String,
  kind: Schema.optionalKey(Schema.String),
  // Nano timestamps arrive as JSON strings (int64, decision 0041) — plain `Schema.String`.
  startTimeUnixNano: Schema.String,
  endTimeUnixNano: Schema.String,
  /** OTLP status code, e.g. `STATUS_CODE_ERROR`; empty when unset. */
  statusCode: Schema.optionalKey(Schema.String),
  attributes: Schema.optionalKey(Schema.Array(TraceAttribute)),
  events: Schema.optionalKey(Schema.Array(TraceSpanEvent)),
}).annotate({ identifier: 'Vista.TraceSpan' })
export type TraceSpan = typeof TraceSpan.Type

/**
 * Payload a `trace` block resolves from its `DataFeed` (decision 0026) — an
 * OTLP-faithful flat span list (the `trace` provider's `TraceResult`). The
 * consumer's data source closes over the frozen-decode-vs-live-`getTrace` logic;
 * the block only renders the spans through the telemetry island's `mountTrace`.
 */
export const TraceData = Schema.Struct({
  traceId: Schema.String,
  spans: Schema.Array(TraceSpan),
}).annotate({ identifier: 'Vista.TraceData' })
export type TraceData = typeof TraceData.Type

// --- telemetry metric (Grafana island; decisions 0040/0046) ---

/**
 * Prometheus sample values are legitimately `NaN`/`+Inf`/`-Inf`, so this is a
 * `Schema.declare` typeof-number guard on purpose: `Schema.Finite` would reject real
 * backend payloads. Mirrors `PrometheusSampleValue` in the service's `otel.provider.ts`,
 * and the two MUST stay semantically aligned.
 */
const PrometheusSampleValue = Schema.declare(
  (value): value is number => typeof value === 'number',
  {
    identifier: 'Vista.PrometheusSampleValue',
  },
)

/**
 * One PromQL-`matrix`-faithful metric series — the otel provider's success shape
 * (decision 0041), and exactly what the island's `mountMetric` consumes.
 */
export const MetricSeries = Schema.Struct({
  metric: Schema.String,
  labels: Schema.Record(Schema.String, Schema.String),
  /** `t` is unix seconds; Prometheus sample values can be finite, `NaN`, or infinite. */
  samples: Schema.Array(Schema.Struct({ t: Schema.Finite, v: PrometheusSampleValue })),
}).annotate({ identifier: 'Vista.MetricSeries' })
export type MetricSeries = typeof MetricSeries.Type

/**
 * Payload a `metric` block resolves from its `DataFeed` (decision 0026). The
 * consumer's data source closes over the frozen-decode-vs-live-fetch logic; the
 * block only renders the resulting series through the telemetry island.
 */
export const MetricData = Schema.Struct({
  series: Schema.Array(MetricSeries),
}).annotate({ identifier: 'Vista.MetricData' })
export type MetricData = typeof MetricData.Type

// --- telemetry flamegraph (Grafana island; decisions 0040/0041/0046) ---

/**
 * Payload a `flamegraph` block resolves from its `DataFeed` (decision 0026) — the
 * `pyroscope` provider's backend-faithful flamebearer (decision 0041): a `names`
 * table + BFS `levels` (each a flat `[offsetDelta, total, self, nameIndex]` quad
 * list) + `total`/`maxSelf`. The island's `mountFlamegraph` reconstructs the call
 * tree from this and adapts it to the `@grafana/flamegraph` nested-set DataFrame;
 * the block only renders it (the profiles analog of `MetricData`/`TraceData`).
 */
export const ProfileData = Schema.Struct({
  profileTypeId: Schema.String,
  names: Schema.Array(Schema.String),
  // Flamebearer quads and totals are plain numbers per the interface contract (decision 0041).
  levels: Schema.Array(Schema.Array(Schema.Finite)),
  total: Schema.Finite,
  maxSelf: Schema.Finite,
  /** Grafana value-field unit (e.g. `ns`, `bytes`, `short`) for display; optional. */
  unit: Schema.optionalKey(Schema.String),
}).annotate({ identifier: 'Vista.ProfileData' })
export type ProfileData = typeof ProfileData.Type

// --- charts ---

/**
 * Union of semantic visual intents used to color a chart series as neutral, success, warning,
 * error, or informational.
 */
export type ChartIntent = 'neutral' | 'success' | 'warning' | 'error' | 'info'
/**
 * Union of the Cartesian chart renderings supported by the chart component: plain or stacked line,
 * area, and bar forms.
 */
export type ChartKind = 'line' | 'area' | 'bar' | 'stacked-area' | 'stacked-bar'

/**
 * Describes one plottable series by stable key, display label, and optional visual intent, where
 * the key matches entries in each datum's values record.
 */
export interface ChartSeries {
  readonly key: string
  readonly label: string
  readonly intent?: ChartIntent
}

/** Generic Recharts-backed Cartesian chart payload. Values are keyed by series key. */
export interface ChartDatum {
  readonly label: string
  readonly values: Readonly<Record<string, number>>
}

/**
 * Complete render contract for a Recharts-backed Cartesian chart, combining title, chart kind,
 * optional axis labels, series definitions, keyed data points, and an optional unit suffix.
 */
export interface ChartSpec {
  readonly title: string
  readonly description?: string
  readonly kind: ChartKind
  readonly xLabel?: string
  readonly yLabel?: string
  readonly series: readonly ChartSeries[]
  readonly data: readonly ChartDatum[]
  readonly unit?: string
}

/** Typed payload for a GitHub preview composed from diff and file-tree views. */
export interface GhPreview {
  readonly kind: 'pull-request' | 'issue'
  readonly number: number
  readonly title: string
  readonly url: string
  readonly author: string
  readonly state: string
  readonly body?: string
  /** Changed files: a unified-diff patch + per-file git status. */
  readonly files: readonly {
    readonly path: string
    readonly status: GitStatus
    /** Unified-diff patch for this file (drives the embedded `diff` block). */
    readonly patch?: string
  }[]
}
