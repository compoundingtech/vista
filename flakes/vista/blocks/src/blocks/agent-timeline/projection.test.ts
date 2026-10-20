import { Schema } from 'effect'
import { expect, test } from 'vitest'

import {
  AgentTimelineModelSchema,
  type AgentTimelineBin,
  type AgentTimelineModel,
  type AgentTimelineRequest,
  type AgentTimelineSession,
} from '@overeng/agent-timeline/model'
import {
  deriveAgentTimelineActivity,
  projectAgentTimeline,
  valuesAt,
} from '@overeng/agent-timeline/projection'

import oneHourJson from '../../stories/agent-timeline/1h.json' with { type: 'json' }

test('decodes the captured Agent Timeline fixture through the provider wire schema', () => {
  expect(Schema.decodeSync(AgentTimelineModelSchema)(oneHourJson).horizon).toBe('1h')
})

const session = (
  id: string,
  startedAt: number,
  parentId: string | null,
  rootId: string,
  depth: number,
  endedAt: number | null = null,
): AgentTimelineSession => ({
  id,
  parentId,
  rootId,
  depth,
  role: depth === 0 ? 'main' : 'subagent',
  model: 'model-a',
  actorId: 'seat-01',
  project: 'example/repo@main',
  title: id,
  name: depth === 0 ? null : id,
  agentType: depth === 0 ? 'gen' : 'task',
  task: depth === 0 ? null : `Handle ${id}`,
  modelRole: depth === 0 ? null : 'worker',
  readOnly: false,
  contextCapacity: 100,
  startedAt,
  endedAt,
})

const request = (
  sessionId: string,
  ts: number,
  usd: number,
  stopReason: string,
  contextTokens: number | null,
  kind: AgentTimelineRequest['kind'] = 'turn',
): AgentTimelineRequest => ({
  sessionId,
  ts,
  durationMs: 1_000,
  kind,
  stopReason,
  provider: 'test-provider',
  model: 'model-a',
  contextCapacity: null,
  inputTokens: 100,
  cacheReadTokens: 20,
  cacheWriteTokens: 5,
  outputTokens: 10,
  contextTokens,
  compactionEpoch: 0,
  usd,
  usdInput: usd / 2,
  usdCacheRead: usd / 4,
  usdCacheWrite: usd / 8,
  usdOutput: usd / 8,
  requests: 1,
  toolCalls: stopReason === 'toolUse' ? 1 : 0,
  tools: stopReason === 'toolUse' ? ['read'] : [],
})

const fixtureActivity = [
  { from: 100, to: 400_000, state: 'working' },
  { from: 400_000, to: 950_000, state: 'idle' },
] as const

const foldedBin: AgentTimelineBin = {
  sessionId: 'child-early',
  from: 510_000,
  to: 520_000,
  requests: 2,
  agentTurns: 1,
  usd: 1,
  usdInput: 0.5,
  usdCacheRead: 0.25,
  usdCacheWrite: 0.125,
  usdOutput: 0.125,
  inputTokens: 200,
  cacheReadTokens: 40,
  cacheWriteTokens: 10,
  outputTokens: 20,
  toolCalls: 3,
  tools: ['read', 'write'],
  byModel: {
    'model-a': { requests: 1, usd: 0.4 },
    'model-b': { requests: 1, usd: 0.6 },
  },
  byStop: { error: 1, toolUse: 1 },
  contextEstimated: true,
}

