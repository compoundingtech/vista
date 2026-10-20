import type { Meta, StoryObj } from '@storybook/react'

import { InterfacesTable } from '../blocks/content.tsx'
import { interfaceRows } from './_fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Content/Interfaces Table',
  component: InterfacesTable,
  args: { id: 'interfaces', rows: interfaceRows },
} satisfies Meta<typeof InterfacesTable>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Renders the interfaces table with its default row set, serving as the baseline for observing
 * column and width behavior.
 */
export const Default: Story = {}

/**
 * Exercises the zero-rows case so the table can be checked for an intentional empty state instead
 * of a bare shell.
 */
export const Empty: Story = {
  args: { id: 'it-empty-args', rows: [] },
}

/** Narrow layout: the table must scroll or stack rather than clip a column. */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: '20rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <InterfacesTable id="it-narrow" rows={interfaceRows} />
    </div>
  ),
}

/**
 * Stacks a comfortable full-interface rendering above a dense single-row rendering so every
 * density variant is visible in one story.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Comfortable — full interface set</strong>
        <InterfacesTable id="it-full" rows={interfaceRows} />
      </div>
      <div>
        <strong>Dense — single interface</strong>
        <InterfacesTable id="it-single" rows={interfaceRows.slice(0, 1)} />
      </div>
      <div>
        <strong>Empty</strong>
        <InterfacesTable id="it-empty" rows={[]} />
      </div>
    </div>
  ),
}
