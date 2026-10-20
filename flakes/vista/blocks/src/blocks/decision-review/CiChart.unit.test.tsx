import { describe, it, live } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect } from 'vitest'

import { CiChart } from './CiChart.tsx'
import { roundToCi } from './precision.ts'

const precisionCase = Schema.Struct({
  exponent: Schema.Int.check(Schema.isBetween({ minimum: -12, maximum: 12 })),
  widthMantissa: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 9 })),
  center: Schema.Int.check(Schema.isBetween({ minimum: -100_000, maximum: 100_000 })),
})

describe('roundToCi', () => {
  it('rounds all interval values to the width’s leading decimal place', () => {
    expect(roundToCi(12.3456, 10.1, 14.6)).toBe('12')
    expect(roundToCi(12.3456, 12.21, 12.49)).toBe('12.3')
    expect(roundToCi(12345.678, 12000, 15000)).toBe('12000')
    expect(roundToCi(-0.009876, -0.0102, -0.0095)).toBe('-0.0099')
    expect(roundToCi(0.9, 0, 1)).toBe('1')
    expect(roundToCi(-0.01, -1, 1)).toBe('0')
  })

  it('does not invent precision for an absent or invalid interval', () => {
    expect(roundToCi(1.234567, 1.234567, 1.234567)).toBe('—')
    expect(roundToCi(1, 2, 0)).toBe('—')
    expect(roundToCi(Number.NaN, 0, 2)).toBe('—')
    expect(roundToCi(1, 0, Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('preserves supported precision at very small and large magnitudes', () => {
    expect(roundToCi(1.23456e-20, 1.1e-20, 1.3e-20)).toBe('1.2e-20')
    expect(roundToCi(1.23456e24, 1.1e24, 1.3e24)).toBe('1.2e+24')
    expect(roundToCi(Number.MIN_VALUE, 0, Number.MIN_VALUE)).toBe('5e-324')
  })

  live.prop(
    'never displays a digit finer than the confidence interval width supports',
    [precisionCase],
    ([{ exponent, widthMantissa, center }]) =>
      Effect.sync(() => {
        const scale = 10 ** exponent
        const point = (center + 0.123456789) * scale
        const lo = point - (widthMantissa * scale) / 2
        const hi = point + (widthMantissa * scale) / 2
        const display = roundToCi(point, lo, hi)
        const supportedExponent = Math.floor(Math.log10(hi - lo))
        const [mantissa = '', scientificExponent = '0'] = display.split('e')
        const [integerPart = '', fraction = ''] = mantissa.split('.')
        const trailingZeros =
          fraction.length === 0 ? (integerPart.match(/0+$/)?.[0].length ?? 0) : 0
        const displayedExponent = Number(scientificExponent) - fraction.length + trailingZeros
        expect(display).not.toBe('—')
        if (Number(display) !== 0)
          expect(displayedExponent).toBeGreaterThanOrEqual(supportedExponent)
        const step = 10 ** supportedExponent
        expect(Math.abs(Number(display) - point)).toBeLessThanOrEqual(step * 0.50001)
      }),
    { arbitrary: { runs: 500 } },
  )
})

const rows = [
  { label: 'First measurement', point: 12.345678, lo: 10.1, hi: 14.6 },
  { label: 'Second measurement', point: 13.876543, lo: 13.71, hi: 13.99 },
] as const

describe('CiChart', () => {
  it('renders point estimates, whiskers, and a threshold band without per-row legend entries', () => {
    const html = renderToStaticMarkup(
      <CiChart
        rows={rows}
        threshold={{ value: [11.123456, 12.654321], label: 'Target range' }}
        unit="ms"
      />,
    )
    expect(html.match(/<ellipse /g)).toHaveLength(2)
    expect(html.match(/<rect /g)).toHaveLength(2)
    expect(html.match(/Point and confidence interval/g)).toHaveLength(1)
    expect(html.match(/Target range/g)).toHaveLength(1)
    expect(html).toContain('12 [10–15] ms')
    expect(html).toContain('13.9 [13.7–14.0] ms')
    expect(html).toContain('Target range: 11–13 ms')
    expect(html).not.toContain('12.345678')
    expect(html).not.toContain('13.876543')
    expect(html).not.toContain('11.123456')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('First measurement')
    expect(html).toContain('Second measurement')
  })

  it('rounds axis ticks against the widest interval, not the numeric domain', () => {
    const html = renderToStaticMarkup(
      <CiChart
        rows={rows}
        threshold={{ value: 12.123456, label: 'Target' }}
        unit="ms"
        domain={[9.123456, 15.987654]}
      />,
    )
    expect(html).toContain('aria-label="Axis (ms)"')
    expect(html).toContain('>9</span>')
    expect(html).toContain('>11</span>')
    expect(html).toContain('>13</span>')
    expect(html).toContain('>14</span>')
    expect(html).toContain('>16</span>')
    expect(html).not.toContain('9.123456')
    expect(html).not.toContain('15.987654')
    expect(html).toContain('Target: 12 ms')
  })

  it('gives scalar thresholds a visible band', () => {
    const html = renderToStaticMarkup(
      <CiChart rows={rows} threshold={{ value: 12, label: 'Target' }} unit="ms" />,
    )
    expect(html.match(/width="2" height="40"/g)).toHaveLength(2)
  })

  it('does not cover plotted data with text labels', () => {
    const html = renderToStaticMarkup(
      <CiChart rows={rows} threshold={{ value: 12, label: 'Target' }} unit="ms" />,
    )
    expect(html).not.toContain('<text')
    expect(html).not.toContain('<foreignObject')
  })

  it('reports an empty dataset without inventing an interval', () => {
    const html = renderToStaticMarkup(
      <CiChart rows={[]} threshold={{ value: 12, label: 'Target' }} unit="ms" />,
    )
    expect(html).toContain('No interval data available.')
    expect(html).not.toContain('<svg')
  })

  it('rejects reversed intervals and domains that would hide observations', () => {
    expect(() =>
      renderToStaticMarkup(
        <CiChart
          rows={[{ label: 'Invalid', point: 2, lo: 3, hi: 1 }]}
          threshold={{ value: 2, label: 'Target' }}
          unit="ms"
        />,
      ),
    ).toThrow(RangeError)
    expect(() =>
      renderToStaticMarkup(
        <CiChart
          rows={rows}
          threshold={{ value: 12, label: 'Target' }}
          unit="ms"
          domain={[11, 14]}
        />,
      ),
    ).toThrow(RangeError)
  })
})
