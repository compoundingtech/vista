import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'
import { expect, userEvent, within } from 'storybook/test'

import type { DiffArrangement, DiffMode, DiffSide } from '../../blocks/diff/contract.ts'
import {
  ChangeLegend,
  ChangeMark,
  DiffFrame,
  useDiffArrangement,
  useDiffMode,
} from '../../blocks/diff/DiffFrame.tsx'
import { DiffSummary } from '../../blocks/diff/DiffSummary.tsx'

const observedBefore: DiffSide = {
  label: 'Before',
  provenance: 'Workspace export, 2026-09-24 18:02',
  basis: 'observed',
}
const observedAfter: DiffSide = {
  label: 'After',
  provenance: 'Workspace export, 2026-09-25 09:41',
  basis: 'observed',
}
const projectedAfter: DiffSide = {
  label: 'Dry run',
  provenance: 'Migration plan v3, not applied',
  basis: 'projected',
}

const imageModes: readonly DiffMode[] = [
  { id: 'overlay', label: 'Overlay', arrangement: 'unified' },
  { id: 'swipe', label: 'Swipe', arrangement: 'unified' },
  { id: 'difference', label: 'Difference', arrangement: 'unified' },
]

const Placeholder = ({ label }: { label: string }) => (
  <div
    style={{
      display: 'grid',
      placeItems: 'center',
      minHeight: '6rem',
      border: '1px dashed var(--ds-gray-alpha-400)',
      borderRadius: 6,
      color: 'var(--ds-gray-900)',
      fontSize: '0.8rem',
    }}
  >
    {label}
  </div>
)

/** Stand-in lens body that renders what it reads from the frame. */
const ScopeEcho = ({ name = 'lens body' }: { name?: string }) => {
  const arrangement = useDiffArrangement()
  const mode = useDiffMode()
  return (
    <Placeholder
      label={`${name} renders: ${arrangement}${mode === undefined ? '' : ` / ${mode}`}`}
    />
  )
}

/**
 * The chrome every semantic diff lens renders inside. Review axes: side provenance and
 * basis (observed vs projected, keyboard-reachable tooltips), temporal vs peer relation,
 * change summary (per-kind counts, zero kinds hidden, no changes), the Combined / Side by
 * side switch with parent inheritance, lens modes per arrangement, collapse, and nesting.
 */
const meta = {
  title: 'Vista/Blocks/Diff/DiffFrame',
  component: DiffFrame,
  args: {
    title: 'Quarterly planning notes',
    lens: 'document',
    before: observedBefore,
    after: observedAfter,
    counts: { added: 2, changed: 1, unchanged: 14 },
    children: <ScopeEcho />,
  },
  argTypes: {
    arrangement: { control: 'inline-radio', options: ['unified', 'split'] },
    relation: { control: 'inline-radio', options: ['temporal', 'peer'] },
    collapsed: { control: 'boolean' },
    nested: { control: 'boolean' },
    children: { control: false },
  },
} satisfies Meta<typeof DiffFrame>

export default meta
type Story = StoryObj<typeof meta>

/** Plain frame; the body follows the arrangement switch. */
export const Default: Story = {}

/** Every change kind present, in fixed order and consistent colors; removed counts are not struck through. */
export const AllCounts: Story = {
  args: {
    counts: { added: 3, removed: 2, changed: 5, moved: 1, unchanged: 40 },
    children: (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <ChangeLegend />
        <p style={{ margin: 0, lineHeight: 1.8 }}>
          Status went from <ChangeMark kind="removed">Draft</ChangeMark>{' '}
          <ChangeMark kind="added">Ready for review</ChangeMark>, the owner field is{' '}
          <ChangeMark kind="changed" title="was: Team A">
            Team B
          </ChangeMark>
          , the budget section{' '}
          <ChangeMark kind="moved" title="from section 2">
            moved
          </ChangeMark>{' '}
          and the <ChangeMark kind="unchanged">summary</ChangeMark> is untouched.
        </p>
        <ChangeMark kind="added" block>
          Added paragraph block
        </ChangeMark>
        <ChangeMark kind="removed" block>
          Removed paragraph block
        </ChangeMark>
        <ChangeMark kind="changed" block>
          Changed paragraph block
        </ChangeMark>
        <ChangeMark kind="moved" block title="from position 4">
          Moved paragraph block
        </ChangeMark>
        <ChangeMark kind="unchanged" block>
          Unchanged paragraph block
        </ChangeMark>
      </div>
    ),
  },
}

/** Only non-zero kinds appear; here a pure addition. */
export const AddOnly: Story = {
  args: { counts: { added: 4 } },
}

