import { Effect, Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'

import { AgentTimelineHorizonSchema, AgentTimelineModelSchema } from '@overeng/agent-timeline/model'
export { AgentTimelineHorizonSchema, AgentTimelineModelSchema }

import { contract, Cursor, subscription } from './data-contract.ts'
export {
  decodeSnapshotText,
  degradedReasons,
  DISK_INDEX_HOSTS,
  DISK_INDEX_SCHEMA_VERSION,
  DiskAttemptStatus,
  DiskBoundary,
  DiskClaimClass,
  DiskClaimDomain,
  DiskClaimScope,
  DiskFacetRefreshStatus,
  DiskFacetRefreshSummary,
  DiskFacetRow,
  DiskFreshness,
  DiskHealth,
  DiskHealthStatus,
  DiskIndexHost,
  DiskIndexApi,
  DiskIndexError,
  DiskIndexErrorReason,
  DiskPerspective,
  DiskPoolParticipant,
  DiskProjection,
  DiskRefreshAttempt,
  DiskResidualReason,
  DiskRowOwnership,
  DiskRowStatus,
  DiskSnapshot,
  DiskUsageGroup,
  groupIdentityFor,
  groupKeyFor,
  Outcome,
  perspectiveLabel,
  projectPerspective,
  TreemapArgs,
  TreemapLens,
  TreemapOutcome,
  unknownBoundaryError,
  type WireBoundary,
  type WireFacetRow,
  type WireSnapshot,
} from './disk-index-contract.ts'
import { DiskIndexApi } from './disk-index-contract.ts'
export { buildTreemapModel } from './treemap-model.ts'

/**
 * Tagged error schema whose OverviewError failures carry a human-readable message when overview
 * retrieval fails.
 */
export class OverviewError extends Schema.TaggedError<OverviewError>()('OverviewError', {
  message: Schema.String,
}) {}
/**
 * Schema class validating a pull request overview for a repository, including PR number,
 * changed-file and diff counts, and a verdict string.
 */
export class Overview extends Schema.Class<Overview>('Overview')({
  repo: Schema.String,
  pr: Schema.Finite,
  changedFiles: Schema.Finite,
  additions: Schema.Finite,
  deletions: Schema.Finite,
  verdict: Schema.String,
}) {}
/**
 * RPC group exposing a single get method that resolves an Overview for a given repo and PR number
 * or fails with OverviewError.
 */
export const OverviewApi = RpcGroup.make(
  Rpc.make('get', {
    payload: { repo: Schema.String, pr: Schema.Finite },
    success: Overview,
    error: OverviewError,
  }),
)

/**
 * Tagged error schema used by GhApi handlers to surface GitHub provider failures together with a
 * descriptive message.
 */
export class GhError extends Schema.TaggedError<GhError>()('GhError', {
  message: Schema.String,
}) {}

const PullRequestNumber = Schema.Int.check(Schema.isGreaterThan(0))
const Repository = Schema.String.check(Schema.isPattern(/^[^/\s]+\/[^/\s]+$/u))
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PullRequestArgs = Schema.Struct({
  repo: Repository,
  pr: PullRequestNumber,
}).annotate({
  identifier: 'Vista.Gh.PullRequestArgs',
})

/**
 * Struct schema describing one changed file in a pull request, including status, optional patch
 * and before/after contents, diff counts, and provenance, while rejecting unknown properties.
 */
export const PullRequestFile = Schema.Struct({
  path: Schema.String,
  status: Schema.Literals(['added', 'deleted', 'ignored', 'modified', 'renamed', 'untracked']),
  previousPath: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  patch: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  oldContents: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  newContents: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  additions: Schema.optionalKey(Schema.UndefinedOr(NonNegativeInt)),
  deletions: Schema.optionalKey(Schema.UndefinedOr(NonNegativeInt)),
  provenance: Schema.optionalKey(
    Schema.UndefinedOr(Schema.Literals(['authored', 'generated', 'vendored'])),
  ),
}).annotate({
  identifier: 'Vista.Gh.PullRequestFile',
})
export type PullRequestFile = typeof PullRequestFile.Type

/**
 * Struct schema for a pull request commit, pairing identifying sha, message, author, and date with
 * the list of files it touched.
 */
export const PullRequestCommit = Schema.Struct({
  sha: Schema.String,
  message: Schema.String,
  author: Schema.String,
  date: Schema.String,
  files: Schema.Array(PullRequestFile),
}).annotate({
  identifier: 'Vista.Gh.PullRequestCommit',
})
export type PullRequestCommit = typeof PullRequestCommit.Type

/**
 * Struct schema for pull request metadata such as number, title, author, and state, with optional
 * repository, refs, diff totals, and body text.
 */
export const PullRequestData = Schema.Struct({
  number: PullRequestNumber,
  title: Schema.String,
  url: Schema.String,
  author: Schema.String,
  state: Schema.String,
  repository: Schema.optionalKey(Schema.UndefinedOr(Repository)),
  baseRef: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  headRef: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  additions: Schema.optionalKey(Schema.UndefinedOr(NonNegativeInt)),
  deletions: Schema.optionalKey(Schema.UndefinedOr(NonNegativeInt)),
  body: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
  files: Schema.Array(PullRequestFile),
  commits: Schema.optionalKey(Schema.UndefinedOr(Schema.Array(PullRequestCommit))),
}).annotate({
  identifier: 'Vista.Gh.PullRequestData',
})
export type PullRequestData = typeof PullRequestData.Type

/**
 * Nullable schema enumerating the allowed terminal conclusions (e.g. success, failure, timed_out)
 * shared by check runs, jobs, and steps.
 */
export const CheckConclusion = Schema.NullOr(
  Schema.Literals([
    'success',
    'failure',
    'neutral',
    'cancelled',
    'skipped',
    'timed_out',
    'action_required',
  ]),
)
export type CheckConclusion = typeof CheckConclusion.Type

/**
 * Struct schema for a single CI check entry recording its check-run, status, or workflow-run
 * source plus name, lifecycle status, conclusion, timestamps, and URL.
 */
export const CheckRun = Schema.Struct({
  source: Schema.Literals(['check-run', 'status', 'workflow-run']),
  name: Schema.String,
  status: Schema.Literals(['queued', 'in_progress', 'completed']),
  conclusion: CheckConclusion,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  url: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.CheckRun',
})
export type CheckRun = typeof CheckRun.Type

/**
 * Struct schema summarizing a pull request for the checks view, covering open/closed/merged state,
 * draft and mergeability flags, review decision, and head ref and sha.
 */
export const PullRequestChecksSummary = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  state: Schema.Literals(['open', 'closed', 'merged']),
  isDraft: Schema.Boolean,
  mergeable: Schema.Literals(['mergeable', 'conflicting', 'unknown']),
  reviewDecision: Schema.NullOr(
    Schema.Literals(['approved', 'changes_requested', 'review_required']),
  ),
  headRef: Schema.String,
  headSha: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.PullRequestChecksSummary',
})
export type PullRequestChecksSummary = typeof PullRequestChecksSummary.Type

