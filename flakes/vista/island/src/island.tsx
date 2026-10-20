/**
 * Vista telemetry island (decision 0046). A CLIENT-ONLY React module pre-built
 * into ONE self-contained ESM chunk: React and the Grafana viz subtree are
 * INLINED, zero externals, so plain `react`/`react-dom` imports here AND
 * `@grafana/ui`'s bare `react` imports all bind to the one bundled React. The
 * review host reaches this chunk only through a dynamic `import()` inside a
 * `LazyBlock`, so the host's React and the island's React are separate instances
 * in physically separate graphs.
 *
 * The chunk exports one `mount*` per viz: `mountMetric` (`@grafana/ui` TimeSeries),
 * `mountTrace` (the vendored Jaeger `TraceTimelineViewer`), and `mountFlamegraph`
 * (`@grafana/flamegraph`). They live in THIS one chunk so the ~2.5 MB-gzip Grafana
 * base is paid ONCE; flamegraph only adds its own delta over the shared base. Each
 * `mount*` builds its own island root and installs an island `ErrorBoundary` (a
 * host boundary cannot catch a throw inside a foreign React root).
 */
import {
  applyFieldOverrides,
  CoreApp,
  createDataFrame,
  createTheme,
  dateTime,
  FieldType,
  ThemeContext,
  type DataFrame,
  type TimeRange,
} from '@grafana/data'
// `@grafana/flamegraph`'s `FlameGraph` (a.k.a. FlameGraphContainer): consumes a
// nested-set DataFrame + a `getTheme` prop, renders the flame bars to a canvas.
// Its `@grafana/assistant` peer (the "Analyze with Assistant" button) is aliased to
// a tiny stub in vite.config so the heavy @grafana/scenes/runtime/rxjs closure stays
// out of the chunk — the assistant button is irrelevant for Vista.
import { FlameGraph } from '@grafana/flamegraph'
// The SPECIFIC viz subtree, NOT the `@grafana/ui` barrel (which drags react-aria*
// etc.). `@vista/grafana-timeseries` is a build-time alias (vite.config) to the
// `graveyard/TimeSeries/TimeSeries.mjs` file — the `exports` map blocks the deep
// specifier, so the alias is the seam. Safe only while `@grafana/ui` is pinned
// EXACTLY. Cost is the ~180 KB-gzip subtree over the shared Grafana base.
import { TimeSeries } from '@vista/grafana-timeseries'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import transformTraceData from '../vendor/traceview/components/model/transform-trace-data'
// The vendored Jaeger trace waterfall (decision 0042; vendor/traceview/PROVENANCE.md).
// Only the reachable subset is bundled: the viewer, the OTLP→Jaeger transform, and
// the four prop-feeding hooks the upstream `TraceView.tsx` wires (we replicate just
// the slice that feeds `TraceTimelineViewer`, not the app wrapper).
import TraceTimelineViewer from '../vendor/traceview/components/TraceTimelineViewer'
import { useChildrenState } from '../vendor/traceview/useChildrenState'
import { useDetailState } from '../vendor/traceview/useDetailState'
import { useHoverIndentGuide } from '../vendor/traceview/useHoverIndentGuide'
import { useViewRange } from '../vendor/traceview/useViewRange'
import { flamebearerToNestedSet } from './flamebearer.ts'

/** One PromQL-`matrix`-faithful series (mirrors the `otel` provider QueryResult). */
export interface MetricSeries {
  readonly metric: string
  readonly labels: Record<string, string>
  /** `t` is unix SECONDS (Prometheus); `v` the sample value. */
  readonly samples: ReadonlyArray<{ readonly t: number; readonly v: number }>
}

export interface MountMetricProps {
  readonly title: string
  readonly series: ReadonlyArray<MetricSeries>
}

export interface MountOptions {
  readonly onError?: (err: unknown) => void
}

const theme = createTheme({ colors: { mode: 'dark' } })

/**
 * PromQL-`matrix`→DataFrame adapter (the edge adaptation, decision 0041). Builds a
 * time+number DataFrame from the first series and runs `applyFieldOverrides()` —
 * load-bearing: without it the axis ticks render the literal string `undefined`.
 */
