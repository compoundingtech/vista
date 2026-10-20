import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { LivePtyView } from '../blocks/LivePtyView.tsx'
import type { ScreenState } from '../provider-contracts.ts'

const screen: ScreenState = {
  _tag: 'ScreenState',
  cursor: 'frame-42',
  seq: 42,
  columns: 80,
  rowCount: 24,
  rows: [
    'Vista LivePty',
    '',
    '$ printf "snapshot first; live next\\n"',
    'snapshot first; live next',
    '$ _',
  ],
  cursorX: 2,
  cursorY: 4,
  observedAt: '2026-09-20T12:00:00.000Z',
}

const largeScreen: ScreenState = {
  _tag: 'ScreenState',
  cursor: 'frame-183x101',
  seq: 183_101,
  columns: 183,
  rowCount: 101,
  rows: Array.from({ length: 101 }, (_, index) => {
    const row = String(index + 1).padStart(3, '0')
    return `${row}  Vista LivePty large-geometry proof  │  ${'active session · '.repeat(7)}`
  }),
  cursorX: 0,
  cursorY: 100,
  observedAt: '2026-09-22T12:00:00.000Z',
}

const meta = {
  title: 'Vista/Blocks/LivePty',
  component: LivePtyView,
  args: {
    actorSource: 'none',
    id: 'livepty-story',
    sessionId: 'dotfiles.vista-livepty.demo',
    state: screen,
    provenance: 'Live',
    attached: false,
    pending: false,
    height: 320,
    onToggleAttach: () => undefined,
    onData: () => undefined,
  },
} satisfies Meta<typeof LivePtyView>

export default meta
type Story = StoryObj<typeof LivePtyView>

/**
 * Renders the terminal with default args, actor source none and no attachment, to document its
 * resting read-only appearance.
 */
export const ReadOnly: Story = {}

/**
 * Pins a 420px height against the large-screen fixture to verify the terminal stretches to full
 * width and height of its container.
 */
export const FitWidthFullHeight: Story = {
  args: {
    sessionId: 'r7ntz6aw-size-fixture',
    state: largeScreen,
    height: 420,
  },
}

/**
 * Uses the same fixed-height fixture, but the play function turns the viewport toggle on so the
 * pane must scroll content internally.
 */
export const FixedHeightInternalScroll: Story = {
  args: {
    sessionId: 'r7ntz6aw-size-fixture',
    state: largeScreen,
    height: 420,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = await canvas.findByRole('button', {
      name: /terminal viewport/,
    })
    if (toggle.getAttribute('aria-pressed') === 'false') await userEvent.click(toggle)
    await expect(canvas.getByTestId('livepty-viewport')).toHaveAttribute(
      'data-viewport-mode',
      'scroll',
    )
  },
}

/**
 * Supplies a loopback actor source so the attach affordance is present but the session is not yet
 * engaged.
 */
export const AttachEnabled: Story = {
  args: { actorSource: 'loopback-dev' },
}

/**
 * Shows the attached state where the loopback actor is connected, demonstrating the interactive
 * session affordances.
 */
export const Attached: Story = {
  args: { actorSource: 'loopback-dev', attached: true },
}

/**
 * Simulates a dropped live stream so the frozen provenance badge, error message, and last captured
 * viewport remain visible together.
 */
export const DegradedFrozen: Story = {
  args: {
    provenance: 'Frozen',
    error: 'The live stream disconnected. The captured viewport remains visible.',
  },
}

/**
 * Renders the read-only, attached, and frozen variants in a single grid so all LivePty states can
 * be compared at once.
 */
export const AllStates: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 16 }}>
      <LivePtyView
        {...args}
        id="livepty-readonly"
        actorSource="none"
        attached={false}
        provenance="Live"
      />
      <LivePtyView
        {...args}
        id="livepty-attach-enabled"
        actorSource="loopback-dev"
        attached={false}
        provenance="Live"
      />
      <LivePtyView
        {...args}
        id="livepty-attached"
        actorSource="loopback-dev"
        attached
        provenance="Live"
      />
      <LivePtyView
        {...args}
        id="livepty-frozen"
        attached={false}
        provenance="Frozen"
        error="The live stream disconnected. The captured viewport remains visible."
      />
    </div>
  ),
}
