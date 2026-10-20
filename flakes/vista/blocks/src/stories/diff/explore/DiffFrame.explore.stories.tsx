/**
 * Exploration for the shared `DiffFrame` chrome.
 *
 * Dimensions (decided default in brackets):
 * - H header density [H2]: how much of the before/after provenance the header spends rows on.
 * - S summary style [S1]: how per-kind change counts are read at a glance.
 * - A arrangement switch [A3]: where the Combined / Side by side choice lives and how nested frames get it.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import type { ChangeKind, DiffMode, DiffSide } from '../../../blocks/diff/contract.ts'
import {
  ChangeMark,
  DiffFrame,
  DiffPage,
  type DiffFrameVariants,
  Unstable_DiffFrameVariants,
  useDiffArrangement,
  useDiffMode,
} from '../../../blocks/diff/DiffFrame.tsx'
import { DiffSummary } from '../../../blocks/diff/DiffSummary.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'

type HeaderId = 'H1' | 'H2' | 'H3'
type SummaryId = 'S1' | 'S2' | 'S3'
type ArrangementId = 'A1' | 'A2' | 'A3'

const headerVariants: readonly Variant<HeaderId>[] = [
  {
    id: 'H1',
    description:
      'Two rows: title + counts + switch, then A → B chips with provenance printed inline.',
  },
  {
    id: 'H2',
    description: 'One compact row: sides as label-only chips inline, provenance in their tooltips.',
  },
  {
    id: 'H3',
    description:
      'Minimal: title + counts only; sides live behind one “A → B” handle (hover/focus).',
  },
]
const summaryVariants: readonly Variant<SummaryId>[] = [
  { id: 'S1', description: 'Tinted pill per change kind with count and word.' },
  { id: 'S2', description: 'Git-style +N −N ~N ↔N monospace text in kind colors.' },
  {
    id: 'S3',
    description: 'Proportional change bar (unchanged as the gray remainder) + “N/M changed”.',
  },
]
const arrangementVariants: readonly Variant<ArrangementId>[] = [
  {
    id: 'A1',
    description:
      'Segmented “Combined | Side by side” text toggle at the header right of every frame.',
  },
  { id: 'A2', description: 'Icon-only toggle per frame, labels in tooltips; saves header width.' },
  {
    id: 'A3',
    description:
      'One page-level toggle; frames drop their own switch and inherit it (modes stay per frame).',
  },
]

const headerById: Readonly<Record<HeaderId, DiffFrameVariants['header']>> = {
  H1: 'stacked',
  H2: 'inline',
  H3: 'minimal',
}
const summaryById: Readonly<Record<SummaryId, DiffFrameVariants['summary']>> = {
  S1: 'pills',
  S2: 'git',
  S3: 'bar',
}
/** A3 keeps the segmented style; the enclosing `DiffPage` hides per-frame switches. */
const switcherById: Readonly<Record<ArrangementId, DiffFrameVariants['switcher']>> = {
  A1: 'segmented',
  A2: 'icons',
  A3: 'segmented',
}

const liveBefore: DiffSide = {
  label: 'Live workspace',
  provenance: 'Notion API block tree, 2026-09-25 20:10',
  basis: 'observed',
}
const dryRunAfter: DiffSide = {
  label: 'Dry run',
  provenance: 'Cleanup plan v3, not applied',
  basis: 'projected',
}
const snapshotBefore: DiffSide = {
  label: 'gen 78',
  provenance: 'Nightly snapshot, 2026-09-24 02:00',
  basis: 'observed',
}
const snapshotAfter: DiffSide = {
  label: 'gen 79',
  provenance: 'Nightly snapshot, 2026-09-25 02:00',
  basis: 'observed',
}

const imageModes: readonly DiffMode[] = [
  { id: 'overlay', label: 'Overlay', arrangement: 'unified' },
  { id: 'swipe', label: 'Swipe', arrangement: 'unified' },
  { id: 'difference', label: 'Difference', arrangement: 'unified' },
]

