import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { scale, tokens } from '@vista/ui/tokens.stylex'

import { laneEnd } from './encodings.ts'
import { clock, money, shortModel } from './format.ts'
import type { AgentTimelineBin, AgentTimelineRequest } from './model.ts'
import type { AgentTimelineScene, Lane, LaneSample } from './projection.ts'

const CHART_WIDTH = 920
const CHART_HEIGHT = 156
const CHART_INSET_X = 10
const CHART_INSET_Y = 12

const requestsFor = (scene: AgentTimelineScene, lane: Lane): ReadonlyArray<AgentTimelineRequest> =>
  scene.model.requests.filter((request) => request.sessionId === lane.session.id)

interface SpendComponents {
  readonly input: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly output: number
}

type SpendComponent = keyof SpendComponents

const SPEND_COMPONENTS: ReadonlyArray<{
  readonly id: SpendComponent
  readonly label: string
  readonly color: string
}> = [
  { id: 'input', label: 'Input', color: tokens['--ds-blue-700'] },
  { id: 'cacheRead', label: 'Cache read', color: tokens['--ds-purple-700'] },
  { id: 'cacheWrite', label: 'Cache write', color: tokens['--ds-amber-800'] },
  { id: 'output', label: 'Output', color: tokens['--ds-green-700'] },
]

const isSpendComponents = (value: unknown): value is SpendComponents =>
  typeof value === 'object' &&
  value !== null &&
  'input' in value &&
  typeof value.input === 'number' &&
  'cacheRead' in value &&
  typeof value.cacheRead === 'number' &&
  'cacheWrite' in value &&
  typeof value.cacheWrite === 'number' &&
  'output' in value &&
  typeof value.output === 'number'

const sampleComponents = (sample: LaneSample): SpendComponents | null => {
  if (!('cumulativeUsdByComponent' in sample)) return null
  return isSpendComponents(sample.cumulativeUsdByComponent) ? sample.cumulativeUsdByComponent : null
}

const requestComponents = (request: AgentTimelineRequest): SpendComponents | null => {
  if (
    !('usdInput' in request) ||
    typeof request.usdInput !== 'number' ||
    !('usdCacheRead' in request) ||
    typeof request.usdCacheRead !== 'number' ||
    !('usdCacheWrite' in request) ||
    typeof request.usdCacheWrite !== 'number' ||
    !('usdOutput' in request) ||
    typeof request.usdOutput !== 'number'
  )
    return null
  return {
    input: request.usdInput,
    cacheRead: request.usdCacheRead,
    cacheWrite: request.usdCacheWrite,
    output: request.usdOutput,
  }
}
const binComponents = (bin: AgentTimelineBin): SpendComponents => ({
  input: bin.usdInput,
  cacheRead: bin.usdCacheRead,
  cacheWrite: bin.usdCacheWrite,
  output: bin.usdOutput,
})

const linePath = (points: ReadonlyArray<{ readonly x: number; readonly y: number }>): string =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

const areaPath = (
  upper: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  lower: ReadonlyArray<{ readonly x: number; readonly y: number }>,
): string => {
  if (upper.length === 0) return ''
  return `${linePath(upper)} ${linePath(lower.toReversed()).replace(/^M/, 'L')} Z`
}

const xFor = (ts: number, start: number, end: number): number =>
  CHART_INSET_X + ((ts - start) / Math.max(1, end - start)) * (CHART_WIDTH - CHART_INSET_X * 2)

const yFor = (value: number, maximum: number): number =>
  CHART_HEIGHT - CHART_INSET_Y - (value / Math.max(1, maximum)) * (CHART_HEIGHT - CHART_INSET_Y * 2)

interface KeyValueProps {
  readonly label: string
  readonly children: ReactNode
  readonly wide?: boolean
}

const KeyValue = ({ label, children, wide = false }: KeyValueProps) => (
  <div {...stylex.props(styles.keyValue, wide && styles.keyValueWide)}>
    <dt {...stylex.props(styles.key)}>{label}</dt>
    <dd {...stylex.props(styles.value, wide && styles.valueWrap)}>{children}</dd>
  </div>
)

const SectionHeading = ({ children }: { readonly children: ReactNode }) => (
  <h3 {...stylex.props(styles.sectionHeading)}>{children}</h3>
)