const model: AgentTimelineModel = {
  horizon: '1h',
  windowStart: 0,
  windowEnd: 1_000_000,
  modelCapacities: { 'model-a': 100, 'model-b': 200 },
  sessions: [
    { ...session('root-a', 100, null, 'root-a', 0), activity: fixtureActivity },
    { ...session('root-b', 150, null, 'root-b', 0), model: 'model-b', contextCapacity: null },
    session('child-early', 200, 'root-a', 'root-a', 1, 650_000),
    session('child-late', 300, 'root-a', 'root-a', 1),
  ],
  requests: [
    request('child-late', 200_000, 1, 'stop', null),
    request('child-early', 500_000, 2, 'toolUse', 80),
    request('child-early', 550_000, 3, 'stop', 999),
    request('child-early', 600_000, 4, 'stop', 20),
    request('root-a', 950_000, 5, 'stop', 200),
    { ...request('root-b', 999_000, 6, 'toolUse', 240), model: 'model-b' },
  ],
  bins: [foldedBin],
  events: [
    { _tag: 'compaction', sessionId: 'child-early', ts: 550_000, summaryChars: 240 },
    { _tag: 'model_change', sessionId: 'child-early', ts: 580_000, model: 'model-b' },
    { _tag: 'session_exit', sessionId: 'child-early', ts: 650_000 },
  ],
  humanPrompts: [
    { sessionId: 'root-a', ts: 900_000, steering: false },
    { sessionId: 'child-early', ts: 575_000, steering: true },
  ],
  humanPromptCount: 5,
  humanPromptCounts: { 'root-a': 4, 'child-early': 1 },
  coverage: {
    includedRoots: 2,
    totalRoots: 4,
    includedRequests: 8,
    totalRequests: 16,
    includedUsd: 22,
    totalUsd: 44,
    policy: 'Test selection.',
  },
  parameters: {
    idleThresholdMs: 600_000,
    activeWithinMs: 600_000,
  },
  sampled: true,
  folded: 2,
}

test('projects tree order, fork points, spend, context lifecycle, and activity', () => {
  const scene = projectAgentTimeline(model)

  expect(scene.lanes.map((lane) => lane.session.id)).toEqual([
    'root-a',
    'child-early',
    'child-late',
    'root-b',
  ])
  expect(scene.lanes.find(({ session }) => session.id === 'root-a')?.humanPromptCount).toBe(4)
  expect(scene.lanes.map((lane) => lane.order)).toEqual([0, 1, 2, 3])
  expect(scene.lanes[0]?.activity).toBe(fixtureActivity)
  expect(scene.forks).toEqual([
    { parentSessionId: 'root-a', childSessionId: 'child-early', ts: 200 },
    { parentSessionId: 'root-a', childSessionId: 'child-late', ts: 300 },
  ])

  expect(scene.cumulativeUsd).toEqual([
    { ts: 200_000, usd: 1 },
    { ts: 500_000, usd: 3 },
    { ts: 520_000, usd: 4 },
    { ts: 550_000, usd: 7 },
    { ts: 600_000, usd: 11 },
    { ts: 950_000, usd: 16 },
    { ts: 999_000, usd: 22 },
  ])
  expect(scene.lanes[1]?.samples.map((sample) => sample.cumulativeUsd)).toEqual([2, 6, 10])
  expect(scene.lanes[1]?.cumulativeValues).toEqual([
    { ts: 500_000, usd: 2, requests: 1 },
    { ts: 520_000, usd: 3, requests: 3 },
    { ts: 550_000, usd: 6, requests: 4 },
    { ts: 600_000, usd: 10, requests: 5 },
  ])
  expect(scene.lanes[1]?.samples.at(-1)?.cumulativeUsdByComponent).toEqual({
    input: 5,
    cacheRead: 2.5,
    cacheWrite: 1.25,
    output: 1.25,
  })
  expect(scene.lanes[1]?.tokens).toEqual({
    input: 500,
    cacheRead: 100,
    cacheWrite: 25,
    output: 50,
    total: 675,
  })
  expect(scene.lanes[1]?.samples.map((sample) => sample.requests)).toEqual([1, 4, 5])
  expect(scene.lanes[1]?.samples.map((sample) => sample.toolCalls)).toEqual([1, 4, 4])
  expect(scene.lanes[1]?.requests).toBe(5)
  expect(scene.lanes[1]?.toolCalls).toBe(4)
  expect(scene.lanes[1]?.bins).toEqual([foldedBin])
  expect(scene.lanes[1]?.compactions).toEqual([{ ts: 550_000, before: 80, after: 20 }])
  expect(scene.lanes[2]?.samples[0]?.contextTokens).toBe(125)
  expect(scene.lanes[1]?.samples.map((sample) => sample.contextFraction)).toEqual([0.8, 9.99, 0.2])
  expect(scene.lanes[2]?.samples[0]?.contextFraction).toBe(1.25)
  expect(scene.lanes[3]?.samples[0]?.contextFraction).toBe(1.2)
  expect(scene.lanes.map((lane) => lane.contextCapacity)).toEqual([100, 200, 100, 200])
  expect(scene.lanes.map((lane) => lane.contextSource)).toEqual([
    'measured',
    'mixed',
    'estimated',
    'measured',
  ])
  expect(scene.lanes[2]?.samples[0]?.isContextEstimated).toBe(true)
  expect(scene.lanes.map((lane) => lane.status)).toEqual([
    { _tag: 'active', lastRequestAt: 950_000 },
    { _tag: 'exited', at: 650_000 },
    { _tag: 'inactive', lastRequestAt: 200_000 },
    { _tag: 'active', lastRequestAt: 999_000 },
  ])
  expect(scene.lanes.map((lane) => lane.endTs)).toEqual([950_000, 650_000, 200_000, 999_000])
  expect(scene.lanes[1]?.models).toEqual([
    { from: 200, model: 'model-a' },
    { from: 580_000, model: 'model-b' },
  ])
  expect(scene.lanes[1]?.currentModel).toBe('model-b')
  expect(scene.lanes[1]?.wallMs).toBe(100_000)
  expect(scene.lanes[1]?.activeMs).toBe(100_000)
  expect(scene.lanes[1]?.spendByModel).toEqual({ 'model-a': 9.4, 'model-b': 0.6 })
  expect(scene.lanes[1]?.agentTurns).toBe(3)
  expect(scene.spendByModel).toEqual({ 'model-a': 15.4, 'model-b': 6.6 })
  expect(scene.totals).toEqual({
    usd: 22,
    requests: 8,
    toolCalls: 5,
    agentTurns: 5,
    humanPrompts: 5,
    sessions: 4,
    active: 2,
  })
})

