import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import {
  agentTimeline,
  AgentTimelineError,
  AgentTimelineModelSchema,
} from '@vista/blocks/internal/provider-contracts'
import { Context, Data, Effect, Layer, Schema } from 'effect'

import { implement, mountProvider } from '../provider.ts'
import {
  AgentTimelineCommandRunner,
  AgentTimelineCommandRunnerLive,
  type AgentTimelineTmuxResolverService,
  makeAgentTimelineTmuxResolver,
} from './agent-timeline-tmux.ts'

type AgentTimelineModel = typeof AgentTimelineModelSchema.Type
type AgentTimelineHorizon = AgentTimelineModel['horizon']
type AgentTimelineSession = AgentTimelineModel['sessions'][number]
type AgentTimelineRequest = AgentTimelineModel['requests'][number]
type AgentTimelineBin = AgentTimelineModel['bins'][number]
type AgentTimelineEvent = AgentTimelineModel['events'][number]

const HOUR_MS = 60 * 60 * 1_000
const IDLE_THRESHOLD_MS = 10 * 60 * 1_000
const ROOT_LIMIT: Readonly<Record<AgentTimelineHorizon, number>> = { '1h': 3, '1d': 3, '7d': 6 }
const HORIZON_MS: Readonly<Record<AgentTimelineHorizon, number>> = {
  '1h': HOUR_MS,
  '1d': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
}

/** Hard payload bounds for every repeated collection returned by the projection. */
export const MAX_RETAINED_REQUESTS = 500
/** Maximum number of session records included in one projected payload. */
export const MAX_TIMELINE_SESSIONS = 64
/** Session cap for an explicit agent filter; one agent's subagents and compaction successors add up quickly. */
export const MAX_ACTOR_TIMELINE_SESSIONS = 512
/** Maximum number of aggregate timeline bins included across all sessions in one payload. */
export const MAX_TIMELINE_BINS = 2_048
/** Maximum number of lifecycle event drawing marks retained for each kind. */
export const MAX_TIMELINE_EVENTS = 128
/** Maximum number of human prompt records retained in one projected payload. */
export const MAX_TIMELINE_PROMPTS = 256
/** Maximum number of tool-call names retained for each detailed request. */
export const MAX_TOOLS_PER_REQUEST = 8
/** Maximum number of distinct tool names summarized for each aggregate bin. */
export const MAX_TOOLS_PER_BIN = 4
/** Maximum number of database rows read when populating tools for retained requests. */
export const MAX_DETAIL_TOOL_ROWS = MAX_RETAINED_REQUESTS * MAX_TOOLS_PER_REQUEST
/** Maximum number of database rows read when populating tools for aggregate bins. */
export const MAX_BIN_TOOL_ROWS = 4_096
/** Maximum number of model or stop-reason breakdown rows read per projection query. */
export const MAX_BIN_BREAKDOWN_ROWS = 4_096
/** Folded bins with more compaction segments than this carry no context band at all. */
export const MAX_CONTEXT_SEGMENTS_PER_BIN = 4
/** Total compaction segments across all folded bins; later bins past the budget carry none. */
export const MAX_CONTEXT_SEGMENTS = 4_096

const MAX_TEXT_CHARS = 512
const MAX_ACTIVITY_SEGMENTS_PER_SESSION = 64
const ADDITIONAL_MODELS = '(additional models)'
const ADDITIONAL_STOPS = '(additional stop reasons)'

/** Resolves the ledger file from an explicit override or the XDG state directory fallback. */
export const resolveAgentTimelineLedgerPath = (
  configured: string | undefined,
  xdgStateHome: string | undefined = process.env.XDG_STATE_HOME,
  home: string = homedir(),
): string => {
  const override = configured?.trim()
  if (override !== undefined && override !== '') return override
  const stateHome = xdgStateHome?.trim()
  return join(
    stateHome === undefined || stateHome === '' ? join(home, '.local', 'state') : stateHome,
    'omp-usage',
    'ledger.sqlite',
  )
}

interface RootRow {
  readonly root_session_id: string
}

interface CoverageRow {
  readonly total_roots: number
  readonly total_requests: number
  readonly total_usd: number
}

interface IncludedCoverageRow {
  readonly included_roots: number
  readonly included_requests: number
  readonly included_usd: number
}

interface ActiveSessionRow {
  readonly session_id: string
}
interface MatchingSessionsRow {
  readonly total: number
}

interface RawSessionFactsRow {
  readonly session_id: string
  readonly requests: number
  readonly turns: number
  readonly usd: number
  readonly input_tokens: number
  readonly cache_read_tokens: number
  readonly cache_write_tokens: number
  readonly output_tokens: number
  readonly tool_calls: number
  readonly last_request_at: number
  readonly actor_id: string
  readonly compactions: number
  readonly last_exit_at: number | null
}

interface RawRequestRow {
  readonly entry_id: string
  readonly ts_ms: number
  readonly duration_ms: number | null
  readonly session_id: string
  readonly kind: string
  readonly stop_reason: string
  readonly model: string
  readonly provider: string
  readonly context_capacity: number | null
  readonly input_tokens: number
  readonly cache_read_tokens: number
  readonly cache_write_tokens: number
  readonly output_tokens: number
  readonly context_prompt_tokens: number | null
  readonly context_nonmessage_tokens: number | null
  readonly compaction_epoch: number | null
  readonly cost_total_usd: number
  readonly cost_input_usd: number
  readonly cost_cache_read_usd: number
  readonly cost_cache_write_usd: number
  readonly cost_output_usd: number
}

interface RawFirstRequestRow {
  readonly session_id: string
  readonly parent_session_id: string | null
  readonly root_session_id: string
  readonly depth: number
  readonly role: string
  readonly model: string
  readonly actor_id: string
  readonly project: string | null
  readonly repo: string | null
  readonly branch: string | null
  readonly ts_ms: number
}

interface RawSessionRow {
  readonly session_id: string
  readonly title: string | null
  readonly project: string | null
  readonly repo: string | null
  readonly branch: string | null
  readonly file: string
}

interface RawToolRow {
  readonly request_entry_id: string
  readonly tool_name: string
  readonly total_calls: number
}

interface RawEventRow {
  readonly session_id: string
  readonly ts_ms: number
  readonly kind: string
  readonly payload_valid: number
  readonly summary_chars: number | null
  readonly model: string | null
}

interface RawPromptRow {
  readonly session_id: string
  readonly ts_ms: number
  readonly steering: number
}
interface RawPromptCountRow {
  readonly session_id: string
  readonly prompt_count: number
}

interface RawAnchorRow {
  readonly entry_id: string
}

interface RawCompactionAnchorRow {
  readonly before_entry_id: string | null
  readonly after_entry_id: string | null
}

interface RawActivitySegmentRow {
  readonly session_id: string
  readonly from_ts: number
  readonly to_ts: number
  readonly state: 'working' | 'idle'
  readonly total_segments: number
  readonly working_ms: number
}

interface RawBinRow {
  readonly session_id: string
  readonly bin_from: number
  readonly requests: number
  readonly first_ts: number
  readonly last_ts: number
  readonly agent_turns: number
  readonly usd: number
  readonly usd_input: number
  readonly usd_cache_read: number
  readonly usd_cache_write: number
  readonly usd_output: number
  readonly input_tokens: number
  readonly cache_read_tokens: number
  readonly cache_write_tokens: number
  readonly output_tokens: number
  readonly tool_calls: number
  readonly context_estimated: number
}

interface RawBinBreakdownRow {
  readonly session_id: string
  readonly bin_from: number
  readonly key: string
  readonly requests: number
  readonly usd?: number
}

interface RawBinToolRow {
  readonly session_id: string
  readonly bin_from: number
  readonly tool_name: string
}

interface RawContextSegmentRow {
  readonly session_id: string
  readonly bin_from: number
  readonly from_ts: number
  readonly to_ts: number
  readonly compaction_epoch: number
  readonly min_fraction: number | null
  readonly max_fraction: number | null
  readonly measured: number
  readonly unknown: number
}

interface CatalogPresenceRow {
  readonly present: number
}

interface RawTmuxRootRow {
  readonly root_session_id: string | null
}

class ProjectionQueryFailure extends Data.TaggedError('ProjectionQueryFailure')<{
  readonly cause: unknown
}> {}

class ProjectionDecodeFailure extends Data.TaggedError('ProjectionDecodeFailure')<{
  readonly message: string
}> {}

const queryRows = <TRow>(
  db: DatabaseSync,
  horizon: AgentTimelineHorizon,
  stage: string,
  summary: string,
  sql: string,
  parameters: ReadonlyArray<SQLInputValue> = [],
): Effect.Effect<ReadonlyArray<TRow>, ProjectionQueryFailure> =>
  Effect.try({
    try: () => db.prepare(sql).all(...parameters) as unknown as ReadonlyArray<TRow>,
    catch: (cause) => new ProjectionQueryFailure({ cause }),
  }).pipe(
    Effect.tap((rows) => Effect.annotateCurrentSpan('db.response.returned_rows', rows.length)),
    Effect.withSpan('vista.agent_timeline.sql', {
      attributes: {
        'span.label': stage,
        'db.system.name': 'sqlite',
        'db.operation.name': 'SELECT',
        'db.query.summary': summary,
        'sk.vista.agent_timeline.horizon': horizon,
      },
    }),
  )