const toFrames = (props: MountMetricProps): DataFrame[] => {
  const samples = props.series[0]?.samples ?? []
  const raw = createDataFrame({
    refId: 'A',
    fields: [
      // Prometheus unix-seconds → ms epoch (Grafana time fields are ms).
      { name: 'time', type: FieldType.time, values: samples.map((s) => s.t * 1000) },
      { name: props.title, type: FieldType.number, values: samples.map((s) => s.v) },
    ],
  })
  return applyFieldOverrides({
    data: [raw],
    theme,
    replaceVariables: (s) => s,
    fieldConfig: { defaults: {}, overrides: [] },
    timeZone: 'browser',
  })
}

class ErrorBoundary extends React.Component<
  { onError?: (e: unknown) => void; children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error)
  }
  render() {
    if (this.state.failed)
      return React.createElement('div', { role: 'alert' }, 'island render failed')
    return this.props.children
  }
}

const MetricPanel = ({ props }: { props: MountMetricProps }) => {
  const frames = toFrames(props)
  const samples = props.series[0]?.samples ?? []
  const fromMs = (samples[0]?.t ?? Date.now() / 1000) * 1000
  const toMs = (samples.at(-1)?.t ?? Date.now() / 1000) * 1000
  const from = dateTime(fromMs)
  const to = dateTime(toMs)
  const timeRange = { from, to, raw: { from, to } }
  return (
    <ThemeContext.Provider value={theme}>
      <div data-testid="telemetry-island" style={{ width: 560, height: 220 }}>
        <TimeSeries
          frames={frames}
          width={560}
          height={220}
          timeRange={timeRange}
          timeZone="browser"
          legend={
            { showLegend: true, displayMode: 'list', placement: 'bottom', calcs: [] } as never
          }
        />
      </div>
    </ThemeContext.Provider>
  )
}

/** Shared mount helper: one island root + boundary per block instance. */
const mountIslandRoot = (
  el: HTMLElement,
  node: React.ReactNode,
  opts: MountOptions,
): (() => void) => {
  const root: Root = createRoot(el)
  // Expose the island's React version so the integration test can assert the
  // island's bundled React and the host React coexist on one page.
  ;(globalThis as Record<string, unknown>).__VISTA_ISLAND_REACT__ = React.version
  root.render(React.createElement(ErrorBoundary, { onError: opts.onError }, node))
  return () => root.unmount()
}

/** Imperative LazyBlock mount for the metric viz. */
export const mountMetric = (
  el: HTMLElement,
  props: MountMetricProps,
  opts: MountOptions = {},
): (() => void) => mountIslandRoot(el, React.createElement(MetricPanel, { props }), opts)

// --- Trace waterfall (vendored Jaeger TraceTimelineViewer) -------------------

/**
 * One OTLP span, faithful to the `trace` provider's flattened `TraceResult.spans`
 * (decision 0041): nano timestamps as strings, base64 span ids, `service.name`
 * carried onto each span, OTLP status code. This is exactly what the kit's
 * `trace` block resolves from its `DataFeed` and hands to `mountTrace`.
 */
export interface TraceSpanInput {
  readonly spanId: string
  /** empty string (or an id absent from the trace) marks a root / orphan. */
  readonly parentSpanId: string
  readonly name: string
  readonly serviceName: string
  readonly kind?: string
  readonly startTimeUnixNano: string
  readonly endTimeUnixNano: string
  /** OTLP status, e.g. `STATUS_CODE_ERROR`; empty when unset. */
  readonly statusCode?: string
  readonly attributes?: ReadonlyArray<{ readonly key: string; readonly value: string }>
  readonly events?: ReadonlyArray<{
    readonly name: string
    readonly timeUnixNano: string
    readonly attributes?: ReadonlyArray<{ readonly key: string; readonly value: string }>
  }>
}

export interface MountTraceProps {
  readonly traceId: string
  readonly title?: string
  readonly spans: ReadonlyArray<TraceSpanInput>
}

const SYNTHETIC_ROOT_ID = '__vista_synthetic_root__'

/** ns string → µs number. BigInt keeps precision at epoch-ns magnitude (> 2^53). */
const nanoToMicros = (nano: string): number => {
  try {
    return Number(BigInt(nano === '' ? '0' : nano) / 1000n)
  } catch {
    return 0
  }
}

