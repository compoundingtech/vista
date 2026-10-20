import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'

import { CompactSpend } from '@overeng/agent-timeline/compact'
import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import { useTheme } from '../../theme.ts'
import { agentTimelineFixtures } from './fixtures.ts'

const scene = projectAgentTimeline(agentTimelineFixtures['1d'])
const root = scene.lanes.find((lane) => lane.session.parentId === null)!
const leaf = scene.lanes.find(
  (lane) => !scene.forks.some((fork) => fork.parentSessionId === lane.session.id),
)!

const CompactCases = (): ReactNode => {
  const theme = useTheme()
  return (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.card)}>
        <h2 {...stylex.props(styles.heading)}>Root and descendants</h2>
        <CompactSpend scene={scene} lane={root} theme={theme} />
      </section>
      <section {...stylex.props(styles.card)}>
        <h2 {...stylex.props(styles.heading)}>Session without descendants</h2>
        <CompactSpend scene={scene} lane={leaf} theme={theme} />
      </section>
    </main>
  )
}

const meta = {
  title: 'Vista/Blocks/Agents/Agent Timeline/Compact Spend',
  component: CompactSpend,
  args: { scene, lane: root },
  argTypes: { scene: { control: false }, lane: { control: false } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CompactSpend>

export default meta
type Story = StoryObj<typeof meta>

/** Compare full-subtree spend and a leaf session at H2 width. */
export const AllStates: Story = { render: () => <CompactCases /> }

const styles = stylex.create({
  page: { display: 'flex', flexWrap: 'wrap', gap: scale.space4, padding: scale.space4 },
  card: {
    width: 320,
    padding: scale.space3,
    backgroundColor: tokens['--ds-background-200'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  heading: {
    marginBlock: '0 0.5rem',
    marginInline: 0,
    fontSize: '0.75rem',
    color: tokens['--ds-foreground'],
  },
})