const queryRow = <TRow>(
  db: DatabaseSync,
  horizon: AgentTimelineHorizon,
  stage: string,
  summary: string,
  sql: string,
  parameters: ReadonlyArray<SQLInputValue> = [],
): Effect.Effect<TRow | undefined, ProjectionQueryFailure> =>
  Effect.try({
    try: () => db.prepare(sql).get(...parameters) as unknown as TRow | undefined,
    catch: (cause) => new ProjectionQueryFailure({ cause }),
  }).pipe(
    Effect.tap((row) =>
      Effect.annotateCurrentSpan('db.response.returned_rows', row === undefined ? 0 : 1),
    ),
    Effect.withSpan('vista.agent_timeline.sql', {
      attributes: {
        'span.label': stage,
        'db.system.name': 'sqlite',
        'db.operation.name': 'SELECT',
        'db.query.summary': summary,
        'sk.vista.agent_timeline.horizon': horizon,
      },
    }),
  )

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ')
const roundUsd = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
const canonicalModelId = (value: string): string => value.slice(value.lastIndexOf('/') + 1)
const binKey = (sessionId: string, from: number): string => `${sessionId}\u0000${from}`

const sessionRole = (value: string): AgentTimelineSession['role'] => {
  switch (value) {
    case 'main':
    case 'subagent':
    case 'advisor':
      return value
    default:
      throw new ProjectionDecodeFailure({ message: 'Unknown session role' })
  }
}

const requestKind = (value: string): AgentTimelineRequest['kind'] => {
  switch (value) {
    case 'turn':
    case 'auxiliary':
      return value
    default:
      throw new ProjectionDecodeFailure({ message: 'Unknown request kind' })
  }
}

/**
 * Removes path- and email-shaped material from display titles. Agent IDs and host names are
 * operational metadata and stay readable.
 */
