import type { Meta, StoryObj } from '@storybook/react'

import { TimeTrack } from '../blocks/kit/TimeTrack.tsx'

/** Durations on one shared axis; the slowest row carries the risk tone. */
const meta = {
  title: 'Vista/Blocks/Kit/TimeTrack',
  component: TimeTrack,
  args: {
    rows: [
      { label: 'Through SSH relay', ms: 3889.781 },
      { label: 'Direct Devnet path', ms: 93.113 },
    ],
  },
} satisfies Meta<typeof TimeTrack>

export default meta

type Story = StoryObj<typeof meta>

/** Linear: bar lengths compare directly. */
export const Linear: Story = {}

/** Log axis for spreads of 100× or more, with decade ticks. */
export const Log: Story = {
  args: {
    rows: [
      { label: 'Session inventory read', ms: 8192.084 },
      { label: 'Fresh page open (relay)', ms: 3796.668 },
      { label: 'Filter keystroke', ms: 29.5 },
    ],
  },
}