test('treats an exit followed by a request as a resumption, not a terminal exit', () => {
  const resumedModel: AgentTimelineModel = {
    ...model,
    sessions: [session('resumed', 100, null, 'resumed', 0)],
    requests: [
      request('resumed', 200_000, 1, 'toolUse', 10),
      request('resumed', 500_000, 2, 'stop', 20),
    ],
    bins: [],
    events: [
      { _tag: 'session_exit', sessionId: 'resumed', ts: 300_000 },
      { _tag: 'session_exit', sessionId: 'resumed', ts: 400_000 },
    ],
    humanPrompts: [],
  }

  const lane = projectAgentTimeline(resumedModel).lanes[0]!
  expect(lane.status).toEqual({ _tag: 'active', lastRequestAt: 500_000 })
  expect(lane.endTs).toBe(500_000)
  expect(lane.resumptions).toEqual([
    { exitedAt: 300_000, resumedAt: 500_000 },
    { exitedAt: 400_000, resumedAt: 500_000 },
  ])
})

test('derives working, waiting, and idle activity with the ten-minute rule', () => {
  const sessions = [
    session('parent', 0, null, 'parent', 0),
    session('child', 400_000, 'parent', 'parent', 1),
  ]
  const activity = deriveAgentTimelineActivity({
    sessions,
    requests: [
      request('parent', 0, 0, 'toolUse', 10),
      request('parent', 100_000, 0, 'toolUse', 20),
      request('child', 400_000, 0, 'toolUse', 10),
      request('parent', 800_000, 0, 'toolUse', 30),
      request('parent', 1_500_000, 0, 'toolUse', 40),
    ],
    windowStart: 0,
    windowEnd: 1_500_000,
    idleThresholdMs: 600_000,
  })

  expect(activity.get('parent')).toEqual([
    { from: 0, to: 100_000, state: 'working' },
    { from: 100_000, to: 800_000, state: 'waiting' },
    { from: 800_000, to: 1_500_000, state: 'idle' },
  ])
})

test('orders nested descendants before their parent’s later siblings', () => {
  const nestedModel: AgentTimelineModel = {
    ...model,
    sessions: [
      session('sibling', 300, 'root', 'root', 1),
      session('grandchild', 250, 'child', 'root', 2),
      session('root', 100, null, 'root', 0),
      session('child', 200, 'root', 'root', 1),
    ],
    requests: [
      request('root', 100, 0, 'stop', 10),
      request('child', 200, 0, 'stop', 10),
      request('grandchild', 250, 0, 'stop', 10),
      request('sibling', 300, 0, 'stop', 10),
    ],
    bins: [],
    events: [],
    humanPrompts: [],
  }

  expect(projectAgentTimeline(nestedModel).lanes.map((lane) => lane.session.id)).toEqual([
    'root',
    'child',
    'grandchild',
    'sibling',
  ])
})

