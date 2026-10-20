import * as React from 'react'

import type { AgentTimelineHorizon, AgentTimelineModel } from '@overeng/agent-timeline/model'
import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import type { Expansion } from './blocks/agent-timeline/state.ts'
import { type DataFeed, type DataLoadState } from './data-feed.ts'
import {
  availableValue,
  bind,
  bindingFailureMessage,
  BindingFailureDiagnostic,
  type BindingResult,
  useBindingContext,
} from './data-query.tsx'
import { type InterviewQuestionProps, useVistaHostRuntime } from './host-runtime.tsx'
import {
  agentTimeline,
  diskIndex,
  type DiskIndexHost as DiskIndexHostName,
  type DiskPerspective,
  gh,
  type MetricRange,
  type MetricSnapshot,
  otel,
  overview,
  type PrSummary,
  pyroscope,
  type SearchResult,
  trace,
  type TreemapArgs,
  type TreemapOutcome,
  type Overview,
} from './provider-contracts.ts'

// Visual realizations stay out of the Node semantic evaluator. The browser loads
// them only after the binding has been collected and extraction is known to be off.
const MetricBlock = React.lazy(() =>
  import('./blocks/MetricBlock.tsx').then((module) => ({ default: module.MetricBlock })),
)
const TraceBlock = React.lazy(() =>
  import('./blocks/TraceBlock.tsx').then((module) => ({ default: module.TraceBlock })),
)
const FlamegraphBlock = React.lazy(() =>
  import('./blocks/FlamegraphBlock.tsx').then((module) => ({ default: module.FlamegraphBlock })),
)
const Treemap = React.lazy(() =>
  import('./blocks/treemap/Treemap.tsx').then((module) => ({ default: module.Treemap })),
)
const AgentTimeline = React.lazy(() =>
  import('./blocks/agent-timeline/AgentTimeline.tsx').then((module) => ({ default: module.AgentTimeline })),
)

type ReactNode = React.ReactNode

const dataFeedFor = <TValue, TError>(result: BindingResult<TValue, TError>): DataFeed<TValue> => {
  const resolved = availableValue(result)
  const state: DataLoadState<TValue> =
    resolved !== undefined
      ? { _tag: 'loaded', value: resolved.value }
      : result._tag === 'Failure'
        ? { _tag: 'error', message: bindingFailureMessage(result) }
        : { _tag: 'loading' }
  return {
    mode: resolved?._tag === 'Live' ? 'live' : 'frozen',
    fetch: async () => state,
  }
}

/**
 * Adapts a metric binding result into a DataFeed exposing only the snapshot's series, reporting a
 * degraded state when the binding failed but previously resolved data is still available.
 */
export const metricFeedFor = <TError,>(
  result: BindingResult<MetricSnapshot, TError>,
): DataFeed<{ readonly series: MetricSnapshot['result']['series'] }> => {
  const resolved = availableValue(result)
  const value = resolved === undefined ? undefined : { series: resolved.value.result.series }
  const state: DataLoadState<{ readonly series: MetricSnapshot['result']['series'] }> =
    result._tag === 'Failure' && value !== undefined && resolved !== undefined
      ? {
          _tag: 'degraded',
          value,
          message: bindingFailureMessage(result),
          lastSuccessAt: resolved._tag === 'Live' ? resolved.observedAt : resolved.frozenAt,
        }
      : value !== undefined
        ? { _tag: 'loaded', value }
        : result._tag === 'Failure'
          ? { _tag: 'error', message: bindingFailureMessage(result) }
          : { _tag: 'loading' }
  return {
    mode: resolved?._tag === 'Live' ? 'live' : 'frozen',
    fetch: async () => state,
  }
}

const formatMetricInstant = (seconds: number): string => new Date(seconds * 1_000).toISOString()

const formatRequestedMetricRange = (range: MetricRange): string =>
  range.kind === 'relative'
    ? `last ${range.last}`
    : `${formatMetricInstant(range.start)} → ${formatMetricInstant(range.end)}`

