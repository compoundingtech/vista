import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

import { laneActivity, laneEnd, spanHue } from '@overeng/agent-timeline/encodings'
import { sessionLabel } from '@overeng/agent-timeline/labels'
import type {
  AgentTimelineBin,
  AgentTimelineContextSegment,
  AgentTimelineModel,
  AgentTimelineRequest,
} from '@overeng/agent-timeline/model'
import {
  projectAgentTimeline,
  type AgentTimelineScene,
  type Lane,
} from '@overeng/agent-timeline/projection'
import { Span } from '@overeng/agent-timeline/span'

import { SpanHover, useSpanHover } from '../../blocks/agent-timeline/SpanHover.tsx'
import { useTheme } from '../../theme.ts'
import { agentTimelineFixtures } from './fixtures.ts'

const SPAN_WIDTH = 960
const SPAN_HEIGHT = 34
const MINUTE = 60_000
const WIDTHS = [7, 8, 23, 24, 96, 97, 480] as const

const scenes = {
  '1h': projectAgentTimeline(agentTimelineFixtures['1h']),
  '1d': projectAgentTimeline(agentTimelineFixtures['1d']),
  '7d': projectAgentTimeline(agentTimelineFixtures['7d']),
} as const

interface SpanCase {
  readonly id: string
  readonly label: string
  readonly caption: string
  readonly scene: AgentTimelineScene
  readonly lane: Lane
}

const spanCase = (
  horizon: keyof typeof scenes,
  laneId: string,
  id: string,
  label: string,
  caption: string,
): SpanCase => {
  const scene = scenes[horizon]
  const lane = scene.lanes.find((candidate) => candidate.session.id === laneId)!
  return { id, label, caption, scene, lane }
}

const BAND_START = 1_789_800_000_000
const BAND_SESSION = 'context-band-root'
const WINDOW_TOKENS = 1_000_000
const at = (minutes: number): number => BAND_START + minutes * MINUTE

const bandRequest = (minutes: number, contextTokens: number): AgentTimelineRequest => ({
  sessionId: BAND_SESSION,
  ts: at(minutes),
  durationMs: 4_000,
  kind: 'turn',
  stopReason: 'toolUse',
  provider: 'anthropic',
  model: 'claude-opus-5',
  contextCapacity: WINDOW_TOKENS,
  inputTokens: 2_000,
  cacheReadTokens: contextTokens - 2_000,
  cacheWriteTokens: 0,
  outputTokens: 800,
  contextTokens,
  compactionEpoch: minutes < 30 ? 0 : 1,
  usd: 0.12,
  usdInput: 0.01,
  usdCacheRead: 0.08,
  usdCacheWrite: 0,
  usdOutput: 0.03,
  requests: 1,
  toolCalls: 1,
  tools: ['read'],
})

const bandBin = (
  fromMinutes: number,
  toMinutes: number,
  requests: number,
  contextSegments: ReadonlyArray<AgentTimelineContextSegment>,
  contextEstimated = false,
): AgentTimelineBin => ({
  sessionId: BAND_SESSION,
  from: at(fromMinutes),
  to: at(toMinutes),
  requests,
  agentTurns: 0,
  usd: requests * 0.12,
  usdInput: requests * 0.01,
  usdCacheRead: requests * 0.08,
  usdCacheWrite: 0,
  usdOutput: requests * 0.03,
  inputTokens: requests * 2_000,
  cacheReadTokens: requests * 150_000,
  cacheWriteTokens: 0,
  outputTokens: requests * 800,
  toolCalls: requests,
  tools: ['read', 'edit'],
  byModel: { 'claude-opus-5': { requests, usd: requests * 0.12 } },
  byStop: { toolUse: requests },
  contextEstimated,
  contextSegments,
})

const segment = (
  fromMinutes: number,
  toMinutes: number,
  compactionEpoch: number,
  minTokens: number | null,
  maxTokens: number | null,
  measured: number,
  unknown = 0,
): AgentTimelineContextSegment => ({
  from: at(fromMinutes),
  to: at(toMinutes),
  compactionEpoch,
  minFraction: minTokens === null ? null : minTokens / WINDOW_TOKENS,
  maxFraction: maxTokens === null ? null : maxTokens / WINDOW_TOKENS,
  measured,
  unknown,
})

