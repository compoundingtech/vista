import type { Meta, StoryObj } from '@storybook/react'

import { FlamegraphBlock } from '../blocks/FlamegraphBlock.tsx'
import { fixedFeed } from '../data-feed.ts'
import type { ProfileData } from '../model.ts'
import { allocProfile, cpuProfile } from './_fixtures.ts'
import { telemetryRuntime } from './_telemetry-island.ts'

const meta = {
  title: 'Vista/Blocks/Telemetry/Flamegraph',
  component: FlamegraphBlock,
  args: {
    id: 'flamegraph-cpu',
    profileTypeId: cpuProfile.profileTypeId,
    title: 'process CPU — last hour',
    dataFeed: fixedFeed(cpuProfile),
    island: telemetryRuntime,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FlamegraphBlock>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Renders the flamegraph with the default CPU profile and standard feed, the baseline
 * configuration for the block.
 */
export const Cpu: Story = {}
/**
 * Drives the block with a fixed feed of the alloc profile type under an alloc-space title, showing
 * allocation data instead of CPU samples.
 */
export const Alloc: Story = {
  args: {
    id: 'flamegraph-alloc',
    profileTypeId: allocProfile.profileTypeId,
    title: 'alloc space',
    dataFeed: fixedFeed(allocProfile),
  },
}
/**
 * Feeds a profile with no names or levels and zero totals to verify the flamegraph renders a
 * meaningful empty state rather than erroring.
 */
export const Empty: Story = {
  args: {
    id: 'flamegraph-empty',
    dataFeed: fixedFeed<ProfileData>({
      profileTypeId: cpuProfile.profileTypeId,
      names: [],
      levels: [],
      total: 0,
      maxSelf: 0,
      unit: 'ns',
    }),
  },
}
