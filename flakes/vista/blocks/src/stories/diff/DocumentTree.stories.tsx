import type { Meta, StoryObj } from '@storybook/react'

import type { DiffArrangement } from '../../blocks/diff/contract.ts'
import { DiffFrame } from '../../blocks/diff/DiffFrame.tsx'
import {
  DocumentDiff,
  type DocSnapshot,
  type PropertyChange,
} from '../../blocks/diff/DocumentDiff.tsx'
import { TreeDiff } from '../../blocks/diff/TreeDiff.tsx'
import {
  addOnly,
  captured,
  emptyDoc,
  proposed,
  receiptAfter,
  receiptBefore,
  renderEmbedPreviews,
  splitAfter,
  splitBefore,
  treeAfter,
  treeBefore,
} from './_documentFixtures.tsx'

/** Nested placeholder: real callers can pass a RecordDiff here. */
const renderProperties = (changes: readonly PropertyChange[]) => (
  <DiffFrame
    title="Page properties"
    lens="record"
    before={captured}
    after={proposed}
    counts={{
      changed: changes.filter((change) => change.kind === 'changed').length,
      added: changes.filter((change) => change.kind === 'added').length,
    }}
    nested
  >
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '8rem 1fr',
        gap: '4px 12px',
        padding: 8,
        fontSize: 12,
      }}
    >
      {changes
        .filter((change) => change.kind !== 'unchanged')
        .map((change) => (
          <div key={change.key} style={{ display: 'contents' }}>
            <strong>{change.key}</strong>
            <span>
              {change.before ?? '—'} → {change.after ?? '—'}
            </span>
          </div>
        ))}
    </div>
  </DiffFrame>
)

type Scenario = 'receipt' | 'split' | 'added' | 'removed' | 'identical' | 'small' | 'move'

interface GalleryProps {
  readonly lens: 'document' | 'tree'
  readonly scenario: Scenario
  readonly arrangement: DiffArrangement
  readonly nestedSlots: boolean
}

const documentPair = (scenario: Scenario): readonly [DocSnapshot, DocSnapshot] => {
  switch (scenario) {
    case 'split':
      return [splitBefore, splitAfter]
    case 'added':
      return [emptyDoc, addOnly]
    case 'removed':
      return [receiptBefore, emptyDoc]
    case 'identical':
      return [receiptBefore, receiptBefore]
    case 'small':
      return [
        receiptBefore,
        {
          ...receiptBefore,
          blocks: receiptBefore.blocks.map((block) =>
            block._tag === 'toggle'
              ? {
                  ...block,
                  children: block.children.map((child) =>
                    child._tag === 'todo' ? { ...child, checked: true } : child,
                  ),
                }
              : block,
          ),
        },
      ]
    case 'receipt':
    case 'move':
      return [receiptBefore, receiptAfter]
  }
}

/** Thin Storybook selector; the actual surfaces are DocumentDiff and TreeDiff. */
const DocumentTreeGallery = ({ lens, scenario, arrangement, nestedSlots }: GalleryProps) => {
  if (lens === 'tree') {
    return (
      <TreeDiff
        key={arrangement}
        before={scenario === 'added' ? [] : treeBefore}
        after={scenario === 'removed' ? [] : scenario === 'identical' ? treeBefore : treeAfter}
        beforeSide={captured}
        afterSide={proposed}
        defaultArrangement={arrangement}
        title={scenario === 'move' ? 'Receipts filed into Archive/2024' : 'Workspace hierarchy'}
      />
    )
  }
  const [before, after] = documentPair(scenario)
  return (
    <DocumentDiff
      key={arrangement}
      before={before}
      after={after}
      beforeSide={captured}
      afterSide={proposed}
      defaultArrangement={arrangement}
      title={scenario === 'split' ? 'Page split into three children' : undefined}
      {...(nestedSlots ? { renderEmbed: renderEmbedPreviews, renderProperties } : {})}
    />
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/DocumentTree',
  component: DocumentTreeGallery,
  args: { lens: 'document', scenario: 'receipt', arrangement: 'unified', nestedSlots: true },
  argTypes: {
    lens: { control: 'inline-radio', options: ['document', 'tree'] },
    scenario: {
      control: 'select',
      options: ['receipt', 'split', 'added', 'removed', 'identical', 'small', 'move'],
    },
    arrangement: { control: 'inline-radio', options: ['unified', 'split'] },
    nestedSlots: { control: 'boolean' },
  },
} satisfies Meta<typeof DocumentTreeGallery>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Re-OCR, property changes, a moved callout, a rescanned PDF (nested image lens on its
 * rendered first page) and a regenerated thumbnail flagged by a semantic-only note.
 */
export const ReceiptCombined: Story = {}
/** The combined receipt scenario in split arrangement, for eyeballing before/after parity. */
export const ReceiptSideBySide: Story = { args: { arrangement: 'split' } }
/** Built-in embed cards: PDF render thumbnail plus open link, no nested lens. */
export const ReceiptEmbedCards: Story = { args: { nestedSlots: false } }
/** Sections extracted into three child pages. */
export const PageSplit: Story = { args: { scenario: 'split', nestedSlots: false } }
/** Split arrangement over the page-split scenario: one bundle against three child pages. */
export const PageSplitSideBySide: Story = {
  args: { scenario: 'split', arrangement: 'split', nestedSlots: false },
}
/** One todo checked inside an otherwise unchanged toggle; unchanged runs fold. */
export const SmallChange: Story = { args: { scenario: 'small', nestedSlots: false } }
/** Nothing changed: the lens should report zero and collapse the whole document. */
export const Identical: Story = { args: { scenario: 'identical', nestedSlots: false } }
/** A page that exists only after: heading and body both count as added. */
export const AddedOnly: Story = { args: { scenario: 'added', nestedSlots: false } }
/** A page that exists only before, so every block is removed with no counterpart. */
export const RemovedOnly: Story = { args: { scenario: 'removed', nestedSlots: false } }
/** Receipt moves into Archive/2024, a scanner batch PDF splits into three receipt pages, a bundle into three studies. */
export const HierarchyCombined: Story = { args: { lens: 'tree', scenario: 'move' } }
/** Hover or select a moved/split node to highlight its counterpart in the other tree. */
export const HierarchySideBySide: Story = {
  args: { lens: 'tree', scenario: 'move', arrangement: 'split' },
}
/** Tree lens with the added scenario, to see add marks rendered on node rows. */
export const HierarchyAdded: Story = { args: { lens: 'tree', scenario: 'added' } }
/** Tree lens with the removed scenario: drop marks on rows with no successor. */
export const HierarchyRemoved: Story = { args: { lens: 'tree', scenario: 'removed' } }
/** Tree lens with the identical scenario: no marks at all, the baseline for the lens. */
export const HierarchyIdentical: Story = { args: { lens: 'tree', scenario: 'identical' } }
/** Both lenses in both arrangements. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 24 }}>
      <DocumentTreeGallery lens="document" scenario="receipt" arrangement="unified" nestedSlots />
      <DocumentTreeGallery lens="document" scenario="receipt" arrangement="split" nestedSlots />
      <DocumentTreeGallery lens="tree" scenario="move" arrangement="unified" nestedSlots={false} />
      <DocumentTreeGallery lens="tree" scenario="move" arrangement="split" nestedSlots={false} />
    </div>
  ),
}
