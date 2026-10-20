import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { ChartIntent, ChartSpec } from '../model.ts'

const categoricalColors = [
  tokens['--ds-blue-700'],
  tokens['--ds-purple-700'],
  tokens['--ds-teal-700'],
  tokens['--ds-amber-900'],
  tokens['--ds-pink-700'],
  tokens['--ds-gray-1000'],
] as const

const seriesDashPatterns = [undefined, '8 3', '3 3', '10 3 2 3', '2 2', '12 3 3 3'] as const

const intentColor = (intent: ChartIntent | undefined, index: number): string => {
  if (intent === 'success') return tokens['--ds-green-900']
  if (intent === 'warning') return tokens['--ds-amber-900']
  if (intent === 'error') return tokens['--ds-red-900']
  if (intent === 'info') return tokens['--ds-blue-700']
  return categoricalColors[index % categoricalColors.length]!
}

const seriesDash = (index: number): string | undefined =>
  seriesDashPatterns[index % seriesDashPatterns.length]

const seriesDashProps = (index: number) => {
  const strokeDasharray = seriesDash(index)
  return strokeDasharray === undefined ? {} : { strokeDasharray }
}

const chartData = (chart: ChartSpec): readonly Record<string, string | number>[] =>
  chart.data.map((datum) => ({ label: datum.label, ...datum.values }))

const formatValue = (value: unknown, unit?: string): string =>
  typeof value === 'number' ? `${value.toLocaleString()}${unit ? ` ${unit}` : ''}` : String(value)

const VistaTooltip = ({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean | undefined
  payload?:
    | readonly { name?: string | number | undefined; value?: unknown; color?: string | undefined }[]
    | undefined
  label?: string | number | undefined
  unit?: string | undefined
}) => {
  if (!active || !payload?.length) return null
  return (
    <div {...stylex.props(styles.tooltip)}>
      <div {...stylex.props(styles.tooltipLabel)}>{label}</div>
      {payload.map((item) => (
        <div key={String(item.name)} {...stylex.props(styles.tooltipRow)}>
          <span {...stylex.props(styles.tooltipMarker(item.color ?? 'transparent'))} />
          <span>{item.name}</span>
          <strong>{formatValue(item.value, unit)}</strong>
        </div>
      ))}
    </div>
  )
}

/**
 * Props for the chart block: a required id and ChartSpec, an optional caption, and style overrides
 * that may not set overflow or containerType because the block controls those.
 */
export interface ChartBlockProps {
  readonly id: string
  readonly chart: ChartSpec
  readonly caption?: string
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden'; containerType: 'inline-size' }>
}

const formatLegendLabel = (value: string) => (
  <span {...stylex.props(styles.legendText)}>{value}</span>
)

/**
 * Renders a declarative ChartSpec as a chart with stacking, axis labels, legend, and dots only for
 * small datasets, inside a captioned block wrapper.
 */
