import { Effect, Schema } from 'effect'

import type { ActivitySegment } from './types.ts'

/** Supported lookback window encoded as a compact duration literal. */
export type AgentTimelineHorizon = '1h' | '1d' | '7d'
/** A session's structural role in the agent delegation graph. */
export type AgentSessionRole = 'main' | 'subagent' | 'advisor'

/** Exact window aggregates; bounded requests, bins and events are drawing marks only. */
export interface AgentTimelineSessionFacts {
  readonly requests: number
  readonly turns: number
  readonly usd: number
  readonly inputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly outputTokens: number
  readonly toolCalls: number
  readonly compactions: number
  readonly prompts: number
  readonly activeMs: number
  readonly lastRequestAt: number
  readonly lastExitAt: number | null
  readonly status: 'active' | 'inactive' | 'exited'
}

/** Normalized session identity, hierarchy, timing, and optionally precomputed activity. */
export interface AgentTimelineSession {
  readonly id: string
  readonly parentId: string | null
  readonly rootId: string
  readonly depth: number
  readonly role: AgentSessionRole
  readonly model: string
  readonly actorId: string
  readonly project: string | null // `repo@branch` worktree key
  readonly title: string | null
  readonly name: string | null // child: transcript file stem, e.g. `VistaIntegrationReview`; root: null
  readonly agentType: string | null // child: session_init `agent`; root: title persona, e.g. `gen`
  readonly task: string | null // neutralized short summary, at most 120 characters; root: null
  readonly modelRole: string | null // session_init.modelRole
  readonly readOnly: boolean // session_init.readOnly; false for roots
  readonly contextCapacity: number | null // token capacity of the session's initial model
  readonly startedAt: number // epoch ms, first observed request
  readonly endedAt: number | null // epoch ms of session_exit event, null if none observed
  readonly activity?: ReadonlyArray<ActivitySegment>
  readonly activeMs?: number
  readonly activitySampled?: boolean
  readonly facts?: AgentTimelineSessionFacts
}

/** One retained ledger request with epoch-millisecond timing, token counts, and USD spend. */
export interface AgentTimelineRequest {
  readonly sessionId: string
  readonly ts: number // epoch ms
  readonly durationMs: number | null
  readonly kind: 'turn' | 'auxiliary'
  readonly stopReason: string // 'stop' | 'toolUse' | 'error' | ...
  readonly provider: string // requests.provider; '' for fixtures captured before it was recorded
  readonly model: string
  /** Context window from the ledger's model catalog for (provider, model); null when unknown. */
  readonly contextCapacity: number | null
  readonly inputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly outputTokens: number
  readonly contextTokens: number | null // context_prompt_tokens (+ nonmessage) snapshot if present
  readonly compactionEpoch: number
  readonly usd: number // cost_total_usd, API-equivalent
  readonly usdInput: number
  readonly usdCacheRead: number
  readonly usdCacheWrite: number
  readonly usdOutput: number
  readonly requests: 1
  readonly toolCalls: number
  readonly tools: ReadonlyArray<string>
}

/**
 * Context fill range for one compaction segment of a bin: requests between compaction boundaries,
 * with fractions computed per request (context tokens / context window) before taking min/max.
 */
export interface AgentTimelineContextSegment {
  readonly from: number // epoch ms of the segment's first request
  readonly to: number // epoch ms of the segment's last request
  readonly compactionEpoch: number
  readonly minFraction: number | null // null when no request in the segment has a known capacity
  readonly maxFraction: number | null
  readonly measured: number // requests with a known context size and capacity
  readonly unknown: number // requests whose capacity or context size is unknown
}

/** Aggregate evidence for request rows folded into an epoch-millisecond time interval. */
export interface AgentTimelineBin {
  readonly sessionId: string
  readonly from: number
  readonly to: number
  readonly requests: number
  readonly firstTs?: number
  readonly lastTs?: number
  readonly agentTurns: number
  readonly usd: number
  readonly usdInput: number
  readonly usdCacheRead: number
  readonly usdCacheWrite: number
  readonly usdOutput: number
  readonly inputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly outputTokens: number
  readonly toolCalls: number
  readonly tools: ReadonlyArray<string>
  readonly byModel: Readonly<Record<string, { readonly requests: number; readonly usd: number }>>
  readonly byStop: Readonly<Record<string, number>>
  readonly contextEstimated: boolean
  /** Present only when the bin's segment count fits the payload budget; never merged. */
  readonly contextSegments?: ReadonlyArray<AgentTimelineContextSegment>
}

/** Timestamped lifecycle evidence associated with an agent session. */
export type AgentTimelineEvent =
  | {
      readonly _tag: 'compaction'
      readonly sessionId: string
      readonly ts: number
      readonly summaryChars: number | null
    }
  | { readonly _tag: 'session_exit'; readonly sessionId: string; readonly ts: number }
  | {
      readonly _tag: 'model_change'
      readonly sessionId: string
      readonly ts: number
      readonly model: string
    }