/**
 * OTLP → Jaeger `TraceResponse` adapter (decisions 0040/0041), the input
 * `transformTraceData()` wants. Fiddly/lossy conversions:
 *  - ns → µs (`BigInt(nano)/1000n`); sub-µs precision is lost (Jaeger is µs).
 *  - `parentSpanId` → a `references:[{refType:'CHILD_OF',spanID,traceID}]` entry;
 *    a root carries `[]`. `transformTraceData` derives depth / relativeStartTime /
 *    hasChildren / the tree from these — never hand-build those.
 *  - one invented `pN` processID per distinct `service.name`; an empty service name
 *    is tolerated as `unknown` so it still round-trips the `processes` table.
 *  - required fillers `logs`, `flags:1`, numeric `startTime`/`duration`.
 *
 * ROOTLESS / PARTIAL handling lives HERE (decision 0040 — single adapter, no
 * first-party fallback). An orphan is a span whose `parentSpanId` is empty OR
 * points at a span absent from this (partial) trace. When the trace is not a clean
 * single-root tree (zero, or more than one, orphan; or the lone orphan still
 * carries a dangling parent ref), we synthesize ONE placeholder root spanning the
 * full window and repoint every orphan to it — so a partial Tempo trace renders as
 * a bounded waterfall instead of Jaeger's `<trace-without-root-span>` placeholder.
 */
export const otlpToJaeger = (spans: ReadonlyArray<TraceSpanInput>, traceID: string): unknown => {
  const present = new Set(spans.map((s) => s.spanId))
  const isOrphan = (s: TraceSpanInput): boolean =>
    s.parentSpanId === '' || !present.has(s.parentSpanId)
  const orphans = spans.filter(isOrphan)
  const cleanSingleRoot = orphans.length === 1 && orphans[0]!.parentSpanId === ''
  const synthesize = !cleanSingleRoot && spans.length > 0

  const svcToPid = new Map<string, string>()
  const processes: Record<string, { serviceName: string; tags: [] }> = {}
  const pidFor = (serviceNameRaw: string): string => {
    const serviceName = serviceNameRaw === '' ? 'unknown' : serviceNameRaw
    const existing = svcToPid.get(serviceName)
    if (existing !== undefined) return existing
    const pid = `p${svcToPid.size + 1}`
    svcToPid.set(serviceName, pid)
    processes[pid] = { serviceName, tags: [] }
    return pid
  }

  const tagsFor = (s: TraceSpanInput): Array<{ key: string; type: string; value: unknown }> => {
    const tags: Array<{ key: string; type: string; value: unknown }> = (s.attributes ?? []).map(
      (a) => ({ key: a.key, type: 'string', value: a.value }),
    )
    if (s.statusCode === 'STATUS_CODE_ERROR') tags.push({ key: 'error', type: 'bool', value: true })
    return tags
  }
  const logsFor = (s: TraceSpanInput): Array<{ timestamp: number; fields: unknown[] }> =>
    (s.events ?? []).map((e) => ({
      timestamp: nanoToMicros(e.timeUnixNano),
      fields: [
        { key: 'event', type: 'string', value: e.name },
        ...(e.attributes ?? []).map((a) => ({ key: a.key, type: 'string', value: a.value })),
      ],
    }))

  const jaegerSpans = spans.map((s) => {
    const startTime = nanoToMicros(s.startTimeUnixNano)
    const endTime = nanoToMicros(s.endTimeUnixNano)
    const references =
      synthesize && isOrphan(s)
        ? [{ refType: 'CHILD_OF' as const, spanID: SYNTHETIC_ROOT_ID, traceID }]
        : s.parentSpanId !== ''
          ? [{ refType: 'CHILD_OF' as const, spanID: s.parentSpanId, traceID }]
          : []
    return {
      traceID,
      spanID: s.spanId,
      processID: pidFor(s.serviceName),
      operationName: s.name === '' ? '<unnamed>' : s.name,
      startTime,
      duration: Math.max(endTime - startTime, 0),
      logs: logsFor(s),
      flags: 1,
      references,
      tags: tagsFor(s),
    }
  })

  if (synthesize) {
    const starts = jaegerSpans.map((s) => s.startTime)
    const ends = jaegerSpans.map((s) => s.startTime + s.duration)
    const startTime = Math.min(...starts)
    jaegerSpans.push({
      traceID,
      spanID: SYNTHETIC_ROOT_ID,
      processID: pidFor('trace'),
      operationName: '<partial trace — synthesized root>',
      startTime,
      duration: Math.max(Math.max(...ends) - startTime, 1),
      logs: [],
      flags: 1,
      references: [],
      tags: [{ key: 'vista.synthetic_root', type: 'bool', value: true }],
    })
  }

  return { traceID, processes, spans: jaegerSpans }
}