/**
 * Struct schema for a compact workflow run snapshot including name, status, conclusion, URL, head
 * commit sha, and creation time.
 */
export const WorkflowRunSummary = Schema.Struct({
  name: Schema.String,
  status: Schema.Literals(['queued', 'in_progress', 'completed']),
  conclusion: CheckConclusion,
  url: Schema.String,
  headSha: Schema.String,
  createdAt: Schema.String,
}).annotate({
  identifier: 'Vista.Gh.WorkflowRunSummary',
})
export type WorkflowRunSummary = typeof WorkflowRunSummary.Type

/**
 * Struct schema for one step inside a check job, capturing its order, name, status, conclusion,
 * and start and completion timestamps.
 */
export const CheckStep = Schema.Struct({
  number: Schema.Int,
  name: Schema.String,
  status: Schema.Literals(['queued', 'in_progress', 'completed']),
  conclusion: CheckConclusion,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
}).annotate({
  identifier: 'Vista.Gh.CheckStep',
})
export type CheckStep = typeof CheckStep.Type

/** Struct schema for a CI job with its runner, timing, URL, and the ordered list of steps it executed. */
export const CheckJob = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  status: Schema.Literals(['queued', 'in_progress', 'completed']),
  conclusion: CheckConclusion,
  createdAt: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  runner: Schema.String,
  url: Schema.String,
  steps: Schema.Array(CheckStep),
}).annotate({
  identifier: 'Vista.Gh.CheckJob',
})
export type CheckJob = typeof CheckJob.Type

/**
 * Struct schema for the full detail of a workflow run, including attempt number, timing, URL, and
 * the jobs it spawned.
 */
export const WorkflowRunDetails = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  attempt: Schema.Int,
  status: Schema.Literals(['queued', 'in_progress', 'completed']),
  conclusion: CheckConclusion,
  createdAt: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
  url: Schema.String,
  jobs: Schema.Array(CheckJob),
}).annotate({
  identifier: 'Vista.Gh.WorkflowRunDetails',
})
export type WorkflowRunDetails = typeof WorkflowRunDetails.Type

/**
 * Struct schema aggregating the checks state for a PR, including its summary, named check runs,
 * workflow run count and latest run details (decoded to null when missing), and a streaming
 * cursor.
 */
export const ChecksState = Schema.Struct({
  pullRequest: PullRequestChecksSummary,
  checks: Schema.Record(Schema.String, CheckRun),
  workflowRunCount: NonNegativeInt,
  latestWorkflowRun: Schema.NullOr(WorkflowRunSummary),
  run: Schema.NullOr(WorkflowRunDetails).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  cursor: Cursor,
}).annotate({
  identifier: 'Vista.Gh.ChecksState',
})
export type ChecksState = typeof ChecksState.Type

/**
 * Union of tagged streaming events that either carry the full synced checks state or report a
 * single updated check alongside the current cursor.
 */
export const CheckEvent = Schema.Union([
  Schema.TaggedStruct('Synced', { state: ChecksState }),
  Schema.TaggedStruct('CheckUpdated', {
    check: CheckRun,
    cursor: Cursor,
  }),
]).annotate({
  identifier: 'Vista.Gh.CheckEvent',
})
export type CheckEvent = typeof CheckEvent.Type

/**
 * Class schema for one changed file, validating its path, addition and deletion counts, and one of
 * four possible change statuses.
 */
