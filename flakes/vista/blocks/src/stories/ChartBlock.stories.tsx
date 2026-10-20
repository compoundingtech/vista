import type { Meta, StoryObj } from '@storybook/react'
import { expect, waitFor } from 'storybook/test'

import { ChartBlock } from '../blocks/ChartBlock.tsx'
import { chartKindSpecs, denseChart, singlePointChart } from './_coverage-fixtures.ts'
import { latencyChart, throughputChart } from './_fixtures.ts'

/**
 * The Recharts-backed Cartesian chart. The review axes are the chart KIND
 * (line/area/bar and their stacked forms), the data SHAPE (empty, one point,
 * dense), and container width — everything else is payload.
 */
const meta = {
  title: 'Vista/Blocks/Data/Chart',
  component: ChartBlock,
  args: {
    id: 'chart-latency',
    chart: latencyChart,
    caption: 'Attach latency',
  },
  argTypes: {
    caption: { control: 'text' },
    id: { control: false },
    chart: { control: false },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChartBlock>

export default meta

type Story = StoryObj<typeof meta>

/** The default area chart (p50/p95 latency). */
export const Default: Story = {}

/**
 * Story that renders the throughput chart as a stacked bar visualization of run outcomes with a
 * caption beneath it.
 */
export const OutcomeStackedBar: Story = {
  args: {
    id: 'chart-outcomes',
    chart: throughputChart,
    caption: 'Run outcomes',
  },
}

/** Structural empty: series declared, no data — axes and legend must still be honest. */
export const EmptyChart: Story = {
  args: {
    id: 'chart-empty',
    chart: { ...latencyChart, data: [] },
    caption: 'Empty chart',
  },
}

/** Degenerate-but-valid: a single sample. */
export const SinglePoint: Story = {
  args: { id: 'chart-single', chart: singlePointChart, caption: 'One sample' },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const labels = [...canvasElement.querySelectorAll('.recharts-label')].map(
        (element) => element.textContent,
      )
      expect(labels).toContain('Captured at')
      expect(labels).toContain('Latency')
      expect(canvasElement.querySelectorAll('.recharts-line-dot').length).toBeGreaterThan(0)
    })
  },
}

/** 60 samples: x labels must thin out instead of colliding. */
export const DenseSeries: Story = {
  args: { id: 'chart-dense', chart: denseChart, caption: 'Dense series' },
}

/** Narrow column: the chart is container-queried, so it must stay legible at ~320px. */
export const NarrowColumn: Story = {
  render: () => (
    <div style={{ width: '20rem', border: '1px dashed var(--ds-gray-alpha-400)' }}>
      <ChartBlock id="chart-narrow" chart={latencyChart} caption="Attach latency (narrow)" />
    </div>
  ),
}

/** Every chart kind over one identical payload — the only variable is `kind`. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {chartKindSpecs.map((chart) => (
        <div key={chart.kind}>
          <strong>{chart.kind}</strong>
          <ChartBlock id={`chart-kind-${chart.kind}`} chart={chart} />
        </div>
      ))}
      <div>
        <strong>empty</strong>
        <ChartBlock id="chart-kind-empty" chart={{ ...latencyChart, data: [] }} />
      </div>
      <div>
        <strong>single point</strong>
        <ChartBlock id="chart-kind-single" chart={singlePointChart} />
      </div>
    </div>
  ),
}