const emptyTraceFrame = createDataFrame({ fields: [] })
const zeroTimeRange: TimeRange = {
  from: dateTime(0),
  to: dateTime(0),
  raw: { from: dateTime(0), to: dateTime(0) },
}

/**
 * The ~45-prop wrapper replicating the slice of upstream `TraceView.tsx` that
 * feeds `TraceTimelineViewer`, driven by the four vendored hooks. `transformTraceData`
 * builds the internal `Trace` (depth/relativeStartTime/hasChildren) from the
 * adapter output; we only own the OTLP→Jaeger edge and this wiring.
 */
const TraceWaterfall = ({ props, scrollEl }: { props: MountTraceProps; scrollEl: Element }) => {
  const detail = useDetailState(emptyTraceFrame as never)
  const children = useChildrenState()
  const view = useViewRange()
  const hover = useHoverIndentGuide()
  const [spanNameColumnWidth, setSpanNameColumnWidth] = React.useState(0.4)
  const [traceFlameGraphs, setTraceFlameGraphs] = React.useState({})
  const [redrawListView, setRedrawListView] = React.useState({})

  const trace = React.useMemo(
    // `as never`: transformTraceData's input type is the full Jaeger TraceResponse;
    // our adapter emits the structurally-required subset it actually reads.
    () => transformTraceData(otlpToJaeger(props.spans, props.traceId) as never),
    [props.spans, props.traceId],
  )

  const traceTimeline = React.useMemo(
    () => ({
      childrenHiddenIDs: children.childrenHiddenIDs,
      detailStates: detail.detailStates,
      hoverIndentGuideIds: hover.hoverIndentGuideIds,
      shouldScrollToFirstUiFindMatch: false,
      spanNameColumnWidth,
      traceID: trace?.traceID,
    }),
    [
      children.childrenHiddenIDs,
      detail.detailStates,
      hover.hoverIndentGuideIds,
      spanNameColumnWidth,
      trace,
    ],
  )

  if (!trace)
    return React.createElement(
      'p',
      { role: 'status', style: { margin: '1em 0' } },
      'no renderable spans in this trace.',
    )

  return React.createElement(TraceTimelineViewer as never, {
    findMatchesIDs: null,
    trace,
    traceTimeline,
    datasourceType: '',
    datasourceUid: '',
    spanBarOptions: undefined,
    updateNextViewRangeTime: view.updateNextViewRangeTime,
    updateViewRangeTime: view.updateViewRangeTime,
    viewRange: view.viewRange,
    timeZone: 'browser',
    setSpanNameColumnWidth,
    collapseAll: children.collapseAll,
    collapseOne: children.collapseOne,
    expandAll: children.expandAll,
    expandOne: children.expandOne,
    childrenToggle: children.childrenToggle,
    detailLogItemToggle: detail.detailLogItemToggle,
    detailLogsToggle: detail.detailLogsToggle,
    detailWarningsToggle: detail.detailWarningsToggle,
    detailStackTracesToggle: detail.detailStackTracesToggle,
    detailReferencesToggle: detail.detailReferencesToggle,
    detailReferenceItemToggle: detail.detailReferenceItemToggle,
    detailProcessToggle: detail.detailProcessToggle,
    detailTagsToggle: detail.detailTagsToggle,
    detailToggle: detail.toggleDetail,
    addHoverIndentGuideId: hover.addHoverIndentGuideId,
    removeHoverIndentGuideId: hover.removeHoverIndentGuideId,
    createSpanLink: undefined,
    scrollElement: scrollEl,
    focusedSpanId: undefined,
    focusedSpanIdForSearch: '',
    showSpanFilterMatchesOnly: false,
    createFocusSpanLink: () => ({
      href: '#',
      title: '',
      target: '_self',
      origin: {},
      onClick: () => undefined,
    }),
    headerHeight: 0,
    criticalPath: [],
    traceFlameGraphs,
    setTraceFlameGraphs,
    redrawListView,
    setRedrawListView,
    timeRange: zeroTimeRange,
    app: CoreApp.Unknown,
  })
}

