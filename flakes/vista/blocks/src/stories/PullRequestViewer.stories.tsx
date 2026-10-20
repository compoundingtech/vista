import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { PullRequestViewer } from '../blocks/PullRequestViewer.tsx'
import {
  brokenPullRequest,
  contentPairPullRequest,
  emptyPullRequest,
  largePullRequest,
  partiallyBrokenPullRequest,
  pullRequest,
} from './_pull-request-fixtures.ts'

const meta = {
  title: 'Vista/Blocks/Code/Pull Request Viewer',
  component: PullRequestViewer,
  args: {
    id: 'pr-viewer',
    pullRequest,
    caption: 'Read-only review surface — no comments, no fetching, no edit mode.',
  },
} satisfies Meta<typeof PullRequestViewer>

export default meta

type Story = StoryObj<typeof meta>

/** The populated review surface: mixed statuses, rail, and unified diffs. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const review = canvas.getByRole('region', { name: 'Pull request #482' })

    await expect(getComputedStyle(review).display).toBe('flex')
    await expect(Number.parseFloat(getComputedStyle(review).rowGap)).toBeGreaterThan(0)
  },
}

/** Story configuring the pull request viewer to open in split diff view. */
export const Split: Story = { args: { id: 'pr-viewer-split', view: 'split' } }

/** Char-level inline granularity, for reviews of dense single-line edits. */
export const CharLevel: Story = {
  args: { id: 'pr-viewer-char', wordLevel: 'char' },
}

/** A file selected up front — the rail and the code pane open on it. */
export const PreselectedFile: Story = {
  args: { id: 'pr-viewer-preselected', initialSelectedPath: 'src/projection/tmux.ts' },
}

/**
 * Authored from full old/new contents instead of a patch: the only shape where
 * @pierre carries whole-file context rather than just the hunks.
 */
export const FromFileContents: Story = {
  args: {
    id: 'pr-viewer-contents',
    pullRequest: contentPairPullRequest,
    view: 'split',
    caption: 'old/new contents → non-partial diff metadata',
  },
}

/** 48 files: the rail scrolls, headers stick, and the pane stays virtualized. */
export const LargeChangeset: Story = {
  args: {
    id: 'pr-viewer-large',
    pullRequest: largePullRequest,
    viewportHeight: '42rem',
    caption: '48 changed files',
  },
}

/** A pull request that changes nothing — bounded empty state, chrome intact. */
export const NoChangedFiles: Story = {
  args: {
    id: 'pr-viewer-empty',
    pullRequest: emptyPullRequest,
    caption: 'no changed files — the review chrome still stands on its own',
  },
}

/** Some files unrenderable: the failures are listed, the rest still review. */
export const PartiallyUnrenderable: Story = {
  args: {
    id: 'pr-viewer-partial-error',
    pullRequest: partiallyBrokenPullRequest,
    caption: 'binary + corrupt patches are reported, the good file still renders',
  },
}

/** A binary captured first must not become the default selected diff. */
export const BinaryFirst: Story = {
  args: {
    id: 'pr-viewer-binary-first',
    pullRequest: {
      ...partiallyBrokenPullRequest,
      files: [partiallyBrokenPullRequest.files[1]!, partiallyBrokenPullRequest.files[0]!],
    },
  },
}

/** Nothing renderable: the whole-viewer error state, still bounded. */
export const Unrenderable: Story = {
  args: {
    id: 'pr-viewer-error',
    pullRequest: brokenPullRequest,
    caption:
      'every captured file is unusable — the viewer says so instead of showing an empty pane',
  },
}

/** Narrow container: the rail stacks above the code pane (container query). */
export const Narrow: Story = {
  args: { id: 'pr-viewer-narrow', viewportHeight: '30rem' },
  decorators: [
    (Story) => (
      <div style={{ width: '34rem', maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
}

/** At the minimum review height, both the treemap and the primary diff stay usable. */
export const ConstrainedDefaultHeight: Story = {
  args: { id: 'pr-viewer-constrained-height', viewportHeight: '16rem' },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const treemap = canvasElement.querySelector(
        '#pr-viewer-constrained-height-treemap-review-first-pane',
      )
      const diff = canvasElement.querySelector(
        '#pr-viewer-constrained-height-treemap-review-second-pane',
      )
      expect(treemap).not.toBeNull()
      expect(diff).not.toBeNull()
      expect(treemap!.getBoundingClientRect().height).toBeGreaterThanOrEqual(120)
      expect(diff!.getBoundingClientRect().height).toBeGreaterThanOrEqual(120)
    })
  },
}

/** A long body must scroll inside its own bounded region, never push the diff. */
export const LongBody: Story = {
  args: {
    id: 'pr-viewer-long-body',
    pullRequest: {
      ...pullRequest,
      body: Array.from(
        { length: 24 },
        (_unused, index) => `Line ${index + 1} of a very long pull-request description.`,
      ).join('\n'),
    },
  },
}

/** Pointer interaction: the layout toggle is a real two-state control. */
export const ToggleLayout: Story = {
  args: { id: 'pr-viewer-toggle' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const unified = canvas.getByRole('button', { name: 'Unified' })
    const split = canvas.getByRole('button', { name: 'Split' })
    await expect(unified).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(split)
    await expect(split).toHaveAttribute('aria-pressed', 'true')
    await expect(unified).toHaveAttribute('aria-pressed', 'false')
  },
}

/** The same toggle must be reachable and operable from the keyboard alone. */
export const KeyboardLayoutToggle: Story = {
  args: { id: 'pr-viewer-keyboard' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const split = canvas.getByRole('button', { name: 'Split' })
    split.focus()
    await expect(split).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await expect(split).toHaveAttribute('aria-pressed', 'true')
  },
}

/** The failure list names every unrenderable file and why it could not render. */
export const UnrenderableReported: Story = {
  args: { id: 'pr-viewer-error-play', pullRequest: partiallyBrokenPullRequest },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const failures = canvas.getByRole('list', { name: 'Files that could not be rendered' })
    await expect(within(failures).getByText('assets/provider-snapshot.bin')).toBeVisible()
    await expect(within(failures).getByText('src/corrupt.ts')).toBeVisible()
    await expect(within(failures).getByText('no patch or file contents supplied')).toBeVisible()
  },
}
