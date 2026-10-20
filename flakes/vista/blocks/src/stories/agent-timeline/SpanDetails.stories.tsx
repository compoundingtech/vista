import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'

import { SpanDetails, type SpanDetailsTab } from '@overeng/agent-timeline/detail'
import { laneActivity, laneEnd, spanHue } from '@overeng/agent-timeline/encodings'
import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import { useTheme } from '../../theme.ts'
import { agentTimelineFixtures } from './fixtures.ts'

const scene = projectAgentTimeline(agentTimelineFixtures['1d'])
const lane =
  scene.lanes.find(
    (candidate) =>
      candidate.compactions.length > 0 &&
      candidate.agentTurns > 0 &&
      scene.forks.some((fork) => fork.parentSessionId === candidate.session.id),
  ) ?? scene.lanes[0]!
const cursorTs = Math.min(
  laneEnd(lane, scene),
  (lane.compactions.at(-1)?.ts ?? lane.session.startedAt) + 60_000,
)
const noop = (): void => undefined

const DetailsCase = ({
  tab,
  empty = false,
}: {
  readonly tab: SpanDetailsTab
  readonly empty?: boolean
}) => {
  const theme = useTheme()
  return (
    <section {...stylex.props(styles.case)}>
      <h2 {...stylex.props(styles.caseTitle)}>{empty ? 'No span selected' : tab}</h2>
      <SpanDetails
        theme={theme}
        scene={scene}
        lane={empty ? null : lane}
        cursor={empty ? null : { ts: cursorTs, laneId: lane.session.id }}
        hue={empty ? null : spanHue(lane, scene, theme)}
        segments={empty ? [] : laneActivity(lane)}
        onSelectLane={noop}
        onSeek={noop}
        onZoomToLane={noop}
        onClose={noop}
        height="100%"
        initialTab={tab}
      />
    </section>
  )
}

const meta = {
  title: 'Vista/Blocks/Agents/Agent Timeline/Span Details',
  component: SpanDetails,
  args: {
    scene,
    lane,
    cursor: { ts: cursorTs, laneId: lane.session.id },
    hue: {
      base: tokens['--ds-blue-700'],
      muted: tokens['--ds-blue-500'],
      strong: tokens['--ds-blue-900'],
      text: tokens['--ds-foreground'],
    },
    segments: laneActivity(lane),
    onSelectLane: noop,
    onSeek: noop,
    onZoomToLane: noop,
    onClose: noop,
    height: 460,
  },
  argTypes: {
    scene: { control: false },
    lane: { control: false },
    cursor: { control: false },
    hue: { control: false },
    segments: { control: false },
    onSelectLane: { control: false },
    onSeek: { control: false },
    onZoomToLane: { control: false },
    onClose: { control: false },
    initialTab: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SpanDetails>

export default meta
type Story = StoryObj<typeof meta>

/** Show every details tab and the empty-selection state together. */
export const AllStates: Story = {
  render: () => (
    <main {...stylex.props(styles.page)}>
      {(['overview', 'timeline', 'context', 'spend', 'children'] as const).map((tab) => (
        <DetailsCase key={tab} tab={tab} />
      ))}
      <DetailsCase tab="overview" empty />
    </main>
  ),
}

const styles = stylex.create({
  page: {
    width: '100vw',
    minWidth: 0,
    margin: 0,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
  },
  case: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  caseTitle: {
    position: 'absolute',
    zIndex: 2,
    right: scale.space2,
    bottom: scale.space2,
    margin: 0,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-800'],
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    pointerEvents: 'none',
    textTransform: 'uppercase',
  },
})