/** Viewer-facing proof that authored intent, queried interval, and actual samples agree. */
export const metricRangeSummary = (snapshot: MetricSnapshot): string => {
  const sampleTimes = snapshot.result.series.flatMap((series) =>
    series.samples.map((sample) => sample.t),
  )
  const sampled =
    sampleTimes.length === 0
      ? 'samples none'
      : `samples ${formatMetricInstant(Math.min(...sampleTimes))} → ${formatMetricInstant(Math.max(...sampleTimes))}`
  return [
    `requested ${formatRequestedMetricRange(snapshot.requestedRange)}`,
    `resolved ${formatMetricInstant(snapshot.resolvedRange.start)} → ${formatMetricInstant(snapshot.resolvedRange.end)}`,
    sampled,
    `${String(snapshot.stepSeconds)}s step`,
    `${String(snapshot.points)} point cap`,
  ].join(' · ')
}

const ValueView = <TValue, TError>({
  result,
  render,
}: {
  readonly result: BindingResult<TValue, TError>
  readonly render?: (value: TValue) => ReactNode
}): ReactNode => {
  const resolved = availableValue(result)
  if (resolved === undefined) {
    return result._tag === 'Failure' ? (
      <div role="alert">
        <p>error: {bindingFailureMessage(result)}</p>
        <BindingFailureDiagnostic result={result} />
      </div>
    ) : (
      <p role="status">loading…</p>
    )
  }
  return render === undefined ? (
    <pre>{JSON.stringify(resolved.value, null, 2)}</pre>
  ) : (
    render(resolved.value)
  )
}

/**
 * Props for the overview block: the repo and pull-request number identifying the PR, plus an
 * optional render override for the fetched Overview.
 */
export interface PullRequestOverviewProps {
  readonly repo: string
  readonly pr: number
  readonly render?: (overview: Overview) => ReactNode
}

/**
 * Binds the overview fetch to the given repo and PR, subscribes through the binding context, and
 * renders the Overview via ValueView unless a custom render callback is supplied.
 */
export const PullRequestOverview = ({ repo, pr, render }: PullRequestOverviewProps): ReactNode => {
  const binding = React.useMemo(() => bind(overview.ops.get, { repo, pr }), [repo, pr])
  const { result } = useBindingContext(binding)
  return <ValueView result={result} {...(render === undefined ? {} : { render })} />
}

/**
 * Props for the changed-files block: the repo and pull-request number plus an optional render
 * callback that receives the PrSummary.
 */
export interface PullRequestFilesProps {
  readonly repo: string
  readonly pr: number
  readonly render?: (summary: PrSummary) => ReactNode
}

/**
 * Binds the frozen changed-files operation to the given repo and PR, then renders the resulting
 * PrSummary through ValueView, honoring an optional custom renderer.
 */
export const PullRequestFiles = ({ repo, pr, render }: PullRequestFilesProps): ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        gh.ops.changedFiles,
        { repo, pr },
        {
          mode: 'frozen',
          effectfulCapture: 'acknowledged',
        },
      ),
    [repo, pr],
  )
  const { result } = useBindingContext(binding)
  return <ValueView result={result} {...(render === undefined ? {} : { render })} />
}

const DEFAULT_METRIC_RANGE: MetricRange = { kind: 'relative', last: '1h' }

/**
 * Props selecting a metric query and its presentation: query text, time range and step/points
 * resolution, frozen or live mode with optional refresh interval, and optional widget id, title,
 * and caption.
 */
export interface MetricQueryProps {
  readonly id?: string
  readonly query: string
  readonly range?: MetricRange
  readonly stepSeconds?: number
  readonly points?: number
  readonly mode?: 'frozen' | 'live'
  readonly refreshEvery?: number
  readonly title?: string
  readonly caption?: string
}

/**
 * Binds the metric snapshot operation with defaults (60s step, 61 points, frozen mode, default
 * range) and renders the resulting series through a feed, polling at refreshEvery when live mode
 * is chosen.
 */
