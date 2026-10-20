import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ChartSpec } from '../model.ts'
import { ChartBlock } from './ChartBlock.tsx'

const singlePointChart: ChartSpec = {
  title: 'Request latency',
  kind: 'line',
  xLabel: 'Captured at',
  yLabel: 'Latency',
  unit: 'ms',
  series: [{ key: 'p50', label: 'p50' }],
  data: [{ label: '12:00', values: { p50: 82 } }],
}

const sixSeriesChart: ChartSpec = {
  title: 'Usage',
  kind: 'line',
  xLabel: 'Day',
  yLabel: 'API-equivalent USD',
  unit: 'USD',
  series: Array.from({ length: 6 }, (_unused, index) => ({
    key: `series-${String(index + 1)}`,
    label: `Series ${String(index + 1)}`,
  })),
  data: [
    {
      label: '2026-09-21',
      values: Object.fromEntries(
        Array.from({ length: 6 }, (_unused, index) => [`series-${String(index + 1)}`, index + 1]),
      ),
    },
    {
      label: '2026-09-22',
      values: Object.fromEntries(
        Array.from({ length: 6 }, (_unused, index) => [`series-${String(index + 1)}`, index + 2]),
      ),
    },
  ],
}
describe('ChartBlock', () => {
  it('exposes authored axis meaning and singleton evidence without requiring the graphic', () => {
    const html = renderToStaticMarkup(
      <ChartBlock id="single-point" chart={singlePointChart} caption="Latency evidence" />,
    )

    expect(html).toContain('Captured at')
    expect(html).toContain('Latency')
    expect(html).toContain('Chart data · 1 observation')
    expect(html).toContain('aria-label="Latency evidence data"')
    expect(html).toContain('82 ms')
  })

  it('exposes all six series as named evidence columns', () => {
    const html = renderToStaticMarkup(<ChartBlock id="six-series" chart={sixSeriesChart} />)

    expect(html).toContain('aria-label="Usage data"')
    for (const series of sixSeriesChart.series) {
      expect(html).toContain(`>${series.label}</th>`)
    }
    expect(html).toContain('API-equivalent USD by Day')
  })
})