/** One root on a 1M window: folded 107k–263k before a compaction, then a lower band after it. */
const contextBandModel: AgentTimelineModel = {
  horizon: '1h',
  windowStart: at(-5),
  windowEnd: at(85),
  modelCapacities: {},
  sessions: [
    {
      id: BAND_SESSION,
      parentId: null,
      rootId: BAND_SESSION,
      depth: 0,
      role: 'main',
      model: 'claude-opus-5',
      actorId: 'example-seat',
      project: 'acme/example@main',
      title: null,
      name: null,
      agentType: 'gen',
      task: null,
      modelRole: null,
      readOnly: false,
      contextCapacity: WINDOW_TOKENS,
      startedAt: at(1),
      endedAt: null,
      activity: [{ from: at(1), to: at(80), state: 'working' }],
    },
  ],
  requests: [
    bandRequest(1, 102_000),
    bandRequest(2, 104_500),
    bandRequest(3, 106_800),
    bandRequest(26, 268_000),
    bandRequest(28, 281_000),
    bandRequest(72, 171_000),
    bandRequest(76, 178_500),
    bandRequest(80, 183_000),
  ],
  bins: [
    bandBin(4, 25, 34, [segment(4.5, 24.5, 0, 107_000, 263_000, 34)]),
    bandBin(31, 50, 22, [segment(31.5, 49, 1, 41_000, 118_000, 22)]),
    bandBin(50, 60, 9, [segment(50.5, 59, 1, 121_000, 158_000, 7, 2)], true),
    bandBin(60, 70, 6, [segment(61, 69, 1, null, null, 0, 6)]),
  ],
  events: [{ _tag: 'compaction', sessionId: BAND_SESSION, ts: at(30), summaryChars: 4_800 }],
  humanPrompts: [],
  coverage: {
    includedRoots: 1,
    totalRoots: 1,
    includedRequests: 8,
    totalRequests: 79,
    includedUsd: 9.48,
    totalUsd: 9.48,
    policy: 'Synthetic context band case.',
  },
  parameters: { idleThresholdMs: 600_000, activeWithinMs: 600_000 },
  sampled: true,
  folded: 71,
}

const contextBandScene = projectAgentTimeline(contextBandModel)

const CASES: ReadonlyArray<SpanCase> = [
  spanCase(
    '1h',
    '0e93336d-86be-594c-b346-89ee7e462ca5',
    'active-working',
    'Active · working',
    'Recent requests reach the open span end.',
  ),
  spanCase(
    '1h',
    '00859d2f-ce92-5600-8ab8-8160a58e0929',
    'idle-gap',
    'Idle interval',
    'A long gap has no descendant activity.',
  ),
  spanCase(
    '1h',
    '40ce328c-dc3d-5a83-b0ba-281183f169ff',
    'waiting',
    'Waiting on descendants',
    'A light hatch fills quiet gaps while descendants work.',
  ),
  spanCase(
    '1h',
    'ba6ac39b-4a33-57b3-a2c0-906f2efaf9c2',
    'terminal',
    'Span status',
    'The end mark distinguishes a recorded exit from inactive activity.',
  ),
  spanCase(
    '1d',
    'bf02d9e3-ab48-50f4-b451-0a5d06148393',
    'failed',
    'Failed',
    'The final request stopped with an error.',
  ),
  spanCase(
    '1d',
    'e04da891-d4ce-5e1b-bf46-944b932e0486',
    'compaction',
    'Compaction',
    'A synthetic histogram drop carries a before → after marker.',
  ),
  spanCase(
    '1d',
    'd6e1e2eb-8abe-5d63-a705-10a94609ee4d',
    'prompts',
    'Root prompts',
    'Filled and hollow prompt markers share a root span.',
  ),
  spanCase(
    '7d',
    '081b835a-e4d6-51da-b67b-8f21892128cb',
    'nested',
    'Nested child',
    'A depth-two session uses the same span marks.',
  ),
  {
    id: 'context-bands',
    label: 'Folded context bands',
    caption:
      'Hatched bands span 107k–263k before the compaction and 41k–118k after it on a 1M window; the dotted band has estimated or unknown-capacity requests, and an unknown-capacity segment draws nothing.',
    scene: contextBandScene,
    lane: contextBandScene.lanes[0]!,
  },
]

const viewportFor = (entry: SpanCase): { readonly start: number; readonly end: number } => {
  const { scene, lane } = entry
  const end = laneEnd(lane, scene)
  const start = Math.max(scene.model.windowStart, lane.session.startedAt)
  const duration = Math.max(MINUTE, Math.min(scene.model.windowEnd, end) - start)
  const padding = Math.max(MINUTE, duration * 0.08)
  return {
    start: Math.max(scene.model.windowStart, start - padding),
    end: Math.min(scene.model.windowEnd, end + padding),
  }
}

