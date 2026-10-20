import type { Meta, StoryObj } from '@storybook/react'

import { OptionsGrid } from '../blocks/content.tsx'
import { optionCards } from './_fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Content/Options Grid',
  component: OptionsGrid,
  args: { id: 'options-grid', options: optionCards },
} satisfies Meta<typeof OptionsGrid>

export default meta

type Story = StoryObj<typeof meta>

/** Renders the full option set with its recommended card to document the grid's standard appearance. */
export const Default: Story = {}

/**
 * Passes an empty options array so the grid's empty state can be verified rather than showing a
 * blank container.
 */
export const Empty: Story = {
  args: { options: [] },
}

/** Narrow layout: the grid must collapse to one column, not squeeze three. */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: '20rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <OptionsGrid id="og-narrow" options={optionCards} />
    </div>
  ),
}

/**
 * Stacks a comfortable full-option grid above a dense single-option one so all supported grid
 * states are visible in one story.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Comfortable — full option set (one recommended)</strong>
        <OptionsGrid id="og-full" options={optionCards} />
      </div>
      <div>
        <strong>Dense — single recommended option</strong>
        <OptionsGrid id="og-single" options={optionCards.slice(0, 1)} />
      </div>
      <div>
        <strong>Empty</strong>
        <OptionsGrid id="og-empty" options={[]} />
      </div>
    </div>
  ),
}
