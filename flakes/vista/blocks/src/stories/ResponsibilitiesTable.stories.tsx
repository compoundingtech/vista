import type { Meta, StoryObj } from '@storybook/react'

import { ResponsibilitiesTable } from '../blocks/content.tsx'
import { responsibilityRows } from './_fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Content/Responsibilities Table',
  component: ResponsibilitiesTable,
  args: { id: 'responsibilities', rows: responsibilityRows },
} satisfies Meta<typeof ResponsibilitiesTable>

export default meta

type Story = StoryObj<typeof meta>

/** Story rendering the responsibilities table with its default sample rows. */
export const Default: Story = {}

/** Story passing zero rows to exercise the table's empty state. */
export const Empty: Story = {
  args: { rows: [] },
}

/** Narrow layout: notes wrap under their row instead of forcing a horizontal scroll. */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: '20rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <ResponsibilitiesTable id="rt-narrow" rows={responsibilityRows} />
    </div>
  ),
}

/**
 * Story stacking multiple table configurations — the full row set with notes, a dense single-owner
 * variant, and others — for side-by-side comparison.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Comfortable — full set (some rows carry notes)</strong>
        <ResponsibilitiesTable id="rt-full" rows={responsibilityRows} />
      </div>
      <div>
        <strong>Dense — single owner</strong>
        <ResponsibilitiesTable id="rt-single" rows={responsibilityRows.slice(0, 1)} />
      </div>
      <div>
        <strong>Empty</strong>
        <ResponsibilitiesTable id="rt-empty" rows={[]} />
      </div>
    </div>
  ),
}