export class ChangedFile extends Schema.Class<ChangedFile>('ChangedFile')({
  path: Schema.String,
  additions: Schema.Finite,
  deletions: Schema.Finite,
  status: Schema.Literals(['added', 'modified', 'deleted', 'renamed']),
}) {}
/**
 * Class schema for a pull request summary, carrying its number, title, per-file changes, and
 * aggregate addition and deletion totals.
 */
export class PrSummary extends Schema.Class<PrSummary>('PrSummary')({
  number: Schema.Finite,
  title: Schema.String,
  files: Schema.Array(ChangedFile),
  totalAdditions: Schema.Finite,
  totalDeletions: Schema.Finite,
}) {}
/**
 * RPC group exposing changedFiles, pullRequest, and checksStream methods that fetch PR diffs and
 * metadata or stream check updates, failing with GhError.
 */
export const GhApi = RpcGroup.make(
  Rpc.make('changedFiles', {
    payload: PullRequestArgs,
    success: PrSummary,
    error: GhError,
  }),
  Rpc.make('pullRequest', {
    payload: PullRequestArgs,
    success: PullRequestData,
    error: GhError,
  }),
  Rpc.make('checksStream', {
    payload: {
      repo: Repository,
      pr: PullRequestNumber,
      since: Schema.optionalKey(Cursor),
    },
    success: CheckEvent,
    error: GhError,
    stream: true,
  }),
)

const PrometheusSampleValue = Schema.Finite.annotate({
  identifier: 'Vista.PrometheusSampleValue',
})
/** Class schema for a single metric sample, pairing a finite timestamp with a Prometheus sample value. */
export class Sample extends Schema.Class<Sample>('Sample')({
  t: Schema.Finite,
  v: PrometheusSampleValue,
}) {}
/**
 * Class schema for a labeled metric series, combining the metric name, its label map, and the
 * array of samples.
 */
export class Series extends Schema.Class<Series>('Series')({
  metric: Schema.String,
  labels: Schema.Record(Schema.String, Schema.String),
  samples: Schema.Array(Sample),
}) {}
/**
 * Class schema wrapping a metrics query result as the originating query string plus the series it
 * produced.
 */
export class QueryResult extends Schema.Class<QueryResult>('QueryResult')({
  query: Schema.String,
  series: Schema.Array(Series),
}) {}
/** Struct schema selecting a rolling lookback window restricted to one of seven supported durations. */
export const RelativeMetricRange = Schema.Struct({
  kind: Schema.Literal('relative'),
  last: Schema.Literals(['30s', '1m', '5m', '15m', '1h', '6h', '24h']),
}).annotate({ identifier: 'Vista.Otel.RelativeMetricRange' })
/**
 * Struct schema for an explicit start and end time window that fails validation unless start
 * precedes end.
 */
export const AbsoluteMetricRange = Schema.Struct({
  kind: Schema.Literal('absolute'),
  start: Schema.Finite,
  end: Schema.Finite,
})
  .check(
    Schema.makeFilter(({ start, end }) => start < end, {
      message: 'absolute metric range start must be before end',
    }),
  )
  .annotate({ identifier: 'Vista.Otel.AbsoluteMetricRange' })
/**
 * Union schema accepting either a relative or an absolute time range, discriminated by the kind
 * field, to scope metric queries.
 */
export const MetricRange = Schema.Union([RelativeMetricRange, AbsoluteMetricRange]).annotate({
  identifier: 'Vista.Otel.MetricRange',
})
export type MetricRange = typeof MetricRange.Type
export type AbsoluteMetricRange = typeof AbsoluteMetricRange.Type
const PositiveFinite = Schema.Finite.check(Schema.isGreaterThan(0))
const MetricRangePointCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(2))
const NonEmptyTrimmedString = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1))

/**
 * Strict schema for metric query requests that requires a non-empty PromQL expression plus the
 * time range, step interval in seconds, and point count, rejecting any excess properties.
 */
export const MetricQueryArgs = Schema.Struct({
  promql: NonEmptyTrimmedString,
  range: MetricRange,
  stepSeconds: PositiveFinite,
  points: MetricRangePointCount,
}).annotate({
  identifier: 'Vista.Otel.MetricQueryArgs',
})
export type MetricQueryArgs = typeof MetricQueryArgs.Type
/**
 * Strict schema describing a captured metric query result, pairing the original request parameters
 * with the resolved absolute range and the returned query data.
 */
export const MetricSnapshot = Schema.Struct({
  capturedAt: Schema.Finite,
  requestedRange: MetricRange,
  resolvedRange: AbsoluteMetricRange,
  query: Schema.String,
  stepSeconds: PositiveFinite,
  points: MetricRangePointCount,
  result: QueryResult,
}).annotate({
  identifier: 'Vista.Otel.MetricSnapshot',
})
export type MetricSnapshot = typeof MetricSnapshot.Type
/**
 * Tagged error type carrying a human-readable message for failures raised by OpenTelemetry metric
 * data-source operations.
 */
export class OtelError extends Schema.TaggedError<OtelError>()('OtelError', {
  message: Schema.String,
}) {}
/**
 * RPC group exposing a single query endpoint that accepts validated metric query arguments and
 * either resolves to a metric snapshot or fails with an OtelError.
 */
