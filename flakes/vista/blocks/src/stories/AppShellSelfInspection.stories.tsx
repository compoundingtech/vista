import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { AppShell } from '../AppShell.tsx'
import { AppRoot, Section } from '../authoring.tsx'
import { fullCapture } from './_app-source-fixtures.ts'

const Document = () => (
  <AppRoot title="Toggle host document" template="architecture-review" scope="Shell prepend reveal">
    <Section id="context" label="Context">
      <p>The inspector prepends above this document when the header toggle is on.</p>
    </Section>
  </AppRoot>
)

const meta = {
  title: 'Vista/Blocks/Self Inspection',
  component: AppShell,
  args: {
    title: 'Toggle host document',
    children: <Document />,
    selfSource: fullCapture,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

type Story = StoryObj<typeof meta>

/** The toggle is present once the payload resolves; off by default. */
export const ToggleOffByDefault: Story = {}

/**
 * Pointer interaction: the toggle prepends the inspector, and closes it again.
 *
 * The shell suspends on its lazy header chunks, so the first lookup waits for
 * commit (findBy) instead of asserting against the Suspense fallback (getBy).
 */
export const TogglePrependsInspector: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = await canvas.findByRole('button', { name: 'Inspect source' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByLabelText('Source of demo v3')).toBeNull()

    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(await canvas.findByLabelText('Source of demo v3')).toBeVisible()

    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByLabelText('Source of demo v3')).toBeNull()
  },
}

/** Keyboard reach: the toggle operates from focus alone. */
export const KeyboardToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = await canvas.findByRole('button', { name: 'Inspect source' })
    toggle.focus()
    await expect(toggle).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(await canvas.findByLabelText('Source of demo v3')).toBeVisible()
  },
}

/** No payload, no toggle: old versions without the artifact show nothing. */
export const WithoutPayload: Story = {
  args: { selfSource: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Wait for the shell to commit before asserting absence.
    await canvas.findByText(
      'The inspector prepends above this document when the header toggle is on.',
    )
    await expect(canvas.queryByRole('button', { name: 'Inspect source' })).toBeNull()
  },
}
