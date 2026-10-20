import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { AppRoot } from '../authoring.tsx'
import { ChoiceCards } from '../blocks/kit/ChoiceCards.tsx'

const inAppRoot: Decorator = (Story) => (
  <AppRoot title="ChoiceCards" template="options-comparison" scope="Story">
    <Story />
  </AppRoot>
)

/**
 * A registered ask answered with real controls. The recommended option carries a quiet mark
 * that must never read as selected; nothing is selected until the reader picks.
 */
const meta = {
  title: 'Vista/Blocks/Kit/ChoiceCards',
  component: ChoiceCards,
  decorators: [inAppRoot],
  args: {
    id: 'relay-fix',
    label: 'Which fix lands first?',
    options: [
      {
        id: 'direct',
        label: 'Direct Devnet path',
        cost: 'Low · one config flag',
        next: 'Fresh page opens drop by ~3.8 s',
        recommended: true,
      },
      {
        id: 'inventory',
        label: 'Trace session inventory',
        cost: 'Medium · ½ day',
        next: 'Proves or rules out the 8.2 s gap',
      },
      {
        id: 'wait',
        label: 'Wait for host-pressure work',
        cost: 'None now',
        risk: 'Slowness stays until another team ships',
      },
    ],
  },
} satisfies Meta<typeof ChoiceCards>

export default meta

type Story = StoryObj<typeof meta>

/** Single choice: radio cards and one Copy answer action. */
export const Single: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Trace session inventory'))
    await expect(canvas.getByRole('radio', { name: /Trace session inventory/ })).toBeChecked()
  },
}

/** Pick list: checkbox cards plus a sticky dock with a copyable pick string. */
export const Multiple: Story = {
  args: {
    id: 'kit',
    label: 'Which components ship in this wave?',
    multiple: true,
    options: [
      { id: 'H2', label: 'Context header', recommended: true },
      { id: 'C1', label: 'Choice cards', recommended: true },
      { id: 'F1', label: 'Inspect row' },
      { id: 'K3', label: 'Tone marks', recommended: true },
      { id: 'S2', label: 'Time track', cost: 'Log axis option' },
      { id: 'R1', label: 'Ask rail' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Context header'))
    await userEvent.click(canvas.getByText('Inspect row'))
    await expect(canvas.getByDisplayValue('kit=H2,F1')).toBeVisible()
  },
}