export const OtelApi = RpcGroup.make(
  Rpc.make('query', {
    payload: MetricQueryArgs,
    success: MetricSnapshot,
    error: OtelError,
  }),
)

/**
 * Tagged error type carrying a human-readable message for failures raised by trace lookup and
 * search operations.
 */
export class TraceError extends Schema.TaggedError<TraceError>()('TraceError', {
  message: Schema.String,
}) {}
/**
 * Schema class modeling a trace attribute as a string key/value pair attached to spans and span
 * events.
 */
export class Attr extends Schema.Class<Attr>('TraceAttr')({
  key: Schema.String,
  value: Schema.String,
}) {}
/**
 * Schema class modeling a timestamped annotation on a span, consisting of a name, a
 * Unix-nanosecond time string, and an array of attributes.
 */
export class SpanEvent extends Schema.Class<SpanEvent>('TraceSpanEvent')({
  name: Schema.String,
  timeUnixNano: Schema.String,
  attributes: Schema.Array(Attr),
}) {}
/**
 * Schema class modeling an individual trace span with its identifiers, service and kind metadata,
 * timing boundaries, status, attributes, and events.
 */
export class Span extends Schema.Class<Span>('TraceSpan')({
  spanId: Schema.String,
  parentSpanId: Schema.String,
  name: Schema.String,
  serviceName: Schema.String,
  kind: Schema.String,
  startTimeUnixNano: Schema.String,
  endTimeUnixNano: Schema.String,
  statusCode: Schema.String,
  statusMessage: Schema.String,
  attributes: Schema.Array(Attr),
  events: Schema.Array(SpanEvent),
}) {}
/**
 * Schema class representing a full trace as its trace ID together with the list of spans that
 * compose it.
 */
export class TraceResult extends Schema.Class<TraceResult>('TraceResult')({
  traceId: Schema.String,
  spans: Schema.Array(Span),
}) {}
/**
 * Schema class summarizing a trace for list views, identifying the root service and operation
 * along with the trace's start time and duration in milliseconds.
 */
export class TraceSummary extends Schema.Class<TraceSummary>('TraceSummary')({
  traceId: Schema.String,
  rootServiceName: Schema.String,
  rootTraceName: Schema.String,
  startTimeUnixNano: Schema.String,
  durationMs: Schema.Finite,
}) {}
/**
 * Schema class representing trace search output as the originating query string alongside the
 * matching trace summaries.
 */
export class SearchResult extends Schema.Class<SearchResult>('SearchResult')({
  query: Schema.String,
  traces: Schema.Array(TraceSummary),
}) {}
/**
 * RPC contract for the getTrace endpoint that takes a trace ID and resolves to the full trace
 * result or fails with a TraceError.
 */
export const TraceGet = Rpc.make('getTrace', {
  payload: { traceId: Schema.String },
  success: TraceResult,
  error: TraceError,
})
/**
 * RPC contract for the searchTraces endpoint that takes a query string and result limit and
 * resolves to matching trace summaries or fails with a TraceError.
 */
export const TraceSearch = Rpc.make('searchTraces', {
  payload: { query: Schema.String, limit: Schema.Finite },
  success: SearchResult,
  error: TraceError,
})
/**
 * RPC contract for the latestTrace endpoint that takes a query string and resolves to the most
 * recent matching trace result or fails with a TraceError.
 */
export const TraceLatest = Rpc.make('latestTrace', {
  payload: { query: Schema.String },
  success: TraceResult,
  error: TraceError,
})
/** RPC group bundling only the trace retrieval endpoint so clients can depend on getTrace in isolation. */
export const TraceGetApi = RpcGroup.make(TraceGet)
/**
 * RPC group bundling only the trace search endpoint so clients can depend on searchTraces in
 * isolation.
 */
export const TraceSearchApi = RpcGroup.make(TraceSearch)
/**
 * Combined RPC group exposing the complete trace data-source interface of getTrace, searchTraces,
 * and latestTrace.
 */
export const TraceApi = RpcGroup.make(TraceGet, TraceSearch, TraceLatest)

/** Typed failure of the agent-timeline provider; `reason` says which load stage failed. */
export class AgentTimelineError extends Schema.TaggedError<AgentTimelineError>()('AgentTimelineError', {
  reason: Schema.Literals([
    'missing',
    'open',
    'query',
    'decode',
    'empty',
    // tmuxSession selection: a tmux/pty subprocess failed, or pty lacks `--clients` support.
    'resolve',
    'unsupported',
  ]),
  message: Schema.String,
}) {}
/** Bounded set of canonical host-qualified agent IDs whose root sessions a trace selects. */
export const AgentTimelineActorsSchema = Schema.Array(NonEmptyTrimmedString)
  .check(Schema.isMinLength(1), Schema.isMaxLength(32))
  .annotate({ identifier: 'Vista.AgentTimeline.Actors' })
/**
 * Trace load arguments. `actors` selects roots by agent ID; `tmuxSession` selects the roots of the
 * agents attached to that tmux session's panes. The two selectors are mutually exclusive.
 */