const SpanPreview = ({
  entry,
  width = SPAN_WIDTH,
}: {
  readonly entry: SpanCase
  readonly width?: number
}) => {
  const theme = useTheme()
  const viewport = React.useMemo(() => viewportFor(entry), [entry])
  const { scene, lane } = entry
  const x = React.useCallback(
    (ts: number) => ((ts - viewport.start) / Math.max(1, viewport.end - viewport.start)) * width,
    [viewport.end, viewport.start, width],
  )
  const timeAtX = React.useCallback(
    (offsetX: number, plotWidth: number) =>
      viewport.start + (offsetX / Math.max(1, plotWidth)) * (viewport.end - viewport.start),
    [viewport.end, viewport.start],
  )
  const segments = React.useMemo(() => laneActivity(lane), [lane])
  const hue = spanHue(lane, scene, theme)
  const spanHover = useSpanHover({ lane, timeAtX })

  return (
    <div
      data-span-case={entry.id}
      onPointerMove={spanHover.onPointerMove}
      onPointerLeave={spanHover.onPointerLeave}
      {...stylex.props(styles.preview, styles.previewWidth(width))}
    >
      <svg
        width={width}
        height={SPAN_HEIGHT}
        viewBox={`0 0 ${width} ${SPAN_HEIGHT}`}
        preserveAspectRatio="none"
        aria-label={entry.label}
        role="img"
        {...stylex.props(styles.svg)}
      >
        <Span
          lane={lane}
          scene={scene}
          x={x}
          width={width}
          height={SPAN_HEIGHT}
          hue={hue}
          segments={segments}
          cursorTs={spanHover.cursorTs}
        />
      </svg>
      <SpanHover scene={scene} lane={lane} hue={hue} segments={segments} hover={spanHover.hover} />
    </div>
  )
}

const widthEntry = CASES.find((entry) => entry.id === 'prompts')!
const widthViewport = viewportFor(widthEntry)
const defaultX = (ts: number): number =>
  ((ts - widthViewport.start) / Math.max(1, widthViewport.end - widthViewport.start)) * SPAN_WIDTH

const meta = {
  title: 'Vista/Blocks/Agents/Agent Timeline/Span',
  component: Span,
  args: {
    lane: widthEntry.lane,
    scene: widthEntry.scene,
    x: defaultX,
    width: SPAN_WIDTH,
    height: SPAN_HEIGHT,
    hue: spanHue(widthEntry.lane, widthEntry.scene, 'dark'),
    segments: laneActivity(widthEntry.lane),
  },
  argTypes: {
    lane: { control: false },
    scene: { control: false },
    x: { control: false },
    hue: { control: false },
    segments: { control: false },
    marks: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Span>

export default meta
type Story = StoryObj<typeof meta>

/** Compare representative lane states with their timeline marks and labels. */
export const AllStates: Story = {
  render: () => (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.caseList)}>
        {CASES.map((entry) => (
          <article key={entry.id} {...stylex.props(styles.case)}>
            <header {...stylex.props(styles.caseHeader)}>
              <div>
                <h2 {...stylex.props(styles.caseTitle)}>{entry.label}</h2>
                <p {...stylex.props(styles.caseDescription)}>{entry.caption}</p>
              </div>
              <span {...stylex.props(styles.caseMeta)}>
                {entry.scene.model.horizon} · {sessionLabel(entry.lane.session).primary}
              </span>
            </header>
            <SpanPreview entry={entry} />
          </article>
        ))}
      </section>
    </main>
  ),
}

/** Check span content and mark legibility across constrained widths. */
export const Widths: Story = {
  render: () => (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.widthList)}>
        {WIDTHS.map((width) => (
          <article key={width} {...stylex.props(styles.widthCase)}>
            <strong>{width} px</strong>
            <SpanPreview entry={widthEntry} width={width} />
          </article>
        ))}
      </section>
    </main>
  ),
}

const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space3,
    minWidth: 0,
    minHeight: '100vh',
    padding: scale.space3,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontSans,
  },
  caseList: { display: 'flex', flexDirection: 'column', gap: scale.space2, minWidth: 0 },
  case: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
    minWidth: 0,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
  },
  caseHeader: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: scale.space4,
  },
  caseTitle: { margin: 0, fontSize: '0.75rem', fontWeight: 600 },
  caseDescription: { margin: 0, color: tokens['--ds-gray-800'], fontSize: '0.66rem' },
  caseMeta: { color: tokens['--ds-gray-700'], fontSize: '0.62rem', whiteSpace: 'nowrap' },
  preview: { position: 'relative', height: SPAN_HEIGHT, minWidth: 0, maxWidth: '100%' },
  previewWidth: (width: number) => ({ width }),
  svg: { display: 'block', maxWidth: '100%', overflow: 'visible' },
  widthList: { display: 'flex', flexDirection: 'column', gap: scale.space2 },
  widthCase: {
    display: 'grid',
    gridTemplateColumns: '5rem minmax(0, 1fr)',
    alignItems: 'center',
    gap: scale.space3,
    minHeight: 48,
    padding: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    fontSize: '0.7rem',
  },
})