/** A timestamped human prompt, distinguished from an in-flight steering intervention. */
export interface AgentTimelineHumanPrompt {
  readonly sessionId: string
  readonly ts: number
  readonly steering: boolean
}

/** Complete trace payload for a frozen time window, including coverage and sampling metadata. */
export interface AgentTimelineModel {
  readonly horizon: AgentTimelineHorizon
  readonly windowStart: number // epoch ms
  readonly windowEnd: number // epoch ms ("now" for the fixture; frozen)
  readonly modelCapacities: Readonly<Record<string, number>> // token capacity by request model id
  readonly sessions: ReadonlyArray<AgentTimelineSession> // sorted by startedAt
  readonly requests: ReadonlyArray<AgentTimelineRequest> // retained ledger rows, sorted by ts
  readonly bins: ReadonlyArray<AgentTimelineBin> // aggregate evidence for rows omitted by fixture sizing
  readonly events: ReadonlyArray<AgentTimelineEvent> // sorted by ts
  readonly humanPrompts: ReadonlyArray<AgentTimelineHumanPrompt>
  readonly humanPromptCount?: number
  readonly humanPromptCounts?: Readonly<Record<string, number>>
  readonly coverage: {
    readonly includedRoots: number
    readonly matchingSessions?: number
    readonly totalRoots: number
    readonly includedRequests: number
    readonly totalRequests: number
    readonly includedUsd: number
    readonly totalUsd: number
    readonly policy: string
  }
  readonly parameters: {
    readonly idleThresholdMs: 600_000
    readonly activeWithinMs: 600_000
  }
  readonly sampled: boolean // true if request rows were thinned to fit the size cap
  readonly folded: number // number of omitted request rows represented by bins
  readonly activitySampled?: boolean
}

const ActivitySegmentSchema = Schema.Struct({
  from: Schema.Finite,
  to: Schema.Finite,
  state: Schema.Literals(['working', 'waiting', 'idle']),
})
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const NonNegative = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))

/** Runtime schema for the supported trace lookback literals. */
export const AgentTimelineHorizonSchema = Schema.Literals(['1h', '1d', '7d']).annotate({
  identifier: 'Vista.AgentTimeline.Horizon',
})

const AgentTimelineSessionFactsSchema: Schema.Codec<AgentTimelineSessionFacts> = Schema.Struct({
  requests: NonNegativeInt,
  turns: NonNegativeInt,
  usd: NonNegative,
  inputTokens: NonNegativeInt,
  cacheReadTokens: NonNegativeInt,
  cacheWriteTokens: NonNegativeInt,
  outputTokens: NonNegativeInt,
  toolCalls: NonNegativeInt,
  compactions: NonNegativeInt,
  prompts: NonNegativeInt,
  activeMs: NonNegative,
  lastRequestAt: Schema.Finite,
  lastExitAt: Schema.NullOr(Schema.Finite),
  status: Schema.Literals(['active', 'inactive', 'exited']),
})

const AgentTimelineSessionSchema: Schema.Codec<AgentTimelineSession> = Schema.Struct({
  id: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  rootId: Schema.String,
  depth: NonNegativeInt,
  role: Schema.Literals(['main', 'subagent', 'advisor']),
  model: Schema.String,
  actorId: Schema.String,
  project: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  agentType: Schema.NullOr(Schema.String),
  task: Schema.NullOr(Schema.String),
  modelRole: Schema.NullOr(Schema.String),
  readOnly: Schema.Boolean,
  contextCapacity: Schema.NullOr(NonNegativeInt),
  startedAt: Schema.Finite,
  endedAt: Schema.NullOr(Schema.Finite),
  activeMs: Schema.optionalKey(NonNegative),
  activitySampled: Schema.optionalKey(Schema.Boolean),
  activity: Schema.optionalKey(Schema.Array(ActivitySegmentSchema)),
  facts: Schema.optionalKey(AgentTimelineSessionFactsSchema),
})