export const AgentTimelineLoadArgs = Schema.Struct({
  horizon: AgentTimelineHorizonSchema,
  actors: Schema.optionalKey(AgentTimelineActorsSchema),
  tmuxSession: Schema.optionalKey(NonEmptyTrimmedString),
})
  .check(
    Schema.makeFilter(
      ({ actors, tmuxSession }) => actors === undefined || tmuxSession === undefined,
      {
        message: 'agent timeline accepts either actors or tmuxSession, not both',
      },
    ),
  )
  .annotate({ identifier: 'Vista.AgentTimeline.LoadArgs' })
/** RPC group of the agent-timeline provider: one `load` call returns the projected trace model. */
export const AgentTimelineApi = RpcGroup.make(
  Rpc.make('load', {
    payload: AgentTimelineLoadArgs,
    success: AgentTimelineModelSchema,
    error: AgentTimelineError,
  }),
)

const OmpUsageNonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

/**
 * Literal schema constraining the aggregation window for usage lenses to one day, seven days,
 * thirty days, or the full history.
 */
export const LensWindow = Schema.Literals(['1d', '7d', '30d', 'all']).annotate({
  identifier: 'Vista.OmpUsage.LensWindow',
})
export type LensWindow = typeof LensWindow.Type

/**
 * Strict schema for lens read requests that requires a lens name and window, permits an optional
 * grouping key, and rejects unknown properties.
 */
export const LensArgs = Schema.Struct({
  lens: Schema.String,
  window: LensWindow,
  groupBy: Schema.optionalKey(Schema.String),
}).annotate({
  identifier: 'Vista.OmpUsage.LensArgs',
})
export type LensArgs = typeof LensArgs.Type

/**
 * Schema describing how completely a materialized lens covers its underlying ledger, including row
 * and USD totals, attribution shares, affected hosts, and first/last timestamps.
 */
export const LensCoverage = Schema.Struct({
  ledger_rows: OmpUsageNonNegativeInt,
  ledger_usd: Schema.Finite,
  attributed_share: Schema.Finite,
  seat_share: Schema.Finite,
  seat_identity_share: Schema.Finite,
  account_share: Schema.Finite,
  hosts: Schema.Array(Schema.String),
  first_ts: Schema.NullOr(Schema.String),
  last_ts: Schema.NullOr(Schema.String),
}).annotate({
  identifier: 'Vista.OmpUsage.LensCoverage',
})
export type LensCoverage = typeof LensCoverage.Type

/**
 * Schema for a versioned materialized lens result, carrying its window, computation timestamp,
 * coverage metrics with gate status, and provenance metadata.
 */
export const LensEnvelope = Schema.Struct({
  lens: Schema.String,
  version: OmpUsageNonNegativeInt,
  window: LensWindow,
  computed_at: Schema.String,
  coverage: LensCoverage,
  coverage_gate: Schema.Finite,
  coverage_ok: Schema.Boolean,
  provenance: Schema.Struct({
    pricing_source: Schema.String,
    omp_version: Schema.String,
    ledger_schema: OmpUsageNonNegativeInt,
  }),
  parameters: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  filter: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  rows: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
}).annotate({
  identifier: 'Vista.OmpUsage.LensEnvelope',
})
export type LensEnvelope = typeof LensEnvelope.Type

/**
 * Strict schema recording a materialization run for a lens, capturing the lens name, window, epoch
 * computation time, and number of rows produced.
 */
export const OmpUsageGeneration = Schema.Struct({
  lens: Schema.String,
  window: LensWindow,
  computed_at: Schema.Finite,
  rows: OmpUsageNonNegativeInt,
}).annotate({
  identifier: 'Vista.OmpUsage.Generation',
})
/**
 * Schema describing overall OMP usage pipeline health, aggregating ledger and lens versions,
 * fresh-lens count, per-lens generations, and opaque quota, discovery, and oracle payloads.
 */
export const OmpUsageHealth = Schema.Struct({
  status: Schema.String,
  ledger_rows: OmpUsageNonNegativeInt,
  schema_version: OmpUsageNonNegativeInt,
  lens_version: OmpUsageNonNegativeInt,
  lenses_fresh: OmpUsageNonNegativeInt,
  computed_at: Schema.NullOr(Schema.Finite),
  generations: Schema.Array(OmpUsageGeneration),
  quota: Schema.Unknown,
  discovery: Schema.Unknown,
  oracle: Schema.Unknown,
}).annotate({
  identifier: 'Vista.OmpUsage.Health',
})
export type OmpUsageHealth = typeof OmpUsageHealth.Type

/**
 * Discriminated union for a lens read that either yields the materialized envelope or reports the
 * requested lens and window as unmaterialized.
 */
export const LensRead = Schema.Union([
  Schema.TaggedStruct('materialized', { envelope: LensEnvelope }),
  Schema.TaggedStruct('unmaterialized', { lens: Schema.String, window: LensWindow }),
]).annotate({ identifier: 'Vista.OmpUsage.LensRead' })
export type LensRead = typeof LensRead.Type

/**
 * Discriminated union for gate-verified lens reads, distinguishing fully covered envelopes from
 * those below the coverage gate, computed for a stale window, or not yet materialized.
 */
