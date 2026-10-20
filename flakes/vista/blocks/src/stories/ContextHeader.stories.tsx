import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'

import { ContextHeader } from '../blocks/kit/ContextHeader.tsx'

/** The page opening: what, why now, the reader's ask, then at most one verdict. */
const meta = {
  title: 'Vista/Blocks/Kit/ContextHeader',
  component: ContextHeader,
  args: {
    what: "Measured causes of Fractal's slowness.",
    why: 'A reported 55 s web load.',
    you: 'Pick which fix lands first.',
  },
} satisfies Meta<typeof ContextHeader>

export default meta

type Story = StoryObj<typeof meta>

/** An ask: the You row carries the you tone. */
export const Default: Story = {}

/** Informational page: omitting `you` says so instead of leaving a blank row. */
export const NoAction: Story = {
  args: { you: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No action needed')).toBeVisible()
  },
}

/** The bottom line under the context (replaces a separate Verdict block). */
export const WithVerdict: Story = {
  args: {
    you: undefined,
    verdict: 'Biggest gap: session inventory. Surest win: the relay.',
  },
}
