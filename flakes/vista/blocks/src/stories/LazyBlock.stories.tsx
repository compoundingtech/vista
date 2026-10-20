import type { Meta, StoryObj } from '@storybook/react'

import type { TelemetryRuntimeModule } from '../data-feed.ts'
import { LazyBlock } from '../LazyBlock.tsx'
import { metricData } from './_fixtures.ts'
import { telemetryRuntime } from './_telemetry-island.ts'

/**
 * `LazyBlock` is the generic React-19 host primitive for separately-loaded chunks
 * (decision 0046): it renders a measured skeleton, drives the chunk lifecycle by
 * hand in an effect, and owns the chunk-LOAD failure fallback. The telemetry island
 * is its first consumer, not its only one — so these stories drive it directly.
 *
 * `render`-based stories (not args) sidestep the generic `<Mod>` parameter. The
 * pure skeleton/error states use a tiny inline never-resolving / rejecting `load`
 * (no chunk needed); `IslandBacked` wires the REAL island loader + `mountMetric`.
 */
const meta = {
  title: 'Vista/Blocks/Telemetry/Lazy Block',
  component: LazyBlock,
  // Default args satisfy the generic component's required props; each story
  // overrides the visual via `render` (the generic `<Mod>` is set there).
  args: {
    load: () => new Promise<unknown>(() => {}),
    mount: () => () => undefined,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LazyBlock>

export default meta

type Story = StoryObj<typeof meta>

/** Skeleton: the chunk never resolves, so the measured placeholder holds (status: loading). */
export const Skeleton: Story = {
  render: () => (
    <LazyBlock<never>
      label="@vista/telemetry-island"
      height={220}
      load={() => new Promise<never>(() => {})}
      mount={() => () => undefined}
    />
  ),
}

/** Error fallback: the chunk LOAD rejects, so the host shows "couldn't load visualization". */
export const ErrorFallback: Story = {
  render: () => (
    <LazyBlock<never>
      label="@vista/telemetry-island"
      height={220}
      load={() => Promise.reject(new Error('chunk fetch failed'))}
      mount={() => () => undefined}
    />
  ),
}

/** Real island-backed: loads the chunk and mounts the metric viz through `mountMetric`. */
export const IslandBacked: Story = {
  render: () => (
    <LazyBlock<TelemetryRuntimeModule>
      label="metric via @vista/telemetry-island"
      height={220}
      load={telemetryRuntime.load}
      mount={(mod, el) =>
        mod.mountMetric(
          el,
          { title: metricData.series[0]!.metric, series: metricData.series },
          { onError: () => undefined },
        )
      }
    />
  ),
}