/**
 * Imperative LazyBlock mount for the trace viz. The mount point is the ListView's
 * scroll container, so it must scroll — `TraceTimelineViewer`'s virtualization
 * reads `scrollElement`.
 */
export const mountTrace = (
  el: HTMLElement,
  props: MountTraceProps,
  opts: MountOptions = {},
): (() => void) => {
  el.style.overflow = 'auto'
  el.setAttribute('data-testid', 'telemetry-island-trace')
  return mountIslandRoot(
    el,
    React.createElement(
      ThemeContext.Provider,
      { value: theme },
      React.createElement(
        'div',
        { style: { minHeight: 240 } },
        React.createElement(TraceWaterfall, { props, scrollEl: el }),
      ),
    ),
    opts,
  )
}

// --- Flamegraph (@grafana/flamegraph) ----------------------------------------

/**
 * One backend-faithful Pyroscope flamebearer (the `pyroscope` provider's
 * `ProfileResult` shape, decision 0041): a `names` table + BFS `levels` (each a
 * flat `[offsetDelta, total, self, nameIndex]` quad list) + `total`/`maxSelf`. This
 * is exactly what the kit's `flamegraph` block resolves from its `DataFeed` and
 * hands to `mountFlamegraph`; the OTLP/PromQL analog for profiles.
 */
export interface FlamebearerInput {
  readonly names: ReadonlyArray<string>
  readonly levels: ReadonlyArray<ReadonlyArray<number>>
  readonly total: number
  readonly maxSelf: number
}

export interface MountFlamegraphProps {
  readonly profileTypeId: string
  readonly title?: string
  readonly flamebearer: FlamebearerInput
  /** Grafana value-field unit (e.g. `ns`, `bytes`, `short`) for axis/tooltip display. */
  readonly unit?: string
}

/**
 * Flamebearer → `@grafana/flamegraph` nested-set DataFrame (the edge adaptation,
 * decision 0041). The tree reconstruction (BFS levels → DFS pre-order rows) is the
 * pure, unit-tested {@link flamebearerToNestedSet}; here we only wrap its rows in
 * the four-field DataFrame (`label`/`level`/`value`/`self`) the component's
 * `FlameGraphDataContainer` looks up by name. `preferredVisualisationType` mirrors
 * the package's own test data; the value/self unit drives the tooltip/axis display.
 */
const toFlameFrame = (props: MountFlamegraphProps): DataFrame => {
  const rows = flamebearerToNestedSet(props.flamebearer)
  const valueConfig = props.unit !== undefined ? { unit: props.unit } : {}
  return createDataFrame({
    name: props.profileTypeId,
    meta: { preferredVisualisationType: 'flamegraph' } as never,
    fields: [
      { name: 'level', type: FieldType.number, values: rows.map((r) => r.level) },
      {
        name: 'value',
        type: FieldType.number,
        values: rows.map((r) => r.value),
        config: valueConfig,
      },
      {
        name: 'self',
        type: FieldType.number,
        values: rows.map((r) => r.self),
        config: valueConfig,
      },
      { name: 'label', type: FieldType.string, values: rows.map((r) => r.label) },
    ],
  })
}

/**
 * `@grafana/flamegraph` sizes itself via `react-virtualized-auto-sizer` /
 * `useMeasure` against its container, so a mount with only a `minHeight` can measure
 * 0 and paint nothing while everything stays green. We give the canvas a CONCRETE
 * height (full width × fixed height), and use `showFlameGraphOnly` so the top table
 * (and its symbol search) is skipped — the flame canvas is the viz Vista wants.
 */
const FlamegraphPanel = ({ props }: { props: MountFlamegraphProps }) => {
  const data = toFlameFrame(props)
  return (
    <ThemeContext.Provider value={theme}>
      <div data-testid="telemetry-island-flamegraph" style={{ width: '100%', height: 360 }}>
        <FlameGraph data={data} getTheme={() => theme} showFlameGraphOnly />
      </div>
    </ThemeContext.Provider>
  )
}

/** Imperative LazyBlock mount for the flamegraph viz. */
export const mountFlamegraph = (
  el: HTMLElement,
  props: MountFlamegraphProps,
  opts: MountOptions = {},
): (() => void) => mountIslandRoot(el, React.createElement(FlamegraphPanel, { props }), opts)