export const ChartBlock = ({ id, chart, caption, style }: ChartBlockProps) => {
  const data = chartData(chart)
  const isStacked = chart.kind === 'stacked-area' || chart.kind === 'stacked-bar'
  const isArea = chart.kind === 'area' || chart.kind === 'stacked-area'
  const isBar = chart.kind === 'bar' || chart.kind === 'stacked-bar'
  const stackProps = isStacked ? { stackId: 'stack' } : {}
  const showDots = data.length <= 12
  const dot = showDots ? { r: 3, strokeWidth: 2, fill: tokens['--ds-background-100'] } : false
  const xAxisLabel =
    chart.xLabel === undefined
      ? undefined
      : {
          value: chart.xLabel,
          position: 'insideBottom' as const,
          offset: 4,
          fill: tokens['--ds-gray-800'],
          fontSize: '0.72rem',
        }
  const yAxisLabel =
    chart.yLabel === undefined
      ? undefined
      : {
          value: chart.yLabel,
          angle: -90,
          position: 'insideLeft' as const,
          fill: tokens['--ds-gray-800'],
          fontSize: '0.72rem',
        }
  const xAxisLabelProps = xAxisLabel === undefined ? {} : { label: xAxisLabel }
  const yAxisLabelProps = yAxisLabel === undefined ? {} : { label: yAxisLabel }

  if (chart.series.length === 0 || data.length === 0) {
    return (
      <figure {...stylex.props(styles.root, style)} id={id}>
        <figcaption {...stylex.props(styles.title)}>{caption ?? chart.title}</figcaption>
        <p {...stylex.props(styles.empty)} role="status">
          No chart data available.
        </p>
      </figure>
    )
  }

  const common = {
    data,
    margin: {
      top: 10,
      right: 10,
      bottom: 0,
      left: 0,
    },
  }

  return (
    <figure {...stylex.props(styles.root, style)} id={id} aria-labelledby={`${id}-title`}>
      <header {...stylex.props(styles.header)}>
        <div>
          <figcaption id={`${id}-title`} {...stylex.props(styles.title)}>
            {caption ?? chart.title}
          </figcaption>
          {chart.description ? (
            <p {...stylex.props(styles.description)}>{chart.description}</p>
          ) : null}
        </div>
        <span {...stylex.props(styles.kind)}>{chart.kind}</span>
      </header>
      <div {...stylex.props(styles.canvas)}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          {isArea ? (
            <AreaChart {...common}>
              <CartesianGrid stroke={tokens['--ds-gray-alpha-400']} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fill: tokens['--ds-gray-800'], fontSize: '0.72rem' }}
                height={chart.xLabel === undefined ? 30 : 48}
                {...xAxisLabelProps}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={chart.yLabel === undefined ? 42 : 82}
                tickFormatter={(value) => formatValue(value, chart.unit)}
                tick={{ fill: tokens['--ds-gray-800'], fontSize: '0.72rem' }}
                {...yAxisLabelProps}
              />
              <Tooltip content={(props) => <VistaTooltip {...props} unit={chart.unit} />} />
              <Legend formatter={formatLegendLabel} />
              {chart.series.map((series, index) => (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  {...stackProps}
                  stroke={intentColor(series.intent, index)}
                  {...seriesDashProps(index)}
                  fill={intentColor(series.intent, index)}
                  fillOpacity={isStacked ? 0.18 : 0.08}
                  strokeWidth={1.7}
                  dot={dot}
                  activeDot={{ r: 4 }}
                  legendType="plainline"
                />
              ))}
            </AreaChart>
          ) : isBar ? (
            <BarChart {...common}>
              <CartesianGrid stroke={tokens['--ds-gray-alpha-400']} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                height={chart.xLabel === undefined ? 30 : 48}
                tick={{ fill: tokens['--ds-gray-800'], fontSize: '0.72rem' }}
                {...xAxisLabelProps}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={chart.yLabel === undefined ? 42 : 82}
                tickFormatter={(value) => formatValue(value, chart.unit)}
                tick={{ fill: tokens['--ds-gray-800'], fontSize: '0.72rem' }}
                {...yAxisLabelProps}
              />
              <Tooltip content={(props) => <VistaTooltip {...props} unit={chart.unit} />} />
              <Legend formatter={formatLegendLabel} />
              {chart.series.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  {...stackProps}
                  fill={intentColor(series.intent, index)}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart {...common}>
              <CartesianGrid stroke={tokens['--ds-gray-alpha-400']} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                height={chart.xLabel === undefined ? 30 : 48}
                tick={{ fill: tokens['--ds-gray-800'], fontSize: '0.72rem' }}
                {...xAxisLabelProps}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={chart.yLabel === undefined ? 42 : 82}
                tickFormatter={(value) => formatValue(value, chart.unit)}
                tick={{ fill: tokens['--ds-gray-800'], fontSize: '0.72rem' }}
                {...yAxisLabelProps}
              />
              <Tooltip content={(props) => <VistaTooltip {...props} unit={chart.unit} />} />
              <Legend formatter={formatLegendLabel} />
              {chart.series.map((series, index) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={intentColor(series.intent, index)}
                  {...seriesDashProps(index)}
                  strokeWidth={1.8}
                  dot={dot}
                  activeDot={{ r: 4 }}
                  legendType="plainline"
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <details {...stylex.props(styles.evidence)}>
        <summary {...stylex.props(styles.evidenceSummary)}>
          Chart data · {String(chart.data.length)}{' '}
          {chart.data.length === 1 ? 'observation' : 'observations'}
        </summary>
        <div {...stylex.props(styles.evidenceScroll)}>
          <table
            {...stylex.props(styles.evidenceTable)}
            aria-label={`${caption ?? chart.title} data`}
          >
            <caption {...stylex.props(styles.visuallyHidden)}>
              {chart.yLabel ?? 'Value'} by {chart.xLabel ?? 'category'}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  {...stylex.props(
                    styles.evidenceCell,
                    styles.evidenceHeader,
                    styles.evidenceRowHeader,
                  )}
                >
                  {chart.xLabel ?? 'Category'}
                </th>
                {chart.series.map((series) => (
                  <th
                    key={series.key}
                    scope="col"
                    {...stylex.props(styles.evidenceCell, styles.evidenceHeader)}
                  >
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.data.map((datum, index) => (
                <tr key={`${datum.label}-${String(index)}`}>
                  <th
                    scope="row"
                    {...stylex.props(
                      styles.evidenceCell,
                      styles.evidenceHeader,
                      styles.evidenceRowHeader,
                    )}
                  >
                    {datum.label}
                  </th>
                  {chart.series.map((series) => (
                    <td key={series.key} {...stylex.props(styles.evidenceCell)}>
                      {datum.values[series.key] === undefined
                        ? '—'
                        : formatValue(datum.values[series.key], chart.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    flexDirection: {
      default: 'row',
      '@container (max-width: 42rem)': 'column',
    },
    justifyContent: 'space-between',
    gap: '1rem',
    paddingBlock: '0.75rem',
    paddingInline: '0.875rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  description: {
    marginBlock: '0.2rem 0',
    marginInline: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.78rem',
  },
  kind: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-800'],
    paddingBlock: '0.15rem',
    paddingInline: '0.4rem',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
  },
  canvas: {
    height: {
      default: '18rem',
      '@container (max-width: 42rem)': '15rem',
    },
    paddingBlock: '0.75rem 0.35rem',
    paddingInline: '0.5rem 0',
  },
  legendText: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.72rem',
  },
  tooltip: {
    minWidth: '10rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    paddingBlock: '0.45rem',
    paddingInline: '0.5rem',
    boxShadow: tokens['--ds-shadow-border'],
    fontSize: '0.75rem',
  },
  tooltipLabel: {
    marginBottom: '0.35rem',
    color: tokens['--ds-gray-800'],
    fontWeight: 600,
  },
  tooltipRow: {
    display: 'grid',
    gridTemplateColumns: '0.55rem minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '0.35rem',
    fontVariantNumeric: 'tabular-nums',
  },
  tooltipMarker: (color: string) => ({
    width: '0.45rem',
    height: '0.45rem',
    borderRadius: '999px',
    backgroundColor: color,
  }),
  evidence: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  evidenceSummary: {
    cursor: 'pointer',
    paddingBlock: '0.5rem',
    paddingInline: '0.875rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.75rem',
    fontWeight: 550,
  },
  evidenceScroll: {
    overflowX: 'auto',
    paddingBlock: '0 0.75rem',
    paddingInline: '0.875rem',
  },
  evidenceTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  evidenceCell: {
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    paddingBlock: '0.35rem',
    paddingInline: '0.45rem',
  },
  evidenceHeader: {
    color: tokens['--ds-gray-800'],
    fontWeight: 550,
  },
  evidenceRowHeader: {
    textAlign: 'left',
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
  empty: {
    margin: 0,
    paddingBlock: '0.75rem',
    paddingInline: '0.875rem',
    color: tokens['--ds-gray-800'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
    fontSize: '0.85rem',
    lineHeight: 1.4,
  },
})