test('includes folded bins in cursor spend and request totals', () => {
  const lane = projectAgentTimeline(model).lanes.find(
    (candidate) => candidate.session.id === 'child-early',
  )!

  expect(valuesAt(lane, 525_000)).toMatchObject({
    cumulativeUsd: 3,
    requests: 3,
  })
})

test('uses exact session facts when retained marks omit requests and compactions', () => {
  const exact = projectAgentTimeline({
    ...model,
    sessions: [
      {
        ...session('root-exact', 100, null, 'root-exact', 0),
        facts: {
          requests: 34,
          turns: 11,
          usd: 125,
          inputTokens: 1000,
          cacheReadTokens: 2000,
          cacheWriteTokens: 300,
          outputTokens: 400,
          toolCalls: 29,
          compactions: 3,
          prompts: 4,
          activeMs: 300_000,
          lastRequestAt: 950_000,
          lastExitAt: null,
          status: 'active',
        },
      },
    ],
    requests: [request('root-exact', 300_000, 1, 'toolUse', 10)],
    bins: [],
    events: [],
    humanPrompts: [],
  })
  const lane = exact.lanes[0]!
  expect(lane).toMatchObject({
    requests: 34,
    agentTurns: 11,
    totalUsd: 125,
    toolCalls: 29,
    compactionCount: 3,
    humanPromptCount: 4,
    activeMs: 300_000,
    status: { _tag: 'active', lastRequestAt: 950_000 },
    tokens: { total: 3700 },
  })
  expect(lane.compactions).toEqual([])
  expect(exact.totals).toMatchObject({
    usd: 125,
    requests: 34,
    agentTurns: 11,
    toolCalls: 29,
    humanPrompts: 4,
  })
})

test('prefers the catalog capacity on a request over the model capacity table', () => {
  const scene = projectAgentTimeline({
    ...model,
    sessions: [session('root-catalog', 100, null, 'root-catalog', 0)],
    requests: [
      { ...request('root-catalog', 200_000, 1, 'stop', 500_000), contextCapacity: 1_000_000 },
      request('root-catalog', 300_000, 1, 'stop', 50),
    ],
    bins: [],
    events: [],
    humanPrompts: [],
  })
  const lane = scene.lanes[0]!
  expect(lane.samples.map((sample) => sample.contextFraction)).toEqual([0.5, 0.5])
  expect(lane.contextCapacity).toBe(1_000_000)
})

test('projects folded compaction segments into bands and omits unknown-capacity segments', () => {
  const scene = projectAgentTimeline({
    ...model,
    bins: [
      {
        ...foldedBin,
        contextEstimated: false,
        contextSegments: [
          {
            from: 510_500,
            to: 514_000,
            compactionEpoch: 2,
            minFraction: 0.107,
            maxFraction: 0.263,
            measured: 5,
            unknown: 0,
          },
          {
            from: 515_000,
            to: 517_000,
            compactionEpoch: 3,
            minFraction: null,
            maxFraction: null,
            measured: 0,
            unknown: 2,
          },
          {
            from: 518_000,
            to: 519_500,
            compactionEpoch: 3,
            minFraction: 0.031,
            maxFraction: 0.058,
            measured: 3,
            unknown: 1,
          },
        ],
      },
    ],
  })
  const lane = scene.lanes.find(({ session }) => session.id === 'child-early')!
  expect(lane.contextBands).toEqual([
    {
      from: 510_500,
      to: 514_000,
      compactionEpoch: 2,
      minFraction: 0.107,
      maxFraction: 0.263,
      estimated: false,
      partialCapacity: false,
    },
    {
      from: 518_000,
      to: 519_500,
      compactionEpoch: 3,
      minFraction: 0.031,
      maxFraction: 0.058,
      estimated: false,
      partialCapacity: true,
    },
  ])
  expect(
    scene.lanes.flatMap((other) => (other.session.id === 'child-early' ? [] : other.contextBands)),
  ).toEqual([])
})
