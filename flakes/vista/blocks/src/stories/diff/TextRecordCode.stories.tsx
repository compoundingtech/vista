import type { Meta, StoryObj } from '@storybook/react'

import { CodeDiff } from '../../blocks/diff/CodeDiff.tsx'
import type { DiffSide } from '../../blocks/diff/contract.ts'
import { RecordDiff } from '../../blocks/diff/RecordDiff.tsx'
import type { RecordEntries } from '../../blocks/diff/RecordDiff.tsx'
import { TextDiff } from '../../blocks/diff/TextDiff.tsx'

const before: DiffSide = {
  label: 'Before migration',
  provenance: 'Synthetic snapshot · 09:12 UTC',
  basis: 'observed',
}
const after: DiffSide = {
  label: 'Proposed migration',
  provenance: 'Synthetic dry run · 09:16 UTC',
  basis: 'projected',
}

const proseBefore =
  'The archive receives a shipment every Tuesday. A staff member checks each label against the ledger before placing the parcel on a shelf.\n\nThe intake note is kept with the shipment. It lists the courier, the condition of the package, and the date it was received.'
const proseAfter =
  'The archive receives a shipment every Thursday. A staff member checks each label against the ledger before placing the parcel in a numbered bay.\n\nThe intake note is kept with the shipment. It lists the courier, the condition of the package, and the time it was received.'

const ocrParagraph = (n: number) =>
  `SCAN PAGE ${n + 1} — SHIPPING MANIFEST\n` +
  Array.from(
    { length: 18 },
    (_, row) =>
      `Item ${String(n * 18 + row + 1).padStart(3, '0')}: ${['brass fasteners', 'paper stock', 'ceramic tiles', 'wool samples'][row % 4]} recorded at bay ${row + 2}. Custody and handling were verified by the receiving clerk.`,
  ).join(' ')
const ocrBefore = Array.from({ length: 6 }, (_, n) => ocrParagraph(n)).join('\n\n')
const ocrAfter = ocrBefore
  .replace('Item 054: wool samples', 'Item 054: wood samples')
  .replace('bay 10. Custody and handling', 'bay 11. Custody and handling')
  .replace('Item 089: brass fasteners', 'Item 089: brass fasteners (rechecked)')

const recordBefore: RecordEntries = {
  title: { _tag: 'text', value: 'Parcel intake protocol' },
  status: { _tag: 'text', value: 'Draft' },
  department: { _tag: 'text', value: 'Archive' },
  intakeDate: { _tag: 'date', value: '2026-09-10' },
  reviewer: { _tag: 'text', value: 'A. Reader' },
  tags: {
    _tag: 'list',
    items: [
      { _tag: 'text', value: 'operations' },
      { _tag: 'text', value: 'incoming' },
    ],
  },
  metadata: {
    _tag: 'object',
    entries: {
      region: { _tag: 'text', value: 'North' },
      copies: { _tag: 'number', value: 2 },
      archived: { _tag: 'boolean', value: false },
      portal: { _tag: 'url', value: 'https://example.org/archive/parcel' },
    },
  },
  legacyCode: { _tag: 'text', value: 'PKT-12' },
}
const recordAfter: RecordEntries = {
  title: { _tag: 'text', value: 'Parcel intake protocol' },
  status: { _tag: 'text', value: 'Published' },
  department: { _tag: 'text', value: 'Archive' },
  intakeDate: { _tag: 'date', value: '2026-09-10' },
  reviewer: { _tag: 'text', value: 'A. Reader' },
  tags: {
    _tag: 'list',
    items: [
      { _tag: 'text', value: 'operations' },
      { _tag: 'text', value: 'reviewed' },
    ],
  },
  metadata: {
    _tag: 'object',
    entries: {
      region: { _tag: 'text', value: 'South' },
      copies: { _tag: 'number', value: 3 },
      archived: { _tag: 'boolean', value: false },
      portal: { _tag: 'url', value: 'https://example.org/archive/parcel' },
      retentionYears: { _tag: 'number', value: 7 },
    },
  },
  contact: { _tag: 'url', value: 'https://example.org/intake', label: 'Intake portal' },
}

const sourceBefore =
  'export function inspectParcel(parcel: Parcel) {\n  const shelf = parcel.shelf ?? "overflow"\n  return `Inspect ${parcel.id} at ${shelf}`\n}\n'
const sourceAfter =
  'export function inspectParcel(parcel: Parcel) {\n  const bay = parcel.bay ?? "receiving"\n  return `Inspect ${parcel.id} at ${bay}`\n}\n'

const meta = {
  title: 'Vista/Blocks/Diff/TextRecordCode',
  component: TextDiff,
  args: {
    title: 'Intake procedure',
    before,
    after,
    beforeText: proseBefore,
    afterText: proseAfter,
  },
  argTypes: {
    defaultArrangement: { control: 'inline-radio', options: ['unified', 'split'] },
    renderer: { control: 'inline-radio', options: ['inline', 'pierre'] },
    granularity: { control: 'inline-radio', options: ['word', 'char', 'sentence'] },
    context: { control: 'inline-radio', options: ['folded', 'full'] },
    beforeText: { control: 'text' },
    afterText: { control: 'text' },
  },
} satisfies Meta<typeof TextDiff>

export default meta

type Story = StoryObj<typeof meta>

/** Word-level prose changes with paragraph boundaries preserved. */
export const ProseEdit: Story = {}

/** Same prose, side by side: before/after paragraphs in two columns. */
export const ProseSplit: Story = { args: { defaultArrangement: 'split' } }

/** Same prose through `@pierre/diffs`: one sentence per line, word-level highlights, wrapped. */
export const ProsePierre: Story = { args: { renderer: 'pierre' } }

