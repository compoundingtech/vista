import type { Meta, StoryObj } from '@storybook/react'

import { DiffFrame } from '../../blocks/diff/DiffFrame.tsx'
import { ImageCompareSet, ImageDiff } from '../../blocks/diff/ImageDiff.tsx'
import { PageSetDiff, type PageImage } from '../../blocks/diff/PageSetDiff.tsx'
import {
  after,
  before,
  blueprint,
  invoice,
  longAfter,
  longBefore,
  reportAfterPartial,
  reportBefore,
  reportPage,
  rotated,
  scan,
} from './_imageFixtures.ts'

const source = invoice('120.00')
const subtle = invoice('120.01')
const large = invoice('840.00', 'Full document redesign')

const meta = {
  title: 'Vista/Blocks/Diff/ImageDiff',
  component: ImageDiff,
  args: {
    title: 'Invoice render',
    before,
    after,
    beforeImage: source,
    afterImage: subtle,
  },
  argTypes: {
    defaultArrangement: { control: 'inline-radio', options: ['unified', 'split'] },
    defaultMode: { control: 'inline-radio', options: ['swipe', 'overlay', 'difference'] },
    differenceStyle: { control: 'inline-radio', options: ['pixels', 'heat', 'regions'] },
    beforeImage: { control: false },
    afterImage: { control: false },
  },
} satisfies Meta<typeof ImageDiff>

export default meta
type Story = StoryObj<typeof meta>

/** Equal content hashes mean the same bytes: one render, a "Same bytes" marker, no pixel pass. */
export const SameBytes: Story = {
  args: {
    beforeImage: { ...source, contentHash: 'sha256:synthetic-invoice-1' },
    afterImage: { ...source, contentHash: 'sha256:synthetic-invoice-1' },
  },
}

/** Different hashes but an identical render (only an XML comment differs): "same render, different bytes". */
export const SameRenderDifferentBytes: Story = {
  args: {
    title: 'Report page 3 · re-exported',
    beforeImage: { ...reportPage(3), contentHash: 'sha256:report-p3-v1' },
    afterImage: {
      ...reportPage(3, { comment: 're-exported' }),
      contentHash: 'sha256:report-p3-v2',
    },
  },
}

/** A single cent change lights up the changed pixels and reports their percentage. */
export const SubtleDifference: Story = { args: { defaultMode: 'difference' } }

/** Heat map: delta magnitude, with sub-tolerance antialiasing noise faintly visible. */
export const DifferenceHeat: Story = {
  args: {
    afterImage: large,
    defaultMode: 'difference',
    differenceStyle: 'heat',
    title: 'Revised invoice render',
  },
}

/** Region boxes: only clustered changed regions are marked. */
export const DifferenceRegions: Story = {
  args: {
    afterImage: large,
    defaultMode: 'difference',
    differenceStyle: 'regions',
    title: 'Revised invoice render',
  },
}

/** Drag anywhere on the stage, or focus the divider and use the arrow keys (React Aria Slider). */
export const Swipe: Story = {
  args: {
    defaultMode: 'swipe',
    beforeImage: scan('DRAFT'),
    afterImage: scan('APPROVED', '#166534'),
  },
}

/** Onion-skin opacity reveals changes that span a document. */
export const Overlay: Story = {
  args: { defaultMode: 'overlay', beforeImage: scan('DRAFT'), afterImage: rotated },
}

/** Side by side with synced zoom and scroll; letterboxing preserves both images' dimensions. */
export const SideBySide: Story = {
  args: {
    defaultArrangement: 'split',
    beforeImage: scan('DRAFT'),
    afterImage: rotated,
    title: 'Portrait → landscape scan',
  },
}

/** Peer comparison: two alternatives rather than successive states ("vs" instead of an arrow). */
export const PeerComparison: Story = {
  args: {
    title: 'Renderer A vs renderer B',
    relation: 'peer',
    before: { label: 'pdfium', basis: 'observed', provenance: 'Synthetic render, engine A' },
    after: { label: 'poppler', basis: 'observed', provenance: 'Synthetic render, engine B' },
    beforeImage: scan('DRAFT'),
    afterImage: scan('DRAFT', '#1e3a8a'),
  },
}

