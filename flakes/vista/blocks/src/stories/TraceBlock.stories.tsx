import type { Meta, StoryObj } from '@storybook/react'

import { TraceBlock } from '../blocks/TraceBlock.tsx'
import { fixedFeed } from '../data-feed.ts'
import type { TraceData } from '../model.ts'
import { checkoutTrace, partialTrace } from './_fixtures.ts'
import { telemetryRuntime } from './_telemetry-island.ts'

const meta = {
  title: 'Vista/Blocks/Telemetry/Trace',
  component: TraceBlock,
  args: {
    id: 'trace-checkout',
    traceId: checkoutTrace.traceId,
    title: 'POST /v1/checkout',
    dataFeed: fixedFeed(checkoutTrace),
    island: telemetryRuntime,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TraceBlock>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Baseline story rendering the trace viewer with the built-in checkout fixture and its default
 * data feed.
 */
export const Checkout: Story = {}
/**
 * Drives the block with a fixed feed of a partially received trace to exercise its in-progress
 * rendering contract.
 */
export const Partial: Story = {
  args: {
    id: 'trace-partial',
    traceId: partialTrace.traceId,
    dataFeed: fixedFeed(partialTrace),
  },
}
/** Supplies a fixed feed whose trace has no spans to verify the empty-trace presentation. */
export const Empty: Story = {
  args: {
    id: 'trace-empty',
    traceId: 'empty-trace',
    dataFeed: fixedFeed<TraceData>({ traceId: 'empty-trace', spans: [] }),
  },
}
