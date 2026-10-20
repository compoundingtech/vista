/**
 * Document lens exploration (`/sk-explore-variants`). Flip the frame's Combined / Side by
 * side switch alongside the pickers. The sample is a re-OCR'd receipt page: rewritten OCR
 * text (two removed blocks in a row), a moved callout, a rescanned PDF, a thumbnail whose
 * change is only visible through its semantic note, toggle children edits and a folded
 * run of unchanged history.
 *
 * - G gutter: G1 colored bar, G2 `+ − ~ ↕` glyph column with tint, G3 background tint only.
 *   Current default: G1.
 * - R removed content (combined only; side by side always uses the before column):
 *   R1 struck inline, R2 collapsed `N removed` marker, R3 margin ghost. Current default: R1.
 * - E embeds: E1 thumbnail + link card, E2 nested ImageDiff on the rendered pages of a
 *   changed embed, E3 collapsed chip. Current default: E1.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import {
  DocumentDiff,
  type DocumentEmbedPresentation,
  type DocumentGutter,
  type DocumentRemovedPresentation,
} from '../../../blocks/diff/DocumentDiff.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'
import {
  captured,
  proposed,
  receiptAfter,
  receiptBefore,
  renderEmbedPreviews,
} from '../_documentFixtures.tsx'

type GutterId = 'G1' | 'G2' | 'G3'
type RemovedId = 'R1' | 'R2' | 'R3'
type EmbedId = 'E1' | 'E2' | 'E3'

const gutterVariants: readonly Variant<GutterId>[] = [
  {
    id: 'G1',
    description:
      'Colored inline-start bar per block; prose stays untinted, word diffs carry the detail.',
  },
  {
    id: 'G2',
    description:
      'Diff-style `+ − ~ ↕` glyph column plus a background tint; readable without color.',
  },
  { id: 'G3', description: 'Background tint only; no bar, no glyphs. Quietest, relies on color.' },
]
const removedVariants: readonly Variant<RemovedId>[] = [
  { id: 'R1', description: 'Removed blocks stay in place, ghosted and struck through.' },
  {
    id: 'R2',
    description:
      'Consecutive removed blocks collapse into one expandable `N removed blocks` marker.',
  },
  {
    id: 'R3',
    description:
      'Removed blocks move to a right margin next to where they were; the document reads clean.',
  },
]
const embedVariants: readonly Variant<EmbedId>[] = [
  {
    id: 'E1',
    description: 'Card: render thumbnail (PDF first page), name, meta, hash and an open link.',
  },
  {
    id: 'E2',
    description:
      'Changed embeds nest an ImageDiff of their rendered pages; unchanged ones stay cards.',
  },
  { id: 'E3', description: 'Collapsed chip (type + name); expands to the card on demand.' },
]

const gutter: Readonly<Record<GutterId, DocumentGutter>> = { G1: 'bar', G2: 'glyph', G3: 'tint' }
const removed: Readonly<Record<RemovedId, DocumentRemovedPresentation>> = {
  R1: 'inline',
  R2: 'collapsed',
  R3: 'margin',
}
const embeds: Readonly<Record<EmbedId, DocumentEmbedPresentation>> = {
  E1: 'card',
  E2: 'card',
  E3: 'chip',
}

const DocumentExploration = () => {
  const [gutterId, setGutterId] = React.useState<GutterId>('G1')
  const [removedId, setRemovedId] = React.useState<RemovedId>('R1')
  const [embedId, setEmbedId] = React.useState<EmbedId>('E1')
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Gutter"
          variants={gutterVariants}
          value={gutterId}
          onChange={setGutterId}
        />
        <VariantPicker
          label="Removed"
          variants={removedVariants}
          value={removedId}
          onChange={setRemovedId}
        />
        <VariantPicker
          label="Embeds"
          variants={embedVariants}
          value={embedId}
          onChange={setEmbedId}
        />
      </VariantPanel>
      <DocumentDiff
        before={receiptBefore}
        after={receiptAfter}
        beforeSide={captured}
        afterSide={proposed}
        gutter={gutter[gutterId]}
        removed={removed[removedId]}
        embeds={embeds[embedId]}
        {...(embedId === 'E2' ? { renderEmbed: renderEmbedPreviews } : {})}
      />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/DocumentDiff',
  component: DocumentExploration,
} satisfies Meta
export default meta

/** Pick G/R/E variants above the live document lens. */
export const Exploration: StoryObj = { render: () => <DocumentExploration /> }
