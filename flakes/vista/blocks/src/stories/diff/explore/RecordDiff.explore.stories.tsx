/**
 * Record lens exploration (`/sk-explore-variants`). Flip the frame's Combined / Side by side
 * switch alongside the pickers: combined puts `before → after` inline, side by side gives each
 * side its own column. The sample is a Notion-style page property set with scalar, date,
 * URL (label kept, target changed), tag list, nested object and long-text changes.
 *
 * - L row layout: L1 table, L2 compact `key: before → after` lines, L3 grouped by change kind.
 *   Current default: L1.
 * - U unchanged rows: U1 folded count, U2 dimmed inline, U3 hidden behind a toggle.
 *   Current default: U1.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import type { DiffSide } from '../../../blocks/diff/contract.ts'
import {
  RecordDiff,
  type RecordEntries,
  type RecordRowLayout,
  type RecordUnchangedRows,
} from '../../../blocks/diff/RecordDiff.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'

type LayoutId = 'L1' | 'L2' | 'L3'
type UnchangedId = 'U1' | 'U2' | 'U3'

const layoutVariants: readonly Variant<LayoutId>[] = [
  {
    id: 'L1',
    description: 'Table: Field column plus value column(s); nested lenses span the value columns.',
  },
  {
    id: 'L2',
    description:
      'Compact lines: `key: before → after`, side by side as two aligned key: value columns.',
  },
  {
    id: 'L3',
    description:
      'Grouped by change kind (changed, added, removed, moved, unchanged), one table each.',
  },
]
const unchangedVariants: readonly Variant<UnchangedId>[] = [
  { id: 'U1', description: 'Runs of 2+ unchanged rows fold into an `N unchanged` disclosure.' },
  { id: 'U2', description: 'Every row shown in place; unchanged rows dimmed.' },
  { id: 'U3', description: 'Unchanged rows hidden; one toggle reveals all of them.' },
]

const rowLayout: Readonly<Record<LayoutId, RecordRowLayout>> = {
  L1: 'table',
  L2: 'lines',
  L3: 'grouped',
}
const unchangedRows: Readonly<Record<UnchangedId, RecordUnchangedRows>> = {
  U1: 'fold',
  U2: 'dim',
  U3: 'hide',
}

const before: DiffSide = {
  label: 'Live page',
  provenance: 'Synthetic Notion API page properties · 2026-09-25 20:10',
  basis: 'observed',
}
const after: DiffSide = {
  label: 'After sync',
  provenance: 'Synthetic projected end state · dry run',
  basis: 'projected',
}

const summaryBefore =
  'Weekly intake of archival parcels. Each parcel is checked against the ledger, photographed when damaged, and shelved by the receiving clerk.'
const summaryAfter =
  'Twice-weekly intake of archival parcels. Each parcel is scanned into the intake system, photographed when damaged, and placed in a numbered bay by the receiving clerk.'

const recordBefore: RecordEntries = {
  title: { _tag: 'text', value: 'Parcel intake protocol' },
  status: { _tag: 'text', value: 'Draft' },
  owner: { _tag: 'text', value: 'A. Reader' },
  department: { _tag: 'text', value: 'Archive' },
  created: { _tag: 'date', value: '2026-08-02T09:14:00Z' },
  reviewDue: { _tag: 'date', value: '2026-10-01' },
  pages: { _tag: 'number', value: 12 },
  storage: { _tag: 'number', value: 2.4, unit: 'GB' },
  published: { _tag: 'boolean', value: false },
  tags: {
    _tag: 'list',
    items: [
      { _tag: 'text', value: 'operations' },
      { _tag: 'text', value: 'incoming' },
      { _tag: 'text', value: 'archive' },
    ],
  },
  source: { _tag: 'url', value: 'https://wiki.example.org/archive/intake', label: 'Intake wiki' },
  runbook: { _tag: 'url', value: 'https://runbooks.example.org/parcel-intake' },
  summary: { _tag: 'text', value: summaryBefore },
  location: {
    _tag: 'object',
    entries: {
      building: { _tag: 'text', value: 'North annex' },
      floor: { _tag: 'number', value: 2 },
      room: { _tag: 'text', value: '2.14' },
    },
  },
  legacyId: { _tag: 'text', value: 'PKT-12' },
}
const recordAfter: RecordEntries = {
  title: { _tag: 'text', value: 'Parcel intake protocol' },
  status: { _tag: 'text', value: 'In review' },
  owner: { _tag: 'text', value: 'A. Reader' },
  department: { _tag: 'text', value: 'Archive' },
  created: { _tag: 'date', value: '2026-08-02T09:14:00Z' },
  reviewDue: { _tag: 'date', value: '2026-10-15' },
  pages: { _tag: 'number', value: 14 },
  storage: { _tag: 'number', value: 2.4, unit: 'GB' },
  published: { _tag: 'boolean', value: false },
  tags: {
    _tag: 'list',
    items: [
      { _tag: 'text', value: 'archive' },
      { _tag: 'text', value: 'operations' },
      { _tag: 'text', value: 'reviewed' },
    ],
  },
  source: {
    _tag: 'url',
    value: 'https://wiki.example.org/archive/intake-v2',
    label: 'Intake wiki',
  },
  runbook: { _tag: 'url', value: 'https://runbooks.example.org/parcel-intake' },
  summary: { _tag: 'text', value: summaryAfter },
  location: {
    _tag: 'object',
    entries: {
      building: { _tag: 'text', value: 'North annex' },
      floor: { _tag: 'number', value: 3 },
      room: { _tag: 'text', value: '3.02' },
    },
  },
  retentionYears: { _tag: 'number', value: 7 },
}

const RecordExploration = () => {
  const [layoutId, setLayoutId] = React.useState<LayoutId>('L1')
  const [unchangedId, setUnchangedId] = React.useState<UnchangedId>('U1')
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Row layout"
          variants={layoutVariants}
          value={layoutId}
          onChange={setLayoutId}
        />
        <VariantPicker
          label="Unchanged rows"
          variants={unchangedVariants}
          value={unchangedId}
          onChange={setUnchangedId}
        />
      </VariantPanel>
      <RecordDiff
        title="Parcel intake protocol · page properties"
        before={before}
        after={after}
        beforeRecord={recordBefore}
        afterRecord={recordAfter}
        rowLayout={rowLayout[layoutId]}
        unchanged={unchangedRows[unchangedId]}
      />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/RecordDiff',
  component: RecordExploration,
} satisfies Meta
export default meta

/** Pick L/U variants above the live record lens. */
export const Exploration: StoryObj = { render: () => <RecordExploration /> }
