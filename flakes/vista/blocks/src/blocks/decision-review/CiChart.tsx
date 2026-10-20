import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type * as React from 'react'

import { roundToCi } from './precision.ts'

/** Confidence intervals, comparison threshold and units for the chart. */
export interface CiChartProps {
  readonly rows: readonly {
    readonly label: string
    readonly point: number
    readonly lo: number
    readonly hi: number
  }[]
  readonly threshold: {
    readonly value: number | readonly [number, number]
    readonly label: string
  }
  readonly unit: string
  readonly domain?: readonly [number, number]
  readonly style?: StyleXStylesWithout<{ containerType: 'inline-size' }>
}

/** Confidence-interval chart element accepted by the decision visual factory. */
export type CiChartElement = React.ReactElement<CiChartProps, typeof CiChart>

/** Plot point estimates and confidence intervals against a shared threshold. */
export const CiChart = ({ rows, threshold, unit, domain, style }: CiChartProps) => {
  const [thresholdLo, thresholdHi] =
    typeof threshold.value === 'number' ? [threshold.value, threshold.value] : threshold.value
  let dataLo = thresholdLo
  let dataHi = thresholdHi
  let widestLo = 0
  let widestHi = 0
  if (!Number.isFinite(thresholdLo) || !Number.isFinite(thresholdHi) || thresholdLo > thresholdHi) {
    throw new RangeError('CiChart threshold must be a finite value or an ordered finite interval.')
  }
  for (const row of rows) {
    if (
      !Number.isFinite(row.point) ||
      !Number.isFinite(row.lo) ||
      !Number.isFinite(row.hi) ||
      row.lo > row.point ||
      row.point > row.hi
    ) {
      throw new RangeError('CiChart rows must contain finite points within ordered intervals.')
    }
    dataLo = Math.min(dataLo, row.lo)
    dataHi = Math.max(dataHi, row.hi)
    if (row.hi - row.lo > widestHi - widestLo) {
      widestLo = row.lo
      widestHi = row.hi
    }
  }

  if (rows.length === 0) {
    return (
      <figure {...stylex.props(styles.root, style)}>
        <p {...stylex.props(styles.empty)} role="status">
          No interval data available.
        </p>
      </figure>
    )
  }

  const padding = (dataHi - dataLo || Math.abs(dataLo) || 1) * 0.05
  const [domainLo, domainHi] = domain ?? [dataLo - padding, dataHi + padding]
  if (
    !Number.isFinite(domainLo) ||
    !Number.isFinite(domainHi) ||
    !Number.isFinite(domainHi - domainLo) ||
    domainLo >= domainHi ||
    domainLo > dataLo ||
    domainHi < dataHi
  ) {
    throw new RangeError(
      'CiChart domain must be finite, increasing, and contain all intervals and the threshold.',
    )
  }
  const x = (value: number) => 8 + ((value - domainLo) / (domainHi - domainLo)) * 984
  const bandLo = Math.max(0, x(thresholdLo) - (thresholdLo === thresholdHi ? 1 : 0))
  const bandWidth = Math.max(2, x(thresholdHi) - x(thresholdLo))
  const thresholdText =
    thresholdLo === thresholdHi
      ? roundToCi(thresholdLo, widestLo, widestHi)
      : `${roundToCi(thresholdLo, widestLo, widestHi)}–${roundToCi(thresholdHi, widestLo, widestHi)}`
  const ticks = Array.from({ length: 5 }, (_unused, index) => {
    const value = domainLo + (index / 4) * (domainHi - domainLo)
    return { value, label: roundToCi(value, widestLo, widestHi) }
  })
  // Narrow intervals may round adjacent tick positions to the same number.
  const distinctTicks = new Set(ticks.map((tick) => tick.label)).size === ticks.length

  return (
    <figure
      {...stylex.props(styles.root, style)}
      aria-label={`Point estimates and confidence intervals (${unit})`}
    >
      <figcaption {...stylex.props(styles.legend)}>
        <span {...stylex.props(styles.legendItem)}>
          <svg width="24" height="12" aria-hidden="true">
            <path d="M1 6H23M1 2V10M23 2V10" {...stylex.props(styles.whisker)} />
            <circle cx="12" cy="6" r="3" {...stylex.props(styles.point)} />
          </svg>
          Point and confidence interval
        </span>
        <span {...stylex.props(styles.legendItem)}>
          <span {...stylex.props(styles.bandSwatch)} aria-hidden="true" />
          {threshold.label}: {thresholdText} {unit}
        </span>
      </figcaption>
      <div {...stylex.props(styles.rows)}>
        {rows.map((row) => (
          <div key={row.label} {...stylex.props(styles.row)}>
            <span {...stylex.props(styles.label)}>{row.label}</span>
            <svg
              viewBox="0 0 1000 40"
              preserveAspectRatio="none"
              {...stylex.props(styles.plot)}
              aria-hidden="true"
            >
              <rect x={bandLo} y="0" width={bandWidth} height="40" {...stylex.props(styles.band)} />
              <path d="M8 20H992" {...stylex.props(styles.guide)} />
              <path
                d={`M${x(row.lo)} 20H${x(row.hi)}M${x(row.lo)} 12V28M${x(row.hi)} 12V28`}
                vectorEffect="non-scaling-stroke"
                {...stylex.props(styles.whisker)}
              />
              <ellipse cx={x(row.point)} cy="20" rx="5" ry="5" {...stylex.props(styles.point)} />
            </svg>
            <span {...stylex.props(styles.value)}>
              {roundToCi(row.point, row.lo, row.hi)} [{roundToCi(row.lo, row.lo, row.hi)}–
              {roundToCi(row.hi, row.lo, row.hi)}] {unit}
            </span>
          </div>
        ))}
        <div {...stylex.props(styles.axisRow)} aria-label={`Axis (${unit})`}>
          <div {...stylex.props(styles.axis)}>
            {ticks.map((tick, index) => (
              <span key={tick.value} {...stylex.props(styles.tick)}>
                {distinctTicks || index === 0 || index === ticks.length - 1 ? tick.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    margin: 0,
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    padding: '0.875rem',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem 1.25rem',
    marginBottom: '0.75rem',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    overflowWrap: 'anywhere',
  },
  bandSwatch: {
    width: '0.75rem',
    height: '0.75rem',
    flexShrink: 0,
    backgroundColor: tokens['--ds-amber-300'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-amber-900'],
  },
  rows: { display: 'grid', gap: '0.4rem' },
  row: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 10rem) minmax(0, 1fr) minmax(0, 13rem)',
      '@container (max-width: 42rem)': 'minmax(0, 1fr) minmax(0, 1fr)',
    },
    alignItems: 'center',
    columnGap: '0.75rem',
    rowGap: '0.25rem',
  },
  label: { fontSize: '0.8rem', overflowWrap: 'anywhere' },
  value: {
    gridColumn: { default: '3', '@container (max-width: 42rem)': '2' },
    gridRow: '1',
    textAlign: 'right',
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  plot: {
    display: 'block',
    width: '100%',
    height: 40,
    gridColumn: { default: '2', '@container (max-width: 42rem)': '1 / -1' },
    gridRow: { default: '1', '@container (max-width: 42rem)': '2' },
  },
  band: { fill: tokens['--ds-amber-300'], stroke: tokens['--ds-amber-900'], strokeWidth: 0.5 },
  guide: { fill: 'none', stroke: tokens['--ds-gray-alpha-400'], strokeWidth: 1 },
  whisker: { fill: 'none', stroke: tokens['--ds-blue-700'], strokeWidth: 2 },
  point: { fill: tokens['--ds-blue-700'] },
  axisRow: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 10rem) minmax(0, 1fr) minmax(0, 13rem)',
      '@container (max-width: 42rem)': 'minmax(0, 1fr)',
    },
    columnGap: '0.75rem',
  },
  axis: {
    gridColumn: { default: '2', '@container (max-width: 42rem)': '1' },
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    paddingInline: '0.8%',
    fontSize: '0.7rem',
    fontVariantNumeric: 'tabular-nums',
    color: tokens['--ds-gray-900'],
  },
  tick: { minWidth: 0, overflowWrap: 'anywhere' },
  empty: { margin: 0, color: tokens['--ds-gray-900'], fontSize: '0.8rem' },
})
