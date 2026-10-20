import type { Meta, StoryObj } from '@storybook/react'

import { MetricBlock } from '../blocks/MetricBlock.tsx'
import { fixedFeed } from '../data-feed.ts'
import type { MetricData } from '../model.ts'
import { metricData } from './_fixtures.ts'
import { telemetryRuntime } from './_telemetry-island.ts'

const meta = {
  title: 'Vista/Blocks/Telemetry/Metric',
  component: MetricBlock,
  args: {
    id: 'metric-cpu',
    title: 'node_cpu_usage_rate{instance="dev3"}',
    dataFeed: fixedFeed(metricData),
    island: telemetryRuntime,
    caption: 'CPU usage rate rendered by the telemetry island',
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MetricBlock>

export default meta
type Story = StoryObj<typeof meta>

/** Renders the block with its default successful data feed to document the fully populated metric view. */
export const Loaded: Story = {}
/**
 * Feeds an empty series list so the block can be verified to surface a structural-empty state
 * rather than an error.
 */
export const StructuralEmpty: Story = {
  args: { id: 'metric-empty', dataFeed: fixedFeed<MetricData>({ series: [] }) },
}
/**
 * Wires a live feed whose fetch resolves to a 503 error so the block's failure treatment can be
 * inspected.
 */
export const Failed: Story = {
  args: {
    id: 'metric-error',
    dataFeed: { mode: 'live', fetch: async () => ({ _tag: 'error', message: 'tempo 503' }) },
  },
}