export const MetricQuery = ({
  id,
  query,
  range = DEFAULT_METRIC_RANGE,
  stepSeconds = 60,
  points = 61,
  mode = 'frozen',
  refreshEvery,
  title,
  caption,
}: MetricQueryProps): ReactNode => {
  const { telemetry } = useVistaHostRuntime()
  const binding = React.useMemo(
    () =>
      bind(
        otel.ops.query,
        { promql: query, range, stepSeconds, points },
        mode === 'live'
          ? {
              mode: 'live',
              effectfulCapture: 'acknowledged',
              ...(refreshEvery === undefined ? {} : { refreshEvery }),
            }
          : { mode: 'frozen', effectfulCapture: 'acknowledged' },
      ),
    [mode, points, query, range, refreshEvery, stepSeconds],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  const resolved = availableValue(result)
  const source = React.useMemo(() => metricFeedFor(result), [result])
  if (extracting) return undefined
  return (
    <React.Suspense
      fallback={
        <p role="status">
          {resolved === undefined
            ? 'loading metric…'
            : `${resolved._tag === 'Live' ? 'Live metric refresh' : 'Frozen metric snapshot'} · ${metricRangeSummary(resolved.value)} · loading visualization…`}
        </p>
      }
    >
      <MetricBlock
        id={id ?? `${semanticId}-metric`}
        title={title ?? query}
        {...(resolved === undefined ? {} : { meta: metricRangeSummary(resolved.value) })}
        {...(caption === undefined ? {} : { caption })}
        dataFeed={source}
        {...(telemetry === undefined ? {} : { island: telemetry })}
      />
    </React.Suspense>
  )
}
const DISK_TREEMAP_LENSES = [
  { id: 'disk', layout: 'treemap', maxDepth: 5, colorBy: 'group', minAreaPct: 0.002 },
] as const

/**
 * Props for the disk treemap presenter: a stable widget id and the TreemapOutcome to display,
 * whose failure and degraded variants are surfaced in place of the model.
 */
export interface DiskTreemapViewProps {
  readonly id: string
  readonly outcome: TreemapOutcome
}

/**
 * Renders an alert for hard failures, a status note listing reasons for degraded partial indexes,
 * and otherwise suspends around a Treemap mounted with the disk lenses.
 */
export const DiskTreemapView = ({ id, outcome }: DiskTreemapViewProps): ReactNode => {
  if (outcome._tag === 'failure') {
    return (
      <p role="alert">
        {outcome.reason}: {outcome.message}
      </p>
    )
  }
  return (
    <>
      {outcome._tag === 'degraded' ? (
        <aside role="status">Partial disk index: {outcome.reasons.join('; ')}</aside>
      ) : null}
      <React.Suspense fallback={<p role="status">loading treemap…</p>}>
        <Treemap id={id} model={outcome.value} lenses={DISK_TREEMAP_LENSES} />
      </React.Suspense>
    </>
  )
}

/**
 * Props for the disk treemap: an optional widget id, a declared host, the DiskPerspective,
 * the boundaryId scoping the indexed tree, and an optional lens override forwarded to the fetch.
 */
export interface DiskTreemapProps {
  readonly id?: string
  readonly host: DiskIndexHostName
  readonly perspective: DiskPerspective
  readonly boundaryId: string
  readonly lens?: TreemapArgs['lens']
}

/**
 * Binds the frozen treemap fetch for the given host, perspective, boundary, and optional lens, then
 * delegates presentation of the resulting outcome to DiskTreemapView.
 */
export const DiskTreemap = ({ id, host, perspective, boundaryId, lens }: DiskTreemapProps): ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        diskIndex.ops.treemap,
        { host, perspective, boundaryId, ...(lens === undefined ? {} : { lens }) },
        { mode: 'frozen', effectfulCapture: 'acknowledged' },
      ),
    [host, boundaryId, lens, perspective],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  const resolved = availableValue(result)
  if (extracting) return undefined
  if (resolved === undefined) {
    return result._tag === 'Failure' ? (
      <p role="alert">error: {bindingFailureMessage(result)}</p>
    ) : (
      <p role="status">loading disk treemap…</p>
    )
  }
  return <DiskTreemapView id={id ?? `${semanticId}-disk-treemap`} outcome={resolved.value} />
}