// Unannotated: decoding defaults make `provider` and `contextCapacity` optional on the encoded side.
const AgentTimelineRequestSchema = Schema.Struct({
  sessionId: Schema.String,
  ts: Schema.Finite,
  durationMs: Schema.NullOr(NonNegative),
  kind: Schema.Literals(['turn', 'auxiliary']),
  stopReason: Schema.String,
  provider: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(''))),
  model: Schema.String,
  contextCapacity: Schema.NullOr(NonNegativeInt).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  inputTokens: NonNegativeInt,
  cacheReadTokens: NonNegativeInt,
  cacheWriteTokens: NonNegativeInt,
  outputTokens: NonNegativeInt,
  contextTokens: Schema.NullOr(NonNegativeInt),
  compactionEpoch: NonNegativeInt,
  usd: NonNegative,
  usdInput: NonNegative,
  usdCacheRead: NonNegative,
  usdCacheWrite: NonNegative,
  usdOutput: NonNegative,
  requests: Schema.Literal(1),
  toolCalls: NonNegativeInt,
  tools: Schema.Array(Schema.String),
})
const Fraction = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(1),
)
const AgentTimelineContextSegmentSchema: Schema.Codec<AgentTimelineContextSegment> = Schema.Struct({
  from: Schema.Finite,
  to: Schema.Finite,
  compactionEpoch: NonNegativeInt,
  minFraction: Schema.NullOr(Fraction),
  maxFraction: Schema.NullOr(Fraction),
  measured: NonNegativeInt,
  unknown: NonNegativeInt,
})
const AgentTimelineBinSchema = Schema.Struct({
  sessionId: Schema.String,
  from: Schema.Finite,
  to: Schema.Finite,
  requests: NonNegativeInt,
  firstTs: Schema.optionalKey(Schema.Finite),
  lastTs: Schema.optionalKey(Schema.Finite),
  agentTurns: NonNegativeInt.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  usd: NonNegative,
  usdInput: NonNegative,
  usdCacheRead: NonNegative,
  usdCacheWrite: NonNegative,
  usdOutput: NonNegative,
  inputTokens: NonNegativeInt,
  cacheReadTokens: NonNegativeInt,
  cacheWriteTokens: NonNegativeInt,
  outputTokens: NonNegativeInt,
  toolCalls: NonNegativeInt,
  tools: Schema.Array(Schema.String),
  byModel: Schema.Record(
    Schema.String,
    Schema.Struct({ requests: NonNegativeInt, usd: NonNegative }),
  ),
  byStop: Schema.Record(Schema.String, NonNegativeInt),
  contextEstimated: Schema.Boolean,
  contextSegments: Schema.optionalKey(Schema.Array(AgentTimelineContextSegmentSchema)),
})

const AgentTimelineEventSchema: Schema.Codec<AgentTimelineEvent> = Schema.Union([
  Schema.TaggedStruct('compaction', {
    sessionId: Schema.String,
    ts: Schema.Finite,
    summaryChars: Schema.NullOr(NonNegativeInt),
  }),
  Schema.TaggedStruct('session_exit', {
    sessionId: Schema.String,
    ts: Schema.Finite,
  }),
  Schema.TaggedStruct('model_change', {
    sessionId: Schema.String,
    ts: Schema.Finite,
    model: Schema.String,
  }),
])

const AgentTimelineHumanPromptSchema: Schema.Codec<AgentTimelineHumanPrompt> = Schema.Struct({
  sessionId: Schema.String,
  ts: Schema.Finite,
  steering: Schema.Boolean,
})

/** Strict runtime codec for the externally supplied Agent Timeline payload. */
export const AgentTimelineModelSchema: Schema.Codec<AgentTimelineModel, unknown> = Schema.Struct({
  horizon: AgentTimelineHorizonSchema,
  windowStart: Schema.Finite,
  windowEnd: Schema.Finite,
  modelCapacities: Schema.Record(Schema.String, NonNegativeInt),
  sessions: Schema.Array(AgentTimelineSessionSchema),
  requests: Schema.Array(AgentTimelineRequestSchema),
  bins: Schema.Array(AgentTimelineBinSchema),
  events: Schema.Array(AgentTimelineEventSchema),
  humanPrompts: Schema.Array(AgentTimelineHumanPromptSchema),
  humanPromptCount: Schema.optionalKey(NonNegativeInt),
  humanPromptCounts: Schema.optionalKey(Schema.Record(Schema.String, NonNegativeInt)),
  coverage: Schema.Struct({
    includedRoots: NonNegativeInt,
    totalRoots: NonNegativeInt,
    includedRequests: NonNegativeInt,
    totalRequests: NonNegativeInt,
    includedUsd: NonNegative,
    totalUsd: NonNegative,
    policy: Schema.String,
    matchingSessions: Schema.optionalKey(NonNegativeInt),
  }),
  parameters: Schema.Struct({
    idleThresholdMs: Schema.Literal(600_000),
    activeWithinMs: Schema.Literal(600_000),
  }),
  sampled: Schema.Boolean,
  folded: NonNegativeInt,
  activitySampled: Schema.optionalKey(Schema.Boolean),
}).annotate({
  identifier: 'Vista.AgentTimeline.Model',
})

/** Decode unknown input into an Agent Timeline model without throwing on validation failure. */
export const decodeAgentTimelineModel = Schema.decodeUnknownResult(AgentTimelineModelSchema, {
  onExcessProperty: 'error',
})
