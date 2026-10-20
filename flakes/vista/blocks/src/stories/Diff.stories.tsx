import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Callout } from '../blocks/content.tsx'
import { Diff } from '../blocks/Diff.tsx'
import { AppVersionPreferenceProvider } from '../blocks/ResizableSplit.tsx'
import { longPatch, renameOnlyPatch, subtlePatch } from './_coverage-fixtures.ts'
import { newFile, oldFile, samplePatch } from './_fixtures.ts'

const virtualizedPatch = [
  '--- a/src/virtualized.ts',
  '+++ b/src/virtualized.ts',
  '@@ -1,600 +1,600 @@',
  ...Array.from({ length: 600 }, (_, index) => `-const before${index} = ${index}`),
  ...Array.from({ length: 600 }, (_, index) => `+const after${index} = ${index + 1}`),
].join('\n')

/**
 * The diff block. Review axes: source form (patch vs old/new file pair), layout
 * (unified/split — a real in-block two-state control), inline granularity
 * (`wordLevel`), collapse, and content size.
 */
const meta = {
  title: 'Vista/Blocks/Code/Diff',
  component: Diff,
  args: {
    id: 'diff-default',
    source: { _tag: 'patch', patch: samplePatch },
    caption: 'src/supervisor.ts — reap the provider group on exit',
  },
  argTypes: {
    view: { control: 'inline-radio', options: ['unified', 'split'] },
    wordLevel: { control: 'inline-radio', options: ['word', 'char', 'none'] },
    collapsed: { control: 'boolean' },
    caption: { control: 'text' },
    id: { control: false },
    source: { control: false },
  },
  decorators: [
    (Story) => (
      <AppVersionPreferenceProvider
        identity={{ owner: 'vista.tests', slug: 'diff-stories', version: 'v1' }}
      >
        <Story />
      </AppVersionPreferenceProvider>
    ),
  ],
} satisfies Meta<typeof Diff>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Renders the diff from the default patch with default view settings, serving as the baseline
 * against which the other diff stories vary.
 */
export const Default: Story = {}

/**
 * Sets view to unified so old and new lines interleave in a single inline column, the classic
 * patch layout.
 */
export const Unified: Story = { args: { view: 'unified' } }

/** Sets view to split so the old and new sides render in adjacent panes for line-by-line comparison. */
export const Split: Story = { args: { id: 'diff-split', view: 'split' } }

/** Authored from an old/new file pair instead of a patch string. */
export const FromFiles: Story = {
  args: {
    id: 'diff-files',
    source: { _tag: 'files', path: 'src/kill.ts', oldContents: oldFile, newContents: newFile },
    view: 'split',
    caption: 'old/new file pair → unified patch → split view',
  },
}

/**
 * Enables char-level inline diffing so the exact changed characters within a line are highlighted
 * rather than marking whole lines.
 */
export const WordLevelChar: Story = {
  args: { id: 'diff-char', wordLevel: 'char', caption: 'char-level inline diff' },
}

/** One-token change: the case where word/char highlighting earns its keep. */
export const SubtleChange: Story = {
  args: {
    id: 'diff-subtle',
    source: { _tag: 'patch', patch: subtlePatch },
    wordLevel: 'word',
    caption: 'SIGTERM → SIGKILL, word-level',
  },
}

/** `collapsed`: unchanged context is folded into expandable regions instead of shown. */
export const Collapsed: Story = {
  args: { id: 'diff-collapsed', collapsed: true, caption: 'unchanged context collapsed' },
}

/** Six hunks: scroll behaviour, hunk headers, and sticky chrome under load. */
export const LongDiff: Story = {
  args: {
    id: 'diff-long',
    source: { _tag: 'patch', patch: longPatch },
    caption: 'src/runtime/scheduler.ts — six hunks',
  },
}

/** A header-only patch (rename, no hunks): the structurally empty diff. */
export const NoHunks: Story = {
  args: {
    id: 'diff-empty',
    source: { _tag: 'patch', patch: renameOnlyPatch },
    caption: 'rename only — no hunks to render',
  },
}

/** Narrow layout: split must degrade legibly in a ~24rem column. */
export const NarrowSplit: Story = {
  render: () => (
    <div style={{ width: '24rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <Diff
        id="diff-narrow"
        source={{ _tag: 'patch', patch: samplePatch }}
        view="split"
        caption="split view at 24rem"
      />
    </div>
  ),
}

/**
 * Theming acceptance gate (KR07): a diff next to a kit callout. The diff chrome
 * (background, gutter, add/del accents) must match the kit surface/border in BOTH
 * themes — toggle the Storybook theme global to verify adjacency continuity.
 */
export const ThemeAdjacency: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Callout
        id="adj-callout"
        kind="finding"
        title="Adjacent kit block"
        body="The diff below should share this surface/border with no seam in light and dark."
      />
      <Diff
        id="adj-diff"
        source={{ _tag: 'patch', patch: samplePatch }}
        caption="src/supervisor.ts"
      />
    </div>
  ),
}