/** Server-backed trace source and React Aria-style expansion controls. */
export interface AgentTimelineQueryProps {
  readonly horizon: AgentTimelineHorizon
  /** Canonical agent IDs; when set, the trace shows their root sessions instead of the top roots. */
  readonly actors?: ReadonlyArray<string>
  /**
   * tmux session name (e.g. `dotfiles/misc`); when set, the trace shows the roots of the agents
   * attached to that session's panes. Mutually exclusive with `actors`.
   */
  readonly tmuxSession?: string
  readonly mode?: 'frozen' | 'live'
  readonly refreshEvery?: number
  readonly expandedKeys?: Expansion
  readonly defaultExpandedKeys?: Expansion
  readonly onExpandedChange?: (keys: Expansion) => void
}

/** Server-backed Agent Timeline block over the host OMP Usage ledger. */
export const AgentTimelineQuery = ({
  horizon,
  actors,
  tmuxSession,
  mode = 'frozen',
  refreshEvery,
  expandedKeys,
  defaultExpandedKeys,
  onExpandedChange,
}: AgentTimelineQueryProps): ReactNode => {
  const actorKey = actors === undefined ? undefined : actors.join('\n')
  const traceKey = `${actorKey ?? ''}\u0000${tmuxSession ?? ''}`
  const binding = React.useMemo(
    () =>
      bind(
        agentTimeline.ops.load,
        {
          horizon,
          ...(actorKey === undefined ? {} : { actors: actorKey.split('\n') }),
          ...(tmuxSession === undefined ? {} : { tmuxSession }),
        },
        mode === 'live'
          ? {
              mode: 'live',
              effectfulCapture: 'acknowledged',
              ...(refreshEvery === undefined ? {} : { refreshEvery }),
            }
          : { mode: 'frozen', effectfulCapture: 'acknowledged' },
      ),
    [horizon, actorKey, tmuxSession, mode, refreshEvery],
  )
  const { extracting, result } = useBindingContext(binding)
  const resolved = availableValue(result)
  const model: AgentTimelineModel | undefined = resolved?.value
  const scene = React.useMemo(
    () => (model === undefined ? undefined : projectAgentTimeline(model)),
    [model],
  )
  if (extracting) return undefined
  if (scene === undefined) {
    return result._tag === 'Failure' ? (
      <div role="alert">
        <p>error: {bindingFailureMessage(result)}</p>
        <BindingFailureDiagnostic result={result} />
      </div>
    ) : (
      <p role="status">loading agent timeline…</p>
    )
  }
  return (
    <>
      {mode === 'live' && resolved?._tag !== 'Live' ? (
        <aside role="status">Showing an older captured trace while live data refreshes…</aside>
      ) : null}
      {result._tag === 'Failure' ? (
        <aside role="status">
          Agent timeline refresh failed; showing the last available trace:{' '}
          {bindingFailureMessage(result)}
        </aside>
      ) : null}
      <React.Suspense fallback={<p role="status">loading agent timeline view…</p>}>
        <AgentTimeline
          key={traceKey}
          scene={scene}
          {...(expandedKeys === undefined ? {} : { expandedKeys })}
          {...(defaultExpandedKeys === undefined ? {} : { defaultExpandedKeys })}
          {...(onExpandedChange === undefined ? {} : { onExpandedChange })}
        />
      </React.Suspense>
    </>
  )
}

/**
 * Props for the single-trace view: the traceId to fetch plus optional widget id and title/caption
 * text.
 */
export interface TraceQueryProps {
  readonly id?: string
  readonly traceId: string
  readonly title?: string
  readonly caption?: string
}

