import type { Meta, StoryObj } from '@storybook/react'

import { RankedFindings } from '../blocks/kit/RankedFindings.tsx'

/**
 * Findings ranked by measured gap. Solid bars are proven (`proof` given); dashed bars are
 * hypotheses and name their next experiment. Wide spreads switch to a log axis.
 */
const meta = {
  title: 'Vista/Blocks/Kit/RankedFindings',
  component: RankedFindings,
  args: {
    findings: [
      {
        title: 'SSH relay on fresh page opens',
        icon: 'network',
        gap: 3796.668,
        unit: 'per fresh page open',
        proof: 'Relay 3.89 s vs direct 93 ms, n=3 each',
        fix: 'Use the direct Devnet path',
        cost: 'Low',
        start: true,
      },
      {
        title: 'Session inventory reads',
        icon: 'database',
        gap: 8192.084,
        unit: 'per inventory read',
        fix: 'Trace inventory; drop it from critical paths',
        next: 'Trace one inventory read end to end · ½ day',
        cost: 'Medium',
      },
      {
        title: 'Sidebar filter',
        icon: 'keyboard',
        gap: 29.5,
        unit: 'per keystroke',
        proof: 'p50 over 10 keystrokes',
        fix: 'Profile workspace/tree invalidation',
        cost: 'Medium',
      },
      {
        title: 'Host admission',
        icon: 'cpu',
        fix: 'Coordinate with host-pressure owners',
        cost: 'Medium',
      },
    ],
  },
} satisfies Meta<typeof RankedFindings>

export default meta

type Story = StoryObj<typeof meta>

/** Mixed proven and unproven findings across three decades. */
export const Default: Story = {}

/** Close values stay on a linear axis. */
export const Linear: Story = {
  args: {
    findings: [
      { title: 'Cold build', gap: 4200, proof: 'n=5', fix: 'Cache the toolchain', start: true },
      { title: 'Lockfile resolve', gap: 1900, next: 'Time resolve with a warm store' },
      { title: 'Test boot', gap: 900, proof: 'n=5' },
    ],
  },
}
