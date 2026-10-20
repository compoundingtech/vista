import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { InspectRow } from '../blocks/kit/InspectRow.tsx'

/** Closed rows that open their detail in place; consecutive rows stack into one ruled list. */
const meta = {
  title: 'Vista/Blocks/Kit/InspectRow',
  component: InspectRow,
  args: { title: 'Relay timing', meta: '3 raw records', icon: 'network', children: null },
  render: () => (
    <div>
      <InspectRow title="Relay timing" meta="3 raw records" icon="network">
        Fresh page open through the SSH relay: 3.89 s median over n=3; direct Devnet path: 93 ms.
      </InspectRow>
      <InspectRow title="Filter keystrokes" meta="10 samples" icon="keyboard">
        p50 29.5 ms per keystroke after warm cache.
      </InspectRow>
      <InspectRow title="Host admission" icon="cpu">
        Admission queue grows under load; not yet quantified.
      </InspectRow>
    </div>
  ),
} satisfies Meta<typeof InspectRow>

export default meta

type Story = StoryObj<typeof meta>

/** All closed: the page shows titles and counts only. */
export const Default: Story = {}

/** One row opened in place. */
export const Opened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Relay timing/ }))
    await expect(canvas.getByText(/3.89 s median/)).toBeVisible()
  },
}