/** Evidence used by the standalone detailed spend view. */
export interface SpendPanelProps {
  readonly scene: AgentTimelineScene
  readonly lane: Lane
}

/** Render cumulative spend and retained component/model evidence. */
export const SpendPanel = ({ scene, lane }: SpendPanelProps): ReactNode => {
  const requests = requestsFor(scene, lane)
  let aggregateComponents: SpendComponents = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
  const componentSamples = lane.samples.length > 0
    ? lane.samples.map((sample) => ({ sample, components: sampleComponents(sample) }))
    : lane.bins.map((bin) => {
        const components = binComponents(bin)
        aggregateComponents = {
          input: aggregateComponents.input + components.input,
          cacheRead: aggregateComponents.cacheRead + components.cacheRead,
          cacheWrite: aggregateComponents.cacheWrite + components.cacheWrite,
          output: aggregateComponents.output + components.output,
        }
        return { sample: { ts: bin.to }, components: aggregateComponents }
      })
  const hasComponents =
    componentSamples.length > 0 && componentSamples.every(({ components }) => components !== null)
  const start = lane.session.startedAt
  const end = laneEnd(lane, scene)
  const retainedUsd = lane.cumulativeValues.at(-1)?.usd ?? 0
  const partial = Math.abs(retainedUsd - lane.totalUsd) > 0.005
  const maximum = Math.max(0.000_001, retainedUsd)
  const totalPath = linePath(
    lane.cumulativeValues.map((point) => ({
      x: xFor(point.ts, start, end),
      y: yFor(point.usd, maximum),
    })),
  )
  const componentTotals = SPEND_COMPONENTS.map(({ id }) => ({
    id,
    value:
      requests.reduce((total, request) => total + (requestComponents(request)?.[id] ?? 0), 0) +
      lane.bins.reduce((total, bin) => total + binComponents(bin)[id], 0),
  }))
  const requestCountByModel = new Map<string, number>()
  for (const request of requests) {
    requestCountByModel.set(request.model, (requestCountByModel.get(request.model) ?? 0) + 1)
  }
  for (const bin of lane.bins) {
    for (const [model, aggregate] of Object.entries(bin.byModel)) {
      requestCountByModel.set(model, (requestCountByModel.get(model) ?? 0) + aggregate.requests)
    }
  }
  const modelTotals = Object.entries(lane.spendByModel)
    .map(([model, usdValue]) => ({
      model,
      usd: usdValue,
      requests: requestCountByModel.get(model) ?? 0,
    }))
    .toSorted((left, right) => right.usd - left.usd)
  const baseline = CHART_HEIGHT - CHART_INSET_Y

  return (
    <div {...stylex.props(styles.panelScroll, styles.chartPanel)}>
      <div {...stylex.props(styles.chartHeader)}>
        <div>
          <SectionHeading>Cumulative API-equivalent spend</SectionHeading>
          {partial ? (
            <p {...stylex.props(styles.note)}>
              The timeline and breakdowns show retained marks; the total is exact.
            </p>
          ) : null}
          {!hasComponents ? (
            <p {...stylex.props(styles.note)}>
              Component attribution is unavailable; showing total cost only.
            </p>
          ) : null}
        </div>
        <span {...stylex.props(styles.chartMetric)}>{money.format(lane.totalUsd)}</span>
      </div>
      <svg
        {...stylex.props(styles.chart)}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Cumulative API-equivalent spend over time"
      >
        <path
          d={`M${CHART_INSET_X} ${baseline}H${CHART_WIDTH - CHART_INSET_X}`}
          stroke={tokens['--ds-gray-alpha-400']}
        />
        {hasComponents
          ? SPEND_COMPONENTS.map((component, componentIndex) => {
              const lower = componentSamples.map(({ sample, components }) => {
                const value = SPEND_COMPONENTS.slice(0, componentIndex).reduce(
                  (total, candidate) => total + (components?.[candidate.id] ?? 0),
                  0,
                )
                return { x: xFor(sample.ts, start, end), y: yFor(value, maximum) }
              })
              const upper = componentSamples.map(({ sample, components }) => {
                const value = SPEND_COMPONENTS.slice(0, componentIndex + 1).reduce(
                  (total, candidate) => total + (components?.[candidate.id] ?? 0),
                  0,
                )
                return { x: xFor(sample.ts, start, end), y: yFor(value, maximum) }
              })
              return (
                <path
                  key={component.id}
                  d={areaPath(upper, lower)}
                  fill={component.color}
                  fillOpacity={0.24}
                />
              )
            })
          : null}
        {totalPath ? (
          <path
            d={totalPath}
            fill="none"
            stroke={tokens['--ds-foreground']}
            strokeWidth={1.8}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div {...stylex.props(styles.axisLabels)}>
        <span>{clock.format(start)}</span>
        <span>Europe/Berlin</span>
        <span>{clock.format(end)}</span>
      </div>
      {hasComponents ? (
        <div {...stylex.props(styles.legend)} aria-label="Spend component legend">
          {SPEND_COMPONENTS.map((component) => (
            <span key={component.id} {...stylex.props(styles.legendItem)}>
              <span
                {...stylex.props(styles.legendSwatch)}
                style={{ backgroundColor: component.color }}
              />
              {component.label}
            </span>
          ))}
        </div>
      ) : null}
      <div {...stylex.props(styles.breakdownColumns)}>
        <section>
          <SectionHeading>By component{partial ? ' (retained marks)' : ''}</SectionHeading>
          {hasComponents ? (
            <dl {...stylex.props(styles.propertyGrid)}>
              {SPEND_COMPONENTS.map((component) => (
                <KeyValue key={component.id} label={component.label}>
                  {money.format(
                    componentTotals.find((total) => total.id === component.id)?.value ?? 0,
                  )}
                </KeyValue>
              ))}
            </dl>
          ) : (
            <p {...stylex.props(styles.emptyInline)}>No per-component cost fields were recorded.</p>
          )}
        </section>
        <section>
          <SectionHeading>By model{partial ? ' (retained marks)' : ''}</SectionHeading>
          <div {...stylex.props(styles.miniTable)} role="table" aria-label="Spend by model">
            {modelTotals.map((entry) => (
              <div key={entry.model} {...stylex.props(styles.miniTableRow)} role="row">
                <span role="cell" {...stylex.props(styles.modelName)}>
                  {shortModel(entry.model)}
                </span>
                <span role="cell">{entry.requests} req</span>
                <span role="cell">{money.format(entry.usd)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

const styles = stylex.create({
  panelScroll: {
    height: '100%',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  chartPanel: { padding: scale.space3, boxSizing: 'border-box' },
  chartHeader: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: scale.space3,
  },
  note: { margin: 0, color: tokens['--ds-gray-800'], fontSize: '0.7rem', lineHeight: 1.4 },
  chartMetric: {
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  chart: {
    display: 'block',
    width: '100%',
    height: '8.5rem',
    marginBlockStart: scale.space2,
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  axisLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBlockStart: scale.space1,
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    fontSize: '0.65rem',
    fontVariantNumeric: 'tabular-nums',
  },
  legend: { display: 'flex', flexWrap: 'wrap', gap: scale.space3, marginBlock: scale.space2 },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
    color: tokens['--ds-gray-900'],
    fontSize: '0.68rem',
  },
  legendSwatch: { width: scale.space2, height: scale.space2 },
  breakdownColumns: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) minmax(0, 1fr)',
      '@container (max-width: 44rem)': '1fr',
    },
    gap: scale.space5,
    marginBlockStart: scale.space3,
  },
  propertyGrid: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(6.5rem, auto) minmax(0, 1fr)',
    gap: `${scale.space1} ${scale.space3}`,
  },
  emptyInline: { margin: 0, color: tokens['--ds-gray-800'] },
  miniTable: {
    display: 'flex',
    flexDirection: 'column',
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
  },
  miniTableRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: scale.space3,
    paddingBlock: scale.space1,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-200'],
  },
  modelName: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  keyValue: { display: 'contents' },
  keyValueWide: {},
  key: { color: tokens['--ds-gray-800'], fontWeight: 500 },
  value: {
    minWidth: 0,
    margin: 0,
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  valueWrap: { fontFamily: scale.fontSans, lineHeight: 1.4 },
  sectionHeading: {
    marginBlock: `0 ${scale.space2}`,
    marginInline: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.66rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
})
