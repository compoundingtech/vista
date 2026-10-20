import type { Meta, StoryObj } from '@storybook/react'

import { Callout } from '../blocks/content.tsx'
import { SnapshotBadge } from '../blocks/SnapshotBadge.tsx'
import { SnapshotModeView } from '../blocks/SnapshotModeView.tsx'

/**
 * The one canonical snapshot-mode badge. Both worlds that surface the mode —
 * `SnapshotModeView` (bespoke apps, publish-time projection) and the kit
 * telemetry frame — render THIS component, so its three tones are the whole
 * vocabulary. Review axes: mode, the `frozen`-only `as of` detail, and
 * adjacency inside a real block header.
 *
 * `asOf` renders as local wall-clock time, so its rendered text depends on the
 * viewer's timezone; the fixture instant itself is fixed.
 */
const meta = {
  title: 'Vista/Blocks/Data/Snapshot Badge',
  component: SnapshotBadge,
  args: { mode: 'frozen', asOf: '2026-01-01T14:32:07Z' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['live', 'frozen', 'unsupported'] },
    asOf: { control: 'text' },
    style: { control: false },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SnapshotBadge>

export default meta

type Story = StoryObj<typeof meta>

/** Frozen with a valid `as of` instant. */
export const Default: Story = {}

/** Shows the pill in live mode with no as-of instant, representing continuously fresh data. */
export const Live: Story = { args: { mode: 'live', asOf: null } }

/**
 * Shows the badge in unsupported mode to verify the fallback presentation when a snapshot mode
 * cannot be honoured.
 */
export const Unsupported: Story = { args: { mode: 'unsupported', asOf: null } }

/** Frozen without an instant: the bare pill, no dangling separator. */
export const FrozenWithoutAsOf: Story = { args: { mode: 'frozen', asOf: null } }

/** An unparseable `asOf` must degrade to the bare pill, never print `Invalid Date`. */
export const FrozenInvalidAsOf: Story = { args: { mode: 'frozen', asOf: 'not-a-timestamp' } }

/** `asOf` is honoured only for `frozen` — live/unsupported ignore it. */
export const AsOfIgnoredOffFrozen: Story = {
  args: { mode: 'live', asOf: '2026-01-01T14:32:07Z' },
}

/** In place: the badge sitting against kit surfaces and inside its own view. */
export const InContext: Story = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}
    >
      <Callout
        id="badge-adjacent-callout"
        kind="finding"
        title="Adjacent kit block"
        body="The badge tone must read as part of this surface in light and dark."
      />
      <SnapshotBadge mode="frozen" asOf="2026-01-01T14:32:07Z" />
      <SnapshotModeView mode={{ _tag: 'frozen', asOf: '2026-01-01T14:32:07Z' }} />
    </div>
  ),
}

/** The entire badge vocabulary, so no tone can drift from the others. */
export const AllStates: Story = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}
    >
      <SnapshotBadge mode="live" />
      <SnapshotBadge mode="frozen" asOf="2026-01-01T14:32:07Z" />
      <SnapshotBadge mode="frozen" />
      <SnapshotBadge mode="frozen" asOf="not-a-timestamp" />
      <SnapshotBadge mode="unsupported" />
    </div>
  ),
}
