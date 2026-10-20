/**
 * Variant exploration for the image lens and its page-set sibling.
 *
 * Dimensions (current default in brackets):
 * - M, combined mode shown first [M3 difference]: M1 swipe, M2 overlay, M3 difference.
 * - D, difference rendering [D1 pixels]: D1 highlight pixels over dimmed base, D2 heat map, D3 region boxes.
 * - P, page-set combined layout [P1 filmstrip]: P1 horizontal filmstrip, P2 grid of pages, P3 changed pages only.
 *
 * M and D drive the single `ImageDiff` and the page opened inside the `PageSetDiff`; P only
 * affects the page set's combined arrangement (side by side is always two aligned columns).
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import type { DifferenceStyle, ImageCombinedMode } from '../../../blocks/diff/ImageDiff.tsx'
import { ImageDiff } from '../../../blocks/diff/ImageDiff.tsx'
import { PageSetDiff, type PageSetLayout } from '../../../blocks/diff/PageSetDiff.tsx'
import { VariantPanel, VariantPicker, type Variant } from '../../../explore.tsx'
import { after, before, invoice, longAfter, longBefore } from '../_imageFixtures.ts'

type ModeId = 'M1' | 'M2' | 'M3'
type DifferenceId = 'D1' | 'D2' | 'D3'
type PageLayoutId = 'P1' | 'P2' | 'P3'

const modeVariants: readonly Variant<ModeId>[] = [
  {
    id: 'M1',
    description:
      'Swipe: drag a divider across one stage; most intuitive, but a one-digit change is easy to miss.',
  },
  { id: 'M2', description: 'Overlay: onion-skin opacity; best for shifted or re-flowed layouts.' },
  {
    id: 'M3',
    description:
      'Difference: changed pixels computed and painted; answers "what changed" without hunting.',
  },
]
const modeById: Readonly<Record<ModeId, ImageCombinedMode>> = {
  M1: 'swipe',
  M2: 'overlay',
  M3: 'difference',
}

const differenceVariants: readonly Variant<DifferenceId>[] = [
  {
    id: 'D1',
    description: 'Pixels: every changed pixel in magenta over the dimmed grayscale base.',
  },
  {
    id: 'D2',
    description: 'Heat: delta magnitude as a ramp; sub-tolerance noise stays faintly visible.',
  },
  {
    id: 'D3',
    description: 'Regions: only boxes around clustered changes; the page stays readable.',
  },
]
const differenceById: Readonly<Record<DifferenceId, DifferenceStyle>> = {
  D1: 'pixels',
  D2: 'heat',
  D3: 'regions',
}

const pageLayoutVariants: readonly Variant<PageLayoutId>[] = [
  {
    id: 'P1',
    description: 'Filmstrip: one scrollable row in page order; order and position stay legible.',
  },
  { id: 'P2', description: 'Grid: wrapping cards in page order; whole document at a glance.' },
  {
    id: 'P3',
    description: 'Changed only: pages needing attention first, "N unchanged" folded away.',
  },
]
const pageLayoutById: Readonly<Record<PageLayoutId, PageSetLayout>> = {
  P1: 'filmstrip',
  P2: 'grid',
  P3: 'changed',
}

const beforeInvoice = { ...invoice('120.00'), contentHash: 'sha256:invoice-v1' }
const afterInvoice = {
  ...invoice('128.40', 'Vector review + harbor fees'),
  contentHash: 'sha256:invoice-v2',
}

const ImageExploration = () => {
  const [mode, setMode] = React.useState<ModeId>('M3')
  const [difference, setDifference] = React.useState<DifferenceId>('D1')
  const [pageLayout, setPageLayout] = React.useState<PageLayoutId>('P1')
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Combined mode"
          variants={modeVariants}
          value={mode}
          onChange={setMode}
        />
        <VariantPicker
          label="Difference"
          variants={differenceVariants}
          value={difference}
          onChange={setDifference}
        />
        <VariantPicker
          label="Page layout"
          variants={pageLayoutVariants}
          value={pageLayout}
          onChange={setPageLayout}
        />
      </VariantPanel>
      <div style={{ display: 'grid', gap: 24 }}>
        <ImageDiff
          key={mode}
          title="Invoice render"
          before={before}
          after={after}
          beforeImage={beforeInvoice}
          afterImage={afterInvoice}
          defaultArrangement="unified"
          defaultMode={modeById[mode]}
          differenceStyle={differenceById[difference]}
        />
        <PageSetDiff
          key={`${mode}-${pageLayout}`}
          title="Harbor survey · 8 pages"
          before={before}
          after={after}
          beforePages={longBefore}
          afterPages={longAfter}
          defaultArrangement="unified"
          combinedLayout={pageLayoutById[pageLayout]}
          defaultImageMode={modeById[mode]}
          differenceStyle={differenceById[difference]}
        />
      </div>
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/ImageDiff',
  component: ImageExploration,
} satisfies Meta

export default meta

/** Live pickers for combined mode, difference rendering and page-set layout over a one-page invoice diff. */
export const Exploration: StoryObj = { render: () => <ImageExploration /> }