/** Nothing differs: the summary says so instead of showing zero counts. */
export const NoChanges: Story = {
  args: {
    counts: { unchanged: 18 },
    children: <Placeholder label="identical sides" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/no changes/)).toBeVisible()
  },
}

/** Observed before vs projected after: the projected chip is dashed, hatched and tagged. */
export const ProjectedVsObserved: Story = {
  args: {
    title: 'Migration dry run',
    after: projectedAfter,
    children: (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Placeholder label="observed (A) vs projected (B)" />
        <DiffFrame
          title="Both sides projected"
          lens="record"
          relation="peer"
          before={{ label: 'Plan v2', provenance: 'Superseded plan', basis: 'projected' }}
          after={{ label: 'Plan v3', provenance: 'Current plan', basis: 'projected' }}
          counts={{ changed: 2 }}
        >
          <ScopeEcho name="plan vs plan" />
        </DiffFrame>
      </div>
    ),
  },
}

/** Two candidates, neither earlier: `relation="peer"` renders `vs` instead of the before → after arrow. */
export const PeerComparison: Story = {
  args: {
    title: 'Landing hero: candidate A vs B',
    lens: 'image',
    relation: 'peer',
    before: { label: 'Candidate A', provenance: 'Render run 412, seed 7', basis: 'projected' },
    after: { label: 'Candidate B', provenance: 'Render run 412, seed 19', basis: 'projected' },
    counts: { changed: 3, unchanged: 11 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('vs')).toBeVisible()
    await expect(canvas.queryByText('→')).toBeNull()
  },
}

/** Provenance is in a tooltip reachable by keyboard focus, not a `title` attribute. */
export const ProvenanceTooltip: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chip = canvas.getByRole('img', { name: /^Before: Before/ })
    // Header tab order: collapse trigger, arrangement switch, then the side chips.
    for (let step = 0; step < 6 && document.activeElement !== chip; step++) await userEvent.tab()
    await expect(chip).toHaveFocus()
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'Workspace export, 2026-09-24 18:02',
    )
  },
}

/** Starts collapsed: header and summary only; the title is the trigger. */
export const Collapsed: Story = {
  args: { defaultCollapsed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /Quarterly planning notes/ })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText(/lens body renders/)).toBeNull()
    await expect(canvas.queryByRole('radiogroup', { name: 'Diff arrangement' })).toBeNull()
    await userEvent.click(trigger)
    await expect(canvas.getByText('lens body renders: unified')).toBeVisible()
  },
}

const ControlledCollapse = () => {
  const [collapsed, setCollapsed] = React.useState(true)
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem' }}>
        parent state: {collapsed ? 'collapsed' : 'expanded'}
      </span>
      <DiffFrame
        title="notes.md"
        lens="text"
        before={observedBefore}
        after={observedAfter}
        counts={{ added: 3, removed: 1 }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      >
        <ScopeEcho />
      </DiffFrame>
    </div>
  )
}

/** Controlled collapse: the parent owns the state. */
export const CollapsedControlled: Story = {
  render: () => <ControlledCollapse />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /notes\.md/ }))
    await expect(canvas.getByText('parent state: expanded')).toBeVisible()
  },
}

/** A document lens nesting a record lens and an image lens (with modes) in their compact variant. */
export const Nested: Story = {
  args: {
    counts: { added: 1, changed: 2, moved: 1, unchanged: 9 },
    children: (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <ChangeMark kind="added" block>
          New introduction paragraph
        </ChangeMark>
        <DiffFrame
          nested
          title="Page properties"
          lens="record"
          before={observedBefore}
          after={observedAfter}
          counts={{ changed: 1, unchanged: 6 }}
        >
          <ScopeEcho name="record lens" />
        </DiffFrame>
        <DiffFrame
          nested
          title="attachment.pdf, page 1"
          lens="image"
          before={observedBefore}
          after={observedAfter}
          counts={{ changed: 1 }}
          modes={imageModes}
        >
          <ScopeEcho name="image lens" />
        </DiffFrame>
        <ChangeMark kind="moved" block title="from after the table">
          Moved closing section
        </ChangeMark>
      </div>
    ),
  },
}

/** Nested frame on its own, as a lens would render it inside another lens body. */
export const NestedCompact: Story = {
  args: { nested: true, lens: 'image', title: 'cover.svg' },
}

