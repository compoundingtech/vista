import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { Settled } from '../blocks/doctrine.tsx'
import { longSettledDecisions } from './_coverage-fixtures.ts'
import { settledDecisions } from './_fixtures.ts'

/**
 * The settled-decisions block: locked history, collapsed by default so it stays
 * audit context rather than foreground. Review axes: decision count (empty →
 * many), title/summary length, and the disclosure interaction itself.
 */
const meta = {
  title: 'Vista/Blocks/Doctrine/Settled',
  component: Settled,
  args: { id: 'settled', decisions: settledDecisions },
  argTypes: { id: { control: false }, decisions: { control: false } },
} satisfies Meta<typeof Settled>

export default meta

type Story = StoryObj<typeof meta>

/** Collapsed by default — click the toggle to expand the locked decisions. */
export const Default: Story = {}

/**
 * Renders the settled-decisions disclosure with an empty list to verify the collapsed toggle over
 * zero decisions.
 */
export const Empty: Story = {
  args: { id: 'settled-empty', decisions: [] },
}

/** Long titles and long summaries: the wrapping case inside the disclosure. */
export const LongContent: Story = {
  args: { id: 'settled-long', decisions: longSettledDecisions },
}

/** Narrow column: the toggle row and expanded list must not overflow. */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: '18rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <Settled id="settled-narrow" decisions={longSettledDecisions} />
    </div>
  ),
}

/**
 * Composes populated, long-content, and empty decision sets in a single column for a side-by-side
 * audit of the component's states.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <strong>With locked decisions (collapsed; toggle to expand)</strong>
        <Settled id="settled-all" decisions={settledDecisions} />
      </div>
      <div>
        <strong>Long titles and summaries</strong>
        <Settled id="settled-all-long" decisions={longSettledDecisions} />
      </div>
      <div>
        <strong>Empty</strong>
        <Settled id="settled-all-empty" decisions={[]} />
      </div>
    </div>
  ),
}

/** The disclosure is a real two-state control: the list exists only while expanded. */
export const ExpandCollapse: Story = {
  args: { id: 'settled-play' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', {
      name: `Settled (${String(settledDecisions.length)} locked)`,
    })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('list')).toBeNull()

    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(within(canvas.getByRole('list')).getAllByRole('listitem')).toHaveLength(
      settledDecisions.length,
    )

    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('list')).toBeNull()
  },
}
