/**
 * Extracts standard horizon fixtures, or one complete root tree with
 * `--root <session-id>` / `--seat <actor-id>` and optional `--out <path>`.
 */
import { Database } from 'bun:sqlite'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import type {
  AgentTimelineBin,
  AgentTimelineEvent,
  AgentTimelineHorizon,
  AgentTimelineModel,
  AgentTimelineRequest,
  AgentTimelineSession,
  AgentSessionRole,
} from '@overeng/agent-timeline/model'
import { deriveAgentTimelineActivity } from '@overeng/agent-timeline/projection'

const MAX_FIXTURE_BYTES = 1_500_000
const HOUR_MS = 60 * 60 * 1_000
const IDLE_THRESHOLD_MS = 10 * 60 * 1_000

const horizons: ReadonlyArray<{
  readonly horizon: AgentTimelineHorizon
  readonly durationMs: number
  readonly rootLimit: number
  readonly ranking: 'requests' | 'usd'
}> = [
  { horizon: '1h', durationMs: HOUR_MS, rootLimit: 3, ranking: 'requests' },
  { horizon: '1d', durationMs: 24 * HOUR_MS, rootLimit: 3, ranking: 'usd' },
  { horizon: '7d', durationMs: 7 * 24 * HOUR_MS, rootLimit: 6, ranking: 'usd' },
]

interface RootRow {
  readonly root_session_id: string
  readonly score: number
}

interface RootActivityRow {
  readonly root_session_id: string
  readonly requests: number
  readonly agent_turns: number
  readonly human_prompts: number
  readonly engagement: number
}

interface CoverageRow {
  readonly total_roots: number
  readonly total_requests: number
  readonly total_usd: number
}

interface TargetRootRow {
  readonly root_session_id: string
  readonly requests: number
  readonly children: number
}

interface RawRequestRow {
  readonly entry_id: string
  readonly ts_ms: number
  readonly duration_ms: number | null
  readonly session_id: string
  readonly kind: string
  readonly stop_reason: string
  readonly provider: string
  readonly model: string
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
  readonly provider: string
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

interface RawEventRow {
  readonly id: number
  readonly session_id: string
  readonly ts_ms: number
  readonly kind: string
  readonly payload_json: string
}

interface RawToolRow {
  readonly request_entry_id: string
  readonly tool_name: string
}

interface RawPromptRow {
  readonly entry_id: string
  readonly session_id: string
  readonly ts_ms: number
  readonly steering: number
}

interface ExtractedRequest {
  readonly entryId: string
  readonly request: AgentTimelineRequest
}

interface SessionInitMetadata {
  readonly agentType: string | null
  readonly task: string | null
  readonly modelRole: string | null
  readonly readOnly: boolean
}

interface ChildLabelInput {
  readonly sessionId: string
  readonly name: string
}

const dbPath = join(homedir(), '.local/state/omp-usage/ledger.sqlite')
const outputDirectory = join(import.meta.dir, '../src/stories/agent-timeline')
const db = new Database(dbPath, { readonly: true })
const readRuntimeModelCapacities = async (): Promise<ReadonlyMap<string, number>> => {
  const child = Bun.spawn(['omp', 'models', '--json'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`omp models --json failed (${exitCode}): ${stderr.trim()}`)
  }

  const parsed: unknown = JSON.parse(stdout)
  if (typeof parsed !== 'object' || parsed === null || !('models' in parsed)) {
    throw new Error('omp models --json returned an invalid catalog')
  }
  const models = parsed.models
  if (!Array.isArray(models)) throw new Error('omp models --json omitted its models array')

  const capacities = new Map<string, number>()
  for (const rawModel of models) {
    if (typeof rawModel !== 'object' || rawModel === null) continue
    if (
      !('provider' in rawModel) ||
      typeof rawModel.provider !== 'string' ||
      !('id' in rawModel) ||
      typeof rawModel.id !== 'string' ||
      !('contextWindow' in rawModel) ||
      typeof rawModel.contextWindow !== 'number' ||
      !Number.isFinite(rawModel.contextWindow) ||
      rawModel.contextWindow <= 0
    ) {
      continue
    }
    capacities.set(`${rawModel.provider}/${rawModel.id}`, rawModel.contextWindow)
  }
  return capacities
}

const runtimeModelCapacities = await readRuntimeModelCapacities()

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ')
const roundUsd = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength
const isAgentTurn = (request: AgentTimelineRequest): boolean =>
  request.kind === 'turn' && request.stopReason === 'stop'

const sessionRole = (value: string): AgentSessionRole => {
  switch (value) {
    case 'main':
    case 'subagent':
    case 'advisor':
      return value
    default:
      throw new Error(`Unexpected agent session role: ${value}`)
  }
}

const requestKind = (value: string): AgentTimelineRequest['kind'] => {
  switch (value) {
    case 'turn':
    case 'auxiliary':
      return value
    default:
      throw new Error(`Unexpected request kind: ${value}`)
  }
}

const canonicalModelId = (value: string): string => value.slice(value.lastIndexOf('/') + 1)

const parsePayload = (json: string): Readonly<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(json)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {}
}

