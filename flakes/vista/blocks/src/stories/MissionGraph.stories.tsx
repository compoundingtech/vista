import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { MissionGraph } from '../blocks/kit/MissionGraph.tsx'
import { sidenoteOverlay, sidenoteSteps } from './_mission-fixtures.tsx'

/** A mission as lanes × ranks: steps plus gates; selecting a node reveals its details. */
const meta = {
  title: 'Vista/Blocks/Kit/MissionGraph',
  component: MissionGraph,
  args: { steps: sidenoteSteps },
} satisfies Meta<typeof MissionGraph>

export default meta

type Story = StoryObj<typeof meta>

/** Declared steps with the review overlay: lane names and the gates the runner cannot enforce. */
export const Default: Story = { args: { overlay: sidenoteOverlay } }

/** Declared steps alone: lanes come from `assignedTo`, labels from the step. */
export const StepsOnly: Story = {}

/** Selecting a step opens its details below the graph; selecting it again closes them. */
export const Selected: Story = {
  args: { overlay: sidenoteOverlay },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const step = await canvas.findByRole('button', { name: 'Step 3: Real speech' })
    await userEvent.click(step)
    const details = await canvas.findByRole('region', { name: 'Selected node' })
    await expect(within(details).getByText('Real speech')).toBeVisible()
    await expect(within(details).getByText(/owned originals/)).toBeVisible()
    await expect(step).toHaveAttribute('aria-pressed', 'true')
  },
}

/** Narrow containers stack lanes top to bottom instead of shrinking the graph. */
export const Narrow: Story = {
  args: { overlay: sidenoteOverlay },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
}