export const LensChecked = Schema.Union([
  Schema.TaggedStruct('ok', { envelope: LensEnvelope }),
  Schema.TaggedStruct('below-gate', {
    envelope: LensEnvelope,
    accountShare: Schema.Finite,
  }),
  Schema.TaggedStruct('stale', {
    envelope: LensEnvelope,
    computedAt: Schema.String,
    window: LensWindow,
  }),
  Schema.TaggedStruct('unmaterialized', { lens: Schema.String, window: LensWindow }),
]).annotate({ identifier: 'Vista.OmpUsage.LensChecked' })
export type LensChecked = typeof LensChecked.Type

/**
 * Schema validating one ranked project-spend row, pairing a project key and rank with finite USD
 * spend and a non-negative request count.
 */
export const SpendByProjectRow = Schema.Struct({
  key: Schema.String,
  rank: OmpUsageNonNegativeInt,
  usd: Schema.Finite,
  requests: OmpUsageNonNegativeInt,
}).annotate({ identifier: 'Vista.OmpUsage.SpendByProjectRow' })
export type SpendByProjectRow = typeof SpendByProjectRow.Type
/**
 * Decoder that validates unknown input against SpendByProjectRow, returning success or failure as
 * a Result instead of throwing.
 */
export const decodeSpendByProjectRow = Schema.decodeUnknownResult(SpendByProjectRow)

/**
 * Schema validating a single time-bucketed usage row that carries the bucket granularity and
 * start, grouping dimension, token type, and a possibly-null USD amount.
 */
export const UsageOverTimeRow = Schema.Struct({
  bucket: Schema.Literals(['hour', 'day', 'week', 'month']),
  bucket_start: Schema.String,
  group: Schema.String,
  group_by: Schema.String,
  token_type: Schema.String,
  usd: Schema.NullOr(Schema.Finite),
}).annotate({ identifier: 'Vista.OmpUsage.UsageOverTimeRow' })
export type UsageOverTimeRow = typeof UsageOverTimeRow.Type
/**
 * Decoder that validates unknown input against UsageOverTimeRow and reports decoding failures
 * through a Result rather than exceptions.
 */
export const decodeUsageOverTimeRow = Schema.decodeUnknownResult(UsageOverTimeRow)

/**
 * Schema validating a per-worktree spend row identified by key, repo, and branch, with finite USD
 * cost and a non-negative request count.
 */
export const SpendByWorktreeRow = Schema.Struct({
  key: Schema.String,
  repo: Schema.String,
  branch: Schema.String,
  usd: Schema.Finite,
  requests: OmpUsageNonNegativeInt,
}).annotate({ identifier: 'Vista.OmpUsage.SpendByWorktreeRow' })
export type SpendByWorktreeRow = typeof SpendByWorktreeRow.Type
/**
 * Decoder that validates unknown input against SpendByWorktreeRow, yielding a Result that captures
 * decode success or failure.
 */
export const decodeSpendByWorktreeRow = Schema.decodeUnknownResult(SpendByWorktreeRow)

/**
 * Schema validating a per-project drilldown row containing aggregate USD and request totals, a
 * drilled/un-drilled status, and nested worktree rows, while rejecting any excess properties.
 */
export const ProjectDrilldownRow = Schema.Struct({
  project: Schema.String,
  usd: Schema.Finite,
  requests: OmpUsageNonNegativeInt,
  status: Schema.Literals(['drilled', 'un-drilled']),
  worktrees: Schema.Array(SpendByWorktreeRow),
}).annotate({
  identifier: 'Vista.OmpUsage.ProjectDrilldownRow',
})
/**
 * Schema validating a drilldown response that bundles the analysis window, per-project drilldown
 * rows, and the names of projects left undrilled, rejecting excess properties.
 */
export const ProjectDrilldown = Schema.Struct({
  window: LensWindow,
  projects: Schema.Array(ProjectDrilldownRow),
  unDrilled: Schema.Array(Schema.String),
}).annotate({
  identifier: 'Vista.OmpUsage.ProjectDrilldown',
})
export type ProjectDrilldown = typeof ProjectDrilldown.Type

/**
 * Tagged error schema for OmpUsage failures carrying a reason classification (transport, timeout,
 * http, decode, policy), a message, an optional HTTP status, and a transient flag.
 */
export class OmpUsageError extends Schema.TaggedError<OmpUsageError>()('OmpUsageError', {
  reason: Schema.Literals(['transport', 'timeout', 'http', 'decode', 'policy']),
  message: Schema.String,
  status: Schema.optionalKey(Schema.Finite),
  transient: Schema.Boolean,
}) {}

/**
 * RPC group defining the OmpUsage service contract, including health probes and lens/lensChecked
 * reads whose failures surface as OmpUsageError.
 */
export const OmpUsageApi = RpcGroup.make(
  Rpc.make('health', {
    payload: {},
    success: OmpUsageHealth,
    error: OmpUsageError,
  }),
  Rpc.make('lens', {
    payload: LensArgs.fields,
    success: LensRead,
    error: OmpUsageError,
  }),
  Rpc.make('lensChecked', {
    payload: LensArgs.fields,
    success: LensChecked,
    error: OmpUsageError,
  }),
  Rpc.make('projectDrilldown', {
    payload: { window: LensWindow },
    success: ProjectDrilldown,
    error: OmpUsageError,
  }),
)

