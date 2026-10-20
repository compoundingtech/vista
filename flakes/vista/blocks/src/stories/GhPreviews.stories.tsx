import type { Meta, StoryObj } from '@storybook/react'

import { GhPreviews } from '../blocks/GhPreviews.tsx'
import { fixedFeed } from '../data-feed.ts'
import { ghPreview } from './_fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Code/GitHub Previews',
  component: GhPreviews,
  args: {
    id: 'gh-default',
    dataFeed: fixedFeed(ghPreview),
    caption: 'PR preview composed from a direct frozen data source',
  },
} satisfies Meta<typeof GhPreviews>

export default meta
type Story = StoryObj<typeof meta>

/** Renders the pull-request preview through its default live feed, the block's primary use case. */
export const PullRequest: Story = {}
/**
 * Wires a live feed whose fetch promise never settles, pinning the preview in its loading state
 * indefinitely.
 */
export const Loading: Story = {
  args: {
    id: 'gh-loading',
    dataFeed: { mode: 'live', fetch: () => Promise.withResolvers<never>().promise },
  },
}
/**
 * Wires a live feed that resolves to an error result (GitHub 503) to verify the preview surfaces
 * the failure message instead of crashing.
 */
export const Failed: Story = {
  args: {
    id: 'gh-failed',
    dataFeed: { mode: 'live', fetch: async () => ({ _tag: 'error', message: 'GitHub 503' }) },
  },
}
