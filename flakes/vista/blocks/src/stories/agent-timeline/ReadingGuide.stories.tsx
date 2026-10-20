import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { Button, DialogTrigger } from 'react-aria-components'
import { expect, within } from 'storybook/test'

import { spanMarks, type SpanMarkId } from '@overeng/agent-timeline/encodings'
import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import { ReadingGuide } from '../../blocks/agent-timeline/ReadingGuide.tsx'
import { agentTimelineFixtures } from './fixtures.ts'

const scene = projectAgentTimeline(agentTimelineFixtures['1d'])
const exampleLaneIds = scene.lanes.map((lane) => lane.session.id)
const allMarks: ReadonlySet<SpanMarkId> = new Set(spanMarks.map((mark) => mark.id))
const defaultMarks: ReadonlySet<SpanMarkId> = new Set(
  spanMarks
    .map((mark) => mark.id)
    .filter(
      (markId) => markId !== 'turn-tick' && markId !== 'cursor-line' && markId !== 'span-label',
    ),
)

const meta = {
  title: 'Vista/Blocks/Agents/Agent Timeline/Reading Guide',
  component: ReadingGuide,
  args: {
    scene,
    marks: defaultMarks,
    exampleLaneIds,
  },
  argTypes: {
    scene: { control: false },
    marks: { control: false },
    exampleLaneIds: { control: false },
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <main {...stylex.props(styles.canvas)}>
      <DialogTrigger defaultOpen>
        <Button {...stylex.props(styles.trigger)}>Open reading guide</Button>
        <ReadingGuide {...args} />
      </DialogTrigger>
    </main>
  ),
} satisfies Meta<typeof ReadingGuide>

export default meta
type Story = StoryObj<typeof meta>

/** The production reading order using the marks drawn by default. */
export const Default: Story = {}

/** Every registry mark, including inspection detail that is gated in the main trace. */
export const AllMarks: Story = {
  args: { marks: allMarks },
  play: async ({ canvasElement }) => {
    const documentBody = within(canvasElement.ownerDocument.body)
    const guide = await documentBody.findByRole('dialog', { name: 'Reading guide' })
    await expect(within(guide).getAllByTestId('trace-reading-guide-row')).toHaveLength(
      spanMarks.length,
    )
  },
}

const styles = stylex.create({
  canvas: {
    display: 'grid',
    width: '100vw',
    height: '100vh',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    placeItems: 'center',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontSans,
  },
  trigger: {
    minHeight: 32,
    paddingInline: scale.space3,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-200'],
    },
    color: tokens['--ds-foreground'],
    font: 'inherit',
    fontSize: '0.75rem',
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
})
