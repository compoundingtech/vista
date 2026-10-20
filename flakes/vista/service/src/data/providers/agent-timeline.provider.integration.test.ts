import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import { snapshotKey, type Snapshot } from '@vista/blocks/internal/data-contract'
import {
  agentTimeline,
  AgentTimelineError,
  AgentTimelineLoadArgs,
  AgentTimelineModelSchema,
} from '@vista/blocks/internal/provider-contracts'
import { Duration, Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcClient from 'effect/rpc/RpcClient'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { layerJson } from 'effect/rpc/RpcSerialization'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { captureInProcessTrace } from '@overeng/utils-dev/otelite'

import { readFrozen } from '../client/frozen.ts'
import { makeProviderBudget } from '../live-hub.ts'
import { agentTimelineWireAliases, resolveProvider } from '../mount.ts'
import { materializeProvider } from '../provider.ts'
import { AgentTimelineCommandFailure, AgentTimelineCommandRunner } from './agent-timeline-tmux.ts'
import agentTimelineProvider, {
  makeAgentTimelineProvider,
  makeAgentTimelineSourceLayer,
  MAX_CONTEXT_SEGMENTS_PER_BIN,
  MAX_RETAINED_REQUESTS,
  MAX_TOOLS_PER_REQUEST,
  MAX_TIMELINE_BINS,
  MAX_TIMELINE_EVENTS,
  MAX_TIMELINE_PROMPTS,
  MAX_TIMELINE_SESSIONS,
} from './agent-timeline.provider.ts'

const NOW = 2_000_000_000_000

let directory: string
let ledgerPath: string

const createLedger = (): DatabaseSync => {
  const db = new DatabaseSync(ledgerPath)
  db.exec(`
    CREATE TABLE requests (
      entry_id TEXT PRIMARY KEY,
      ts_ms INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      parent_session_id TEXT,
      root_session_id TEXT NOT NULL,
      depth INTEGER NOT NULL,
      role TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      project TEXT,
      repo TEXT,
      branch TEXT,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      stop_reason TEXT NOT NULL,
      duration_ms REAL,
      input_tokens INTEGER NOT NULL,
      cache_read_tokens INTEGER NOT NULL,
      cache_write_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      context_prompt_tokens INTEGER,
      context_nonmessage_tokens INTEGER,
      compaction_epoch INTEGER,
      cost_total_usd REAL NOT NULL,
      cost_input_usd REAL NOT NULL,
      cost_cache_read_usd REAL NOT NULL,
      cost_cache_write_usd REAL NOT NULL,
      cost_output_usd REAL NOT NULL
    );
    CREATE TABLE tool_calls (
      call_id TEXT PRIMARY KEY,
      request_entry_id TEXT,
      session_id TEXT NOT NULL,
      ts_ms INTEGER NOT NULL,
      tool_name TEXT NOT NULL
    );
    CREATE TABLE session_events (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      ts_ms INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT,
      project TEXT,
      repo TEXT,
      branch TEXT,
      file TEXT NOT NULL,
      first_ts_ms INTEGER NOT NULL
    );
    CREATE TABLE human_prompts (
      entry_id TEXT PRIMARY KEY,
      ts_ms INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      root_session_id TEXT NOT NULL,
      steering INTEGER NOT NULL
    );
    CREATE INDEX requests_ts ON requests(ts_ms);
    CREATE INDEX requests_session ON requests(session_id);
  `)
  return db
}

interface RequestSeed {
  readonly id: string
  readonly ts: number
  readonly sessionId?: string
  readonly parentSessionId?: string | null
  readonly rootSessionId?: string
  readonly depth?: number
  readonly role?: 'main' | 'subagent' | 'advisor'
  readonly actorId?: string
  readonly model?: string
  readonly provider?: string
  readonly kind?: 'turn' | 'auxiliary'
  readonly stopReason?: string
  readonly durationMs?: number | null
  readonly inputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly outputTokens?: number
  readonly contextPromptTokens?: number | null
  readonly contextNonmessageTokens?: number | null
  readonly compactionEpoch?: number | null
  readonly usd?: number
  readonly usdInput?: number
  readonly usdCacheRead?: number
  readonly usdCacheWrite?: number
  readonly usdOutput?: number
}

const insertRequest = (db: DatabaseSync, seed: RequestSeed): void => {
  db.prepare(
    `INSERT INTO requests (
       entry_id, ts_ms, session_id, parent_session_id, root_session_id, depth, role,
       actor_id, project, repo, branch, model, provider, kind, stop_reason, duration_ms,
       input_tokens, cache_read_tokens, cache_write_tokens, output_tokens,
       context_prompt_tokens, context_nonmessage_tokens, compaction_epoch,
       cost_total_usd, cost_input_usd, cost_cache_read_usd, cost_cache_write_usd,
       cost_output_usd
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    seed.id,
    seed.ts,
    seed.sessionId ?? 'root',
    seed.parentSessionId ?? null,
    seed.rootSessionId ?? 'root',
    seed.depth ?? 0,
    seed.role ?? 'main',
    seed.actorId ?? 'actor-private-id',
    'acme/repo@feature',
    'acme/repo',
    'feature',
    seed.model ?? 'gpt-test',
    seed.provider ?? 'openai',
    seed.kind ?? 'turn',
    seed.stopReason ?? 'stop',
    seed.durationMs === undefined ? 25.4 : seed.durationMs,
    seed.inputTokens ?? 1,
    seed.cacheReadTokens ?? 2,
    seed.cacheWriteTokens ?? 3,
    seed.outputTokens ?? 4,
    seed.contextPromptTokens === undefined ? 10 : seed.contextPromptTokens,
    seed.contextNonmessageTokens === undefined ? 5 : seed.contextNonmessageTokens,
    seed.compactionEpoch === undefined ? 0 : seed.compactionEpoch,
    seed.usd ?? 0.01,
    seed.usdInput ?? 0.001,
    seed.usdCacheRead ?? 0.002,
    seed.usdCacheWrite ?? 0.003,
    seed.usdOutput ?? 0.004,
  )
}

/** omp-usage's catalog table; created only by tests that model a ledger that already has it. */
const createModelCatalog = (
  db: DatabaseSync,
  rows: ReadonlyArray<readonly [provider: string, model: string, contextWindow: number]>,
): void => {
  db.exec(`
    CREATE TABLE model_catalog (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      context_window INTEGER NOT NULL CHECK(context_window > 0),
      max_tokens INTEGER CHECK(max_tokens IS NULL OR max_tokens > 0),
      observed_at_ms INTEGER NOT NULL,
      PRIMARY KEY(provider, model)
    ) WITHOUT ROWID;
  `)
  const insert = db.prepare('INSERT INTO model_catalog VALUES (?, ?, ?, ?, ?)')
  for (const [provider, model, contextWindow] of rows) {
    insert.run(provider, model, contextWindow, 32_000, NOW - 60_000)
  }
}

interface FoldedRun {
  readonly count: number
  readonly epoch: number
  readonly contextTokens: number
}

/**
 * Seeds consecutive runs 10 ms apart for one session. Runs are large enough that the evenly
 * spaced detail sample (about one in six at these sizes) leaves omitted rows in every run.
 */
const seedRuns = (
  db: DatabaseSync,
  { sessionId, start, runs }: { sessionId: string; start: number; runs: ReadonlyArray<FoldedRun> },
): ReadonlyArray<{ readonly first: number; readonly last: number }> => {
  let ts = start
  return runs.map((run, runIndex) => {
    const first = ts
    for (let index = 0; index < run.count; index += 1) {
      insertRequest(db, {
        id: `${sessionId}-${start}-${runIndex}-${String(index).padStart(4, '0')}`,
        ts,
        sessionId,
        rootSessionId: sessionId,
        compactionEpoch: run.epoch,
        contextPromptTokens: run.contextTokens,
        contextNonmessageTokens: 0,
      })
      ts += 10
    }
    return { first, last: ts - 10 }
  })
}

/** Start of the 1h window's eleventh one-minute bin, where runs of a few thousand rows fit. */
const BIN_START = NOW - 60 * 60_000 + 10 * 60_000

const load = (path: string, horizon: '1h' | '1d' | '7d' = '1h', actors?: ReadonlyArray<string>) =>
  agentTimelineProvider.core
    .load(actors === undefined ? { horizon } : { horizon, actors })
    .pipe(Effect.provide(makeAgentTimelineSourceLayer({ ledgerPath: path, now: () => NOW })))

const TMUX_SESSION = 'dotfiles/misc'

/** Fixture subprocess runner: canned stdout per command, recording each invocation. */
const fixtureRunner = (
  outputs: Readonly<Record<string, string>>,
  calls: Array<readonly [string, ReadonlyArray<string>]> = [],
) =>
  Layer.succeed(AgentTimelineCommandRunner, {
    run: (command, args) => {
      calls.push([command, args])
      const stdout = outputs[command]
      return stdout === undefined
        ? Effect.fail(new AgentTimelineCommandFailure({ command, message: 'not in fixture' }))
        : Effect.succeed(stdout)
    },
  })

const tmuxPanes = (panes: ReadonlyArray<readonly [paneId: string, tty: string]>): string =>
  panes.map(([paneId, tty]) => `${paneId}\t${tty}\n`).join('')

const ptyEntry = ({
  name,
  status = 'running',
  ttys,
  sessionId,
  actorPath,
}: {
  name: string
  status?: string
  ttys: ReadonlyArray<string>
  sessionId?: string
  actorPath?: string
}) => ({
  name,
  status,
  pid: status === 'running' ? 4242 : null,
  tags: {
    ...(sessionId === undefined ? {} : { 'agent.harness.session.id': sessionId }),
    ...(actorPath === undefined ? {} : { 'agent.actor.path': actorPath }),
  },
  clients: ttys.map((tty) => ({ tty, pid: 7 })),
})

/** Builds the source once, as the provider registry does, so the resolver cache spans loads. */
const loadTmux = async (
  path: string,
  runner: Layer.Layer<AgentTimelineCommandRunner>,
  now: () => number = () => NOW,
) => {
  const context = await Effect.runPromise(
    Effect.scoped(
      Layer.build(makeAgentTimelineSourceLayer({ ledgerPath: path, now, commandRunner: runner })),
    ),
  )
  return (horizon: '1h' | '1d' | '7d' = '1h') =>
    agentTimelineProvider.core
      .load({ horizon, tmuxSession: TMUX_SESSION })
      .pipe(Effect.provide(context))
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'vista-agent-timeline-'))
  ledgerPath = join(directory, 'ledger.sqlite')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('agent-timeline provider', () => {
  it('resolves the retained agent-trace query and reads its frozen publication seed', async () => {
    const db = createLedger()
    insertRequest(db, { id: 'legacy-publication', ts: NOW - 20_000 })
    db.close()
    await Effect.runPromise(
      Effect.gen(function* () {
        const mounted = yield* materializeProvider(
          makeAgentTimelineProvider(makeAgentTimelineSourceLayer({ ledgerPath, now: () => NOW })),
          undefined,
          undefined,
          undefined,
          agentTimelineWireAliases,
        )
        const registry = { providers: new Map([[agentTimeline.id, mounted]]) }
        const resolved = resolveProvider(registry, 'agent-trace')
        expect(resolved).toBe(resolveProvider(registry, agentTimeline.id))
        if (resolved === undefined) return yield* Effect.die('legacy query did not resolve')
        expect(resolved.id).toBe('agent-timeline')
        const args = { horizon: '1h' as const }
        const value = yield* resolved.call('load', args, 'live')
        const key = yield* snapshotKey(
          { ...agentTimeline.ops.load, providerId: 'agent-trace' },
          args,
        )
        const snapshot: Snapshot = {
          apiVersion: 2,
          frozenAt: '2026-10-10T00:00:00.000Z',
          entries: {
            [key]: {
              provider: 'agent-trace',
              operation: 'load',
              encodedArgs: args,
              encodedValue: value,
              capturedAt: '2026-10-10T00:00:00.000Z',
            },
          },
        }
        expect(yield* readFrozen(snapshot, agentTimeline.ops.load, args)).toEqual(value)
        expect(snapshot.entries[key]?.provider).toBe('agent-trace')
        expect(yield* snapshotKey(agentTimeline.ops.load, args)).not.toBe(key)
        const previousApi = RpcGroup.make(
          Rpc.make('load', {
            payload: AgentTimelineLoadArgs,
            success: AgentTimelineModelSchema,
            error: Schema.TaggedStruct('AgentTraceError', {
              reason: AgentTimelineError.fields.reason,
              message: AgentTimelineError.fields.message,
            }),
          }),
        )
        // Scope the handler fetch to this client: patching globalThis.fetch would be
        // captured by the cached FetchHttpClient.Fetch default and leak into later tests.
        const handlerFetch: typeof globalThis.fetch = (input, init) =>
          resolved.handler(input instanceof Request ? input : new Request(input, init))
        yield* Effect.gen(function* () {
          const client = yield* RpcClient.make(previousApi)
          expect(yield* client.load(args)).toEqual(value)
          const failure = yield* Effect.flip(
            client.load({ horizon: '1h', actors: ['dev3.not-present'] }),
          )
          expect(failure).toMatchObject({ _tag: 'AgentTraceError', reason: 'empty' })
        }).pipe(
          Effect.provide(
            RpcClient.layerProtocolHttp({ url: 'http://localhost/_data/agent-trace' }).pipe(
              Layer.provide(layerJson),
              Layer.provide(FetchHttpClient.layer),
              Layer.provide(Layer.succeed(FetchHttpClient.Fetch, handlerFetch)),
            ),
          ),
        )
      }).pipe(Effect.scoped),
    )
  })

  it('projects sessions, tools, prompts, and lifecycle events with real agent IDs and scrubbed titles', async () => {
    const db = createLedger()
    insertRequest(db, { id: 'root-first', ts: NOW - 20_000 })
    insertRequest(db, {
      id: 'child-tool',
      ts: NOW - 10_000,
      sessionId: 'child',
      parentSessionId: 'root',
      depth: 1,
      role: 'subagent',
      stopReason: 'toolUse',
      contextPromptTokens: null,
      contextNonmessageTokens: null,
    })
    insertRequest(db, {
      id: 'child-last',
      ts: NOW - 2_000,
      sessionId: 'child',
      parentSessionId: 'root',
      depth: 1,
      role: 'subagent',
      model: 'gpt-next',
      actorId: 'actor-current-id',
      compactionEpoch: 1,
    })
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'root',
      'workstation.direct.omp.example[gen] @alice cwd=/home/alice/private path:/srv/secret',
      'acme/repo@feature',
      'acme/repo',
      'feature',
      '/home/alice/transcripts/root.jsonl',
      NOW - 30_000,
    )
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'child',
      'alice@example.com review',
      'acme/repo@feature',
      'acme/repo',
      'feature',
      '/home/alice/transcripts/ReviewChild.jsonl',
      NOW - 20_000,
    )
    db.prepare('INSERT INTO tool_calls VALUES (?, ?, ?, ?, ?)').run(
      'tool-1',
      'child-tool',
      'child',
      NOW - 9_900,
      'bash',
    )
    db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?)').run(
      1,
      'child',
      NOW - 8_000,
      'compaction',
      '{"summary_chars":321}',
    )
    db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?)').run(
      2,
      'child',
      NOW - 7_000,
      'model_change',
      '{"model":"openai/gpt-next"}',
    )
    db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?)').run(
      3,
      'child',
      NOW - 1_000,
      'session_exit',
      '{}',
    )
    db.prepare('INSERT INTO human_prompts VALUES (?, ?, ?, ?, ?)').run(
      'prompt-1',
      NOW - 15_000,
      'root',
      'root',
      1,
    )
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(model.sessions).toHaveLength(2)
    expect(model.sessions.map(({ actorId }) => actorId)).toEqual([
      'actor-private-id',
      'actor-current-id',
    ])
    expect(model.sessions[0]?.title).toBe(
      'workstation.direct.omp.example[gen] @seat cwd=[absolute path removed] path:[absolute path removed]',
    )
    expect(model.sessions[1]).toMatchObject({
      name: 'ReviewChild',
      task: null,
      modelRole: null,
      contextCapacity: null,
      title: '[email removed] review',
    })
    expect(model.sessions[1]?.agentType).toBeNull()
    expect(model.requests.find(({ sessionId }) => sessionId === 'child')?.tools).toEqual(['bash'])
    expect(model.events).toEqual([
      { _tag: 'compaction', sessionId: 'child', ts: NOW - 8_000, summaryChars: 321 },
      { _tag: 'model_change', sessionId: 'child', ts: NOW - 7_000, model: 'gpt-next' },
      { _tag: 'session_exit', sessionId: 'child', ts: NOW - 1_000 },
    ])
    expect(model.humanPrompts).toEqual([{ sessionId: 'root', ts: NOW - 15_000, steering: true }])
    expect(model.modelCapacities).toEqual({})
    expect(model.sessions.find(({ id }) => id === 'child')?.facts).toMatchObject({
      requests: 2,
      turns: 1,
      usd: 0.02,
      inputTokens: 2,
      cacheReadTokens: 4,
      cacheWriteTokens: 6,
      outputTokens: 8,
      toolCalls: 1,
      compactions: 1,
      prompts: 0,
      status: 'exited',
    })
  })

  it('folds oversized request sets while conserving request, cost, token, and tool totals', async () => {
    const db = createLedger()
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'root',
      'host[gen]',
      'acme/repo@feature',
      'acme/repo',
      'feature',
      '/tmp/root.jsonl',
      NOW - (MAX_RETAINED_REQUESTS + 1_000) * 5 * 60_000,
    )
    const totalRequests = MAX_RETAINED_REQUESTS + 1_000
    const firstRequestAt = NOW - totalRequests * 5 * 60_000
    const insertTool = db.prepare('INSERT INTO tool_calls VALUES (?, ?, ?, ?, ?)')
    for (let index = 0; index < totalRequests; index += 1) {
      const id = `request-${String(index).padStart(4, '0')}`
      insertRequest(db, {
        id,
        ts: firstRequestAt + index * 5 * 60_000,
        inputTokens: 1,
        cacheReadTokens: 2,
        cacheWriteTokens: 3,
        outputTokens: 4,
        usd: 0.01,
        usdInput: 0.001,
        usdCacheRead: 0.002,
        usdCacheWrite: 0.003,
        usdOutput: 0.004,
      })
      insertTool.run(`tool-${index}`, id, 'root', firstRequestAt + index * 5 * 60_000, 'read')
    }
    db.close()

    const model = await Effect.runPromise(load(ledgerPath, '7d'))
    const values = [...model.requests, ...model.bins]
    expect(model.sessions[0]?.facts).toMatchObject({
      requests: totalRequests,
      turns: totalRequests,
      usd: totalRequests * 0.01,
      inputTokens: totalRequests,
      cacheReadTokens: totalRequests * 2,
      cacheWriteTokens: totalRequests * 3,
      outputTokens: totalRequests * 4,
      toolCalls: totalRequests,
    })
    expect(model.sampled).toBe(true)
    expect(model.requests).toHaveLength(MAX_RETAINED_REQUESTS)
    expect(model.folded).toBe(totalRequests - MAX_RETAINED_REQUESTS)
    expect(
      model.requests.filter((request) => request.kind === 'turn' && request.stopReason === 'stop')
        .length + model.bins.reduce((sum, bin) => sum + bin.agentTurns, 0),
    ).toBe(totalRequests)
    expect(values.reduce((sum, value) => sum + value.requests, 0)).toBe(totalRequests)
    expect(values.reduce((sum, value) => sum + value.inputTokens, 0)).toBe(totalRequests)
    expect(values.reduce((sum, value) => sum + value.cacheReadTokens, 0)).toBe(totalRequests * 2)
    expect(values.reduce((sum, value) => sum + value.cacheWriteTokens, 0)).toBe(totalRequests * 3)
    expect(values.reduce((sum, value) => sum + value.outputTokens, 0)).toBe(totalRequests * 4)
    expect(values.reduce((sum, value) => sum + value.toolCalls, 0)).toBe(totalRequests)
    expect(values.reduce((sum, value) => sum + value.usd, 0)).toBeCloseTo(totalRequests * 0.01)
    expect(model.sessions[0]?.activity?.every(({ state }) => state === 'working')).toBe(true)
    expect(model.bins.every((bin) => bin.firstTs !== undefined && bin.lastTs !== undefined)).toBe(
      true,
    )
  })

  it('keeps exact idle gaps when projecting bounded activity segments', async () => {
    const db = createLedger()
    const base = NOW - 31 * 60_000
    for (const [index, offset] of [0, 1, 2, 30].entries()) {
      insertRequest(db, {
        id: `activity-${index}`,
        ts: base + offset * 60_000,
      })
    }
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(model.sessions[0]?.activity).toEqual([
      { from: base, to: base + 2 * 60_000, state: 'working' },
      { from: base + 2 * 60_000, to: base + 30 * 60_000, state: 'idle' },
    ])
  })

  it('discloses sampled activity while preserving exact active duration', async () => {
    const db = createLedger()
    const segmentCount = 70
    let ts = NOW - 14 * 60 * 60_000
    insertRequest(db, { id: 'activity-overflow-0', ts })
    let expectedActiveMs = 0
    for (let index = 1; index <= segmentCount; index += 1) {
      const duration = index % 2 === 1 ? 60_000 : 11 * 60_000
      if (duration <= 10 * 60_000) expectedActiveMs += duration
      ts += duration
      insertRequest(db, { id: `activity-overflow-${index}`, ts })
    }
    db.close()

    const model = await Effect.runPromise(load(ledgerPath, '1d'))
    expect(model.activitySampled).toBe(true)
    expect(model.sessions[0]?.activitySampled).toBe(true)
    expect(model.sessions[0]?.activity).toHaveLength(64)
    expect(model.sessions[0]?.activeMs).toBe(expectedActiveMs)
  })

  it('does not treat an overlapping descendant idle segment as parent waiting', async () => {
    const db = createLedger()
    const base = NOW - 40 * 60_000
    insertRequest(db, { id: 'root-before', ts: base })
    insertRequest(db, { id: 'root-after', ts: base + 30 * 60_000 })
    insertRequest(db, {
      id: 'child-before',
      ts: base - 60_000,
      sessionId: 'child',
      parentSessionId: 'root',
      rootSessionId: 'root',
      depth: 1,
      role: 'subagent',
    })
    insertRequest(db, {
      id: 'child-after',
      ts: base + 31 * 60_000,
      sessionId: 'child',
      parentSessionId: 'root',
      rootSessionId: 'root',
      depth: 1,
      role: 'subagent',
    })
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(model.sessions.find(({ id }) => id === 'root')?.activity).toEqual([
      { from: base, to: base + 30 * 60_000, state: 'idle' },
    ])
  })

  it('retains an ancestor lane when only its child has an in-window request', async () => {
    const db = createLedger()
    insertRequest(db, { id: 'root-old', ts: NOW - 2 * 60 * 60_000 })
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'root',
      'host[gen]',
      'acme/repo@feature',
      'acme/repo',
      'feature',
      '/tmp/root.jsonl',
      NOW - 2 * 60 * 60_000,
    )
    insertRequest(db, {
      id: 'child-current',
      ts: NOW - 1_000,
      sessionId: 'child',
      parentSessionId: 'root',
      rootSessionId: 'root',
      depth: 1,
      role: 'subagent',
    })
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(model.sessions.map(({ id }) => id)).toEqual(['root', 'child'])
    expect(model.sessions.find(({ id }) => id === 'child')?.parentId).toBe('root')
  })

  it('selects only the requested agents’ sessions plus ancestor lanes instead of the top-ranked roots', async () => {
    const db = createLedger()
    for (const [index, root] of ['busy-a', 'busy-b', 'busy-c'].entries()) {
      for (let request = 0; request < 5; request += 1) {
        insertRequest(db, {
          id: `${root}-${request}`,
          ts: NOW - 10_000 - index * 1_000 - request,
          sessionId: root,
          rootSessionId: root,
          actorId: `dev3.busy-${index}`,
        })
      }
    }
    insertRequest(db, {
      id: 'quiet-root',
      ts: NOW - 5_000,
      sessionId: 'quiet',
      rootSessionId: 'quiet',
      actorId: 'dev3.quiet',
    })
    insertRequest(db, {
      id: 'quiet-child',
      ts: NOW - 4_000,
      sessionId: 'quiet-child',
      parentSessionId: 'quiet',
      rootSessionId: 'quiet',
      depth: 1,
      role: 'subagent',
      actorId: 'dev3.quiet',
    })
    insertRequest(db, {
      id: 'foreign-child',
      ts: NOW - 3_000,
      sessionId: 'foreign-child',
      parentSessionId: 'busy-c',
      rootSessionId: 'busy-c',
      depth: 1,
      role: 'subagent',
      actorId: 'dev3.busy-0',
    })
    insertRequest(db, {
      id: 'hosted-child',
      ts: NOW - 2_000,
      sessionId: 'hosted-child',
      parentSessionId: 'busy-a',
      rootSessionId: 'busy-a',
      depth: 1,
      role: 'subagent',
      actorId: 'dev3.quiet',
    })
    db.close()

    const unfiltered = await Effect.runPromise(load(ledgerPath))
    expect(unfiltered.sessions.map(({ id }) => id)).not.toContain('quiet')

    const filtered = await Effect.runPromise(load(ledgerPath, '1h', ['dev3.quiet', 'dev3.busy-2']))
    expect(filtered.sessions.map(({ id }) => id).toSorted()).toEqual([
      'busy-a',
      'busy-c',
      'hosted-child',
      'quiet',
      'quiet-child',
    ])
    expect(filtered.coverage).toMatchObject({ includedRoots: 3, totalRoots: 4 })
    expect(filtered.coverage.policy).toContain('2 selected agents')

    const error = await Effect.runPromise(Effect.flip(load(ledgerPath, '1h', ['dev3.absent'])))
    expect(error.reason).toBe('empty')
  })

  it('retains each session boundary and both requests adjacent to a compaction', async () => {
    const db = createLedger()
    const totalRequests = MAX_RETAINED_REQUESTS + 80
    const base = NOW - 120_000
    const compactionBefore = 271
    const compactionAfter = compactionBefore + 1
    for (let index = 0; index < totalRequests; index += 1) {
      const model =
        index === 0
          ? 'anchor-first'
          : index === totalRequests - 1
            ? 'anchor-last'
            : index === compactionBefore
              ? 'anchor-before'
              : index === compactionAfter
                ? 'anchor-after'
                : 'ordinary'
      insertRequest(db, {
        id: `request-${String(index).padStart(4, '0')}`,
        ts: base + index * 100,
        model,
      })
    }
    insertRequest(db, {
      id: 'child-first',
      ts: base + 25,
      sessionId: 'child',
      parentSessionId: 'root',
      depth: 1,
      role: 'subagent',
      model: 'child-anchor-first',
    })
    insertRequest(db, {
      id: 'child-last',
      ts: base + (totalRequests - 1) * 100 - 25,
      sessionId: 'child',
      parentSessionId: 'root',
      depth: 1,
      role: 'subagent',
      model: 'child-anchor-last',
    })
    db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?)').run(
      1,
      'root',
      base + compactionBefore * 100 + 50,
      'compaction',
      '{"summary_chars":42}',
    )
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    const retainedModels = new Set(model.requests.map((request) => request.model))
    expect(
      [
        'anchor-first',
        'anchor-last',
        'anchor-before',
        'anchor-after',
        'child-anchor-first',
        'child-anchor-last',
      ].every((anchor) => retainedModels.has(anchor)),
    ).toBe(true)
  })

  it('caps every repeated projection collection while keeping aggregate counts exact', async () => {
    const db = createLedger()
    const sessionCount = MAX_TIMELINE_SESSIONS + 6
    const requestsPerSession = 40
    const base = NOW - 3_500_000
    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex += 1) {
      const sessionId =
        sessionIndex === 0 ? 'root' : `child-${String(sessionIndex).padStart(3, '0')}`
      for (let requestIndex = 0; requestIndex < requestsPerSession; requestIndex += 1) {
        insertRequest(db, {
          id: `${sessionId}-request-${String(requestIndex).padStart(2, '0')}`,
          ts: base + requestIndex * 85_000 + sessionIndex,
          sessionId,
          parentSessionId: sessionIndex === 0 ? null : 'root',
          depth: sessionIndex === 0 ? 0 : 1,
          role: sessionIndex === 0 ? 'main' : 'subagent',
        })
      }
    }
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'child-001',
      'child[reviewer]',
      'acme/repo@feature',
      'acme/repo',
      'feature',
      '/tmp/child-001.jsonl',
      base + 1,
    )
    const insertTool = db.prepare('INSERT INTO tool_calls VALUES (?, ?, ?, ?, ?)')
    for (let index = 0; index < MAX_TOOLS_PER_REQUEST + 5; index += 1) {
      insertTool.run(
        `tool-${index}`,
        'root-request-00',
        'root',
        base + index,
        `tool-name-${String(index).padStart(2, '0')}`,
      )
    }
    const insertEvent = db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?)')
    for (let index = 0; index < MAX_TIMELINE_EVENTS + 20; index += 1) {
      insertEvent.run(index + 1, 'root', base + index, 'session_exit', '{}')
    }
    for (let index = 0; index < 47; index += 1) {
      insertEvent.run(MAX_TIMELINE_EVENTS + 21 + index, 'root', base + index, 'compaction', '{}')
    }
    const insertPrompt = db.prepare('INSERT INTO human_prompts VALUES (?, ?, ?, ?, ?)')
    for (let index = 0; index < MAX_TIMELINE_PROMPTS + 20; index += 1) {
      insertPrompt.run(`prompt-${index}`, base + index, 'root', 'root', index % 2)
    }
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    const rootFirst = model.requests.find((request) => request.ts === base)
    expect(model.sessions).toHaveLength(MAX_TIMELINE_SESSIONS)
    expect(model.requests).toHaveLength(MAX_RETAINED_REQUESTS)
    expect(model.bins.length).toBeGreaterThan(0)
    expect(model.bins.length).toBeLessThanOrEqual(MAX_TIMELINE_BINS)
    expect(model.events).toHaveLength(MAX_TIMELINE_EVENTS + 47)
    expect(model.events.filter((event) => event._tag === 'compaction')).toHaveLength(47)
    expect(model.humanPrompts).toHaveLength(MAX_TIMELINE_PROMPTS)
    expect(model.coverage.matchingSessions).toBe(sessionCount)
    expect(model.sessions.find(({ id }) => id === 'root')?.facts).toMatchObject({
      compactions: 47,
      prompts: MAX_TIMELINE_PROMPTS + 20,
      toolCalls: MAX_TOOLS_PER_REQUEST + 5,
      requests: requestsPerSession,
      turns: requestsPerSession,
    })
    expect(model.humanPromptCount).toBe(MAX_TIMELINE_PROMPTS + 20)
    expect(model.sessions.find(({ id }) => id === 'root')?.endedAt).toBe(
      base + MAX_TIMELINE_EVENTS + 19,
    )
    expect(model.humanPromptCounts?.root).toBe(MAX_TIMELINE_PROMPTS + 20)
    expect(rootFirst?.tools).toHaveLength(MAX_TOOLS_PER_REQUEST)
    expect(rootFirst?.toolCalls).toBe(MAX_TOOLS_PER_REQUEST + 5)
    expect(model.sessions.find(({ id }) => id === 'child-001')?.agentType).toBeNull()
    expect([...model.requests, ...model.bins].reduce((sum, value) => sum + value.requests, 0)).toBe(
      model.coverage.includedRequests,
    )
  })

  it('emits bounded load and SQL stage telemetry without ledger identity', async () => {
    const db = createLedger()
    insertRequest(db, { id: 'telemetry-root', ts: NOW - 1_000 })
    db.close()

    const trace = await Effect.runPromise(
      captureInProcessTrace(
        {
          serviceName: 'vista-service-test',
          rootSpanName: 'vista.agent-timeline.test',
          rootSpanLabel: 'agent-timeline.test',
          exportInterval: 50,
        },
        Effect.asVoid(load(ledgerPath)),
        { spanLabelPolicy: 'off' },
      ).pipe(Effect.scoped),
    )

    trace.expectSome({
      name: 'vista.agent_timeline.load',
      attrs: {
        'span.label': 'ledger',
        'sk.vista.agent_timeline.horizon': '1h',
        'sk.vista.agent_timeline.sessions': 1,
        'sk.vista.agent_timeline.retained_requests': 1,
        'sk.vista.agent_timeline.folded': 0,
      },
    })
    trace.expectSome({
      name: 'vista.agent_timeline.sql',
      attrs: {
        'span.label': 'roots',
        'db.system.name': 'sqlite',
        'db.operation.name': 'SELECT',
        'db.query.summary': 'select ranked roots',
        'sk.vista.agent_timeline.horizon': '1h',
        'db.response.returned_rows': 1,
      },
    })
  })

  it('reads first-request metadata through the session index, not a horizon-wide time scan', async () => {
    const db = createLedger()
    // Many in-horizon requests from sessions outside the selection, as in the live ledger.
    for (let request = 0; request < 400; request += 1) {
      insertRequest(db, {
        id: `other-${request}`,
        ts: NOW - 60_000 - request,
        sessionId: `other-${request % 40}`,
        rootSessionId: `other-${request % 40}`,
        actorId: 'dev3.other',
      })
    }
    insertRequest(db, { id: 'selected-root', ts: NOW - 5_000, actorId: 'dev3.selected' })
    db.close()

    const statements: Array<{
      readonly sql: string
      readonly parameters: ReadonlyArray<SQLInputValue>
    }> = []
    const prepare = DatabaseSync.prototype.prepare
    DatabaseSync.prototype.prepare = function (this: DatabaseSync, sql: string) {
      const statement = prepare.call(this, sql)
      if (!sql.includes('ranked_window as')) return statement
      const all = statement.all.bind(statement)
      statement.all = ((...parameters: SQLInputValue[]) => {
        statements.push({ sql, parameters })
        return all(...parameters)
      }) as typeof statement.all
      return statement
    }
    try {
      await Effect.runPromise(load(ledgerPath, '7d', ['dev3.selected']))
    } finally {
      DatabaseSync.prototype.prepare = prepare
    }

    expect(statements).toHaveLength(1)
    const { sql, parameters } = statements[0]!
    const plan = new DatabaseSync(ledgerPath, { readOnly: true })
    const details = (
      plan.prepare(`explain query plan ${sql}`).all(...parameters) as unknown as ReadonlyArray<{
        readonly detail: string
      }>
    ).map(({ detail }) => detail)
    plan.close()
    // The first `requests` search is the in-horizon ranking; it must probe per selected session.
    const firstRequestsSearch = details.find((detail) => /\bSEARCH r\b|\bSCAN r\b/.test(detail))
    expect(firstRequestsSearch).toContain('requests_session')
  })

  it('uses local-provider admission for live refreshes', async () => {
    const budget = await Effect.runPromise(
      makeProviderBudget({ external: { limit: 1, window: '1 minute' } }),
    )
    for (const id of [agentTimeline.id, 'agent-trace']) {
      const interval = await Effect.runPromise(
        budget.pollInterval(id, 1, { min: '10 millis', max: '100 millis' }),
      )
      expect(Duration.toMillis(interval)).toBe(100)
    }
  })

  it('fails on the typed missing-ledger channel', async () => {
    const error = await Effect.runPromise(Effect.flip(load(join(directory, 'missing.sqlite'))))
    expect(error).toBeInstanceOf(AgentTimelineError)
    expect(error.reason).toBe('missing')
  })

  it('does not expose local paths or raw SQLite causes in open failures', async () => {
    const error = await Effect.runPromise(Effect.flip(load(directory)))
    expect(error).toBeInstanceOf(AgentTimelineError)
    expect(error.reason).toBe('open')
    expect(error.message).toBe('Could not open the OMP Usage ledger read-only')
    expect(error.message).not.toContain(directory)
  })

  it('does not expose raw SQLite query causes', async () => {
    new DatabaseSync(ledgerPath).close()
    const error = await Effect.runPromise(Effect.flip(load(ledgerPath)))
    expect(error).toBeInstanceOf(AgentTimelineError)
    expect(error.reason).toBe('query')
    expect(error.message).toBe('Could not query the OMP Usage ledger')
    expect(error.message).not.toContain(ledgerPath)
  })

  it('is effectful', () => {
    expect(agentTimelineProvider.id).toBe('agent-timeline')
    expect(agentTimelineProvider.purity).toBe('effectful')
  })
})

describe('agent-timeline context capacity', () => {
  it('leaves capacity unknown when the ledger has no model catalog yet', async () => {
    const db = createLedger()
    insertRequest(db, { id: 'no-catalog', ts: NOW - 1_000, provider: 'anthropic', model: 'claude' })
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(model.requests).toEqual([
      expect.objectContaining({ provider: 'anthropic', model: 'claude', contextCapacity: null }),
    ])
  })

  it('joins the catalog on the exact provider and model pair', async () => {
    const db = createLedger()
    createModelCatalog(db, [
      ['openai', 'gpt-test', 400_000],
      ['azure', 'gpt-test', 128_000],
      ['openai', 'openai/gpt-test', 1],
    ])
    insertRequest(db, { id: 'openai', ts: NOW - 3_000, provider: 'openai', model: 'gpt-test' })
    insertRequest(db, { id: 'azure', ts: NOW - 2_000, provider: 'azure', model: 'gpt-test' })
    insertRequest(db, { id: 'other', ts: NOW - 1_000, provider: 'anthropic', model: 'gpt-test' })
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(
      model.requests.map(({ provider, contextCapacity }) => [provider, contextCapacity]),
    ).toEqual([
      ['openai', 400_000],
      ['azure', 128_000],
      ['anthropic', null],
    ])
  })

  it('splits a folded bin into one context segment per epoch run, so A-B-A is three', async () => {
    const db = createLedger()
    createModelCatalog(db, [['openai', 'gpt-test', 1_000]])
    const runs = seedRuns(db, {
      sessionId: 'root',
      start: BIN_START,
      runs: [
        { count: 1_000, epoch: 0, contextTokens: 100 },
        { count: 1_000, epoch: 1, contextTokens: 500 },
        { count: 1_000, epoch: 0, contextTokens: 200 },
      ],
    })
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    expect(model.bins).toHaveLength(1)
    const bin = model.bins[0]!
    const segments = bin.contextSegments ?? []
    expect(
      segments.map(({ compactionEpoch, minFraction, maxFraction, unknown }) => [
        compactionEpoch,
        minFraction,
        maxFraction,
        unknown,
      ]),
    ).toEqual([
      [0, 0.1, 0.1, 0],
      [1, 0.5, 0.5, 0],
      [0, 0.2, 0.2, 0],
    ])
    for (const [index, segment] of segments.entries()) {
      expect(segment.from).toBeGreaterThanOrEqual(runs[index]!.first)
      expect(segment.to).toBeLessThanOrEqual(runs[index]!.last)
    }
    expect(segments.reduce((total, { measured }) => total + measured, 0)).toBe(bin.requests)
  })

  it('splits at a compaction event within one epoch and counts uncatalogued requests as unknown', async () => {
    const db = createLedger()
    const runs = seedRuns(db, {
      sessionId: 'root',
      start: BIN_START,
      runs: [
        { count: 1_200, epoch: 0, contextTokens: 100 },
        { count: 1_200, epoch: 0, contextTokens: 300 },
      ],
    })
    db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?)').run(
      1,
      'root',
      runs[1]!.first - 5,
      'compaction',
      '{}',
    )
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    const bin = model.bins[0]!
    expect(bin.contextSegments).toHaveLength(2)
    expect(bin.contextSegments?.[0]?.to).toBeLessThan(runs[1]!.first)
    expect(bin.contextSegments?.[1]?.from).toBeGreaterThanOrEqual(runs[1]!.first)
    expect(
      bin.contextSegments?.map(({ compactionEpoch, minFraction, maxFraction, measured }) => [
        compactionEpoch,
        minFraction,
        maxFraction,
        measured,
      ]),
    ).toEqual([
      [0, null, null, 0],
      [0, null, null, 0],
    ])
    expect(bin.contextSegments?.reduce((total, { unknown }) => total + unknown, 0)).toBe(
      bin.requests,
    )
  })

  it('omits segments for a bin over the segment budget instead of merging them', async () => {
    const db = createLedger()
    createModelCatalog(db, [['openai', 'gpt-test', 1_000]])
    seedRuns(db, {
      sessionId: 'root',
      start: BIN_START,
      runs: Array.from({ length: MAX_CONTEXT_SEGMENTS_PER_BIN + 1 }, (_, index) => ({
        count: 400,
        epoch: index % 2,
        contextTokens: 100,
      })),
    })
    seedRuns(db, {
      sessionId: 'root',
      start: BIN_START + 10 * 60_000,
      runs: [{ count: 1_000, epoch: 0, contextTokens: 100 }],
    })
    db.close()

    const model = await Effect.runPromise(load(ledgerPath))
    const overflowing = model.bins.find(({ from }) => from === BIN_START)
    const budgeted = model.bins.find(({ from }) => from === BIN_START + 10 * 60_000)
    expect(overflowing).toBeDefined()
    expect(overflowing).not.toHaveProperty('contextSegments')
    expect(budgeted?.contextSegments).toHaveLength(1)
  })
})

describe('agent-timeline tmux session selection', () => {
  const seedTmuxLedger = (): void => {
    const db = createLedger()
    insertRequest(db, {
      id: 'agent-root-1',
      ts: NOW - 30_000,
      sessionId: 'agent-root',
      rootSessionId: 'agent-root',
      actorId: 'dev3.misc',
    })
    insertRequest(db, {
      id: 'agent-successor-1',
      ts: NOW - 20_000,
      sessionId: 'agent-successor',
      parentSessionId: 'agent-root',
      rootSessionId: 'agent-root',
      depth: 1,
      actorId: 'dev3.misc',
    })
    insertRequest(db, {
      id: 'agent-sub-1',
      ts: NOW - 10_000,
      sessionId: 'agent-sub',
      parentSessionId: 'agent-successor',
      rootSessionId: 'agent-root',
      depth: 2,
      role: 'subagent',
      actorId: 'dev3.misc.worker',
    })
    for (let index = 0; index < 5; index += 1) {
      insertRequest(db, {
        id: `busy-${index}`,
        ts: NOW - 5_000 - index,
        sessionId: 'busy-root',
        rootSessionId: 'busy-root',
        actorId: 'dev3.busy',
        usd: 1,
      })
    }
    db.close()
  }

  const panes = tmuxPanes([
    ['%1', '/dev/pts/1'],
    ['%2', '/dev/pts/2'],
    ['%3', '/dev/pts/3'],
    ['%4', '/dev/pts/9'],
  ])
  const ptyList = JSON.stringify([
    ptyEntry({
      name: 'misc',
      ttys: ['/dev/pts/1'],
      sessionId: 'agent-successor',
      actorPath: 'dev3.misc',
    }),
    // Stale: the PTY exited, so its former client tty proves nothing.
    ptyEntry({ name: 'stale', status: 'exited', ttys: ['/dev/pts/2'], sessionId: 'busy-root' }),
    ptyEntry({ name: 'fresh', ttys: ['/dev/pts/3'], sessionId: 'not-in-ledger' }),
  ])

  it('selects every session under the roots of agents attached to the tmux session', async () => {
    seedTmuxLedger()
    const calls: Array<readonly [string, ReadonlyArray<string>]> = []
    const loadAt = await loadTmux(ledgerPath, fixtureRunner({ tmux: panes, pty: ptyList }, calls))

    const model = await Effect.runPromise(loadAt())
    expect(model.sessions.map(({ id }) => id).toSorted()).toEqual([
      'agent-root',
      'agent-sub',
      'agent-successor',
    ])
    expect(model.coverage.policy).toContain('1 agent attached to tmux session dotfiles/misc')
    expect(calls).toEqual([
      ['tmux', ['list-panes', '-t', '=dotfiles/misc', '-s', '-F', '#{pane_id}\t#{pane_tty}']],
      ['pty', ['list', '--json', '--clients']],
    ])
  })

  it('reuses a resolution for 30 s and never caches failures', async () => {
    seedTmuxLedger()
    const calls: Array<readonly [string, ReadonlyArray<string>]> = []
    let now = NOW
    const loadAt = await loadTmux(
      ledgerPath,
      fixtureRunner({ tmux: panes, pty: ptyList }, calls),
      () => now,
    )
    await Effect.runPromise(loadAt())
    now = NOW + 29_999
    await Effect.runPromise(loadAt())
    expect(calls).toHaveLength(2)
    now = NOW + 30_000
    await Effect.runPromise(loadAt())
    expect(calls).toHaveLength(4)

    const failing = await loadTmux(ledgerPath, fixtureRunner({ pty: ptyList }))
    const error = await Effect.runPromise(Effect.flip(failing()))
    expect(error).toBeInstanceOf(AgentTimelineError)
    expect(error.reason).toBe('resolve')
  })

  it('fails as unsupported when pty omits attached clients', async () => {
    seedTmuxLedger()
    const legacyPty = JSON.stringify([
      { name: 'misc', status: 'running', tags: { 'agent.harness.session.id': 'agent-successor' } },
    ])
    const loadAt = await loadTmux(ledgerPath, fixtureRunner({ tmux: panes, pty: legacyPty }))

    const error = await Effect.runPromise(Effect.flip(loadAt()))
    expect(error).toBeInstanceOf(AgentTimelineError)
    expect(error.reason).toBe('unsupported')
    expect(error.message).toBe('pty does not report attached clients (needs pty with --clients)')
  })

  it('skips panes whose agent has no ledger rows', async () => {
    seedTmuxLedger()
    const loadAt = await loadTmux(
      ledgerPath,
      fixtureRunner({
        tmux: tmuxPanes([['%3', '/dev/pts/3']]),
        pty: ptyList,
      }),
    )

    const error = await Effect.runPromise(Effect.flip(loadAt()))
    expect(error.reason).toBe('empty')
    expect(error.message).toContain('tmux session dotfiles/misc')
  })

  it('records pane and root counts on the resolve span', async () => {
    seedTmuxLedger()
    const loadAt = await loadTmux(ledgerPath, fixtureRunner({ tmux: panes, pty: ptyList }))

    const trace = await Effect.runPromise(
      captureInProcessTrace(
        {
          serviceName: 'vista-service-test',
          rootSpanName: 'vista.agent-timeline.test',
          rootSpanLabel: 'agent-timeline.test',
          exportInterval: 50,
        },
        Effect.asVoid(loadAt()),
        { spanLabelPolicy: 'off' },
      ).pipe(Effect.scoped),
    )

    trace.expectSome({
      name: 'vista.agent_timeline.tmux_resolve',
      attrs: {
        'sk.vista.agent_timeline.tmux.panes': 4,
        'sk.vista.agent_timeline.tmux.agents': 2,
        'sk.vista.agent_timeline.tmux.resolved_roots': 1,
      },
    })
  })

  it('rejects actors and tmuxSession together', () => {
    const decode = Schema.decodeUnknownResult(AgentTimelineLoadArgs)
    expect(decode({ horizon: '1h', tmuxSession: TMUX_SESSION })._tag).toBe('Success')
    expect(decode({ horizon: '1h', actors: ['dev3.misc'], tmuxSession: TMUX_SESSION })._tag).toBe(
      'Failure',
    )
  })
})
