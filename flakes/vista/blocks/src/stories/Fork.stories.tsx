import type { Meta, StoryObj } from '@storybook/react'

import { Fork } from '../blocks/doctrine.tsx'
import type { ForkBranch } from '../model.ts'
import { forkBranches } from './_fixtures.ts'

const drivers = ['survives-viewer-failure', 'clean-teardown', 'visual-tui-fidelity']

const twoBranch: readonly ForkBranch[] = [
  {
    id: 'branch-two-chosen',
    label: 'A',
    name: 'Supervised PTY + disposable viewer',
    thesis: 'Root the provider under a supervisor; the viewer attaches and may die freely.',
    verdict: 'chosen',
    why: 'Survives viewer crashes and reaps the provider group on shutdown.',
    pros: ['viewer failure is non-fatal', 'clean process-group teardown'],
  },
  {
    id: 'branch-two-rejected',
    label: 'B',
    name: 'Inline viewer owns the provider',
    thesis: 'The viewer spawns and owns the provider directly — no supervisor.',
    verdict: 'rejected',
    why: 'A viewer crash orphans the provider and its esbuild children.',
    failedDrivers: ['survives-viewer-failure', 'clean-teardown'],
    proofRef: 'set-process-group',
    cons: ['orphaned children on crash'],
  },
]

const meta = {
  title: 'Vista/Blocks/Doctrine/Fork',
  component: Fork,
  args: {
    id: 'fork-viewer-composition',
    axis: 'Viewer/provider composition',
    drivers,
    branches: forkBranches,
  },
} satisfies Meta<typeof Fork>

export default meta

type Story = StoryObj<typeof meta>

/** Renders a baseline fork decision using the stock axis, drivers, and branch set. */
export const Default: Story = {}

/**
 * Stacks several fork renderings, including a three-branch decision with one chosen and two
 * rejected, so every outcome shape can be reviewed together.
 */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <strong>Three branches (one chosen, two rejected)</strong>
        <Fork
          id="fork-three"
          axis="Viewer/provider composition"
          drivers={drivers}
          branches={forkBranches}
        />
      </div>
      <div>
        <strong>Two branches (chosen vs rejected)</strong>
        <Fork
          id="fork-two"
          axis="Viewer/provider composition"
          drivers={drivers}
          branches={twoBranch}
        />
      </div>
    </div>
  ),
}