const neutralizeText = (value: string): string =>
  value
    .replace(/\b[a-z0-9-]+\.direct\.omp\.[a-z0-9-]+\b/gi, 'host-a')
    .replace(/(^|[\s("'`])\/(?:[^\s'"`)]+\/?)+/g, '$1[absolute path removed]')
    .replace(/\s+/g, ' ')
    .trim()

const sanitizeTitle = (title: string | null): string | null =>
  title === null ? null : neutralizeText(title)

const parseJsonRecord = (line: string): Readonly<Record<string, unknown>> | null => {
  try {
    const parsed: unknown = JSON.parse(line)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as Readonly<Record<string, unknown>>
  } catch {
    return null
  }
}

/**
 * Streams JSONL without retaining transcript contents. Returning true from
 * `onLine` stops immediately, which bounds child-header reads to ten records.
 */
const scanJsonl = async (
  path: string,
  maxLines: number,
  onLine: (line: string) => boolean,
): Promise<void> => {
  const reader = Bun.file(path).stream().getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lines = 0
  try {
    while (lines < maxLines) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let newline = buffer.indexOf('\n')
      while (newline >= 0 && lines < maxLines) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        lines += 1
        if (onLine(line)) return
        newline = buffer.indexOf('\n')
      }
      if (chunk.done) {
        if (buffer.length > 0 && lines < maxLines) onLine(buffer)
        return
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

const emptySessionInit: SessionInitMetadata = {
  agentType: null,
  task: null,
  modelRole: null,
  readOnly: false,
}

/** Reads only the child transcript header up through its session_init record. */
const readSessionInit = async (path: string): Promise<SessionInitMetadata> => {
  let metadata = emptySessionInit
  try {
    await scanJsonl(path, 10, (line) => {
      const record = parseJsonRecord(line)
      if (record?.type !== 'session_init') return false
      metadata = {
        agentType: typeof record.agent === 'string' ? record.agent : null,
        task: typeof record.task === 'string' ? record.task : null,
        modelRole: typeof record.modelRole === 'string' ? record.modelRole : null,
        readOnly: record.readOnly === true,
      }
      return true
    })
  } catch {
    return emptySessionInit
  }
  return metadata
}

const taskIntents = (
  record: Readonly<Record<string, unknown>>,
): ReadonlyArray<{ readonly childName: string; readonly intent: string }> => {
  if (
    typeof record.message !== 'object' ||
    record.message === null ||
    Array.isArray(record.message)
  ) {
    return []
  }
  const message = record.message as Readonly<Record<string, unknown>>
  if (!Array.isArray(message.content)) return []
  const intents: Array<{ readonly childName: string; readonly intent: string }> = []
  for (const rawItem of message.content) {
    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) continue
    const item = rawItem as Readonly<Record<string, unknown>>
    if (
      item.type !== 'toolCall' ||
      item.name !== 'task' ||
      typeof item.arguments !== 'object' ||
      item.arguments === null ||
      Array.isArray(item.arguments)
    ) {
      continue
    }
    const args = item.arguments as Readonly<Record<string, unknown>>
    if (typeof args.i !== 'string' || !Array.isArray(args.tasks)) continue
    for (const rawTask of args.tasks) {
      if (typeof rawTask !== 'object' || rawTask === null || Array.isArray(rawTask)) continue
      const task = rawTask as Readonly<Record<string, unknown>>
      if (typeof task.name === 'string') {
        intents.push({ childName: task.name, intent: args.i })
      }
    }
  }
  return intents
}

/**
 * Scans one parent transcript once for all selected children and parses only
 * records containing at least one child name.
 */
const readParentIntents = async (
  path: string,
  children: ReadonlyArray<ChildLabelInput>,
): Promise<ReadonlyMap<string, string>> => {
  const intents = new Map<string, string>()
  try {
    await scanJsonl(path, Number.POSITIVE_INFINITY, (line) => {
      const matchingChildren = children.filter((child) => line.includes(child.name))
      if (matchingChildren.length === 0) return false
      const record = parseJsonRecord(line)
      if (record === null) return false
      for (const candidate of taskIntents(record)) {
        for (const child of matchingChildren) {
          if (candidate.childName === child.name) intents.set(child.sessionId, candidate.intent)
        }
      }
      return intents.size === children.length
    })
  } catch {
    return intents
  }
  return intents
}

const summarizeTask = (intent: string | null, initialTask: string | null): string | null => {
  const childSummary =
    initialTask
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 &&
          !/^complete assignment thoroughly:?$/i.test(line) &&
          !/^#{1,6}(?:\s|$)/.test(line),
      )
      .map((line) => line.replace(/^(?:[-*+]|\d+[.)])\s+/, '').trim())
      .find((line) => line.length > 0) ?? null
  const source = childSummary ?? intent
  if (source === null) return null
  const summary = neutralizeText(source)
  if (summary.length === 0) return null
  return summary.length <= 120 ? summary : `${summary.slice(0, 119).trimEnd()}…`
}

const personaFromTitle = (title: string | null): string | null => {
  const persona = title?.match(/\[([^\]]+)\]/)?.[1]?.trim()
  return persona && persona.length > 0 ? persona : null
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
  if (repo !== null && branch !== null && !repo.startsWith('/') && !branch.startsWith('/')) {
    return `${repo}@${branch}`
  }
  return null
}

const renderModel = (model: AgentTimelineModel): string => `${JSON.stringify(model)}\n`

const rootActivity = (windowStart: number, windowEnd: number): ReadonlyArray<RootActivityRow> =>
  db
    .query(
      `with request_activity as (
         select root_session_id,
                count(*) as requests,
                sum(case when kind = 'turn' and stop_reason = 'stop' then 1 else 0 end) as agent_turns
         from requests
         where ts_ms between ? and ?
         group by root_session_id
       ),
       prompt_activity as (
         select root_session_id, count(*) as human_prompts
         from human_prompts
         where ts_ms between ? and ?
         group by root_session_id
       )
       select request_activity.root_session_id,
              requests,
              agent_turns,
              coalesce(human_prompts, 0) as human_prompts,
              agent_turns + coalesce(human_prompts, 0) as engagement
       from request_activity
       left join prompt_activity using (root_session_id)
       order by engagement desc, requests desc, request_activity.root_session_id`,
    )
    .all(windowStart, windowEnd, windowStart, windowEnd) as ReadonlyArray<RootActivityRow>

/**
 * Picks an engaged primary tree with at least 100 requests, then adds up to two
 * active trees. When possible, one addition contributes human-prompt evidence.
 */
const chooseOneHourRoots = (activity: ReadonlyArray<RootActivityRow>): ReadonlyArray<RootRow> => {
  const primary = activity.find((root) => root.requests >= 100)
  if (primary === undefined) return []

  const chosen: RootActivityRow[] = [primary]
  const remaining = activity.filter(
    (root) => root.root_session_id !== primary.root_session_id && root.engagement > 0,
  )
  const firstAddition = remaining.at(0)
  if (firstAddition !== undefined) chosen.push(firstAddition)

  if (chosen.length < 3) {
    const chosenIds = new Set(chosen.map((root) => root.root_session_id))
    const candidates = remaining.filter((root) => !chosenIds.has(root.root_session_id))
    const promptAddition = chosen.some((root) => root.human_prompts > 0)
      ? undefined
      : [...candidates].toSorted(
          (left, right) =>
            right.human_prompts - left.human_prompts ||
            right.engagement - left.engagement ||
            right.requests - left.requests ||
            left.root_session_id.localeCompare(right.root_session_id),
        )[0]
    const addition = promptAddition ?? candidates.at(0)
    if (addition !== undefined) chosen.push(addition)
  }

  return chosen.map((root) => ({
    root_session_id: root.root_session_id,
    score: root.engagement,
  }))
}

/**
 * Uses the latest frozen hour when it contains engagement. Otherwise, scans
 * the last 24 clock-hour windows and freezes the fixture at the busiest one.
 */
const selectOneHour = (
  latestWindowEnd: number,
): {
  readonly windowEnd: number
  readonly roots: ReadonlyArray<RootRow>
  readonly widened: boolean
} => {
  const latestActivity = rootActivity(latestWindowEnd - HOUR_MS, latestWindowEnd)
  const latestRoots = chooseOneHourRoots(latestActivity)
  if ((latestRoots.at(0)?.score ?? 0) > 0) {
    return { windowEnd: latestWindowEnd, roots: latestRoots, widened: false }
  }

  const latestClockHourEnd = Math.floor(latestWindowEnd / HOUR_MS) * HOUR_MS + HOUR_MS
  let best:
    | {
        readonly windowEnd: number
        readonly activity: ReadonlyArray<RootActivityRow>
        readonly primary: RootActivityRow
      }
    | undefined
  for (let offset = 0; offset < 24; offset += 1) {
    const candidateEnd = latestClockHourEnd - offset * HOUR_MS
    const activity = rootActivity(candidateEnd - HOUR_MS, candidateEnd)
    const primary = activity.find((root) => root.requests >= 100)
    if (primary === undefined) continue
    if (
      best === undefined ||
      primary.engagement > best.primary.engagement ||
      (primary.engagement === best.primary.engagement && primary.requests > best.primary.requests)
    ) {
      best = { windowEnd: candidateEnd, activity, primary }
    }
  }

  if (best === undefined) {
    return { windowEnd: latestWindowEnd, roots: latestRoots, widened: false }
  }
  return {
    windowEnd: best.windowEnd,
    roots: chooseOneHourRoots(best.activity),
    widened: true,
  }
}

const selectionPolicy = (horizon: AgentTimelineHorizon): string => {
  switch (horizon) {
    case '1h':
      return 'Up to 3 engaged roots: a root with at least 100 requests, then highest engagement (agent turns + human prompts), adding prompt evidence when available; latest active hour or the busiest of the previous 24 hours.'
    case '1d':
      return 'Top 3 roots by API-equivalent cost in the horizon.'
    case '7d':
      return 'Top 6 roots by API-equivalent cost in the horizon.'
  }
}

/** Mandatory request rows survive size-cap thinning. */
const mandatoryRequestIds = (
  requests: ReadonlyArray<ExtractedRequest>,
  events: ReadonlyArray<AgentTimelineEvent>,
): ReadonlySet<string> => {
  const mandatory = new Set<string>()
  const bySession = new Map<string, ExtractedRequest[]>()
  for (const extracted of requests) {
    const sessionRequests = bySession.get(extracted.request.sessionId) ?? []
    sessionRequests.push(extracted)
    bySession.set(extracted.request.sessionId, sessionRequests)
    if (isAgentTurn(extracted.request)) mandatory.add(extracted.entryId)
  }

  for (const sessionRequests of bySession.values()) {
    const first = sessionRequests.at(0)
    const last = sessionRequests.at(-1)
    if (first !== undefined) mandatory.add(first.entryId)
    if (last !== undefined) mandatory.add(last.entryId)
    const measured = sessionRequests.find((request) => request.request.contextTokens !== null)
    const estimated = sessionRequests.find((request) => request.request.contextTokens === null)
    if (measured !== undefined) mandatory.add(measured.entryId)
    if (estimated !== undefined) mandatory.add(estimated.entryId)
  }

  for (const event of events) {
    if (event._tag !== 'compaction') continue
    const sessionRequests = bySession.get(event.sessionId) ?? []
    let before: ExtractedRequest | undefined
    let after: ExtractedRequest | undefined
    for (const extracted of sessionRequests) {
      if (
        extracted.request.ts < event.ts &&
        (before === undefined || extracted.request.ts > before.request.ts)
      ) {
        before = extracted
      }
      if (
        extracted.request.ts > event.ts &&
        (after === undefined || extracted.request.ts < after.request.ts)
      ) {
        after = extracted
      }
    }
    if (before !== undefined) mandatory.add(before.entryId)
    if (after !== undefined) mandatory.add(after.entryId)
  }

  return mandatory
}

/** Selects `count` evenly-spaced rows while preserving the original order. */
const uniformSample = <T>(values: ReadonlyArray<T>, count: number): ReadonlyArray<T> => {
  if (count <= 0) return []
  if (count >= values.length) return values
  if (count === 1) return [values[Math.floor(values.length / 2)]!]
  return Array.from(
    { length: count },
    (_, index) => values[Math.floor((index * (values.length - 1)) / (count - 1))]!,
  )
}

interface MutableBin {
  readonly sessionId: string
  readonly from: number
  readonly to: number
  requests: number
  usd: number
  usdInput: number
  usdCacheRead: number
  usdCacheWrite: number
  usdOutput: number
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  toolCalls: number
  readonly tools: Set<string>
  readonly byModel: Map<string, { requests: number; usd: number }>
  readonly byStop: Map<string, number>
  contextEstimated: boolean
}

const binWidthFor = (horizon: AgentTimelineHorizon): number => {
  switch (horizon) {
    case '1h':
      return 60_000
    case '1d':
      return 5 * 60_000
    case '7d':
      return 30 * 60_000
  }
}

const retainedRowsAndBins = (
  extractedRequests: ReadonlyArray<ExtractedRequest>,
  keptIds: ReadonlySet<string>,
  model: AgentTimelineModel,
): {
  readonly requests: ReadonlyArray<AgentTimelineRequest>
  readonly bins: ReadonlyArray<AgentTimelineBin>
} => {
  const requests: AgentTimelineRequest[] = []
  const binsByKey = new Map<string, MutableBin>()
  const width = binWidthFor(model.horizon)
  for (const { entryId, request } of extractedRequests) {
    if (keptIds.has(entryId)) {
      requests.push(request)
      continue
    }

    const from = model.windowStart + Math.floor((request.ts - model.windowStart) / width) * width
    const key = `${request.sessionId}\u0000${from}`
    let bin = binsByKey.get(key)
    if (bin === undefined) {
      bin = {
        sessionId: request.sessionId,
        from,
        to: Math.min(model.windowEnd, from + width),
        requests: 0,
        usd: 0,
        usdInput: 0,
        usdCacheRead: 0,
        usdCacheWrite: 0,
        usdOutput: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        toolCalls: 0,
        tools: new Set(),
        byModel: new Map(),
        byStop: new Map(),
        contextEstimated: false,
      }
      binsByKey.set(key, bin)
    }
    bin.requests += 1
    bin.usd += request.usd
    bin.usdInput += request.usdInput
    bin.usdCacheRead += request.usdCacheRead
    bin.usdCacheWrite += request.usdCacheWrite
    bin.usdOutput += request.usdOutput
    bin.inputTokens += request.inputTokens
    bin.cacheReadTokens += request.cacheReadTokens
    bin.cacheWriteTokens += request.cacheWriteTokens
    bin.outputTokens += request.outputTokens
    bin.toolCalls += request.toolCalls
    for (const tool of request.tools) bin.tools.add(tool)
    const byModel = bin.byModel.get(request.model) ?? { requests: 0, usd: 0 }
    byModel.requests += 1
    byModel.usd += request.usd
    bin.byModel.set(request.model, byModel)
    bin.byStop.set(request.stopReason, (bin.byStop.get(request.stopReason) ?? 0) + 1)
    bin.contextEstimated ||= request.contextTokens === null
  }

  const bins = [...binsByKey.values()]
    .toSorted(
      (left, right) => left.from - right.from || left.sessionId.localeCompare(right.sessionId),
    )
    .map(
      (bin): AgentTimelineBin => ({
        sessionId: bin.sessionId,
        from: bin.from,
        to: bin.to,
        requests: bin.requests,
        usd: roundUsd(bin.usd),
        usdInput: roundUsd(bin.usdInput),
        usdCacheRead: roundUsd(bin.usdCacheRead),
        usdCacheWrite: roundUsd(bin.usdCacheWrite),
        usdOutput: roundUsd(bin.usdOutput),
        inputTokens: bin.inputTokens,
        cacheReadTokens: bin.cacheReadTokens,
        cacheWriteTokens: bin.cacheWriteTokens,
        outputTokens: bin.outputTokens,
        toolCalls: bin.toolCalls,
        tools: [...bin.tools].toSorted(),
        byModel: Object.fromEntries(
          [...bin.byModel]
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([requestModel, aggregate]) => [
              requestModel,
              { requests: aggregate.requests, usd: roundUsd(aggregate.usd) },
            ]),
        ),
        byStop: Object.fromEntries(
          [...bin.byStop].toSorted(([left], [right]) => left.localeCompare(right)),
        ),
        contextEstimated: bin.contextEstimated,
      }),
    )
  return { requests, bins }
}

/** Fits a model under the fixture cap without dropping semantic anchor rows. */
const fitToSizeCap = (
  model: AgentTimelineModel,
  extractedRequests: ReadonlyArray<ExtractedRequest>,
): { readonly model: AgentTimelineModel; readonly json: string } => {
  const fullJson = renderModel(model)
  if (byteLength(fullJson) <= MAX_FIXTURE_BYTES) return { model, json: fullJson }

  const mandatoryIds = mandatoryRequestIds(extractedRequests, model.events)
  const optional = extractedRequests.filter((request) => !mandatoryIds.has(request.entryId))
  const makeCandidate = (optionalCount: number): AgentTimelineModel => {
    const keptIds = new Set<string>(mandatoryIds)
    for (const request of uniformSample(optional, optionalCount)) keptIds.add(request.entryId)
    const { requests, bins } = retainedRowsAndBins(extractedRequests, keptIds, model)
    return {
      ...model,
      requests,
      bins,
      sampled: true,
      folded: extractedRequests.length - requests.length,
    }
  }

  let low = 0
  let high = optional.length
  let fittedModel = makeCandidate(0)
  let fittedJson = renderModel(fittedModel)
  if (byteLength(fittedJson) > MAX_FIXTURE_BYTES) {
    throw new Error(
      `${model.horizon} mandatory rows and bins exceed ${MAX_FIXTURE_BYTES.toLocaleString()} bytes`,
    )
  }

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = makeCandidate(middle)
    const json = renderModel(candidate)
    if (byteLength(json) <= MAX_FIXTURE_BYTES) {
      fittedModel = candidate
      fittedJson = json
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return { model: fittedModel, json: fittedJson }
}

interface ConservedTotals {
  readonly requests: number
  readonly inputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly outputTokens: number
  readonly toolCalls: number
  readonly usd: number
  readonly usdInput: number
  readonly usdCacheRead: number
  readonly usdCacheWrite: number
  readonly usdOutput: number
}

const conservedTotals = (
  requests: ReadonlyArray<AgentTimelineRequest>,
  bins: ReadonlyArray<AgentTimelineBin>,
): ConservedTotals => {
  const values = [...requests, ...bins]
  return {
    requests: values.reduce((total, value) => total + value.requests, 0),
    inputTokens: values.reduce((total, value) => total + value.inputTokens, 0),
    cacheReadTokens: values.reduce((total, value) => total + value.cacheReadTokens, 0),
    cacheWriteTokens: values.reduce((total, value) => total + value.cacheWriteTokens, 0),
    outputTokens: values.reduce((total, value) => total + value.outputTokens, 0),
    toolCalls: values.reduce((total, value) => total + value.toolCalls, 0),
    usd: values.reduce((total, value) => total + value.usd, 0),
    usdInput: values.reduce((total, value) => total + value.usdInput, 0),
    usdCacheRead: values.reduce((total, value) => total + value.usdCacheRead, 0),
    usdCacheWrite: values.reduce((total, value) => total + value.usdCacheWrite, 0),
    usdOutput: values.reduce((total, value) => total + value.usdOutput, 0),
  }
}

const assertConservation = (
  horizon: AgentTimelineHorizon,
  allRequests: ReadonlyArray<AgentTimelineRequest>,
  model: AgentTimelineModel,
): void => {
  const expected = conservedTotals(allRequests, [])
  const actual = conservedTotals(model.requests, model.bins)
  for (const field of [
    'requests',
    'inputTokens',
    'cacheReadTokens',
    'cacheWriteTokens',
    'outputTokens',
    'toolCalls',
  ] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(
        `${horizon} ${field} conservation failed: ${actual[field]} !== ${expected[field]}`,
      )
    }
  }
  for (const field of ['usd', 'usdInput', 'usdCacheRead', 'usdCacheWrite', 'usdOutput'] as const) {
    if (Math.abs(actual[field] - expected[field]) > 0.001) {
      throw new Error(
        `${horizon} ${field} conservation failed: ${actual[field]} !== ${expected[field]}`,
      )
    }
  }
  for (const bin of model.bins) {
    const modelRequests = Object.values(bin.byModel).reduce(
      (total, aggregate) => total + aggregate.requests,
      0,
    )
    const modelUsd = Object.values(bin.byModel).reduce(
      (total, aggregate) => total + aggregate.usd,
      0,
    )
    const stopRequests = Object.values(bin.byStop).reduce((total, count) => total + count, 0)
    if (
      modelRequests !== bin.requests ||
      stopRequests !== bin.requests ||
      Math.abs(modelUsd - bin.usd) > 0.001
    ) {
      throw new Error(
        `${horizon} bin breakdown conservation failed at ${bin.sessionId}:${bin.from}`,
      )
    }
  }
}

const actorRows = db
  .query(
    `select actor_id, min(ts_ms) as first_ts_ms
     from requests
     group by actor_id
     order by first_ts_ms, actor_id`,
  )
  .all() as ReadonlyArray<{ readonly actor_id: string; readonly first_ts_ms: number }>
const seatByActor = new Map(
  actorRows.map((row, index) => [row.actor_id, `seat-${String(index + 1).padStart(2, '0')}`]),
)

const windowEndRow = db.query('select max(ts_ms) as ts_ms from requests').get() as {
  readonly ts_ms: number | null
}
const ledgerWindowEnd = windowEndRow.ts_ms
if (ledgerWindowEnd === null)
  throw new Error('Cannot extract fixtures from an empty requests table')

const eventKinds = db
  .query('select kind, count(*) as count from session_events group by kind order by kind')
  .all() as ReadonlyArray<{ readonly kind: string; readonly count: number }>
console.log(
  `session event kinds: ${eventKinds.map((row) => `${row.kind}=${row.count}`).join(', ')}`,
)

await mkdir(outputDirectory, { recursive: true })

const isHorizon = (value: string): value is AgentTimelineHorizon =>
  value === '1h' || value === '1d' || value === '7d'
const commandArguments = Bun.argv.slice(2)
let requestedRoot: string | undefined
let requestedSeat: string | undefined
let requestedOutput: string | undefined
let preserveSelection = false
const requestedHorizons: AgentTimelineHorizon[] = []
for (let index = 0; index < commandArguments.length; index += 1) {
  const argument = commandArguments[index]
  if (argument === undefined) continue
  if (argument === '--preserve-selection') {
    preserveSelection = true
    continue
  }
  if (argument === '--root' || argument === '--seat' || argument === '--out') {
    const value = commandArguments[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${argument} requires a value`)
    }
    if (argument === '--root') requestedRoot = value
    if (argument === '--seat') requestedSeat = value
    if (argument === '--out') requestedOutput = value
    index += 1
    continue
  }
  if (!isHorizon(argument)) throw new Error(`Unknown argument: ${argument}`)
  requestedHorizons.push(argument)
}
if (requestedRoot !== undefined && requestedSeat !== undefined) {
  throw new Error('--root and --seat are mutually exclusive')
}
const targeted = requestedRoot !== undefined || requestedSeat !== undefined
if (targeted && (requestedHorizons.length > 0 || preserveSelection)) {
  throw new Error('Targeted extraction cannot be combined with horizons or --preserve-selection')
}
if (!targeted && requestedOutput !== undefined) {
  throw new Error('--out requires --root or --seat')
}