/**
 * Binds the frozen getTrace operation to the traceId, bridges the result into a DataFeed
 * (rendering nothing while extracting), and presents the trace with optional title and caption.
 */
export const TraceQuery = ({ id, traceId, title, caption }: TraceQueryProps): ReactNode => {
  const { telemetry } = useVistaHostRuntime()
  const binding = React.useMemo(
    () =>
      bind(
        trace.ops.getTrace,
        { traceId },
        {
          mode: 'frozen',
          effectfulCapture: 'acknowledged',
        },
      ),
    [traceId],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  const source = React.useMemo(() => dataFeedFor(result), [result])
  if (extracting) return undefined
  return (
    <React.Suspense fallback={<p role="status">loading trace…</p>}>
      <TraceBlock
        id={id ?? `${semanticId}-trace`}
        traceId={traceId}
        {...(title === undefined ? {} : { title })}
        {...(caption === undefined ? {} : { caption })}
        dataFeed={source}
        {...(telemetry === undefined ? {} : { island: telemetry })}
      />
    </React.Suspense>
  )
}

/**
 * Props for trace search: the query text, an optional result limit (default 20), and an optional
 * render callback for each SearchResult.
 */
export interface TraceSearchProps {
  readonly query: string
  readonly limit?: number
  readonly render?: (result: SearchResult) => ReactNode
}

/**
 * Binds the frozen searchTraces operation to the query and limit, then renders the results through
 * ValueView unless a custom renderer is supplied.
 */
export const TraceSearch = ({ query, limit = 20, render }: TraceSearchProps): ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        trace.ops.searchTraces,
        { query, limit },
        {
          mode: 'frozen',
          effectfulCapture: 'acknowledged',
        },
      ),
    [query, limit],
  )
  const { result } = useBindingContext(binding)
  return <ValueView result={result} {...(render === undefined ? {} : { render })} />
}

/**
 * Props for the profile query: the profile type id, an optional label selector, from/until time
 * bounds, and optional widget id, title, and caption.
 */
export interface ProfileQueryProps {
  readonly id?: string
  readonly profileTypeId: string
  readonly labelSelector?: string
  readonly from: number
  readonly until: number
  readonly title?: string
  readonly caption?: string
}

/**
 * Renders a single profiling result for the given profile type, label selector, and time range by
 * binding to the provider's getProfile operation in frozen (fetch-once) mode.
 */
export const ProfileQuery = ({
  id,
  profileTypeId,
  labelSelector = '{}',
  from,
  until,
  title,
  caption,
}: ProfileQueryProps): ReactNode => {
  const { telemetry } = useVistaHostRuntime()
  const binding = React.useMemo(
    () =>
      bind(
        pyroscope.ops.getProfile,
        { profileTypeId, labelSelector, from, until },
        {
          mode: 'frozen',
          effectfulCapture: 'acknowledged',
        },
      ),
    [profileTypeId, labelSelector, from, until],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  const source = React.useMemo(() => dataFeedFor(result), [result])
  if (extracting) return undefined
  return (
    <React.Suspense fallback={<p role="status">loading profile…</p>}>
      <FlamegraphBlock
        id={id ?? `${semanticId}-profile`}
        profileTypeId={profileTypeId}
        {...(title === undefined ? {} : { title })}
        {...(caption === undefined ? {} : { caption })}
        dataFeed={source}
        {...(telemetry === undefined ? {} : { island: telemetry })}
      />
    </React.Suspense>
  )
}

export type { InterviewQuestionProps } from './host-runtime.tsx'

/** Service-backed decision question for use inside a RuntimeIsland; the host must provide it. */
export const InterviewQuestion = (props: InterviewQuestionProps): ReactNode => {
  const { InterviewQuestion: Runtime } = useVistaHostRuntime()
  if (Runtime === undefined)
    return <p role="status">decision questions are not available in this host</p>
  return (
    <React.Suspense fallback={<p role="status">loading question…</p>}>
      <Runtime {...props} />
    </React.Suspense>
  )
}
