import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { SourceInspector } from '../blocks/SourceInspector.tsx'
import { draftCapture, emptyCapture, fullCapture, largeCapture } from './_app-source-fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Code/Source Inspector',
  component: SourceInspector,
  args: {
    id: 'source-inspector',
    source: fullCapture,
    caption: 'Read-only self-inspection surface — frozen at publish, no fetching.',
  },
} satisfies Meta<typeof SourceInspector>

export default meta

type Story = StoryObj<typeof meta>

/** The populated inspector: rail, code pane, and all four details tabs. */
export const Default: Story = {}

/** A file selected up front — the rail and the code pane open on it. */
export const PreselectedFile: Story = {
  args: { id: 'source-inspector-preselected', initialSelectedPath: 'trail.json' },
}

/** Hand-authored draft: files only, so only the File tab exists. */
export const DraftWithoutPublishSections: Story = {
  args: {
    id: 'source-inspector-draft',
    source: draftCapture,
    caption: 'no semantics, receipt, or trail — the File tab stands alone',
  },
}

/** 48 files: the rail scrolls and the pane stays virtualized. */
export const ManyFiles: Story = {
  args: {
    id: 'source-inspector-large',
    source: largeCapture,
    viewportHeight: '42rem',
    caption: '48 captured files',
  },
}

/** A capture that holds nothing — bounded empty state, chrome intact. */
export const NoFiles: Story = {
  args: {
    id: 'source-inspector-empty',
    source: emptyCapture,
    caption: 'no files — the inspector chrome still stands on its own',
  },
}

/** Narrow container: the rail stacks above the code pane (container query). */
export const Narrow: Story = {
  args: { id: 'source-inspector-narrow', viewportHeight: '30rem' },
  decorators: [
    (Story) => (
      <div style={{ width: '34rem', maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
}

/** Pointer interaction: the details tabs are a real multi-state control. */
export const SwitchDetailsTab: Story = {
  args: { id: 'source-inspector-tabs' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Text queries scope to the details aside: the code pane renders the
    // same fixture strings (trail commands, node ids) as file contents.
    const details = () => within(canvas.getByLabelText('Capture details'))
    const trail = canvas.getByRole('tab', { name: 'Trail' })
    await userEvent.click(trail)
    await expect(trail).toHaveAttribute('aria-selected', 'true')
    await expect(details().getByText('vista publish demo')).toBeVisible()

    const semantics = canvas.getByRole('tab', { name: 'Semantics' })
    await userEvent.click(semantics)
    await expect(semantics).toHaveAttribute('aria-selected', 'true')
    await expect(details().getByText('frozen-capture')).toBeVisible()
  },
}

/** The details tabs must be reachable and operable from the keyboard alone. */
export const KeyboardDetailsTab: Story = {
  args: { id: 'source-inspector-keyboard' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const file = canvas.getByRole('tab', { name: 'File' })
    file.focus()
    await expect(file).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    const receipt = canvas.getByRole('tab', { name: 'Receipt' })
    await expect(receipt).toHaveFocus()
    await expect(receipt).toHaveAttribute('aria-selected', 'true')
    await expect(
      within(canvas.getByLabelText('Capture details')).getByText('/r/vista.tests/demo/v3/'),
    ).toBeVisible()
  },
}