const targetWindowEnd = Date.now()
let targetRoot = requestedRoot
if (requestedSeat !== undefined) {
  const seatRootRow = db
    .query(
      `with candidates as (
         select distinct root_session_id
         from requests
         where actor_id = ? and ts_ms between ? and ?
       )
       select candidates.root_session_id,
              count(requests.entry_id) as requests,
              count(distinct case
                when requests.session_id != requests.root_session_id then requests.session_id
              end) as children
       from candidates
       join requests on requests.root_session_id = candidates.root_session_id
         and requests.ts_ms between ? and ?
       group by candidates.root_session_id
       order by children desc, requests desc, candidates.root_session_id
       limit 1`,
    )
    .get(
      requestedSeat,
      targetWindowEnd - 3 * 24 * HOUR_MS,
      targetWindowEnd,
      targetWindowEnd - 3 * 24 * HOUR_MS,
      targetWindowEnd,
    ) as TargetRootRow | null
  targetRoot = seatRootRow?.root_session_id
}
if (targeted && targetRoot === undefined) {
  throw new Error(`No root found for seat ${requestedSeat}`)
}
let targetFirstRequest: number | undefined
if (targetRoot !== undefined) {
  const targetFirstRequestRow = db
    .query('select min(ts_ms) as ts_ms from requests where root_session_id = ?')
    .get(targetRoot) as { readonly ts_ms: number | null }
  if (targetFirstRequestRow.ts_ms === null) throw new Error(`Root ${targetRoot} has no requests`)
  targetFirstRequest = targetFirstRequestRow.ts_ms
}
const selectedConfigs: typeof horizons =
  targetRoot === undefined
    ? requestedHorizons.length === 0
      ? horizons
      : horizons.filter((config) => requestedHorizons.includes(config.horizon))
    : [
        {
          horizon: '7d',
          durationMs: targetWindowEnd - (targetFirstRequest ?? targetWindowEnd),
          rootLimit: 1,
          ranking: 'requests',
        },
      ]

