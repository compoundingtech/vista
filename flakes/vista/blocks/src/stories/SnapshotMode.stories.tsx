import type { Meta, StoryObj } from '@storybook/react'

import { SnapshotModeView } from '../blocks/SnapshotModeView.tsx'

/**
 * The shared snapshot-mode presentation (decisions 0007/0029/0068). A published
 * review resolves to one of three render outcomes in the browser
 * (`resolveSnapshotMode`); each story pins one so the honest badge / fail-closed
 * notice can be reviewed in isolation, and `AllModes` shows them together. The
 * `Unsupported*` variants prove decision 0068: a present-but-unreadable snapshot is
 * always VISIBLE (a notice), never silently rendered live.
 */
const meta = {
  title: 'Vista/Blocks/Data/Snapshot Mode',
  component: SnapshotModeView,
  args: { mode: { _tag: 'frozen', asOf: '2026-01-01T14:32:07Z' } },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SnapshotModeView>

export default meta

type Story = StoryObj<typeof meta>

/** Draft (`absent`) → rendered against the live provider: the green LIVE badge. */
export const Live: Story = {
  args: { mode: { _tag: 'live' } },
}

/** A published, current-version snapshot: the blue FROZEN badge with its `as of` time. */
export const Frozen: Story = {
  args: { mode: { _tag: 'frozen', asOf: '2026-01-01T14:32:07Z' } },
}

/** Version skew: a present snapshot written under an older contract, with its declared apiVersion. */
export const UnsupportedSkew: Story = {
  args: { mode: { _tag: 'unsupported', reason: 'skew', found: 0 } },
}

/** Malformed: a present, current-version envelope whose payload is not a well-formed snapshot (no apiVersion to show). */
export const UnsupportedMalformed: Story = {
  args: { mode: { _tag: 'unsupported', reason: 'malformed' } },
}

/** Load failure: absence is unconfirmed, so the review fails closed instead of rendering live. */
export const Unavailable: Story = {
  args: { mode: { _tag: 'unavailable' } },
}

/** Picker: every mode side by side, so the badge vocabulary reads as one system. */
export const AllModes: Story = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'flex-start' }}
    >
      <SnapshotModeView mode={{ _tag: 'live' }} />
      <SnapshotModeView mode={{ _tag: 'frozen', asOf: '2026-01-01T14:32:07Z' }} />
      <SnapshotModeView mode={{ _tag: 'unsupported', reason: 'skew', found: 0 }} />
      <SnapshotModeView mode={{ _tag: 'unsupported', reason: 'malformed' }} />
      <SnapshotModeView mode={{ _tag: 'unavailable' }} />
    </div>
  ),
}
