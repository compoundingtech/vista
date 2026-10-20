import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { scale, tokens } from '@vista/ui/tokens.stylex'

import { laneEnd } from './encodings.ts'
import { money } from './format.ts'
import type { AgentTimelineScene, Lane } from './projection.ts'

/** H2-sized spend view of one session and its full descendant subtree. */
export interface CompactSpendProps {
  readonly scene: AgentTimelineScene
  readonly lane: Lane
  readonly theme?: 'light' | 'dark'
  /** Role aggregates when the source cannot attribute hourly marks to individual descendants. */
  readonly descendantSpend?: {
    readonly totalUsd: number
    readonly cumulativeValues: ReadonlyArray<{ readonly ts: number; readonly usd: number }>
  }
}

/** Root and descendant costs remain distinct; bounded marks never masquerade as exact totals. */
export const CompactSpend = ({ scene, lane, theme = 'light', descendantSpend }: CompactSpendProps): ReactNode => {
  const ids = new Set([lane.session.id])
  const descendants: Lane[] = []
  for (const candidate of scene.lanes) {
    if (candidate.session.parentId !== null && ids.has(candidate.session.parentId)) {
      ids.add(candidate.session.id)
      descendants.push(candidate)
    }
  }
  const descendantUsd = descendantSpend?.totalUsd ?? descendants.reduce((total, child) => total + child.totalUsd, 0)
  const start = descendantSpend === undefined ? lane.session.startedAt : scene.model.windowStart
  const end = descendantSpend === undefined
    ? Math.max(laneEnd(lane, scene), ...descendants.map((child) => laneEnd(child, scene)))
    : scene.model.windowEnd
  const times = [
    ...new Set([
      start,
      end,
      ...lane.cumulativeValues.map((point) => point.ts),
      ...descendants.flatMap((child) => child.cumulativeValues.map((point) => point.ts)),
      ...(descendantSpend?.cumulativeValues.map((point) => point.ts) ?? []),
    ]),
  ].toSorted((a, b) => a - b)
  const maximum = Math.max(0.000001, lane.totalUsd, descendantUsd)
  const path = (series: ReadonlyArray<ReadonlyArray<{ readonly ts: number; readonly usd: number }>>): string => {
    const cursors = series.map(() => 0)
    const values = series.map(() => 0)
    return times
      .map((ts, index) => {
        for (let i = 0; i < series.length; i++) {
          const points = series[i]!
          while (cursors[i]! < points.length && points[cursors[i]!]!.ts <= ts) {
            values[i] = points[cursors[i]!]!.usd
            cursors[i]!++
          }
        }
        const x = 4 + ((ts - start) / Math.max(1, end - start)) * 312
        const y = 76 - (values.reduce((total, value) => total + value, 0) / maximum) * 72
        return (index === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
      })
      .join(' ')
  }
  const retainedRoot = lane.cumulativeValues.at(-1)?.usd ?? 0
  const retainedDescendants = descendantSpend?.cumulativeValues.at(-1)?.usd ?? descendants.reduce(
    (total, child) => total + (child.cumulativeValues.at(-1)?.usd ?? 0),
    0,
  )
  const partial =
    Math.abs(retainedRoot - lane.totalUsd) > 0.005 ||
    Math.abs(retainedDescendants - descendantUsd) > 0.005
  return (
    <section
      {...stylex.props(styles.root)}
      data-theme={theme}
      aria-label="Session and descendant spend"
    >
      <div {...stylex.props(styles.totals)}>
        <span>
          Session <strong>{money.format(lane.totalUsd)}</strong>
        </span>
        <span>
          Descendants <strong>{money.format(descendantUsd)}</strong>
        </span>
      </div>
      <svg
        {...stylex.props(styles.chart)}
        viewBox="0 0 320 80"
        preserveAspectRatio="none"
        role="img"
        aria-label="Cumulative session and descendant API-equivalent spend"
      >
        <path
          d={path([lane.cumulativeValues])}
          fill="none"
          stroke={tokens['--ds-blue-700']}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(descendantSpend === undefined ? descendants.map((child) => child.cumulativeValues) : [descendantSpend.cumulativeValues])}
          fill="none"
          stroke={tokens['--ds-purple-700']}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span {...stylex.props(styles.note)}>
        API-equivalent{descendantSpend === undefined ? '' : ' · hourly role aggregates'}{partial ? ' · chart shows retained marks; totals are exact' : ''}
      </span>
    </section>
  )
}

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    minWidth: 0,
    color: tokens['--ds-foreground'],
    fontSize: '0.72rem',
  },
  totals: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: scale.space2,
    fontVariantNumeric: 'tabular-nums',
  },
  chart: { width: '100%', height: 80, display: 'block' },
  note: { color: tokens['--ds-gray-800'], fontSize: '0.66rem' },
})