/** Long OCR through pierre side by side: unchanged sentences fold into hunk separators. */
export const OcrPierreSplit: Story = {
  args: {
    title: 'Synthetic shipping manifest · pierre',
    beforeText: ocrBefore,
    afterText: ocrAfter,
    renderer: 'pierre',
    defaultArrangement: 'split',
  },
}

/** Inputs beyond `clipAt` are cut before diffing and an explicit marker says so. */
export const ClippedText: Story = {
  args: {
    title: 'Clipped OCR comparison',
    beforeText: ocrBefore,
    afterText: ocrAfter,
    clipAt: 4_000,
  },
}

/** Several pages of OCR, but only a few corrected words; large equal stretches fold by sentence. */
export const OcrReextraction: Story = {
  args: {
    title: 'Synthetic shipping manifest · re-extracted OCR',
    beforeText: ocrBefore,
    afterText: ocrAfter,
  },
}

/** Spaces and paragraph separators remain explicit even though the words are identical. */
export const WhitespaceOnly: Story = {
  args: {
    title: 'Whitespace-only edit',
    beforeText: 'One parcel. Two copies.\n\nChecked by the clerk.',
    afterText: 'One  parcel.  Two copies.\nChecked by the clerk.',
  },
}

/** Identical texts have no change marks. */
export const Identical: Story = {
  args: { title: 'No change', beforeText: proseBefore, afterText: proseBefore },
}

/** Empty-before text, all tokens added. */
export const AllAddedText: Story = {
  args: { title: 'New procedure', beforeText: '', afterText: proseAfter },
}

/** Added/removed/changed keys, nested object/list paths, and foldable unchanged rows. */
export const RecordProperties: Story = {
  render: () => (
    <RecordDiff
      title="Parcel page properties"
      before={before}
      after={after}
      beforeRecord={recordBefore}
      afterRecord={recordAfter}
    />
  ),
}

/** The same record side by side: before and after get their own columns. */
export const RecordSplit: Story = {
  render: () => (
    <RecordDiff
      title="Parcel page properties · side by side"
      before={before}
      after={after}
      beforeRecord={recordBefore}
      afterRecord={recordAfter}
      defaultArrangement="split"
    />
  ),
}

/** `foldUnchangedAbove={0}` never folds: every unchanged row is shown (used to crash on an empty fold). */
export const RecordNeverFold: Story = {
  render: () => (
    <RecordDiff
      title="Parcel page properties · no folding"
      before={before}
      after={after}
      beforeRecord={recordBefore}
      afterRecord={recordAfter}
      foldUnchangedAbove={0}
    />
  ),
}

/** Labelled URLs whose target changes: the URL form (host + path) stays visible, not just the label. */
export const RecordUrlChange: Story = {
  render: () => (
    <RecordDiff
      title="Parcel links"
      before={before}
      after={after}
      beforeRecord={{
        portal: {
          _tag: 'url',
          value: 'https://example.org/archive/parcel',
          label: 'Intake portal',
        },
        manual: { _tag: 'url', value: 'http://docs.example.org/intake?v=1', label: 'Manual' },
      }}
      afterRecord={{
        portal: {
          _tag: 'url',
          value: 'https://example.org/archive/parcels',
          label: 'Intake portal',
        },
        manual: { _tag: 'url', value: 'https://docs.example.org/intake?v=2', label: 'Manual' },
      }}
    />
  ),
}

/** A long OCR value delegates to a nested prose diff instead of dumping a giant cell. */
export const RecordWithLongText: Story = {
  render: () => (
    <RecordDiff
      title="OCR page properties"
      before={before}
      after={after}
      beforeRecord={{ page: { _tag: 'number', value: 4 }, ocr: { _tag: 'text', value: ocrBefore } }}
      afterRecord={{ page: { _tag: 'number', value: 4 }, ocr: { _tag: 'text', value: ocrAfter } }}
    />
  ),
}

/** A record's changed code property embeds the code lens inside its own frame. */
export const CodeNestedInsideRecord: Story = {
  render: () => (
    <RecordDiff
      title="Parcel validator configuration"
      before={before}
      after={after}
      beforeRecord={{
        name: { _tag: 'text', value: 'Parcel intake' },
        validator: { _tag: 'code', path: 'src/parcel.ts', value: sourceBefore },
      }}
      afterRecord={{
        name: { _tag: 'text', value: 'Parcel intake' },
        validator: { _tag: 'code', path: 'src/parcel.ts', value: sourceAfter },
      }}
    />
  ),
}

/** Empty-before record, including a nested object: all leaf keys are added. */
export const AllAddedRecord: Story = {
  render: () => (
    <RecordDiff
      title="New synthetic parcel"
      before={before}
      after={after}
      beforeRecord={{}}
      afterRecord={recordAfter}
    />
  ),
}

/** Direct code adapter with actual `Diff` block, framed with semantic line counts. */
export const CodeStandalone: Story = {
  render: () => (
    <CodeDiff
      id="code-standalone"
      title="src/parcel.ts"
      before={before}
      after={after}
      source={{
        _tag: 'files',
        path: 'src/parcel.ts',
        oldContents: sourceBefore,
        newContents: sourceAfter,
      }}
    />
  ),
}

/** Side by side via the frame switch; the frame is the only arrangement control. */
export const CodeSplit: Story = {
  render: () => (
    <CodeDiff
      id="code-split"
      title="src/parcel.ts · side by side"
      before={before}
      after={after}
      defaultArrangement="split"
      source={{
        _tag: 'files',
        path: 'src/parcel.ts',
        oldContents: sourceBefore,
        newContents: sourceAfter,
      }}
    />
  ),
}
