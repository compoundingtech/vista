import type { Meta, StoryObj } from '@storybook/react'

import { DecisionLog } from '../blocks/content.tsx'
import type { DecisionLogProps } from '../blocks/content.tsx'
import { decisionLogEntries } from './_fixtures.ts'

/**
 * The reported defect: a long decision title squeezes the status column until
 * `awaiting-sign-off` splits across lines. Kept as a story so the regression is
 * visible in the narrow (card) layout as well as the desktop table.
 */
const longTitleEntries: DecisionLogProps['entries'] = [
  {
    id: 'dl-long-title',
    title:
      'Terminate the supervised provider on visual-TUI failure instead of leaking its process group to the operator session',
    status: 'awaiting-sign-off',
    summary:
      'A post-launch failure must terminate the whole group. Leaking a detached provider onto the operator session was the original incident, so the viewer never inherits children it cannot reap.',
  },
  {
    id: 'dl-long-grace',
    title: 'Bounded graceful shutdown with an operator-visible reap counter',
    status: 'awaiting-sign-off',
    summary: '5s grace, then SIGKILL the group; the counter surfaces reaps that overran the grace.',
  },
  {
    id: 'dl-long-projection',
    title: 'Pluggable projection adapter',
    status: 'open',
    summary:
      'Per-host adapter versus a single tmux implementation; unresolved until the PTY spike.',
  },
]

/** Every status present at once, for pill-contrast review. */
const allStatusEntries: DecisionLogProps['entries'] = [
  { id: 'dl-s-locked', title: 'Locked', status: 'locked', summary: 'Settled and load-bearing.' },
  {
    id: 'dl-s-awaiting',
    title: 'Awaiting sign-off',
    status: 'awaiting-sign-off',
    summary: 'Implemented, pending human confirmation.',
  },
  { id: 'dl-s-open', title: 'Open', status: 'open', summary: 'Still being argued.' },
]

const meta = {
  title: 'Vista/Blocks/Doctrine/Decision Log',
  component: DecisionLog,
  args: { id: 'decision-log', entries: decisionLogEntries },
} satisfies Meta<typeof DecisionLog>

export default meta

type Story = StoryObj<typeof meta>

/** Story that renders the decision log with its default fixture entries and no overriding arguments. */
export const Default: Story = {}

/**
 * Story that feeds entries with oversized titles to verify long text wraps or truncates without
 * breaking the log layout.
 */
export const LongTitles: Story = {
  args: { id: 'dl-long', entries: longTitleEntries },
}

/** Story that includes one entry per status value so every status badge and its styling is exercised. */
export const AllStatuses: Story = {
  args: { id: 'dl-status', entries: allStatusEntries },
}

/** Narrow container: the table must fold into cards, not scroll into illegibility. */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: '22rem', maxWidth: '100%' }}>
      <DecisionLog id="dl-narrow" entries={longTitleEntries} />
    </div>
  ),
}

/**
 * Renders the decision log with zero entries to verify it shows an intentional empty state instead
 * of a bare list.
 */
export const Empty: Story = {
  args: { entries: [] },
}

/** A single unresolved entry — the state a fresh review starts in. */
export const SingleOpen: Story = {
  args: {
    id: 'dl-single',
    entries: [
      {
        id: 'dl-single-open',
        title: 'Projection adapter shape',
        status: 'open',
        summary: 'No option has survived review yet.',
      },
    ],
  },
}

/**
 * Stacks the populated log with all statuses, a long-title case whose status pill must not split,
 * and other variants in one column for side-by-side review.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Populated (locked / awaiting / open statuses)</strong>
        <DecisionLog id="dl-all" entries={decisionLogEntries} />
      </div>
      <div>
        <strong>Long titles (status pill must not split)</strong>
        <DecisionLog id="dl-all-long" entries={longTitleEntries} />
      </div>
      <div>
        <strong>Narrow container (card layout)</strong>
        <div style={{ width: '22rem', maxWidth: '100%' }}>
          <DecisionLog id="dl-all-narrow" entries={longTitleEntries} />
        </div>
      </div>
      <div>
        <strong>Single open entry</strong>
        <DecisionLog
          id="dl-all-single"
          entries={[
            {
              id: 'dl-all-single-open',
              title: 'Projection adapter shape',
              status: 'open',
              summary: 'No option has survived review yet.',
            },
          ]}
        />
      </div>
      <div>
        <strong>Empty</strong>
        <DecisionLog id="dl-empty" entries={[]} />
      </div>
    </div>
  ),
}