/** One-sided images retain their add/remove classification without pixel work. */
export const AddedOnly: Story = {
  args: { beforeImage: undefined, afterImage: blueprint, title: 'New floor plan' },
}
/** Mirror of {@link AddedOnly}: the floor plan exists only before and is dropped wholesale. */
export const RemovedOnly: Story = {
  args: { beforeImage: blueprint, afterImage: undefined, title: 'Deleted floor plan' },
}

/** N-way peer comparison: one reference render against four candidates. */
export const CompareSet: Story = {
  render: () => (
    <ImageCompareSet
      title="Invoice render across engines"
      reference={{
        side: { label: 'Reference · pdfium', basis: 'observed' },
        image: { ...source, contentHash: 'sha256:invoice-ref' },
      }}
      candidates={[
        {
          id: 'poppler',
          side: { label: 'poppler', basis: 'observed' },
          image: { ...source, contentHash: 'sha256:invoice-ref' },
        },
        { id: 'mupdf', side: { label: 'mupdf', basis: 'observed' }, image: subtle },
        {
          id: 'pdfjs',
          side: { label: 'pdf.js', basis: 'observed' },
          image: invoice('120.00', 'Vector review '),
        },
        { id: 'ghostscript', side: { label: 'ghostscript', basis: 'observed' }, image: large },
      ]}
    />
  ),
}

const beforePages: readonly PageImage[] = [
  { ...source, label: 'Invoice', contentHash: 'invoice-original' },
  { ...scan('DRAFT'), label: 'Scan' },
  { ...blueprint, label: 'Floor plan', contentHash: 'plan-a' },
]
const afterPages: readonly PageImage[] = [
  { ...subtle, label: 'Invoice' },
  { ...scan('APPROVED', '#166534'), label: 'Scan' },
  { ...blueprint, label: 'Floor plan', contentHash: 'plan-a' },
  { ...rotated, label: 'Rotated attachment' },
]

/** 3→4 filmstrip: changed pages, a same-bytes page, and an added page. */
export const PageSetThreeToFour: Story = {
  render: () => (
    <PageSetDiff
      title="Synthetic 3→4 page export"
      before={before}
      after={after}
      beforePages={beforePages}
      afterPages={afterPages}
    />
  ),
}

/** Side by side: two aligned page columns. */
export const PageSetSideBySide: Story = {
  render: () => (
    <PageSetDiff
      title="Synthetic 3→4 page export"
      before={before}
      after={after}
      beforePages={beforePages}
      afterPages={afterPages}
      defaultArrangement="split"
    />
  ),
}

/** A 6-page PDF whose after export rendered only 3 pages: 6 → 6 with 3 placeholders, not 3 → 3. */
export const PageSetUnrenderedPages: Story = {
  render: () => (
    <PageSetDiff
      title="Harbor survey export"
      before={before}
      after={after}
      beforePages={reportBefore}
      afterPages={reportAfterPartial}
      beforePageCount={6}
      afterPageCount={6}
    />
  ),
}

/** Changed pages only, with unchanged pages folded behind a disclosure. */
export const PageSetChangedOnly: Story = {
  render: () => (
    <PageSetDiff
      title="Harbor survey · 8 pages"
      before={before}
      after={after}
      beforePages={longBefore}
      afterPages={longAfter}
      combinedLayout="changed"
    />
  ),
}

/** Hash alignment keeps known identical pages across an insertion. */
export const PageSetInsertion: Story = {
  render: () => (
    <PageSetDiff
      title="Synthetic export · insertion at page 2"
      before={before}
      after={after}
      beforePages={beforePages}
      afterPages={[
        beforePages[0]!,
        { ...rotated, contentHash: 'rotated' },
        beforePages[1]!,
        beforePages[2]!,
      ]}
      alignment="content"
    />
  ),
}

/** A page set nested in a document diff: nested frames inherit the parent's arrangement. */
export const NestedInDocument: Story = {
  render: () => (
    <DiffFrame
      title="Synthetic document · migration preview"
      lens="document"
      before={before}
      after={after}
      counts={{ changed: 2, added: 1 }}
    >
      <PageSetDiff
        title="Rendered attachment pages"
        before={before}
        after={after}
        beforePages={beforePages}
        afterPages={afterPages}
        nested
      />
    </DiffFrame>
  ),
}