/** Uncontrolled nested frames follow the parent's arrangement until switched locally. */
export const ArrangementInherited: Story = {
  args: {
    children: (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <DiffFrame
          nested
          title="Page properties"
          lens="record"
          before={observedBefore}
          after={observedAfter}
          counts={{ changed: 1 }}
        >
          <ScopeEcho name="record lens" />
        </DiffFrame>
        <DiffFrame
          nested
          title="notes.md"
          lens="text"
          before={observedBefore}
          after={observedAfter}
          counts={{ added: 2 }}
        >
          <ScopeEcho name="text lens" />
        </DiffFrame>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [outer, record] = canvas.getAllByRole('radiogroup', { name: 'Diff arrangement' })
    if (outer === undefined || record === undefined) throw new Error('expected nested switches')
    await userEvent.click(within(outer).getByRole('radio', { name: 'Side by side' }))
    await expect(canvas.getByText('record lens renders: split')).toBeVisible()
    await expect(canvas.getByText('text lens renders: split')).toBeVisible()
    await userEvent.click(within(record).getByRole('radio', { name: 'Combined' }))
    await expect(canvas.getByText('record lens renders: unified')).toBeVisible()
    await expect(canvas.getByText('text lens renders: split')).toBeVisible()
  },
}

/** Lens modes: the picker shows only modes of the active arrangement (image: none in Side by side). */
export const Modes: Story = {
  args: {
    lens: 'image',
    title: 'diagram.svg',
    counts: { changed: 1 },
    modes: imageModes,
    defaultMode: 'swipe',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('lens body renders: unified / swipe')).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: 'Difference' }))
    await expect(canvas.getByText('lens body renders: unified / difference')).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: 'Side by side' }))
    await expect(canvas.getByText('lens body renders: split')).toBeVisible()
    await expect(canvas.queryByRole('radiogroup', { name: 'Diff mode' })).toBeNull()
  },
}

const ControlledArrangement = () => {
  const [arrangement, setArrangement] = React.useState<DiffArrangement>('split')
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem' }}>parent state: {arrangement}</span>
      <DiffFrame
        title="notes.md"
        lens="text"
        before={observedBefore}
        after={observedAfter}
        counts={{ added: 3, removed: 1 }}
        arrangement={arrangement}
        onArrangementChange={setArrangement}
      >
        <ScopeEcho />
      </DiffFrame>
    </div>
  )
}

/** Controlled arrangement: the parent owns the state and the frame reports changes. */
export const ArrangementControlled: Story = {
  render: () => <ControlledArrangement />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: 'Combined' }))
    await expect(canvas.getByText('parent state: unified')).toBeVisible()
    await expect(canvas.getByText('lens body renders: unified')).toBeVisible()
  },
}

/**
 * `DiffSummary`: class-level semantic deltas ahead of the item-level lens, with a ledger
 * that reconciles the page count across the migration.
 */
export const Summary: Story = {
  args: {
    title: 'Inbox cleanup',
    lens: 'database',
    after: projectedAfter,
    counts: { added: 2, removed: 4, changed: 9, moved: 13, unchanged: 96 },
    children: (
      <DiffSummary
        title="Tasks database"
        deltas={[
          { kind: 'moved', label: 'parent: Inbox → Archive', count: 13 },
          { kind: 'changed', label: 'Status: Todo → Done', count: 9 },
          { kind: 'removed', label: 'duplicate “Weekly review” pages', count: 4 },
          { kind: 'added', label: 'recurring templates', count: 2 },
          { kind: 'changed', label: 'property renamed: Owner → Assignee' },
        ]}
        ledger={{
          unit: 'pages',
          before: { label: 'Before', value: 122 },
          steps: [
            { kind: 'removed', label: 'removed duplicates', delta: -4 },
            { kind: 'added', label: 'added templates', delta: 2 },
            { kind: 'moved', label: 'moved to Archive', delta: 0 },
            { kind: 'changed', label: 'status edits', delta: 0 },
          ],
          after: { label: 'Dry run', value: 120 },
        }}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/reconciled: every change is accounted for/)).toBeVisible()
  },
}

/** A ledger that does not add up is flagged instead of silently shown. */
export const SummaryUnreconciled: Story = {
  args: {
    title: 'Contacts import',
    lens: 'database',
    counts: { added: 40, removed: 3 },
    children: (
      <DiffSummary
        deltas={[
          { kind: 'added', label: 'imported from CSV', count: 40 },
          { kind: 'removed', label: 'merged duplicates', count: 3 },
        ]}
        ledger={{
          unit: 'rows',
          before: { label: 'Before', value: 210 },
          steps: [
            { kind: 'added', label: 'imported', delta: 40 },
            { kind: 'removed', label: 'merged', delta: -3 },
          ],
          after: { label: 'After', value: 245 },
        }}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/does not reconcile: −2 unaccounted/)).toBeVisible()
  },
}