/**
 * A targeted extraction leaves other fixture data frozen while bringing its
 * source-derived titles under the latest neutralization rules.
 */
if (!targeted && requestedHorizons.length > 0) {
  for (const config of horizons) {
    if (requestedHorizons.includes(config.horizon)) continue
    const path = join(outputDirectory, `${config.horizon}.json`)
    const file = Bun.file(path)
    if (!(await file.exists())) continue
    const retainedModel = (await file.json()) as AgentTimelineModel
    const neutralizedModel: AgentTimelineModel = {
      ...retainedModel,
      sessions: retainedModel.sessions.map((session) => ({
        ...session,
        title: sanitizeTitle(session.title),
      })),
    }
    const json = renderModel(neutralizedModel)
    if (byteLength(json) > MAX_FIXTURE_BYTES) {
      throw new Error(`${config.horizon} retained fixture exceeds the size cap`)
    }
    await Bun.write(path, json)
  }
}

for (const config of selectedConfigs) {
  let horizonWindowEnd = targeted ? targetWindowEnd : ledgerWindowEnd
  let windowStart = horizonWindowEnd - config.durationMs
  let roots: ReadonlyArray<RootRow>
  let widened = false
  if (targetRoot !== undefined) {
    roots = [{ root_session_id: targetRoot, score: 0 }]
  } else if (preserveSelection) {
    const previousModel = (await Bun.file(
      join(outputDirectory, `${config.horizon}.json`),
    ).json()) as AgentTimelineModel
    horizonWindowEnd = previousModel.windowEnd
    windowStart = previousModel.windowStart
    roots = [...new Set(previousModel.sessions.map((session) => session.rootId))]
      .toSorted()
      .map((root_session_id) => ({ root_session_id, score: 0 }))
  } else if (config.horizon === '1h') {
    const selection = selectOneHour(ledgerWindowEnd)
    horizonWindowEnd = selection.windowEnd
    windowStart = horizonWindowEnd - config.durationMs
    roots = selection.roots
    widened = selection.widened
  } else {
    const rankExpression = config.ranking === 'requests' ? 'count(*)' : 'sum(cost_total_usd)'
    roots = db
      .query(
        `select root_session_id, ${rankExpression} as score
         from requests
         where ts_ms between ? and ?
         group by root_session_id
         order by score desc, root_session_id
         limit ?`,
      )
      .all(windowStart, horizonWindowEnd, config.rootLimit) as ReadonlyArray<RootRow>
  }
  const rootIds = roots.map((row) => row.root_session_id)
  if (rootIds.length === 0) throw new Error(`No roots found for ${config.horizon}`)
  const rootSlots = placeholders(rootIds.length)
  const coverageRow = (
    targetRoot === undefined
      ? db
          .query(
            `select count(distinct root_session_id) as total_roots,
                    count(*) as total_requests,
                    coalesce(sum(cost_total_usd), 0) as total_usd
             from requests
             where ts_ms between ? and ?`,
          )
          .get(windowStart, horizonWindowEnd)
      : db
          .query(
            `select count(distinct root_session_id) as total_roots,
                    count(*) as total_requests,
                    coalesce(sum(cost_total_usd), 0) as total_usd
             from requests
             where root_session_id = ? and ts_ms between ? and ?`,
          )
          .get(targetRoot, windowStart, horizonWindowEnd)
  ) as CoverageRow

  const rawRequests = db
    .query(
      `select entry_id, ts_ms, duration_ms, session_id, kind, stop_reason, provider, model,
              input_tokens, cache_read_tokens, cache_write_tokens, output_tokens,
              context_prompt_tokens, context_nonmessage_tokens, compaction_epoch,
              cost_total_usd, cost_input_usd, cost_cache_read_usd,
              cost_cache_write_usd, cost_output_usd
       from requests
       where root_session_id in (${rootSlots}) and ts_ms between ? and ?
       order by ts_ms, entry_id`,
    )
    .all(...rootIds, windowStart, horizonWindowEnd) as ReadonlyArray<RawRequestRow>
  const capacitiesByModel = new Map<string, number>()
  const ambiguousCapacityModels = new Set<string>()
  for (const row of rawRequests) {
    const capacity = runtimeModelCapacities.get(`${row.provider}/${row.model}`)
    const previous = capacitiesByModel.get(row.model)
    if (capacity === undefined || (previous !== undefined && previous !== capacity)) {
      ambiguousCapacityModels.add(row.model)
    } else {
      capacitiesByModel.set(row.model, capacity)
    }
  }
  for (const model of ambiguousCapacityModels) capacitiesByModel.delete(model)
  const modelCapacities = Object.fromEntries(
    [...capacitiesByModel].toSorted(([left], [right]) => left.localeCompare(right)),
  )

  const rawTools = db
    .query(
      `select t.request_entry_id, t.tool_name
       from tool_calls t
       join requests r on r.entry_id = t.request_entry_id
       where r.root_session_id in (${rootSlots}) and r.ts_ms between ? and ?
       order by r.ts_ms, r.entry_id, t.ts_ms, t.call_id`,
    )
    .all(...rootIds, windowStart, horizonWindowEnd) as ReadonlyArray<RawToolRow>
  const toolsByRequest = new Map<string, string[]>()
  for (const tool of rawTools) {
    const tools = toolsByRequest.get(tool.request_entry_id) ?? []
    tools.push(tool.tool_name)
    toolsByRequest.set(tool.request_entry_id, tools)
  }

  const extractedRequests = rawRequests.map((row): ExtractedRequest => {
    const tools = toolsByRequest.get(row.entry_id) ?? []
    const contextTokens =
      row.context_prompt_tokens === null && row.context_nonmessage_tokens === null
        ? null
        : (row.context_prompt_tokens ?? 0) + (row.context_nonmessage_tokens ?? 0)
    const usd = roundUsd(row.cost_total_usd)
    const usdInput = roundUsd(row.cost_input_usd)
    const usdCacheRead = roundUsd(row.cost_cache_read_usd)
    const usdCacheWrite = roundUsd(row.cost_cache_write_usd)
    const usdOutput = roundUsd(row.cost_output_usd)
    return {
      entryId: row.entry_id,
      request: {
        sessionId: row.session_id,
        ts: row.ts_ms,
        durationMs: row.duration_ms,
        kind: requestKind(row.kind),
        stopReason: row.stop_reason,
        provider: row.provider,
        model: row.model,
        contextCapacity: runtimeModelCapacities.get(`${row.provider}/${row.model}`) ?? null,
        inputTokens: row.input_tokens,
        cacheReadTokens: row.cache_read_tokens,
        cacheWriteTokens: row.cache_write_tokens,
        outputTokens: row.output_tokens,
        contextTokens,
        compactionEpoch: row.compaction_epoch ?? 0,
        usd,
        usdInput,
        usdCacheRead,
        usdCacheWrite,
        usdOutput,
        requests: 1,
        toolCalls: tools.length,
        tools,
      },
    }
  })
  const firstRetainedModelBySession = new Map<string, string>()
  for (const row of rawRequests) {
    if (!firstRetainedModelBySession.has(row.session_id)) {
      firstRetainedModelBySession.set(row.session_id, row.model)
    }
  }

  const sessionIds = [...new Set(rawRequests.map((request) => request.session_id))]
  const sessionSlots = placeholders(sessionIds.length)
  const firstRequests = db
    .query(
      `with ranked as (
         select session_id, parent_session_id, root_session_id, depth, role, provider, model,
                actor_id, project, repo, branch, ts_ms,
                row_number() over (partition by session_id order by ts_ms, entry_id) as row_number
         from requests
         where session_id in (${sessionSlots})
       )
       select session_id, parent_session_id, root_session_id, depth, role, provider, model,
              actor_id, project, repo, branch, ts_ms
       from ranked
       where row_number = 1
       order by ts_ms, session_id`,
    )
    .all(...sessionIds) as ReadonlyArray<RawFirstRequestRow>
  const metadataSessionIds = [
    ...new Set([
      ...sessionIds,
      ...firstRequests.flatMap((request) =>
        request.parent_session_id === null ? [] : [request.parent_session_id],
      ),
    ]),
  ]
  const metadataSlots = placeholders(metadataSessionIds.length)
  const rawSessions = db
    .query(
      `select session_id, title, project, repo, branch, file
       from sessions
       where session_id in (${metadataSlots})`,
    )
    .all(...metadataSessionIds) as ReadonlyArray<RawSessionRow>
  const sessionMetadata = new Map(rawSessions.map((session) => [session.session_id, session]))

  const rawEvents = db
    .query(
      `select id, session_id, ts_ms, kind, payload_json
       from session_events
       where session_id in (${sessionSlots})
         and ts_ms between ? and ?
         and kind in ('compaction', 'session_exit', 'model_change')
       order by ts_ms, id`,
    )
    .all(...sessionIds, windowStart, horizonWindowEnd) as ReadonlyArray<RawEventRow>
  const events = rawEvents.flatMap((row): AgentTimelineEvent[] => {
    const payload = parsePayload(row.payload_json)
    switch (row.kind) {
      case 'compaction':
        return [
          {
            _tag: 'compaction',
            sessionId: row.session_id,
            ts: row.ts_ms,
            summaryChars: typeof payload.summary_chars === 'number' ? payload.summary_chars : null,
          },
        ]
      case 'session_exit':
        return [{ _tag: 'session_exit', sessionId: row.session_id, ts: row.ts_ms }]
      case 'model_change':
        return typeof payload.model === 'string'
          ? [
              {
                _tag: 'model_change',
                sessionId: row.session_id,
                ts: row.ts_ms,
                model: canonicalModelId(payload.model),
              },
            ]
          : []
      default:
        return []
    }
  })
  const endedAtBySession = new Map<string, number>()
  for (const event of events) {
    if (event._tag !== 'session_exit') continue
    endedAtBySession.set(
      event.sessionId,
      Math.max(endedAtBySession.get(event.sessionId) ?? Number.NEGATIVE_INFINITY, event.ts),
    )
  }

  const childNameBySession = new Map<string, string>()
  const sessionInitBySession = new Map<string, SessionInitMetadata>()
  const childrenByParentFile = new Map<string, ChildLabelInput[]>()
  for (const row of firstRequests) {
    if (row.parent_session_id === null) continue
    const metadata = sessionMetadata.get(row.session_id)
    if (metadata === undefined) continue
    const name = basename(metadata.file, '.jsonl')
    if (name.length === 0) continue
    childNameBySession.set(row.session_id, name)
    sessionInitBySession.set(row.session_id, await readSessionInit(metadata.file))

    const parentFile = sessionMetadata.get(row.parent_session_id)?.file
    if (parentFile === undefined) continue
    const children = childrenByParentFile.get(parentFile) ?? []
    children.push({ sessionId: row.session_id, name })
    childrenByParentFile.set(parentFile, children)
  }

  const parentIntentBySession = new Map<string, string>()
  for (const [parentFile, children] of childrenByParentFile) {
    const intents = await readParentIntents(parentFile, children)
    for (const [sessionId, intent] of intents) parentIntentBySession.set(sessionId, intent)
  }

  const sessionsWithoutActivity = firstRequests
    .map((row): AgentTimelineSession => {
      const metadata = sessionMetadata.get(row.session_id)
      const actorId = seatByActor.get(row.actor_id)
      if (actorId === undefined) throw new Error(`Missing seat mapping for actor ${row.actor_id}`)
      const title = sanitizeTitle(metadata?.title ?? null)
      const isRoot = row.parent_session_id === null
      const sessionInit = sessionInitBySession.get(row.session_id) ?? emptySessionInit
      return {
        id: row.session_id,
        parentId: row.parent_session_id,
        rootId: row.root_session_id,
        depth: row.depth,
        role: sessionRole(row.role),
        model: firstRetainedModelBySession.get(row.session_id) ?? row.model,
        actorId,
        project: projectKey({
          project: metadata?.project ?? row.project,
          repo: metadata?.repo ?? row.repo,
          branch: metadata?.branch ?? row.branch,
        }),
        title,
        name: isRoot ? null : (childNameBySession.get(row.session_id) ?? null),
        agentType: isRoot ? personaFromTitle(title) : sessionInit.agentType,
        task: isRoot
          ? null
          : summarizeTask(parentIntentBySession.get(row.session_id) ?? null, sessionInit.task),
        modelRole: isRoot ? null : sessionInit.modelRole,
        readOnly: isRoot ? false : sessionInit.readOnly,
        contextCapacity:
          modelCapacities[firstRetainedModelBySession.get(row.session_id) ?? row.model] ?? null,
        startedAt: row.ts_ms,
        endedAt: endedAtBySession.get(row.session_id) ?? null,
      }
    })
    .toSorted((left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id))
  const activityBySession = deriveAgentTimelineActivity({
    sessions: sessionsWithoutActivity,
    requests: extractedRequests.map((request) => request.request),
    windowStart,
    windowEnd: horizonWindowEnd,
    idleThresholdMs: IDLE_THRESHOLD_MS,
  })
  const sessions = sessionsWithoutActivity.map((session) => ({
    ...session,
    activity: activityBySession.get(session.id) ?? [],
  }))

  const rawPrompts = db
    .query(
      `select entry_id, session_id, ts_ms, steering
       from human_prompts
       where session_id in (${sessionSlots}) and ts_ms between ? and ?
       order by ts_ms, entry_id`,
    )
    .all(...sessionIds, windowStart, horizonWindowEnd) as ReadonlyArray<RawPromptRow>

  const model: AgentTimelineModel = {
    horizon: config.horizon,
    windowStart,
    windowEnd: horizonWindowEnd,
    modelCapacities,
    sessions,
    requests: extractedRequests.map((request) => request.request),
    bins: [],
    events,
    humanPrompts: rawPrompts.map((prompt) => ({
      sessionId: prompt.session_id,
      ts: prompt.ts_ms,
      steering: prompt.steering !== 0,
    })),
    coverage: {
      includedRoots: rootIds.length,
      totalRoots: coverageRow.total_roots,
      includedRequests: rawRequests.length,
      totalRequests: coverageRow.total_requests,
      includedUsd: roundUsd(
        rawRequests.reduce((total, request) => total + request.cost_total_usd, 0),
      ),
      totalUsd: roundUsd(coverageRow.total_usd),
      policy:
        targetRoot === undefined
          ? selectionPolicy(config.horizon)
          : `complete root tree ${targetRoot}, first request through extraction time`,
    },
    parameters: {
      idleThresholdMs: 600_000,
      activeWithinMs: 600_000,
    },
    sampled: false,
    folded: 0,
  }
  const fitted = fitToSizeCap(model, extractedRequests)
  assertConservation(
    config.horizon,
    extractedRequests.map((request) => request.request),
    fitted.model,
  )
  const fittedValues = [...fitted.model.requests, ...fitted.model.bins]
  const costComponentDiscrepancies = fittedValues.filter(
    (value) =>
      Math.abs(
        value.usdInput + value.usdCacheRead + value.usdCacheWrite + value.usdOutput - value.usd,
      ) > 0.000001,
  ).length
  const ledgerUsd = rawRequests.reduce((total, request) => total + request.cost_total_usd, 0)
  const projectedUsd = fittedValues.reduce((total, value) => total + value.usd, 0)
  if (Math.abs(projectedUsd - ledgerUsd) > 0.001) {
    throw new Error(
      `${config.horizon} rows + bins USD ${projectedUsd.toFixed(6)} differs from ledger USD ${ledgerUsd.toFixed(6)}`,
    )
  }
  const outputPath =
    targeted && requestedOutput !== undefined
      ? resolve(requestedOutput)
      : join(outputDirectory, targeted ? 'dogfood.json' : `${config.horizon}.json`)
  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, fitted.json)

  const agentTurns = fitted.model.requests.filter(isAgentTurn).length
  const compactions = fitted.model.events.filter((event) => event._tag === 'compaction').length
  const totalUsd = roundUsd(projectedUsd)
  const contextSnapshots = fitted.model.requests.filter(
    (request) => request.contextTokens !== null,
  ).length
  const capacityRequests = rawRequests.filter(
    (request) => modelCapacities[request.model] !== undefined,
  ).length
  console.log(
    `${config.horizon}: sessions=${fitted.model.sessions.length} retained=${fitted.model.requests.length}` +
      ` bins=${fitted.model.bins.length} requests=${fitted.model.coverage.includedRequests}` +
      ` agentTurns=${agentTurns} humanPrompts=${fitted.model.humanPrompts.length}` +
      ` compactions=${compactions} totalUsd=$${totalUsd.toFixed(6)}` +
      ` coverage=${fitted.model.coverage.includedRoots}/${fitted.model.coverage.totalRoots} roots,` +
      `${fitted.model.coverage.includedRequests}/${fitted.model.coverage.totalRequests} requests,` +
      `$${fitted.model.coverage.includedUsd.toFixed(2)}/$${fitted.model.coverage.totalUsd.toFixed(2)}` +
      ` sampled=${fitted.model.sampled} folded=${fitted.model.folded}` +
      ` componentDiscrepancies=${costComponentDiscrepancies}` +
      ` selection=${
        targeted
          ? `target-root:${targetRoot}`
          : preserveSelection
            ? 'preserved-window'
            : widened
              ? 'widened-to-busiest-hour'
              : 'latest-window'
      } output=${outputPath}`,
  )
}

db.close()