/**
 * Tagged error schema for Pyroscope failures that carries a human-readable message and no
 * additional metadata.
 */
export class PyroscopeError extends Schema.TaggedError<PyroscopeError>()('PyroscopeError', {
  message: Schema.String,
}) {}
/**
 * Schema class for a profiling result that carries the profile type, label selector, flamegraph
 * node names, per-level numeric values, and total/max-self weights.
 */
export class ProfileResult extends Schema.Class<ProfileResult>('ProfileResult')({
  profileTypeId: Schema.String,
  labelSelector: Schema.String,
  names: Schema.Array(Schema.String),
  levels: Schema.Array(Schema.Array(Schema.Finite)),
  total: Schema.Finite,
  maxSelf: Schema.Finite,
}) {}
/**
 * RPC group exposing the Pyroscope contract as a single getProfile RPC that takes a profile type,
 * label selector, and time range and returns a ProfileResult or a PyroscopeError.
 */
export const PyroscopeApi = RpcGroup.make(
  Rpc.make('getProfile', {
    payload: {
      profileTypeId: Schema.String,
      labelSelector: Schema.String,
      from: Schema.Finite,
      until: Schema.Finite,
    },
    success: ProfileResult,
    error: PyroscopeError,
  }),
)

/**
 * Schema enumerating the only recognized actor origins: none, a local loopback dev connection, or
 * a Tailscale connection.
 */
export const ActorSource = Schema.Literals(['none', 'loopback-dev', 'tailscale']).annotate({
  identifier: 'Vista.Runtime.ActorSource',
})
export type ActorSource = typeof ActorSource.Type

const PtyDimension = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(4096),
)
const PtySessionId = Schema.NonEmptyString

/** Bounded, independently renderable current terminal viewport. */
export const ScreenState = Schema.TaggedStruct('ScreenState', {
  cursor: Cursor,
  seq: Schema.Natural,
  columns: PtyDimension,
  rowCount: PtyDimension,
  rows: Schema.Array(Schema.String),
  cursorX: Schema.Natural,
  cursorY: Schema.Natural,
  observedAt: Schema.String,
}).annotate({
  identifier: 'Vista.Pty.ScreenState',
})
export type ScreenState = typeof ScreenState.Type

/**
 * Schema validating a single terminal-row update that pairs a natural-number row index with the
 * row's full new text, rejecting excess properties.
 */
export const ScreenRowDelta = Schema.Struct({
  index: Schema.Natural,
  value: Schema.String,
}).annotate({
  identifier: 'Vista.Pty.ScreenRowDelta',
})
export type ScreenRowDelta = typeof ScreenRowDelta.Type

/**
 * Schema validating a coalesced incremental screen update, including the cursor it follows, a
 * monotonic sequence number, bounded terminal dimensions, the changed rows, cursor coordinates,
 * and an observation timestamp.
 */
export const ScreenDelta = Schema.Struct({
  cursor: Cursor,
  seq: Schema.Natural,
  columns: PtyDimension,
  rowCount: PtyDimension,
  contentRowCount: Schema.Natural,
  rows: Schema.Array(ScreenRowDelta),
  cursorX: Schema.Natural,
  cursorY: Schema.Natural,
  observedAt: Schema.String,
}).annotate({
  identifier: 'Vista.Pty.ScreenDelta',
})
export type ScreenDelta = typeof ScreenDelta.Type

/**
 * Schema defining the union of screen stream events—either a full ScreenState sync or a
 * CoalescedFrame carrying a ScreenDelta—with excess properties rejected.
 */
export const ScreenEvent = Schema.Union([
  Schema.TaggedStruct('Synced', { state: ScreenState }),
  Schema.TaggedStruct('CoalescedFrame', { delta: ScreenDelta }),
]).annotate({
  identifier: 'Vista.Pty.ScreenEvent',
})
export type ScreenEvent = typeof ScreenEvent.Type

/**
 * Tagged error schema for Pty operations that classifies failures by reason (identity, session,
 * lease, transport, audit) alongside a message.
 */
export class PtyError extends Schema.TaggedError<PtyError>()('PtyError', {
  reason: Schema.Literals(['identity', 'session', 'lease', 'transport', 'audit']),
  message: Schema.String,
}) {}

/**
 * Tagged struct signaling that an operation referenced a non-empty session id that was never
 * declared to the Pty service.
 */
export const SessionNotDeclared = Schema.TaggedStruct('SessionNotDeclared', {
  sessionId: PtySessionId,
  message: Schema.String,
})
export type SessionNotDeclared = typeof SessionNotDeclared.Type

const PtyOperationError = Schema.Union([PtyError, SessionNotDeclared])

/**
 * Tagged struct granting an attach lease identified by a non-empty lease id that is only valid
 * until the recorded expiry timestamp.
 */
export const AttachLease = Schema.TaggedStruct('AttachLease', {
  leaseId: Schema.NonEmptyString,
  expiresAt: Schema.String,
}).annotate({ identifier: 'Vista.Pty.AttachLease' })
export type AttachLease = typeof AttachLease.Type

/** Tagged struct acknowledging that the Pty accepted a command, stamped with the acceptance timestamp. */
export const PtyCommandAccepted = Schema.TaggedStruct('PtyCommandAccepted', {
  acceptedAt: Schema.String,
}).annotate({ identifier: 'Vista.Pty.CommandAccepted' })