/** Stand-in body that shows which arrangement / mode it would render. */
const BodyStub = ({ lines }: { lines: readonly { kind: ChangeKind; text: string }[] }) => {
  const arrangement = useDiffArrangement()
  const mode = useDiffMode()
  const column = (side: 'before' | 'after') =>
    lines
      .filter((line) => (side === 'before' ? line.kind !== 'added' : line.kind !== 'removed'))
      .map((line) => (
        <ChangeMark key={`${line.kind}:${line.text}`} kind={line.kind} block>
          {line.text}
        </ChangeMark>
      ))
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <span
        style={{
          fontSize: '0.7rem',
          color: 'var(--ds-gray-900)',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        body: {arrangement}
        {mode === undefined ? '' : ` / ${mode}`}
      </span>
      {arrangement === 'split' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem', alignContent: 'start' }}>
            {column('before')}
          </div>
          <div style={{ display: 'grid', gap: '0.25rem', alignContent: 'start' }}>
            {column('after')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          {lines.map((line) => (
            <ChangeMark key={`${line.kind}:${line.text}`} kind={line.kind} block>
              {line.text}
            </ChangeMark>
          ))}
        </div>
      )}
    </div>
  )
}

const Page = () => (
  <div style={{ display: 'grid', gap: '1rem' }}>
    <DiffFrame
      title="Inbox cleanup"
      lens="database"
      before={liveBefore}
      after={dryRunAfter}
      counts={{ added: 2, removed: 4, changed: 9, moved: 13, unchanged: 96 }}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <DiffSummary
          deltas={[
            { kind: 'moved', label: 'parent: Inbox → Archive', count: 13 },
            { kind: 'changed', label: 'Status: Todo → Done', count: 9 },
            { kind: 'removed', label: 'duplicate “Weekly review” pages', count: 4 },
            { kind: 'added', label: 'recurring templates', count: 2 },
          ]}
        />
        <DiffFrame
          nested
          title="Weekly review · properties"
          lens="record"
          before={liveBefore}
          after={dryRunAfter}
          counts={{ changed: 2, unchanged: 7 }}
        >
          <BodyStub
            lines={[
              { kind: 'changed', text: 'Status: Todo → Done' },
              { kind: 'changed', text: 'Parent: Inbox → Archive' },
              { kind: 'unchanged', text: 'Owner: Johannes' },
            ]}
          />
        </DiffFrame>
        <DiffFrame
          nested
          title="whiteboard.png"
          lens="image"
          before={liveBefore}
          after={dryRunAfter}
          counts={{ changed: 1 }}
          modes={imageModes}
        >
          <BodyStub lines={[{ kind: 'changed', text: '[image: 3 regions differ]' }]} />
        </DiffFrame>
      </div>
    </DiffFrame>
    <DiffFrame
      title="README.md"
      lens="text"
      before={snapshotBefore}
      after={snapshotAfter}
      counts={{ added: 3, removed: 1, changed: 1, unchanged: 42 }}
    >
      <BodyStub
        lines={[
          { kind: 'unchanged', text: '## Setup' },
          { kind: 'removed', text: 'Run `make install`.' },
          { kind: 'added', text: 'Run `nix develop`, then `dt setup`.' },
          { kind: 'changed', text: 'Requires Node 22 (was 20).' },
          { kind: 'added', text: '## Troubleshooting' },
        ]}
      />
    </DiffFrame>
    <DiffFrame
      title="Landing hero"
      lens="image"
      relation="peer"
      before={{ label: 'Candidate A', provenance: 'Render run 412, seed 7', basis: 'projected' }}
      after={{ label: 'Candidate B', provenance: 'Render run 412, seed 19', basis: 'projected' }}
      counts={{ changed: 3, unchanged: 11 }}
      modes={imageModes}
      defaultCollapsed
    >
      <BodyStub
        lines={[{ kind: 'changed', text: '[image: headline, CTA and hero crop differ]' }]}
      />
    </DiffFrame>
  </div>
)

const ExplorationView = () => {
  const [header, setHeader] = React.useState<HeaderId>('H2')
  const [summary, setSummary] = React.useState<SummaryId>('S1')
  const [arrangement, setArrangement] = React.useState<ArrangementId>('A3')
  const variants = React.useMemo<DiffFrameVariants>(
    () => ({
      header: headerById[header],
      summary: summaryById[summary],
      switcher: switcherById[arrangement],
    }),
    [header, summary, arrangement],
  )
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Header density"
          variants={headerVariants}
          value={header}
          onChange={setHeader}
        />
        <VariantPicker
          label="Summary style"
          variants={summaryVariants}
          value={summary}
          onChange={setSummary}
        />
        <VariantPicker
          label="Arrangement switch"
          variants={arrangementVariants}
          value={arrangement}
          onChange={setArrangement}
        />
      </VariantPanel>
      <Unstable_DiffFrameVariants value={variants}>
        {arrangement === 'A3' ? (
          <DiffPage>
            <Page />
          </DiffPage>
        ) : (
          <Page />
        )}
      </Unstable_DiffFrameVariants>
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/DiffFrame',
  component: ExplorationView,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta

/** Live pickers for header density, summary style and where the arrangement switch lives, shown inside a live DiffFrame. */
export const Exploration: StoryObj<typeof meta> = {
  render: () => <ExplorationView />,
}