export const sanitizeAgentTimelineTitle = (title: string | null): string | null => {
  if (title === null) return null
  const sanitized = title
    .replace(/(^|[\s("'`=:])\/(?:[^\s"'`)]+\/?)+/g, '$1[absolute path removed]')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email removed]')
    .replace(/@[a-z0-9._-]+/gi, '@seat')
    .replace(/\s+/g, ' ')
    .trim()
  return sanitized === '' ? null : sanitized.slice(0, 200)
}

const personaFromTitle = (title: string | null): string | null => {
  const persona = title?.match(/\[([^\]]+)\]/)?.[1]?.trim()
  return persona === undefined || persona === '' ? null : persona
}

const projectKey = ({
  project,
  repo,
  branch,
}: {
  readonly project: string | null
  readonly repo: string | null
  readonly branch: string | null
}): string | null => {
  if (project !== null && !project.startsWith('/') && project.includes('@')) return project
  return repo !== null && branch !== null && !repo.startsWith('/') && !branch.startsWith('/')
    ? `${repo}@${branch}`
    : null
}

const mergeActivitySegments = (
  segments: ReadonlyArray<NonNullable<AgentTimelineSession['activity']>[number]>,
): ReadonlyArray<NonNullable<AgentTimelineSession['activity']>[number]> => {
  const merged: Array<NonNullable<AgentTimelineSession['activity']>[number]> = []
  for (const segment of segments) {
    if (segment.to <= segment.from) continue
    const previous = merged.at(-1)
    if (
      previous !== undefined &&
      previous.state === segment.state &&
      previous.to === segment.from
    ) {
      merged[merged.length - 1] = { ...previous, to: segment.to }
    } else {
      merged.push(segment)
    }
  }
  return merged
}

/** Local server equivalent of the client projection helper, avoiding a server import through UI internals. */
const deriveActivity = (
  sessions: ReadonlyArray<AgentTimelineSession>,
  rawSegments: ReadonlyArray<RawActivitySegmentRow>,
  requests: ReadonlyArray<AgentTimelineRequest>,
): ReadonlyMap<string, NonNullable<AgentTimelineSession['activity']>> => {
  const segmentsBySession = new Map<string, ReadonlyArray<RawActivitySegmentRow>>()
  for (const session of sessions) {
    segmentsBySession.set(
      session.id,
      rawSegments.filter(({ session_id }) => session_id === session.id),
    )
  }
  const childrenBySession = new Map<string, string[]>()
  for (const session of sessions) {
    if (session.parentId === null) continue
    const children = childrenBySession.get(session.parentId) ?? []
    children.push(session.id)
    childrenBySession.set(session.parentId, children)
  }

  const result = new Map<string, NonNullable<AgentTimelineSession['activity']>>()
  for (const session of sessions) {
    const descendants = new Set<string>()
    const visit = (parentId: string): void => {
      for (const childId of childrenBySession.get(parentId) ?? []) {
        if (descendants.has(childId)) continue
        descendants.add(childId)
        visit(childId)
      }
    }
    visit(session.id)
    const descendantSegments = [...descendants].flatMap(
      (sessionId) => segmentsBySession.get(sessionId) ?? [],
    )
    const descendantRequests = requests.filter(({ sessionId }) => descendants.has(sessionId))
    const segments = (segmentsBySession.get(session.id) ?? []).map(
      ({ from_ts, state, to_ts }): NonNullable<AgentTimelineSession['activity']>[number] => ({
        from: from_ts,
        to: to_ts,
        state:
          state === 'working' ||
          (!descendantSegments.some(
            (segment) =>
              segment.state === 'working' && segment.from_ts < to_ts && segment.to_ts > from_ts,
          ) &&
            !descendantRequests.some((request) => request.ts > from_ts && request.ts < to_ts))
            ? state
            : 'waiting',
      }),
    )
    result.set(session.id, mergeActivitySegments(segments))
  }
  return result
}

const binWidthFor = (horizon: AgentTimelineHorizon, sessionCount: number): number => {
  const preferred = horizon === '1h' ? 60_000 : horizon === '1d' ? 5 * 60_000 : 30 * 60_000
  const binsPerSession = Math.max(1, Math.floor(MAX_TIMELINE_BINS / Math.max(1, sessionCount)))
  return Math.max(preferred, Math.ceil((HORIZON_MS[horizon] + 1) / binsPerSession))
}

/**
 * omp-usage's `model_catalog` is keyed exactly by `requests.provider` + `requests.model`. Older
 * ledgers lack the table, so queries join it only when it exists and use unknown capacity otherwise.
 */
const CATALOG_JOIN = 'left join model_catalog mc on mc.provider = r.provider and mc.model = r.model'
const CATALOG_CAPACITY = 'case when mc.context_window > 0 then mc.context_window end'

const requestColumns = (capacity: string): string => `
  r.entry_id, r.ts_ms, r.duration_ms, r.session_id, r.kind,
  substr(r.stop_reason, 1, ${MAX_TEXT_CHARS}) as stop_reason,
  substr(r.model, 1, ${MAX_TEXT_CHARS}) as model,
  substr(r.provider, 1, ${MAX_TEXT_CHARS}) as provider,
  ${capacity} as context_capacity,
  r.input_tokens, r.cache_read_tokens, r.cache_write_tokens, r.output_tokens,
  r.context_prompt_tokens, r.context_nonmessage_tokens, r.compaction_epoch,
  r.cost_total_usd, r.cost_input_usd, r.cost_cache_read_usd,
  r.cost_cache_write_usd, r.cost_output_usd`

const requestFromRow = (
  row: RawRequestRow,
  toolsByRequest: ReadonlyMap<string, ReadonlyArray<string>>,
  toolCalls: number,
): AgentTimelineRequest => ({
  sessionId: row.session_id,
  ts: row.ts_ms,
  durationMs: row.duration_ms,
  kind: requestKind(row.kind),
  stopReason: row.stop_reason,
  provider: row.provider,
  model: row.model,
  contextCapacity: row.context_capacity,
  inputTokens: row.input_tokens,
  cacheReadTokens: row.cache_read_tokens,
  cacheWriteTokens: row.cache_write_tokens,
  outputTokens: row.output_tokens,
  contextTokens:
    row.context_prompt_tokens === null && row.context_nonmessage_tokens === null
      ? null
      : (row.context_prompt_tokens ?? 0) + (row.context_nonmessage_tokens ?? 0),
  compactionEpoch: row.compaction_epoch ?? 0,
  usd: roundUsd(row.cost_total_usd),
  usdInput: roundUsd(row.cost_input_usd),
  usdCacheRead: roundUsd(row.cost_cache_read_usd),
  usdCacheWrite: roundUsd(row.cost_cache_write_usd),
  usdOutput: roundUsd(row.cost_output_usd),
  requests: 1,
  toolCalls,
  tools: toolsByRequest.get(row.entry_id) ?? [],
})

/** Roots retained for an explicit actor or tmux filter; the session cap still bounds the payload. */
const ACTOR_ROOT_LIMIT = 32

/** Which roots a projection selects: top roots, roots of given agents, or of a tmux session's agents. */
export type AgentTimelineSelection =
  | { readonly _tag: 'top' }
  | { readonly _tag: 'actors'; readonly actors: ReadonlyArray<string> }
  | {
      readonly _tag: 'tmux'
      readonly tmuxSession: string
      readonly resolver: AgentTimelineTmuxResolverService
    }

const selectionPolicy = (
  horizon: AgentTimelineHorizon,
  selection: AgentTimelineSelection,
  tmuxAgents: number,
): string => {
  switch (selection._tag) {
    case 'actors':
      return `Sessions from ${selection.actors.length} selected agent${selection.actors.length === 1 ? '' : 's'} plus their ancestor lanes: up to ${ACTOR_ROOT_LIMIT} roots by API-equivalent cost and ${MAX_ACTOR_TIMELINE_SESSIONS} sessions.`
    case 'tmux':
      return `Sessions under the roots of ${tmuxAgents} agent${tmuxAgents === 1 ? '' : 's'} attached to tmux session ${selection.tmuxSession}: up to ${ACTOR_ROOT_LIMIT} roots by API-equivalent cost and ${MAX_ACTOR_TIMELINE_SESSIONS} sessions.`
    case 'top':
      return horizon === '1h'
        ? 'Top 3 roots by request count in the horizon.'
        : `Top ${ROOT_LIMIT[horizon]} roots by API-equivalent cost in the horizon.`
  }
}

/**
 * Resolves a tmux session to ledger roots: pane ttys → attached agent PTYs → harness session IDs
 * → `root_session_id`. Agents without ledger rows are skipped.
 */
const resolveTmuxRoots = (
  db: DatabaseSync,
  horizon: AgentTimelineHorizon,
  selection: Extract<AgentTimelineSelection, { readonly _tag: 'tmux' }>,
): Effect.Effect<
  { readonly rootIds: ReadonlyArray<string>; readonly agents: number },
  AgentTimelineError | ProjectionQueryFailure
> =>
  Effect.gen(function* () {
    const startedAt = Date.now()
    const resolution = yield* selection.resolver.resolve(selection.tmuxSession)
    const sessionIds = resolution.agents.map(({ harnessSessionId }) => harnessSessionId)
    const rows =
      sessionIds.length === 0
        ? []
        : yield* queryRows<RawTmuxRootRow>(
            db,
            horizon,
            'tmux_roots',
            'resolve tmux agent sessions to roots',
            `with wanted(session_id) as (values ${sessionIds.map(() => '(?)').join(', ')})
           select (select r.root_session_id from requests r
                   where r.session_id = wanted.session_id limit 1) as root_session_id
           from wanted`,
            sessionIds,
          )
    const resolvedRoots = rows.flatMap(({ root_session_id }) =>
      root_session_id === null ? [] : [root_session_id],
    )
    const rootIds = [...new Set(resolvedRoots)]
    yield* Effect.annotateCurrentSpan({
      'sk.vista.agent_timeline.tmux.panes': resolution.panes,
      'sk.vista.agent_timeline.tmux.agents': resolution.agents.length,
      'sk.vista.agent_timeline.tmux.resolved_roots': rootIds.length,
      'sk.vista.agent_timeline.tmux.cached': Number(resolution.cached),
      'sk.vista.agent_timeline.tmux.duration_ms': Date.now() - startedAt,
    })
    // Agents without ledger rows were skipped, so the policy counts only those that resolved.
    return { rootIds, agents: resolvedRoots.length }
  }).pipe(
    Effect.withSpan('vista.agent_timeline.tmux_resolve', {
      attributes: { 'span.label': 'tmux', 'sk.vista.agent_timeline.horizon': horizon },
    }),
  )

const projectLedger = (
  db: DatabaseSync,
  horizon: AgentTimelineHorizon,
  windowEnd: number,
  selection: AgentTimelineSelection,
): Effect.Effect<
  AgentTimelineModel | null,
  ProjectionQueryFailure | ProjectionDecodeFailure | AgentTimelineError
> =>
  Effect.gen(function* () {
    const windowStart = windowEnd - HORIZON_MS[horizon]
    const actors = selection._tag === 'actors' ? selection.actors : undefined
    const tmux =
      selection._tag === 'tmux' ? yield* resolveTmuxRoots(db, horizon, selection) : undefined
    if (tmux !== undefined && tmux.rootIds.length === 0) return null
    const rankExpression =
      horizon === '1h' && selection._tag === 'top' ? 'count(*)' : 'sum(cost_total_usd)'
    const roots = yield* queryRows<RootRow>(
      db,
      horizon,
      'roots',
      'select ranked roots',
      actors !== undefined
        ? `select root_session_id
       from requests
       where ts_ms between ? and ?
         and root_session_id in (
           select root_session_id from requests
           where ts_ms between ? and ? and actor_id in (${placeholders(actors.length)})
         )
       group by root_session_id
       order by ${rankExpression} desc, root_session_id
       limit ?`
        : tmux !== undefined
          ? `select root_session_id
       from requests
       where ts_ms between ? and ? and root_session_id in (${placeholders(tmux.rootIds.length)})
       group by root_session_id
       order by ${rankExpression} desc, root_session_id
       limit ?`
          : `select root_session_id
       from requests
       where ts_ms between ? and ?
       group by root_session_id
       order by ${rankExpression} desc, root_session_id
       limit ?`,
      actors !== undefined
        ? [windowStart, windowEnd, windowStart, windowEnd, ...actors, ACTOR_ROOT_LIMIT]
        : tmux !== undefined
          ? [windowStart, windowEnd, ...tmux.rootIds, ACTOR_ROOT_LIMIT]
          : [windowStart, windowEnd, ROOT_LIMIT[horizon]],
    )
    if (roots.length === 0) return null
    const rootIds = roots.map(({ root_session_id }) => root_session_id)
    const rootSlots = placeholders(rootIds.length)
    const coverage = yield* queryRow<CoverageRow>(
      db,
      horizon,
      'coverage',
      'aggregate horizon coverage',
      `select count(distinct root_session_id) as total_roots,
              count(*) as total_requests,
              coalesce(sum(cost_total_usd), 0) as total_usd
       from requests where ts_ms between ? and ?`,
      [windowStart, windowEnd],
    )
    if (coverage === undefined) return null

    const matchingSessions = yield* queryRow<MatchingSessionsRow>(
      db,
      horizon,
      'matching_sessions',
      'count matching sessions before payload limit',
      `select count(distinct session_id) as total
       from requests
       where root_session_id in (${rootSlots}) and ts_ms between ? and ?${
         actors === undefined ? '' : ` and actor_id in (${placeholders(actors.length)})`
       }`,
      [...rootIds, windowStart, windowEnd, ...(actors ?? [])],
    )

    const sessionLimit =
      selection._tag === 'top' ? MAX_TIMELINE_SESSIONS : MAX_ACTOR_TIMELINE_SESSIONS
    const activeSessions = yield* queryRows<ActiveSessionRow>(
      db,
      horizon,
      'sessions',
      'select bounded sessions and ancestors',
      `with recursive candidates as (
       select session_id,
              min(case when session_id = root_session_id then 0 else 1 end) as root_priority,
              min(ts_ms) as first_ts
       from requests
       where root_session_id in (${rootSlots}) and ts_ms between ? and ?${
         actors === undefined ? '' : ` and actor_id in (${placeholders(actors.length)})`
       }
       group by session_id
       order by root_priority, first_ts, session_id
       limit ?
     ), ancestry(session_id, parent_session_id, root_priority, first_ts, level) as (
       select c.session_id,
              (select parent_session_id
               from requests r
               where r.session_id = c.session_id
               order by r.ts_ms, r.entry_id
               limit 1),
              c.root_priority, c.first_ts, 0
       from candidates c
       union all
       select a.parent_session_id,
              (select parent_session_id
               from requests r
               where r.session_id = a.parent_session_id
               order by r.ts_ms, r.entry_id
               limit 1),
              a.root_priority, a.first_ts, a.level + 1
       from ancestry a
       where a.parent_session_id is not null and a.level + 1 < ?
     ), selected as (
       select session_id, min(root_priority) as root_priority, min(first_ts) as first_ts,
              coalesce((
                select depth
                from requests r
                where r.session_id = ancestry.session_id
                order by r.ts_ms, r.entry_id
                limit 1
              ), 0) as depth
       from ancestry
       group by session_id
     )
     select session_id
     from selected
     order by depth, root_priority, first_ts, session_id
     limit ?`,
      [
        ...rootIds,
        windowStart,
        windowEnd,
        ...(actors ?? []),
        sessionLimit,
        sessionLimit,
        sessionLimit,
      ],
    )
    if (activeSessions.length === 0) return null
    const activeSessionIds = activeSessions.map(({ session_id }) => session_id)
    const activeSessionSlots = placeholders(activeSessionIds.length)

    const activeSessionValues = activeSessionIds.map(() => '(?)').join(', ')
    const includedCoverage = yield* queryRow<IncludedCoverageRow>(
      db,
      horizon,
      'included_coverage',
      'aggregate selected session coverage',
      `select count(distinct root_session_id) as included_roots,
            count(*) as included_requests,
            coalesce(sum(cost_total_usd), 0) as included_usd
     from requests
     where root_session_id in (${rootSlots})
       and session_id in (${activeSessionSlots})
       and ts_ms between ? and ?`,
      [...rootIds, ...activeSessionIds, windowStart, windowEnd],
    )
    if (includedCoverage === undefined || includedCoverage.included_requests === 0) return null

    const rawEvents = yield* queryRows<RawEventRow>(
      db,
      horizon,
      'events',
      'select bounded lifecycle events',
      `with ranked as (
       select id, session_id, ts_ms, kind,
              json_valid(payload_json) as payload_valid,
              case when json_valid(payload_json)
                then json_extract(payload_json, '$.summary_chars') end as summary_chars,
              case when json_valid(payload_json)
                then substr(json_extract(payload_json, '$.model'), 1, ${MAX_TEXT_CHARS}) end as model,
              row_number() over (
                partition by kind order by ts_ms desc, id desc
              ) as kind_rank
       from session_events
       where session_id in (${activeSessionSlots}) and ts_ms between ? and ?
         and kind in ('compaction', 'session_exit', 'model_change')
     )
     select session_id, ts_ms, kind, payload_valid, summary_chars, model
     from ranked
     where kind_rank <= ?
     order by ts_ms, id`,
      [...activeSessionIds, windowStart, windowEnd, MAX_TIMELINE_EVENTS],
    )
    const events = rawEvents.flatMap((row): ReadonlyArray<AgentTimelineEvent> => {
      if (row.payload_valid === 0) {
        throw new ProjectionDecodeFailure({ message: 'Invalid session event payload' })
      }
      switch (row.kind) {
        case 'compaction':
          return [
            {
              _tag: 'compaction',
              sessionId: row.session_id,
              ts: row.ts_ms,
              summaryChars:
                typeof row.summary_chars === 'number' && Number.isInteger(row.summary_chars)
                  ? Math.max(0, row.summary_chars)
                  : null,
            },
          ]
        case 'session_exit':
          return [{ _tag: 'session_exit', sessionId: row.session_id, ts: row.ts_ms }]
        case 'model_change':
          return typeof row.model === 'string'
            ? [
                {
                  _tag: 'model_change',
                  sessionId: row.session_id,
                  ts: row.ts_ms,
                  model: canonicalModelId(row.model),
                },
              ]
            : []
        default:
          return []
      }
    })

    const sessionAnchors = yield* queryRows<RawAnchorRow>(
      db,
      horizon,
      'session_anchors',
      'select first and last request anchors',
      `with ranked as (
       select entry_id,
              row_number() over (
                partition by session_id order by ts_ms, entry_id
              ) as first_rank,
              row_number() over (
                partition by session_id order by ts_ms desc, entry_id desc
              ) as last_rank
       from requests
       where root_session_id in (${rootSlots})
         and session_id in (${activeSessionSlots})
         and ts_ms between ? and ?
     )
     select entry_id
     from ranked
     where first_rank = 1 or last_rank = 1
     order by entry_id
     limit ?`,
      [...rootIds, ...activeSessionIds, windowStart, windowEnd, MAX_RETAINED_REQUESTS],
    )
    const anchorIds = new Set(sessionAnchors.map(({ entry_id }) => entry_id))
    const compactions = rawEvents.filter((event) => event.kind === 'compaction')
    if (compactions.length > 0) {
      const compactionValues = compactions.map(() => '(?, ?, ?)').join(', ')
      const compactionParameters = compactions.flatMap((event, index) => [
        index,
        event.session_id,
        event.ts_ms,
      ])
      const compactionAnchors = yield* queryRows<RawCompactionAnchorRow>(
        db,
        horizon,
        'compaction_anchors',
        'select compaction-adjacent request anchors',
        `with compactions(ordinal, session_id, event_ts) as (values ${compactionValues})
       select
         (select entry_id
          from requests r
          where r.session_id = c.session_id
            and r.ts_ms between ? and ?
            and r.ts_ms < c.event_ts
          order by r.ts_ms desc, r.entry_id desc
          limit 1) as before_entry_id,
         (select entry_id
          from requests r
          where r.session_id = c.session_id
            and r.ts_ms between ? and ?
            and r.ts_ms > c.event_ts
          order by r.ts_ms, r.entry_id
          limit 1) as after_entry_id
       from compactions c
       order by c.ordinal`,
        [...compactionParameters, windowStart, windowEnd, windowStart, windowEnd],
      )
      for (const row of compactionAnchors) {
        // Session boundaries are reserved first; compaction-adjacent detail is best-effort.
        if (row.before_entry_id !== null && anchorIds.size < MAX_RETAINED_REQUESTS) {
          anchorIds.add(row.before_entry_id)
        }
        if (row.after_entry_id !== null && anchorIds.size < MAX_RETAINED_REQUESTS) {
          anchorIds.add(row.after_entry_id)
        }
      }
    }

    const catalog = yield* queryRow<CatalogPresenceRow>(
      db,
      horizon,
      'model_catalog',
      'check model catalog presence',
      `select count(*) as present
     from sqlite_master
     where type = 'table' and name = 'model_catalog'`,
    )
    const hasCatalog = (catalog?.present ?? 0) > 0
    const catalogJoin = hasCatalog ? CATALOG_JOIN : ''
    const capacityExpression = hasCatalog ? CATALOG_CAPACITY : 'null'
    const detailColumns = requestColumns(capacityExpression)

    const retainedAnchorIds = [...anchorIds].toSorted()
    const retainedAnchorSlots = placeholders(retainedAnchorIds.length)
    const anchorRequests =
      retainedAnchorIds.length === 0
        ? []
        : yield* queryRows<RawRequestRow>(
            db,
            horizon,
            'anchor_requests',
            'select semantic anchor request details',
            `select ${detailColumns}
           from requests r
           ${catalogJoin}
           where r.entry_id in (${retainedAnchorSlots})
           order by r.ts_ms, r.entry_id`,
            retainedAnchorIds,
          )
    const optionalCount = Math.min(
      MAX_RETAINED_REQUESTS - anchorRequests.length,
      includedCoverage.included_requests - anchorRequests.length,
    )
    const anchorExclusion =
      retainedAnchorIds.length === 0 ? '' : `and r.entry_id not in (${retainedAnchorSlots})`
    const optionalParameters = [
      ...rootIds,
      ...activeSessionIds,
      windowStart,
      windowEnd,
      ...retainedAnchorIds,
    ]
    const sampledRequests =
      optionalCount <= 0
        ? []
        : yield* queryRows<RawRequestRow>(
            db,
            horizon,
            'sampled_requests',
            'select bounded request detail sample',
            optionalCount >= includedCoverage.included_requests - anchorRequests.length
              ? `select ${detailColumns}
               from requests r
               ${catalogJoin}
               where r.root_session_id in (${rootSlots})
                 and r.session_id in (${activeSessionSlots})
                 and r.ts_ms between ? and ?
                 ${anchorExclusion}
               order by r.ts_ms, r.entry_id
               limit ?`
              : `with recursive ranked as (
                 select ${requestColumns('null')},
                        r.provider as catalog_provider, r.model as catalog_model,
                        row_number() over (order by r.ts_ms, r.entry_id) as ordinal,
                        count(*) over () as total
                 from requests r
                 where r.root_session_id in (${rootSlots})
                   and r.session_id in (${activeSessionSlots})
                   and r.ts_ms between ? and ?
                   ${anchorExclusion}
               ), targets(index_value) as (
                 select 0
                 union all
                 select index_value + 1
                 from targets
                 where index_value + 1 < ?
               ), sampled as (
                 select ranked.*
                 from ranked
                 join targets on ordinal =
                   case when ? = 1
                     then cast((total + 1) / 2 as integer)
                     else cast(index_value * (total - 1) / (? - 1) as integer) + 1
                   end
               )
               select entry_id, ts_ms, duration_ms, session_id, kind, stop_reason, model, provider,
                      ${
                        hasCatalog
                          ? `(select ${CATALOG_CAPACITY} from model_catalog mc
                              where mc.provider = sampled.catalog_provider
                                and mc.model = sampled.catalog_model)`
                          : 'null'
                      } as context_capacity,
                      input_tokens, cache_read_tokens, cache_write_tokens, output_tokens,
                      context_prompt_tokens, context_nonmessage_tokens, compaction_epoch,
                      cost_total_usd, cost_input_usd, cost_cache_read_usd,
                      cost_cache_write_usd, cost_output_usd
               from sampled
               order by ts_ms, entry_id
               limit ?`,
            optionalCount >= includedCoverage.included_requests - anchorRequests.length
              ? [...optionalParameters, optionalCount]
              : [...optionalParameters, optionalCount, optionalCount, optionalCount, optionalCount],
          )
    const rawRequests = [...anchorRequests, ...sampledRequests].toSorted(
      (left, right) => left.ts_ms - right.ts_ms || left.entry_id.localeCompare(right.entry_id),
    )
    const retainedIds = rawRequests.map(({ entry_id }) => entry_id)
    const retainedSlots = placeholders(retainedIds.length)

    const rawTools =
      retainedIds.length === 0
        ? []
        : yield* queryRows<RawToolRow>(
            db,
            horizon,
            'request_tools',
            'select bounded retained request tool names',
            `with ranked as (
             select request_entry_id,
                    substr(tool_name, 1, ${MAX_TEXT_CHARS}) as tool_name,
                    count(*) over (partition by request_entry_id) as total_calls,
                    ts_ms, call_id,
                    row_number() over (
                      partition by request_entry_id order by ts_ms, call_id
                    ) as tool_rank
             from tool_calls
             where session_id in (${activeSessionSlots})
               and ts_ms between ? and ?
               and request_entry_id in (${retainedSlots})
           )
           select request_entry_id, tool_name, total_calls
           from ranked
           where tool_rank <= ?
           order by ts_ms, request_entry_id, call_id
           limit ?`,
            [
              ...activeSessionIds,
              windowStart,
              windowEnd,
              ...retainedIds,
              MAX_TOOLS_PER_REQUEST,
              MAX_DETAIL_TOOL_ROWS,
            ],
          )
    const toolsByRequest = new Map<string, string[]>()
    const toolCallsByRequest = new Map<string, number>()
    for (const tool of rawTools) {
      const tools = toolsByRequest.get(tool.request_entry_id) ?? []
      tools.push(tool.tool_name)
      toolsByRequest.set(tool.request_entry_id, tools)
      toolCallsByRequest.set(tool.request_entry_id, tool.total_calls)
    }
    const requests = rawRequests.map((row) =>
      requestFromRow(row, toolsByRequest, toolCallsByRequest.get(row.entry_id) ?? 0),
    )
    const foldedCount = includedCoverage.included_requests - requests.length

    const binWidth = binWidthFor(horizon, activeSessionIds.length)
    const omittedPredicate =
      retainedIds.length === 0 ? '' : `and r.entry_id not in (${retainedSlots})`
    const omittedParameters = [
      ...rootIds,
      ...activeSessionIds,
      windowStart,
      windowEnd,
      ...retainedIds,
    ]
    const binExpression = `? + cast((r.ts_ms - ?) / ? as integer) * ?`
    const binExpressionParameters = [windowStart, windowStart, binWidth, binWidth]
    const rawBins =
      foldedCount === 0
        ? []
        : yield* queryRows<RawBinRow>(
            db,
            horizon,
            'bins',
            'aggregate omitted requests into bounded bins',
            `with tool_counts as (
             select request_entry_id, count(*) as tool_calls
             from tool_calls
             where session_id in (${activeSessionSlots})
               and ts_ms between ? and ?
             group by request_entry_id
           )
           select r.session_id,
                  ${binExpression} as bin_from,
                  count(*) as requests,
                  min(r.ts_ms) as first_ts,
                  max(r.ts_ms) as last_ts,
                  sum(case when r.kind = 'turn' and r.stop_reason = 'stop' then 1 else 0 end)
                    as agent_turns,
                  coalesce(sum(r.cost_total_usd), 0) as usd,
                  coalesce(sum(r.cost_input_usd), 0) as usd_input,
                  coalesce(sum(r.cost_cache_read_usd), 0) as usd_cache_read,
                  coalesce(sum(r.cost_cache_write_usd), 0) as usd_cache_write,
                  coalesce(sum(r.cost_output_usd), 0) as usd_output,
                  coalesce(sum(r.input_tokens), 0) as input_tokens,
                  coalesce(sum(r.cache_read_tokens), 0) as cache_read_tokens,
                  coalesce(sum(r.cache_write_tokens), 0) as cache_write_tokens,
                  coalesce(sum(r.output_tokens), 0) as output_tokens,
                  coalesce(sum(tool_counts.tool_calls), 0) as tool_calls,
                  max(case when r.context_prompt_tokens is null
                             and r.context_nonmessage_tokens is null
                           then 1 else 0 end) as context_estimated
           from requests r
           left join tool_counts on tool_counts.request_entry_id = r.entry_id
           where r.root_session_id in (${rootSlots})
             and r.session_id in (${activeSessionSlots})
             and r.ts_ms between ? and ?
             ${omittedPredicate}
           group by r.session_id, bin_from
           order by bin_from, r.session_id
           limit ?`,
            [
              ...activeSessionIds,
              windowStart,
              windowEnd,
              ...binExpressionParameters,
              ...omittedParameters,
              MAX_TIMELINE_BINS,
            ],
          )
    if (rawBins.reduce((total, bin) => total + bin.requests, 0) !== foldedCount) {
      throw new ProjectionDecodeFailure({
        message: 'Aggregate bins do not conserve omitted requests',
      })
    }

    const byModel = new Map<string, Map<string, { requests: number; usd: number }>>()
    const byStop = new Map<string, Map<string, number>>()
    const toolsByBin = new Map<string, string[]>()

    const loadBreakdown = (
      column: 'model' | 'stop_reason',
      additionalKey: string,
    ): Effect.Effect<
      ReadonlyArray<RawBinBreakdownRow>,
      ProjectionQueryFailure | ProjectionDecodeFailure
    > => {
      if (foldedCount === 0) return Effect.succeed([])
      const detailLimit = MAX_BIN_BREAKDOWN_ROWS - MAX_TIMELINE_BINS
      return queryRows<RawBinBreakdownRow>(
        db,
        horizon,
        column === 'model' ? 'bin_models' : 'bin_stops',
        column === 'model'
          ? 'aggregate bounded bin model breakdown'
          : 'aggregate bounded bin stop breakdown',
        `with groups as (
         select r.session_id,
                ${binExpression} as bin_from,
                substr(r.${column}, 1, ${MAX_TEXT_CHARS}) as breakdown_key,
                count(*) as requests,
                coalesce(sum(r.cost_total_usd), 0) as usd
         from requests r
         where r.root_session_id in (${rootSlots})
           and r.session_id in (${activeSessionSlots})
           and r.ts_ms between ? and ?
           ${omittedPredicate}
         group by r.session_id, bin_from, breakdown_key
       ), ranked as (
         select *,
                row_number() over (
                  order by bin_from, session_id, breakdown_key
                ) as breakdown_rank
         from groups
       )
       select session_id, bin_from,
              case when breakdown_rank <= ? then breakdown_key else ? end as key,
              sum(requests) as requests, sum(usd) as usd
       from ranked
       group by session_id, bin_from, key
       order by bin_from, session_id, key
       limit ?`,
        [
          ...binExpressionParameters,
          ...omittedParameters,
          detailLimit,
          additionalKey,
          MAX_BIN_BREAKDOWN_ROWS,
        ],
      ).pipe(
        Effect.filterOrFail(
          (rows) => rows.length <= MAX_BIN_BREAKDOWN_ROWS,
          () =>
            new ProjectionDecodeFailure({
              message: 'Aggregate breakdown exceeds the payload cap',
            }),
        ),
      )
    }

    const modelBreakdown = yield* loadBreakdown('model', ADDITIONAL_MODELS)
    if (modelBreakdown.reduce((total, row) => total + row.requests, 0) !== foldedCount) {
      throw new ProjectionDecodeFailure({
        message: 'Model breakdown does not conserve omitted requests',
      })
    }
    for (const row of modelBreakdown) {
      const key = binKey(row.session_id, row.bin_from)
      const values = byModel.get(key) ?? new Map()
      const previous = values.get(row.key) ?? { requests: 0, usd: 0 }
      values.set(row.key, {
        requests: previous.requests + row.requests,
        usd: previous.usd + (row.usd ?? 0),
      })
      byModel.set(key, values)
    }
    const stopBreakdown = yield* loadBreakdown('stop_reason', ADDITIONAL_STOPS)
    if (stopBreakdown.reduce((total, row) => total + row.requests, 0) !== foldedCount) {
      throw new ProjectionDecodeFailure({
        message: 'Stop breakdown does not conserve omitted requests',
      })
    }
    for (const row of stopBreakdown) {
      const key = binKey(row.session_id, row.bin_from)
      const values = byStop.get(key) ?? new Map()
      values.set(row.key, (values.get(row.key) ?? 0) + row.requests)
      byStop.set(key, values)
    }

    const rawBinTools =
      foldedCount === 0
        ? []
        : yield* queryRows<RawBinToolRow>(
            db,
            horizon,
            'bin_tools',
            'select bounded aggregate bin tool names',
            `with distinct_tools as (
             select r.session_id,
                    ${binExpression} as bin_from,
                    substr(t.tool_name, 1, ${MAX_TEXT_CHARS}) as tool_name
             from tool_calls t
             join requests r on r.entry_id = t.request_entry_id
             where t.session_id in (${activeSessionSlots})
               and t.ts_ms between ? and ?
               and r.root_session_id in (${rootSlots})
               and r.session_id in (${activeSessionSlots})
               and r.ts_ms between ? and ?
               ${omittedPredicate}
             group by r.session_id, bin_from, tool_name
           ), ranked as (
             select *,
                    row_number() over (
                      partition by session_id, bin_from order by tool_name
                    ) as tool_rank
             from distinct_tools
           )
           select session_id, bin_from, tool_name
           from ranked
           where tool_rank <= ?
           order by bin_from, session_id, tool_name
           limit ?`,
            [
              ...binExpressionParameters,
              ...activeSessionIds,
              windowStart,
              windowEnd,
              ...omittedParameters,
              MAX_TOOLS_PER_BIN,
              MAX_BIN_TOOL_ROWS,
            ],
          )
    for (const row of rawBinTools) {
      const key = binKey(row.session_id, row.bin_from)
      const tools = toolsByBin.get(key) ?? []
      tools.push(row.tool_name)
      toolsByBin.set(key, tools)
    }

    // Compaction segments of folded requests. A run starts at every compaction_epoch change and
    // after every compaction event, numbered by a running sum over each session's whole window, so
    // an A-B-A epoch sequence yields three runs rather than two epoch groups. Fractions are per
    // request (context tokens / catalog window) before min/max. Bins over the per-bin or total
    // segment budget get no segments at all.
    const rawContextSegments =
      foldedCount === 0
        ? []
        : yield* queryRows<RawContextSegmentRow>(
            db,
            horizon,
            'bin_context_segments',
            'aggregate bounded folded-bin context segments',
            `with compaction_events as (
             select e.session_id, e.ts_ms
             from session_events e
             where e.session_id in (${activeSessionSlots})
               and e.ts_ms between ? and ?
               and e.kind = 'compaction'
           ), measured as (
             select r.session_id, r.entry_id, r.ts_ms,
                    coalesce(r.compaction_epoch, 0) as compaction_epoch,
                    case
                      when r.context_prompt_tokens is null
                           and r.context_nonmessage_tokens is null then null
                      when ${capacityExpression} is null then null
                      else min(1.0, (coalesce(r.context_prompt_tokens, 0)
                                     + coalesce(r.context_nonmessage_tokens, 0)) * 1.0
                                    / (${capacityExpression}))
                    end as fraction,
                    case when coalesce(r.compaction_epoch, 0) is lag(coalesce(r.compaction_epoch, 0))
                           over (partition by r.session_id order by r.ts_ms, r.entry_id)
                      then 0 else 1 end as boundary
             from requests r
             ${catalogJoin}
             where r.root_session_id in (${rootSlots})
               and r.session_id in (${activeSessionSlots})
               and r.ts_ms between ? and ?
           ), stream as (
             select session_id, ts_ms, 0 as is_event, entry_id, compaction_epoch, fraction, boundary
             from measured
             union all
             select session_id, ts_ms, 1, null, null, null, 1
             from compaction_events
           ), runs as (
             select *,
                    sum(boundary) over (
                      partition by session_id order by ts_ms, is_event desc, entry_id
                      rows between unbounded preceding and current row
                    ) as run_id
             from stream
           ), segments as (
             select r.session_id, ${binExpression} as bin_from, r.run_id,
                    min(r.ts_ms) as from_ts, max(r.ts_ms) as to_ts,
                    max(r.compaction_epoch) as compaction_epoch,
                    min(r.fraction) as min_fraction, max(r.fraction) as max_fraction,
                    count(r.fraction) as measured, count(*) - count(r.fraction) as unknown
             from runs r
             where r.is_event = 0
               ${omittedPredicate}
             group by r.session_id, bin_from, r.run_id
           ), bin_sizes as (
             select session_id, bin_from, count(*) as segment_count
             from segments
             group by session_id, bin_from
           ), budgeted as (
             select session_id, bin_from,
                    sum(segment_count) over (
                      order by bin_from, session_id
                      rows between unbounded preceding and current row
                    ) as cumulative
             from bin_sizes
             where segment_count <= ?
           )
           select s.session_id, s.bin_from, s.from_ts, s.to_ts, s.compaction_epoch,
                  s.min_fraction, s.max_fraction, s.measured, s.unknown
           from segments s
           join budgeted b on b.session_id = s.session_id and b.bin_from = s.bin_from
           where b.cumulative <= ?
           order by s.bin_from, s.session_id, s.run_id
           limit ?`,
            [
              ...activeSessionIds,
              windowStart,
              windowEnd,
              ...rootIds,
              ...activeSessionIds,
              windowStart,
              windowEnd,
              ...binExpressionParameters,
              ...retainedIds,
              MAX_CONTEXT_SEGMENTS_PER_BIN,
              MAX_CONTEXT_SEGMENTS,
              MAX_CONTEXT_SEGMENTS,
            ],
          )
    const contextSegmentsByBin = new Map<
      string,
      NonNullable<AgentTimelineBin['contextSegments']>[number][]
    >()
    for (const row of rawContextSegments) {
      const key = binKey(row.session_id, row.bin_from)
      const segments = contextSegmentsByBin.get(key) ?? []
      segments.push({
        from: row.from_ts,
        to: row.to_ts,
        compactionEpoch: row.compaction_epoch,
        minFraction: row.min_fraction,
        maxFraction: row.max_fraction,
        measured: row.measured,
        unknown: row.unknown,
      })
      contextSegmentsByBin.set(key, segments)
    }

    const bins = rawBins.map((row): AgentTimelineBin => {
      const key = binKey(row.session_id, row.bin_from)
      const contextSegments = contextSegmentsByBin.get(key)
      const bin: AgentTimelineBin = {
        sessionId: row.session_id,
        from: row.bin_from,
        to: Math.min(windowEnd, row.bin_from + binWidth),
        requests: row.requests,
        firstTs: row.first_ts,
        lastTs: row.last_ts,
        agentTurns: row.agent_turns,
        usd: roundUsd(row.usd),
        usdInput: roundUsd(row.usd_input),
        usdCacheRead: roundUsd(row.usd_cache_read),
        usdCacheWrite: roundUsd(row.usd_cache_write),
        usdOutput: roundUsd(row.usd_output),
        inputTokens: row.input_tokens,
        cacheReadTokens: row.cache_read_tokens,
        cacheWriteTokens: row.cache_write_tokens,
        outputTokens: row.output_tokens,
        toolCalls: row.tool_calls,
        tools: toolsByBin.get(key) ?? [],
        byModel: Object.fromEntries(
          [...(byModel.get(key) ?? [])]
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([model, aggregate]) => [
              model,
              { requests: aggregate.requests, usd: roundUsd(aggregate.usd) },
            ]),
        ),
        byStop: Object.fromEntries(
          [...(byStop.get(key) ?? [])].toSorted(([left], [right]) => left.localeCompare(right)),
        ),
        contextEstimated: row.context_estimated !== 0,
      }
      return contextSegments === undefined ? bin : Object.assign(bin, { contextSegments })
    })

    const rawActivitySegments = yield* queryRows<RawActivitySegmentRow>(
      db,
      horizon,
      'activity',
      'aggregate bounded exact activity segments',
      `with ordered as (
       select r.session_id, r.ts_ms,
              lag(r.ts_ms) over (
                partition by r.session_id order by r.ts_ms, r.entry_id
              ) as previous_ts
       from requests r indexed by requests_ts
       where r.root_session_id in (${rootSlots})
         and r.session_id in (${activeSessionSlots})
         and r.ts_ms between ? and ?
     ), classified as (
       select session_id, previous_ts as from_ts, ts_ms as to_ts,
              case when ts_ms - previous_ts <= ? then 'working' else 'idle' end as state
       from ordered
       where previous_ts is not null and ts_ms > previous_ts
     ), boundaries as (
       select *,
              case when lag(state) over (
                partition by session_id order by from_ts
              ) = state then 0 else 1 end as new_group
       from classified
     ), grouped as (
       select *,
              sum(new_group) over (
                partition by session_id order by from_ts
              ) as group_id
       from boundaries
     ), segments as (
       select session_id, min(from_ts) as from_ts, max(to_ts) as to_ts, state
       from grouped
       group by session_id, group_id, state
     ), ranked as (
       select *,
              row_number() over (
                partition by session_id order by from_ts
              ) as segment_rank,
              count(*) over (partition by session_id) as total_segments,
              sum(
                case when state = 'working' then to_ts - from_ts else 0 end
              ) over (partition by session_id) as working_ms
       from segments
     )
     select session_id, from_ts, to_ts, state, total_segments, working_ms
     from ranked
     where segment_rank <= ?
     order by from_ts, session_id`,
      [
        ...rootIds,
        ...activeSessionIds,
        windowStart,
        windowEnd,
        IDLE_THRESHOLD_MS,
        MAX_ACTIVITY_SEGMENTS_PER_SESSION,
      ],
    )

    const rawFacts = yield* queryRows<RawSessionFactsRow>(
      db,
      horizon,
      'session_facts',
      'aggregate exact session facts independently of drawing marks',
      `with selected(session_id) as (values ${activeSessionValues}),
     request_facts as (
       select r.session_id, count(*) as requests,
              sum(case when r.kind = 'turn' and r.stop_reason = 'stop' then 1 else 0 end) as turns,
              coalesce(sum(r.cost_total_usd), 0) as usd,
              coalesce(sum(r.input_tokens), 0) as input_tokens,
              coalesce(sum(r.cache_read_tokens), 0) as cache_read_tokens,
              coalesce(sum(r.cache_write_tokens), 0) as cache_write_tokens,
              coalesce(sum(r.output_tokens), 0) as output_tokens,
              max(r.ts_ms) as last_request_at
       from requests r join selected on selected.session_id = r.session_id
       where r.ts_ms between ? and ?
       group by r.session_id
     ), tool_facts as (
       select t.session_id, count(*) as tool_calls
       from tool_calls t join selected on selected.session_id = t.session_id
       where t.ts_ms between ? and ?
       group by t.session_id
     ), event_facts as (
       select e.session_id,
              sum(case when e.kind = 'compaction' then 1 else 0 end) as compactions,
              max(case when e.kind = 'session_exit' then e.ts_ms end) as last_exit_at
       from session_events e join selected on selected.session_id = e.session_id
       where e.ts_ms between ? and ?
       group by e.session_id
     )
     select f.*, coalesce(t.tool_calls, 0) as tool_calls,
            coalesce(e.compactions, 0) as compactions, e.last_exit_at,
            (select substr(r.actor_id, 1, ${MAX_TEXT_CHARS})
             from requests r where r.session_id = f.session_id and r.ts_ms between ? and ?
             order by r.ts_ms desc, r.entry_id desc limit 1) as actor_id
     from request_facts f
     left join tool_facts t on t.session_id = f.session_id
     left join event_facts e on e.session_id = f.session_id
     order by f.session_id`,
      [
        ...activeSessionIds,
        windowStart,
        windowEnd,
        windowStart,
        windowEnd,
        windowStart,
        windowEnd,
        windowStart,
        windowEnd,
      ],
    )
    const factsBySession = new Map(rawFacts.map((facts) => [facts.session_id, facts]))

    // No `indexed by requests_ts` hint here: that hint scans every request in the horizon (about
    // 230k rows over 7 days) and then joins the selected sessions. The planner picks
    // `requests_session` and reads only the selected sessions' requests. For the 459-session dogfood
    // selection this statement went from 4.1 s to 0.2 s, and the whole projection from 8.3–15.7 s to
    // 3.3–3.5 s (128 sessions: 3.4 s to 2.4 s). Payloads are byte-identical.
    const firstRequests = yield* queryRows<RawFirstRequestRow>(
      db,
      horizon,
      'session_metadata',
      'select bounded first request session metadata',
      `with selected(session_id) as (values ${activeSessionValues}),
     ranked_window as (
       select r.session_id, r.parent_session_id, r.root_session_id, r.depth, r.role,
              substr(r.model, 1, ${MAX_TEXT_CHARS}) as model,
              substr(r.actor_id, 1, ${MAX_TEXT_CHARS}) as actor_id,
              substr(r.project, 1, ${MAX_TEXT_CHARS}) as project,
              substr(r.repo, 1, ${MAX_TEXT_CHARS}) as repo,
              substr(r.branch, 1, ${MAX_TEXT_CHARS}) as branch,
              r.ts_ms,
              row_number() over (
                partition by r.session_id order by r.ts_ms, r.entry_id
              ) as request_rank
       from requests r
       join selected on selected.session_id = r.session_id
       where r.ts_ms between ? and ?
     ), first_window as (
       select *
       from ranked_window
       where request_rank = 1
     ), missing as (
       select selected.session_id
       from selected
       left join first_window on first_window.session_id = selected.session_id
       where first_window.session_id is null
     ), ranked_fallback as (
       select r.session_id, r.parent_session_id, r.root_session_id, r.depth, r.role,
              substr(r.model, 1, ${MAX_TEXT_CHARS}) as model,
              substr(r.actor_id, 1, ${MAX_TEXT_CHARS}) as actor_id,
              substr(r.project, 1, ${MAX_TEXT_CHARS}) as project,
              substr(r.repo, 1, ${MAX_TEXT_CHARS}) as repo,
              substr(r.branch, 1, ${MAX_TEXT_CHARS}) as branch,
              r.ts_ms,
              row_number() over (
                partition by r.session_id order by r.entry_id
              ) as request_rank
       from missing
       join sessions s on s.session_id = missing.session_id
       join requests r indexed by requests_ts
         on r.session_id = missing.session_id and r.ts_ms = s.first_ts_ms
     ), first_fallback as (
       select *
       from ranked_fallback
       where request_rank = 1
     )
     select session_id, parent_session_id, root_session_id, depth, role, model, actor_id,
            project, repo, branch, ts_ms
     from first_window
     union all
     select session_id, parent_session_id, root_session_id, depth, role, model, actor_id,
            project, repo, branch, ts_ms
     from first_fallback
     order by ts_ms, session_id
     limit ?`,
      [...activeSessionIds, windowStart, windowEnd, sessionLimit],
    )
    const sessionIds = firstRequests.map(({ session_id }) => session_id)
    const sessionSlots = placeholders(sessionIds.length)
    const rawSessions = yield* queryRows<RawSessionRow>(
      db,
      horizon,
      'session_titles',
      'select bounded session display metadata',
      `select session_id,
            substr(title, 1, ${MAX_TEXT_CHARS}) as title,
            substr(project, 1, ${MAX_TEXT_CHARS}) as project,
            substr(repo, 1, ${MAX_TEXT_CHARS}) as repo,
            substr(branch, 1, ${MAX_TEXT_CHARS}) as branch,
            substr(file, 1, ${MAX_TEXT_CHARS}) as file
     from sessions
     where session_id in (${sessionSlots})
     order by session_id
     limit ?`,
      [...sessionIds, sessionLimit],
    )
    const sessionMetadata = new Map(rawSessions.map((session) => [session.session_id, session]))
    const firstRetainedModelBySession = new Map<string, string>()
    for (const row of rawRequests) {
      if (!firstRetainedModelBySession.has(row.session_id)) {
        firstRetainedModelBySession.set(row.session_id, row.model)
      }
    }
    const endedAtBySession = new Map(
      rawFacts.flatMap((row) =>
        row.last_exit_at === null ? [] : [[row.session_id, row.last_exit_at] as const],
      ),
    )

    const sessionsWithoutActivity = firstRequests
      .map((row): AgentTimelineSession => {
        const metadata = sessionMetadata.get(row.session_id)
        const title = sanitizeAgentTimelineTitle(metadata?.title ?? null)
        const isRoot = row.parent_session_id === null
        return {
          id: row.session_id,
          parentId: row.parent_session_id,
          rootId: row.root_session_id,
          depth: row.depth,
          role: sessionRole(row.role),
          model: firstRetainedModelBySession.get(row.session_id) ?? row.model,
          actorId: factsBySession.get(row.session_id)?.actor_id ?? row.actor_id,
          project: projectKey({
            project: metadata?.project ?? row.project,
            repo: metadata?.repo ?? row.repo,
            branch: metadata?.branch ?? row.branch,
          }),
          title,
          name: isRoot || metadata === undefined ? null : basename(metadata.file, '.jsonl'),
          agentType: isRoot ? personaFromTitle(title) : null,
          task: null,
          modelRole: null,
          readOnly: false,
          contextCapacity: null,
          startedAt: row.ts_ms,
          endedAt: endedAtBySession.get(row.session_id) ?? null,
        }
      })
      .toSorted(
        (left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id),
      )
    const activity = deriveActivity(sessionsWithoutActivity, rawActivitySegments, requests)
    const activitySummaryBySession = new Map(
      rawActivitySegments.map((row) => [
        row.session_id,
        {
          activeMs: row.working_ms,
          sampled: row.total_segments > MAX_ACTIVITY_SEGMENTS_PER_SESSION,
        },
      ]),
    )
    const sessions = sessionsWithoutActivity.map(
      (session): AgentTimelineSession => ({
        id: session.id,
        parentId: session.parentId,
        rootId: session.rootId,
        depth: session.depth,
        role: session.role,
        model: session.model,
        actorId: session.actorId,
        project: session.project,
        title: session.title,
        name: session.name,
        agentType: session.agentType,
        task: session.task,
        modelRole: session.modelRole,
        readOnly: session.readOnly,
        contextCapacity: session.contextCapacity,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        activeMs: activitySummaryBySession.get(session.id)?.activeMs ?? 0,
        activitySampled: activitySummaryBySession.get(session.id)?.sampled ?? false,
        activity: activity.get(session.id) ?? [],
      }),
    )

    const rawPromptCounts = yield* queryRows<RawPromptCountRow>(
      db,
      horizon,
      'prompt_counts',
      'aggregate exact human prompt counts',
      `select session_id, count(*) as prompt_count
     from human_prompts
     where root_session_id in (${rootSlots})
       and session_id in (${activeSessionSlots})
       and ts_ms between ? and ?
     group by session_id
     order by session_id
     limit ?`,
      [...rootIds, ...activeSessionIds, windowStart, windowEnd, sessionLimit],
    )
    const humanPromptCounts = Object.fromEntries(
      rawPromptCounts.map(({ prompt_count, session_id }) => [session_id, prompt_count]),
    )
    const humanPromptCount = rawPromptCounts.reduce(
      (total, { prompt_count }) => total + prompt_count,
      0,
    )
    const sessionsWithFacts = sessions.map((session): AgentTimelineSession => {
      const facts = factsBySession.get(session.id)
      if (facts === undefined) {
        return {
          ...session,
          facts: {
            requests: 0,
            turns: 0,
            usd: 0,
            inputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            outputTokens: 0,
            toolCalls: 0,
            compactions: 0,
            prompts: humanPromptCounts[session.id] ?? 0,
            activeMs: 0,
            lastRequestAt: session.startedAt,
            lastExitAt: null,
            status: 'inactive',
          },
        }
      }
      const lastExitAt = facts.last_exit_at
      const status =
        lastExitAt !== null && lastExitAt >= facts.last_request_at
          ? 'exited'
          : facts.last_request_at >= windowEnd - IDLE_THRESHOLD_MS
            ? 'active'
            : 'inactive'
      return {
        ...session,
        facts: {
          requests: facts.requests,
          turns: facts.turns,
          usd: roundUsd(facts.usd),
          inputTokens: facts.input_tokens,
          cacheReadTokens: facts.cache_read_tokens,
          cacheWriteTokens: facts.cache_write_tokens,
          outputTokens: facts.output_tokens,
          toolCalls: facts.tool_calls,
          compactions: facts.compactions,
          prompts: humanPromptCounts[session.id] ?? 0,
          activeMs: session.activeMs ?? 0,
          lastRequestAt: facts.last_request_at,
          lastExitAt,
          status,
        },
      }
    })

    const rawPrompts = yield* queryRows<RawPromptRow>(
      db,
      horizon,
      'prompts',
      'select bounded human prompt markers',
      `select session_id, ts_ms, steering
     from human_prompts
     where root_session_id in (${rootSlots})
       and session_id in (${activeSessionSlots})
       and ts_ms between ? and ?
     order by ts_ms, entry_id
     limit ?`,
      [...rootIds, ...activeSessionIds, windowStart, windowEnd, MAX_TIMELINE_PROMPTS],
    )
    return {
      horizon,
      windowStart,
      windowEnd,
      modelCapacities: {},
      sessions: sessionsWithFacts,
      requests,
      bins,
      sampled: foldedCount > 0,
      folded: foldedCount,
      activitySampled: sessions.some((session) => session.activitySampled === true),
      events,
      humanPrompts: rawPrompts.map((prompt) => ({
        sessionId: prompt.session_id,
        ts: prompt.ts_ms,
        steering: prompt.steering !== 0,
      })),
      humanPromptCount,
      humanPromptCounts,
      coverage: {
        includedRoots: includedCoverage.included_roots,
        matchingSessions: matchingSessions?.total ?? sessions.length,
        totalRoots: coverage.total_roots,
        includedRequests: includedCoverage.included_requests,
        totalRequests: coverage.total_requests,
        includedUsd: roundUsd(includedCoverage.included_usd),
        totalUsd: roundUsd(coverage.total_usd),
        policy: selectionPolicy(horizon, selection, tmux?.agents ?? 0),
      },
      parameters: { idleThresholdMs: 600_000, activeWithinMs: 600_000 },
    }
  })

const openLedger = (path: string): Effect.Effect<DatabaseSync, AgentTimelineError> => {
  try {
    statSync(path)
  } catch (cause) {
    const code =
      typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined
    return Effect.fail(
      code === 'ENOENT'
        ? new AgentTimelineError({ reason: 'missing', message: 'OMP Usage ledger does not exist' })
        : new AgentTimelineError({
            reason: 'open',
            message: 'Could not inspect the OMP Usage ledger',
          }),
    )
  }
  return Effect.try({
    try: () => {
      const db = new DatabaseSync(path, { readOnly: true })
      try {
        db.exec('BEGIN')
        return db
      } catch (cause) {
        db.close()
        throw cause
      }
    },
    catch: () =>
      new AgentTimelineError({
        reason: 'open',
        message: 'Could not open the OMP Usage ledger read-only',
      }),
  })
}

const closeLedger = (db: DatabaseSync): Effect.Effect<void> =>
  Effect.sync(() => {
    try {
      db.exec('ROLLBACK')
    } finally {
      db.close()
    }
  })

/** Loads and validates one horizon projection from a read-only ledger snapshot at an epoch-millisecond boundary. */
export const loadAgentTimelineFromLedger = ({
  path,
  horizon,
  windowEnd,
  selection,
}: {
  readonly path: string
  readonly horizon: AgentTimelineHorizon
  readonly windowEnd: number
  readonly selection: AgentTimelineSelection
}): Effect.Effect<AgentTimelineModel, AgentTimelineError> =>
  Effect.acquireUseRelease(
    openLedger(path),
    (db) =>
      projectLedger(db, horizon, windowEnd, selection).pipe(
        Effect.mapError((failure) =>
          failure instanceof AgentTimelineError
            ? failure
            : new AgentTimelineError({
                reason: failure instanceof ProjectionDecodeFailure ? 'decode' : 'query',
                message:
                  failure instanceof ProjectionDecodeFailure
                    ? `OMP Usage ledger projection is invalid: ${failure.message}`
                    : 'Could not query the OMP Usage ledger',
              }),
        ),
        Effect.catchDefect((failure) =>
          Effect.fail(
            new AgentTimelineError({
              reason: failure instanceof ProjectionDecodeFailure ? 'decode' : 'query',
              message:
                failure instanceof ProjectionDecodeFailure
                  ? `OMP Usage ledger projection is invalid: ${failure.message}`
                  : 'Could not query the OMP Usage ledger',
            }),
          ),
        ),
      ),
    closeLedger,
  ).pipe(
    Effect.filterOrFail(
      (projected): projected is AgentTimelineModel => projected !== null,
      () =>
        new AgentTimelineError({
          reason: 'empty',
          message:
            selection._tag === 'top'
              ? `OMP Usage ledger has no requests in the ${horizon} horizon`
              : selection._tag === 'actors'
                ? `OMP Usage ledger has no requests from the selected agents in the ${horizon} horizon`
                : `No agent attached to tmux session ${selection.tmuxSession} has requests in the ${horizon} horizon`,
        }),
    ),
    Effect.flatMap((projected) =>
      Schema.decodeEffect(AgentTimelineModelSchema, { onExcessProperty: 'error' })(projected).pipe(
        Effect.mapError(
          () =>
            new AgentTimelineError({
              reason: 'decode',
              message: 'OMP Usage ledger projection does not match the Agent Timeline model',
            }),
        ),
      ),
    ),
    Effect.tap((model) => {
      const capHit =
        model.sessions.length ===
          (selection._tag === 'top' ? MAX_TIMELINE_SESSIONS : MAX_ACTOR_TIMELINE_SESSIONS) ||
        model.requests.length === MAX_RETAINED_REQUESTS ||
        model.bins.length === MAX_TIMELINE_BINS ||
        model.events.length === MAX_TIMELINE_EVENTS ||
        model.humanPrompts.length === MAX_TIMELINE_PROMPTS ||
        model.requests.some((request) => request.tools.length === MAX_TOOLS_PER_REQUEST) ||
        model.bins.some((bin) => bin.tools.length === MAX_TOOLS_PER_BIN) ||
        model.activitySampled === true
      return Effect.annotateCurrentSpan({
        'sk.vista.agent_timeline.sessions': model.sessions.length,
        'sk.vista.agent_timeline.retained_requests': model.requests.length,
        'sk.vista.agent_timeline.bins': model.bins.length,
        'sk.vista.agent_timeline.events': model.events.length,
        'sk.vista.agent_timeline.prompts': model.humanPrompts.length,
        'sk.vista.agent_timeline.prompt_total': model.humanPromptCount ?? model.humanPrompts.length,
        'sk.vista.agent_timeline.activity_segments': model.sessions.reduce(
          (total, session) => total + (session.activity?.length ?? 0),
          0,
        ),
        'sk.vista.agent_timeline.folded': model.folded,
        'sk.vista.agent_timeline.sampled': Number(model.sampled),
        'sk.vista.agent_timeline.activity_sampled': Number(model.activitySampled === true),
        'sk.vista.agent_timeline.cap_hit': Number(capHit),
      })
    }),
    Effect.tapError((error) => Effect.annotateCurrentSpan('error.type', error.reason)),
    Effect.withSpan('vista.agent_timeline.load', {
      attributes: {
        'span.label': 'ledger',
        'sk.vista.agent_timeline.horizon': horizon,
        'sk.vista.agent_timeline.selection': selection._tag,
        'sk.vista.agent_timeline.actor_filter_count':
          selection._tag === 'actors' ? selection.actors.length : 0,
      },
    }),
  )

/** Source contract for loading an Agent Timeline projection for a requested horizon and optional root filter. */
export interface AgentTimelineSourceService {
  readonly load: (args: {
    readonly horizon: AgentTimelineHorizon
    readonly actors?: ReadonlyArray<string> | undefined
    readonly tmuxSession?: string | undefined
  }) => Effect.Effect<AgentTimelineModel, AgentTimelineError>
}

/** Effect context service that supplies Agent Timeline projection data. */
export class AgentTimelineSource extends Context.Service<
  AgentTimelineSource,
  AgentTimelineSourceService
>()('Vista/AgentTimelineSource') {}

const makeSourceLayer = ({
  ledgerPath,
  now,
  commandRunner,
}: {
  readonly ledgerPath: () => string
  readonly now: () => number
  readonly commandRunner: Layer.Layer<AgentTimelineCommandRunner>
}): Layer.Layer<AgentTimelineSource> =>
  Layer.effect(
    AgentTimelineSource,
    Effect.gen(function* () {
      const resolver = makeAgentTimelineTmuxResolver({
        runner: yield* AgentTimelineCommandRunner,
        now,
      })
      return AgentTimelineSource.of({
        load: ({ horizon, actors, tmuxSession }) =>
          loadAgentTimelineFromLedger({
            path: ledgerPath(),
            horizon,
            windowEnd: now(),
            selection:
              tmuxSession !== undefined
                ? { _tag: 'tmux', tmuxSession, resolver }
                : actors !== undefined
                  ? { _tag: 'actors', actors }
                  : { _tag: 'top' },
          }),
      })
    }),
  ).pipe(Layer.provide(commandRunner))

/**
 * Creates an Agent Timeline source layer using an explicit ledger path, injectable epoch-millisecond
 * clock, and injectable subprocess runner for tmux resolution.
 */
export const makeAgentTimelineSourceLayer = ({
  ledgerPath,
  now = Date.now,
  commandRunner = AgentTimelineCommandRunnerLive,
}: {
  readonly ledgerPath: string
  readonly now?: () => number
  readonly commandRunner?: Layer.Layer<AgentTimelineCommandRunner>
}): Layer.Layer<AgentTimelineSource> =>
  makeSourceLayer({ ledgerPath: () => ledgerPath, now, commandRunner })

/** Live Agent Timeline source backed by the configured OMP Usage ledger, system clock and subprocesses. */
export const AgentTimelineSourceLive = makeSourceLayer({
  ledgerPath: () => resolveAgentTimelineLedgerPath(process.env.VISTA_OMP_LEDGER_PATH),
  now: Date.now,
  commandRunner: AgentTimelineCommandRunnerLive,
})

/** Effectful provider implementation that delegates load requests to the configured timeline source. */
export const agentTimelineImplementation = implement(agentTimeline, {
  purity: 'effectful',
  handlers: {
    load: ({ horizon, actors, tmuxSession }) =>
      Effect.flatMap(AgentTimelineSource, (source) =>
        source.load({ horizon, actors, tmuxSession }),
      ),
  },
})

/** Mounts the Agent Timeline provider with the supplied source layer. */
export const makeAgentTimelineProvider = (layer: Layer.Layer<AgentTimelineSource>) =>
  mountProvider(agentTimelineImplementation, layer)

export default makeAgentTimelineProvider(AgentTimelineSourceLive)
