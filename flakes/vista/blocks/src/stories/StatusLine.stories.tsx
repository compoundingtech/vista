import type { Meta, StoryObj } from '@storybook/react'

import { StatusLine } from '../blocks/doctrine.tsx'

const meta = {
  title: 'Vista/Blocks/Doctrine/Status Line',
  component: StatusLine,
  args: { locked: 5, open: 3, awaiting: 2 },
} satisfies Meta<typeof StatusLine>

export default meta

type Story = StoryObj<typeof meta>

/** Renders the status summary with default arguments to establish the baseline appearance. */
export const Default: Story = {}

/** Sets all counters to zero (displayed as "Empty") to verify the zero-count presentation. */
export const AllZero: Story = {
  name: 'Empty',
  args: { locked: 0, open: 0, awaiting: 0 },
}

/**
 * Stacks zero, mixed, and single-class count combinations so the summary renders correctly across
 * all states.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <StatusLine locked={0} open={0} awaiting={0} />
      <StatusLine locked={5} open={3} awaiting={2} />
      <StatusLine locked={12} open={0} awaiting={1} />
    </div>
  ),
}
