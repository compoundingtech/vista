/**
 * Text lens exploration (`/sk-explore-variants`). Flip the frame's Combined / Side by side
 * switch alongside the pickers; the sample picker swaps between an editorial rewrite and a
 * long OCR re-extraction with a few corrected words.
 *
 * - R renderer: R1 own inline word diff in flowing prose, R2 `@pierre/diffs` over one
 *   sentence per line. Current default: R1.
 * - G granularity: G1 word, G2 character, G3 sentence. Current default: G1.
 * - C context: C1 fold unchanged stretches, C2 full text. Current default: C1.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import type { DiffSide } from '../../../blocks/diff/contract.ts'
import {
  TextDiff,
  type TextContext,
  type TextGranularity,
  type TextRenderer,
} from '../../../blocks/diff/TextDiff.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'

type RendererId = 'R1' | 'R2'
type GranularityId = 'G1' | 'G2' | 'G3'
type ContextId = 'C1' | 'C2'
type SampleId = 'S1' | 'S2'

const rendererVariants: readonly Variant<RendererId>[] = [
  {
    id: 'R1',
    description: 'Own renderer: edits marked inline in flowing prose; paragraphs keep their shape.',
  },
  {
    id: 'R2',
    description:
      '@pierre/diffs: text reflowed to one sentence per line, line diff with word highlights.',
  },
]
const granularityVariants: readonly Variant<GranularityId>[] = [
  { id: 'G1', description: 'Word: whole words marked, punctuation glue joins neighbouring edits.' },
  { id: 'G2', description: 'Character: minimal edits, best for OCR letter fixes (0/O, rn/m).' },
  {
    id: 'G3',
    description: 'Sentence: whole changed sentences marked; reads like a tracked-changes summary.',
  },
]
const contextVariants: readonly Variant<ContextId>[] = [
  {
    id: 'C1',
    description: 'Fold long unchanged stretches behind a disclosure, keeping sentence context.',
  },
  { id: 'C2', description: 'Full text, nothing folded.' },
]
const sampleVariants: readonly Variant<SampleId>[] = [
  { id: 'S1', description: 'Editorial rewrite of a short procedure (dense, meaningful edits).' },
  { id: 'S2', description: 'Six pages of OCR re-extracted; three letter-level corrections.' },
]

const renderer: Readonly<Record<RendererId, TextRenderer>> = { R1: 'inline', R2: 'pierre' }
const granularity: Readonly<Record<GranularityId, TextGranularity>> = {
  G1: 'word',
  G2: 'char',
  G3: 'sentence',
}
const context: Readonly<Record<ContextId, TextContext>> = { C1: 'folded', C2: 'full' }

const before: DiffSide = {
  label: 'Published',
  provenance: 'Synthetic Notion page body · 2026-09-24 18:02',
  basis: 'observed',
}
const after: DiffSide = {
  label: 'Proposed edit',
  provenance: 'Synthetic agent rewrite · dry run',
  basis: 'projected',
}

const editorialBefore = [
  'Parcels arrive at the loading dock every Tuesday and Friday. The receiving clerk signs the courier manifest, then checks each label against the intake ledger before the parcel is shelved.',
  'Damaged parcels are photographed and set aside. The clerk notes the damage in the ledger and emails the sender within two working days.',
  'At the end of the week, the archive lead reviews the ledger and closes any open entries.',
].join('\n\n')
const editorialAfter = [
  'Parcels arrive at the loading dock every Tuesday and Thursday. The receiving clerk signs the courier manifest, then scans each label into the intake system before the parcel is placed in a numbered bay.',
  'Damaged parcels are photographed and set aside. The clerk records the damage in the intake system and notifies the sender within one working day.',
  'Parcels without a label go to the exceptions shelf.',
  'At the end of the week, the archive lead reviews the ledger and closes any open entries.',
].join('\n\n')

const goods = ['brass fasteners', 'paper stock', 'ceramic tiles', 'wool samples'] as const
const ocrPage = (page: number) =>
  `SCAN PAGE ${page + 1} \u2014 SHIPPING MANIFEST\n` +
  Array.from(
    { length: 18 },
    (_, row) =>
      `Item ${String(page * 18 + row + 1).padStart(3, '0')}: ${goods[row % 4]} recorded at bay ${row + 2}. Custody and handling were verified by the receiving clerk.`,
  ).join(' ')
const ocrBefore = Array.from({ length: 6 }, (_, page) => ocrPage(page))
  .join('\n\n')
  .replace('Item 054: wool samples', 'Item 054: wo0l samples')
  .replace('Item 071: ceramic tiles', 'Item 071: cerarnic tiles')
  .replace('Item 089: brass fasteners', 'Item 089: brass fastners')
const ocrAfter = Array.from({ length: 6 }, (_, page) => ocrPage(page)).join('\n\n')

const samples: Readonly<
  Record<SampleId, { readonly title: string; readonly before: string; readonly after: string }>
> = {
  S1: { title: 'Parcel intake procedure', before: editorialBefore, after: editorialAfter },
  S2: {
    title: 'Shipping manifest scan \u00b7 OCR re-extraction',
    before: ocrBefore,
    after: ocrAfter,
  },
}

const TextExploration = () => {
  const [rendererId, setRendererId] = React.useState<RendererId>('R1')
  const [granularityId, setGranularityId] = React.useState<GranularityId>('G1')
  const [contextId, setContextId] = React.useState<ContextId>('C1')
  const [sampleId, setSampleId] = React.useState<SampleId>('S1')
  const sample = samples[sampleId]
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Renderer"
          variants={rendererVariants}
          value={rendererId}
          onChange={setRendererId}
        />
        <VariantPicker
          label="Granularity"
          variants={granularityVariants}
          value={granularityId}
          onChange={setGranularityId}
        />
        <VariantPicker
          label="Context"
          variants={contextVariants}
          value={contextId}
          onChange={setContextId}
        />
        <VariantPicker
          label="Sample"
          variants={sampleVariants}
          value={sampleId}
          onChange={setSampleId}
        />
      </VariantPanel>
      <TextDiff
        title={sample.title}
        before={before}
        after={after}
        beforeText={sample.before}
        afterText={sample.after}
        renderer={renderer[rendererId]}
        granularity={granularity[granularityId]}
        context={context[contextId]}
      />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/TextDiff',
  component: TextExploration,
} satisfies Meta
export default meta

/** Pick R/G/C variants (and a sample) above the live text lens. */
export const Exploration: StoryObj = { render: () => <TextExploration /> }