/** Every review axis of the block on one page. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Unified</strong>
        <Diff id="all-unified" source={{ _tag: 'patch', patch: samplePatch }} view="unified" />
      </div>
      <div>
        <strong>Split</strong>
        <Diff id="all-split" source={{ _tag: 'patch', patch: samplePatch }} view="split" />
      </div>
      <div>
        <strong>Char-level</strong>
        <Diff id="all-char" source={{ _tag: 'patch', patch: subtlePatch }} wordLevel="char" />
      </div>
      <div>
        <strong>Collapsed</strong>
        <Diff id="all-collapsed" source={{ _tag: 'patch', patch: samplePatch }} collapsed />
      </div>
      <div>
        <strong>No hunks</strong>
        <Diff id="all-nohunks" source={{ _tag: 'patch', patch: renameOnlyPatch }} />
      </div>
    </div>
  ),
}

/** The layout toggle is a real two-state control, not a prop-only switch. */
export const ToggleView: Story = {
  args: { id: 'diff-toggle' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const unified = canvas.getByRole('button', { name: 'Unified' })
    const split = canvas.getByRole('button', { name: 'Split' })
    await expect(unified).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(split)
    await expect(split).toHaveAttribute('aria-pressed', 'true')
    await expect(unified).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(unified)
    await expect(unified).toHaveAttribute('aria-pressed', 'true')
  },
}

/**
 * Exercises bottom-edge height resizing on a long split-view diff, starting at min(32rem, 100vh -
 * 12rem) and clamped between 16rem and 100vh - 7rem.
 */
export const BottomEdgeHeightResize: Story = {
  args: {
    id: 'diff-bottom-edge',
    source: { _tag: 'patch', patch: longPatch },
    view: 'split',
    caption: 'src/kill.ts — bottom-line height resize',
    heightResize: {
      initialSize: 'min(32rem, calc(100vh - 12rem))',
      minSize: '16rem',
      maxSize: 'calc(100vh - 7rem)',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const separator = await canvas.findByRole('separator', { name: 'Resize first pane' })
    const diff = canvasElement.querySelector<HTMLElement>('#diff-bottom-edge')
    const split = canvasElement.querySelector<HTMLElement>('#diff-bottom-edge-height-resize')
    await expect(separator).toHaveAttribute('aria-orientation', 'horizontal')
    await expect(diff).toBeInTheDocument()
    await expect(split).toBeInTheDocument()

    const splitStyle = canvasElement.ownerDocument.defaultView!.getComputedStyle(split!)
    const diffStyle = canvasElement.ownerDocument.defaultView!.getComputedStyle(diff!)
    await expect(splitStyle.borderBottomWidth).toBe('0px')
    await expect(diffStyle.borderTopWidth).toBe('1px')
    await expect(diffStyle.borderBottomWidth).toBe('0px')

    const minValue = separator.getAttribute('aria-valuemin')
    const maxValue = separator.getAttribute('aria-valuemax')
    if (minValue === null || maxValue === null) throw new Error('splitter bounds must be exposed')
    separator.focus()
    await expect(separator).toHaveFocus()
    await userEvent.keyboard('{Home}')
    await waitFor(() => expect(separator).toHaveAttribute('aria-valuenow', minValue))
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(separator).toHaveAttribute('aria-valuenow', maxValue))
    await waitFor(() =>
      expect(
        Math.abs(diff!.getBoundingClientRect().bottom - separator.getBoundingClientRect().top),
      ).toBeLessThanOrEqual(1),
    )
  },
}

/**
 * Shows a short settled diff in its collapsed presentation with height resizable from 20rem to
 * 40rem, checking that the collapsed extent still fits the useful content.
 */
export const CollapsedUsefulExtent: Story = {
  args: {
    id: 'diff-collapsed-useful-extent',
    source: { _tag: 'patch', patch: subtlePatch },
    collapsed: true,
    caption: 'A short settled diff',
    heightResize: {
      initialSize: '32rem',
      minSize: '20rem',
      maxSize: '40rem',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const diff = canvasElement.querySelector<HTMLElement>('#diff-collapsed-useful-extent')
    if (diff === null) throw new Error('settled Diff must render')
    await waitFor(() => expect(diff).toHaveAttribute('data-vista-useful-extent'))
    await waitFor(() =>
      expect(
        canvas.queryByRole('separator', { name: 'Resize first pane' }),
      ).not.toBeInTheDocument(),
    )
  },
}

/**
 * Renders a large virtualized patch with height adjustable from 12rem to 60rem and includes a play
 * function that locates the block by DOM id to assert behavior during interaction tests.
 */
export const VirtualizedUsefulExtent: Story = {
  args: {
    id: 'diff-virtualized-useful-extent',
    source: { _tag: 'patch', patch: virtualizedPatch },
    heightResize: {
      initialSize: '28rem',
      minSize: '12rem',
      maxSize: '60rem',
    },
  },
  play: async ({ canvasElement }) => {
    const diff = canvasElement.querySelector<HTMLElement>('#diff-virtualized-useful-extent')
    if (diff === null) throw new Error('virtualized Diff must render')
    await waitFor(() => expect(diff).toHaveAttribute('data-vista-diff-logical-extent'))
    const logical = Number(diff.dataset.vistaDiffLogicalExtent)
    await expect(logical).toBeGreaterThan(diff.getBoundingClientRect().height)
  },
}
