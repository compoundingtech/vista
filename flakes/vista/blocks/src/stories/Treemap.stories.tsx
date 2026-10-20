import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { Treemap, type TreemapDetailProps } from '../blocks/treemap/Treemap.tsx'
import { facetedTreemapLenses, facetedTreemapModel } from './_coverage-fixtures.ts'
import {
  bundleLenses,
  bundleModel,
  diskLenses,
  diskModel,
  emptyModel,
  prChurnModel,
  prLenses,
} from './_treemap-fixtures.ts'

/**
 * The value-proportioned hierarchy block. Review axes: data domain (bundle /
 * disk / PR churn), lens (layout, colour encoding, depth cap, default-hidden
 * facets), the interactive controls (search, filter, layout/colour segments,
 * depth stepper), the pinned detail panel (default or caller-supplied), and the
 * temporary depth-indicator exploration variants.
 */
const meta = {
  title: 'Vista/Blocks/Data/Treemap',
  component: Treemap,
  args: {
    id: 'treemap-default',
    model: bundleModel,
    lenses: bundleLenses,
    caption: 'Bundle composition with direct typed model props.',
  },
  argTypes: {
    defaultLensId: { control: 'text' },
    depthIndicator: { control: 'inline-radio', options: ['off', 'D1', 'D2', 'D3', 'D4', 'D5'] },
    caption: { control: 'text' },
    id: { control: false },
    model: { control: false },
    lenses: { control: false },
    renderDetail: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Treemap>

export default meta
type Story = StoryObj<typeof meta>

/** Bundle composition under the zero-interaction overview lens. */
export const Default: Story = {}

/** Icicle layout over the same model: depth on an axis instead of nesting. */
export const Icicle: Story = {
  args: { id: 'treemap-icicle', defaultLensId: 'icicle-value' },
}

/** ~330 nodes, 9 levels: depth capping, "+N more" folding, and byte formatting. */
export const Disk: Story = {
  args: {
    id: 'treemap-disk',
    model: diskModel,
    lenses: diskLenses,
    defaultLensId: 'treemap-deep',
  },
}

/**
 * Renders the treemap over the pull-request churn model with the churn lens preselected, so tiles
 * are sized and grouped by PR churn.
 */
export const PullRequestChurn: Story = {
  args: {
    id: 'treemap-pr',
    model: prChurnModel,
    lenses: prLenses,
    defaultLensId: 'churn',
  },
}

/**
 * A lens with `hiddenFacets`: generated leaves start hidden but stay counted,
 * drillable, and revealable through the "N hidden" filter affordance.
 */
export const HiddenFacets: Story = {
  args: {
    id: 'treemap-facets',
    model: facetedTreemapModel,
    lenses: facetedTreemapLenses,
    defaultLensId: 'authored-only',
    caption: 'provenance: generated hidden by default — the filter still counts them',
  },
}

/** A mixed facet activation includes every leaf in that facet. */
export const MixedFacetIncludesAll: Story = {
  args: {
    id: 'treemap-mixed-facet',
    model: facetedTreemapModel,
    lenses: facetedTreemapLenses,
    defaultLensId: 'everything',
    defaultExcludedIds: ['faceted-src-gen'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Filter tree' }))
    const page = within(canvasElement.ownerDocument.body)
    const dialog = await page.findByRole('dialog', { name: 'Filter tree' })
    const generated = within(dialog).getByRole('checkbox', { name: 'Include Generated' })

    await expect(generated).toBePartiallyChecked()
    await userEvent.click(generated)
    await expect(generated).toBeChecked()
  },
}

/** Seeded exclusions via `defaultExcludedIds` instead of a lens facet rule. */
export const PreExcluded: Story = {
  args: {
    id: 'treemap-excluded',
    model: facetedTreemapModel,
    lenses: facetedTreemapLenses,
    defaultLensId: 'everything',
    defaultExcludedIds: ['faceted-lock'],
    caption: 'pnpm-lock.yaml excluded up front',
  },
}

const RepoDetail = ({ node }: TreemapDetailProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.5rem' }}>
    <strong>{node.label}</strong>
    <code style={{ fontSize: '0.72rem' }}>{node.path.join('/')}</code>
    <span style={{ fontSize: '0.72rem' }}>
      {node.value} {node.valueNoun ?? 'units'} · {node.leafCount} leaves ·{' '}
      {Math.round(node.pctOfTotal * 100)}% of total
    </span>
  </div>
)

/** A caller-supplied detail panel replaces the built-in one. */
export const CustomDetail: Story = {
  args: {
    id: 'treemap-detail',
    model: prChurnModel,
    lenses: prLenses,
    defaultLensId: 'churn',
    renderDetail: RepoDetail,
    caption: 'renderDetail: host-authored pinned detail',
  },
}

/** Empty model: the block must say so rather than render a blank canvas. */
export const Empty: Story = {
  args: { id: 'treemap-empty', model: emptyModel, lenses: bundleLenses },
}

/** Narrow layout: controls wrap and the detail panel stacks under the canvas. */
export const NarrowLayout: Story = {
  render: () => (
    <div style={{ width: '28rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <Treemap
        id="treemap-narrow"
        model={bundleModel}
        lenses={bundleLenses}
        caption="bundle composition at 28rem"
      />
    </div>
  ),
}

/**
 * Depth-indicator exploration (decision 0055): how a tile signals "drillable"
 * vs "leaf" vs the ambiguous depth-capped case. Compare and pick a winner.
 */
export const DepthIndicatorExploration: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {(['off', 'D1', 'D2', 'D3', 'D4', 'D5'] as const).map((variant) => (
        <div key={variant}>
          <strong>{variant}</strong>
          <Treemap
            id={`treemap-depth-${variant}`}
            model={diskModel}
            lenses={diskLenses}
            defaultLensId="treemap-deep"
            depthIndicator={variant}
          />
        </div>
      ))}
    </div>
  ),
}

/** The lens/domain axis on one page. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Treemap layout, colour by group</strong>
        <Treemap id="all-tm-overview" model={bundleModel} lenses={bundleLenses} />
      </div>
      <div>
        <strong>Icicle layout, colour by value</strong>
        <Treemap
          id="all-tm-icicle"
          model={bundleModel}
          lenses={bundleLenses}
          defaultLensId="icicle-value"
        />
      </div>
      <div>
        <strong>Hidden facets (generated)</strong>
        <Treemap
          id="all-tm-facets"
          model={facetedTreemapModel}
          lenses={facetedTreemapLenses}
          defaultLensId="authored-only"
        />
      </div>
      <div>
        <strong>Empty</strong>
        <Treemap id="all-tm-empty" model={emptyModel} lenses={bundleLenses} />
      </div>
    </div>
  ),
}

/** Search is a whole-tree filter: typing narrows to a result list of real matches. */
export const SearchFilter: Story = {
  args: { id: 'treemap-search' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('textbox', { name: 'Search tree' })

    await userEvent.type(search, 'Schema')
    const results = await canvas.findByRole('listbox', { name: 'Search results' })
    await expect(within(results).getByText('Schema.js')).toBeVisible()

    await userEvent.clear(search)
    await expect(canvas.queryByRole('listbox', { name: 'Search results' })).toBeNull()
  },
}

/** Clicking a tile pins it: the detail panel switches from its hint to the node. */
export const FocusTile: Story = {
  args: { id: 'treemap-focus' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const detail = canvas.getByRole('complementary', { name: 'Selected node detail' })
    await expect(within(detail).getByText(/Click a tile to pin its detail/)).toBeVisible()

    const tiles = await canvas.findAllByRole('treeitem')
    await userEvent.click(tiles[0]!)
    await expect(tiles[0]!).toHaveAttribute('aria-selected', 'true')
    await expect(within(detail).queryByText(/Click a tile to pin its detail/)).toBeNull()
  },
}

/** The colour encoding is a restyle, never a relayout: the segment control is two-state. */
export const ColorByToggle: Story = {
  args: { id: 'treemap-colorby' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const byGroup = canvas.getByRole('button', { name: 'Color by group' })
    const byDepth = canvas.getByRole('button', { name: 'Color by depth' })
    await expect(byGroup).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(byDepth)
    await expect(byDepth).toHaveAttribute('aria-pressed', 'true')
    await expect(byGroup).toHaveAttribute('aria-pressed', 'false')
  },
}