/** Tagged struct acknowledging that a Pty lease was released, stamped with the release timestamp. */
export const PtyReleased = Schema.TaggedStruct('PtyReleased', {
  releasedAt: Schema.String,
}).annotate({ identifier: 'Vista.Pty.Released' })

/**
 * RPC group defining the Pty session contract, including a streaming screen endpoint resumable
 * from an optional cursor and an attach operation returning a lease, with failures typed as
 * PtyError or SessionNotDeclared.
 */
export const PtyApi = RpcGroup.make(
  Rpc.make('screen', {
    payload: { sessionId: PtySessionId, since: Schema.optionalKey(Cursor) },
    success: ScreenEvent,
    error: PtyOperationError,
    stream: true,
  }),
  Rpc.make('attach', {
    payload: { sessionId: PtySessionId },
    success: AttachLease,
    error: PtyOperationError,
  }),
  Rpc.make('send', {
    payload: {
      sessionId: PtySessionId,
      leaseId: Schema.NonEmptyString,
      input: Schema.String,
    },
    success: PtyCommandAccepted,
    error: PtyOperationError,
  }),
  Rpc.make('release', {
    payload: { sessionId: PtySessionId, leaseId: Schema.NonEmptyString },
    success: PtyReleased,
    error: PtyOperationError,
  }),
)

/**
 * Contract that registers the OverviewApi RPC group under the 'overview' identifier so clients can
 * consume its operations.
 */
export const overview = contract({ id: 'overview', group: OverviewApi })
const ghBase = contract({ id: 'gh', group: GhApi })
/**
 * Subscription over the GitHub checks RPC that folds Synced snapshots and incremental CheckEvents
 * into a ChecksState keyed by check name and exposes its cursor for resumption.
 */
export const checksStream = subscription(ghBase.ops.checksStream, {
  stateSchema: ChecksState,
  eventSchema: CheckEvent,
  fold: (state, event) =>
    event._tag === 'Synced'
      ? event.state
      : {
          ...state,
          checks: { ...state.checks, [event.check.name]: event.check },
          cursor: event.cursor,
        },
  cursor: (state) => state.cursor,
})
/**
 * GitHub provider contract that extends the base GitHub operations with the streaming checks
 * subscription.
 */
export const gh = { ...ghBase, ops: { ...ghBase.ops, checksStream } }
/**
 * Provider contract exposing the OpenTelemetry capability group under the 'otel' identifier so
 * components can bind typed OTEL data.
 */
export const otel = contract({ id: 'otel', group: OtelApi })
/**
 * Provider contract exposing the trace capability group under the 'trace' identifier so components
 * can bind typed trace data.
 */
export const trace = contract({ id: 'trace', group: TraceApi })
/** Provider contract for server-backed Agent Timeline data. */
export const agentTimeline = contract({ id: 'agent-timeline', group: AgentTimelineApi })
/**
 * Provider contract exposing the OMP usage capability group under the 'omp-usage' identifier for
 * binding usage metrics.
 */
export const ompUsage = contract({ id: 'omp-usage', group: OmpUsageApi })
/**
 * Provider contract exposing the Pyroscope capability group under the 'pyroscope' identifier for
 * binding continuous-profiling data.
 */
export const pyroscope = contract({ id: 'pyroscope', group: PyroscopeApi })
/**
 * Provider contract exposing the disk-index capability group under the 'disk-index' identifier for
 * binding disk index lookups.
 */
export const diskIndex = contract({ id: 'disk-index', group: DiskIndexApi })
const ptyBase = contract({
  id: 'pty',
  group: PtyApi,
  commands: ['attach', 'send', 'release'] as const,
})
/**
 * Reducer folding a pty screen event into prior state, replacing it wholesale on full-sync events
 * while splicing delta rows and adopting the event's cursor and geometry.
 */
export const foldPtyScreenEvent = (state: ScreenState, event: ScreenEvent): ScreenState => {
  if (event._tag === 'Synced') return event.state
  const rows = Array.from(
    { length: event.delta.contentRowCount },
    (_, index) => state.rows[index] ?? '',
  )
  for (const row of event.delta.rows) rows[row.index] = row.value
  return {
    _tag: 'ScreenState',
    cursor: event.delta.cursor,
    seq: event.delta.seq,
    columns: event.delta.columns,
    rowCount: event.delta.rowCount,
    rows,
    cursorX: event.delta.cursorX,
    cursorY: event.delta.cursorY,
    observedAt: event.delta.observedAt,
  }
}

/**
 * Builds the stateful pty screen subscription that folds screen events into a validated
 * ScreenState and resumes streaming from the state's persisted cursor.
 */
export const ptyScreen = subscription(ptyBase.ops.screen, {
  stateSchema: ScreenState,
  eventSchema: ScreenEvent,
  fold: foldPtyScreenEvent,
  cursor: (state) => state.cursor,
})
/**
 * Final pty provider contract combining the base attach/send/release commands with the typed
 * screen subscription.
 */
export const pty = { ...ptyBase, ops: { ...ptyBase.ops, screen: ptyScreen } }
