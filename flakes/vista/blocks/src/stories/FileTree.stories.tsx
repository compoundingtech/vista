import type { Meta, StoryObj } from '@storybook/react'

import { Callout } from '../blocks/content.tsx'
import { FileTree } from '../blocks/FileTree.tsx'
import {
  longPathFileTreeEntries,
  singleChainFileTreeEntries,
  wideFileTreeEntries,
} from './_coverage-fixtures.ts'
import { fileTreeEntries } from './_fixtures.ts'

/**
 * The changed-file tree. Review axes: entry count (empty → 48 paths), path
 * shape (flat, single-chain, very long), git-status marker vocabulary, and
 * container width. Expansion is owned by the embedded `@pierre/trees` web
 * component inside its shadow root — the block itself exposes no selection API,
 * so there is no `play` here (see the story notes).
 */
const meta = {
  title: 'Vista/Blocks/Code/File Tree',
  component: FileTree,
  args: {
    id: 'tree-default',
    entries: fileTreeEntries,
    caption: 'Changed files with git status',
  },
  argTypes: {
    flattenEmptyDirectories: { control: 'boolean' },
    caption: { control: 'text' },
    id: { control: false },
    entries: { control: false },
  },
} satisfies Meta<typeof FileTree>

export default meta

type Story = StoryObj<typeof meta>

/**
 * Renders the file tree with the stock nested entries and no options enabled, providing the
 * baseline hierarchy view.
 */
export const Default: Story = {}

/**
 * Enables flattenEmptyDirectories so chains of single-child directories collapse into combined
 * nodes, shortening deep paths.
 */
export const Flattened: Story = {
  args: {
    id: 'tree-flat',
    flattenEmptyDirectories: true,
    caption: 'flattenEmptyDirectories: collapses single-child dir chains',
  },
}

/** The flatten switch at its most visible: one path, five nested single-child dirs. */
export const SingleChain: Story = {
  args: {
    id: 'tree-chain',
    entries: singleChainFileTreeEntries,
    flattenEmptyDirectories: true,
    caption: 'a/b/c/d/e/only.ts — flattened to one row',
  },
}

/** Every `GitStatus` marker across 48 paths: the tree must virtualize and stay legible. */
export const ManyEntries: Story = {
  args: {
    id: 'tree-wide',
    entries: wideFileTreeEntries,
    caption: '48 changed paths across 8 packages, all status markers',
  },
}

/** Very long paths in a narrow column: truncation must not hide the file name. */
export const NarrowLongPaths: Story = {
  render: () => (
    <div style={{ width: '20rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <FileTree
        id="tree-narrow"
        entries={longPathFileTreeEntries}
        caption="deep repository paths at 20rem"
      />
    </div>
  ),
}

/**
 * Passes an empty entries list to confirm the tree renders its empty-state message rather than
 * nothing at all.
 */
export const Empty: Story = {
  args: { id: 'tree-empty', entries: [], caption: 'empty path list' },
}

/** Theming acceptance gate (KR07): tree chrome must match the kit in both themes. */
export const ThemeAdjacency: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Callout
        id="adj-tree-callout"
        kind="finding"
        title="Adjacent kit block"
        body="The tree below should share this surface with no seam in light and dark."
      />
      <FileTree id="adj-tree" entries={fileTreeEntries} />
    </div>
  ),
}

/**
 * Stacks the default, flattened, and remaining tree configurations in one column so every
 * rendering mode can be reviewed at a glance.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Default</strong>
        <FileTree id="all-tree-default" entries={fileTreeEntries} />
      </div>
      <div>
        <strong>Flattened</strong>
        <FileTree id="all-tree-flat" entries={fileTreeEntries} flattenEmptyDirectories />
      </div>
      <div>
        <strong>Long paths</strong>
        <FileTree id="all-tree-long" entries={longPathFileTreeEntries} />
      </div>
      <div>
        <strong>Empty</strong>
        <FileTree id="all-tree-empty" entries={[]} />
      </div>
    </div>
  ),
}
