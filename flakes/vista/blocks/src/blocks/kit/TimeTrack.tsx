import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'

import { durationScale, formatDuration, prefersLogScale } from './scale.ts'

/** One measured duration. */
export interface TimeTrackRow {
  readonly label: string
  readonly ms: number
}

/** Props for TimeTrack: measured durations; the axis is chosen from their spread. */
export interface TimeTrackProps {
  readonly rows: readonly TimeTrackRow[]
}

/**
 * Durations as bars whose width is proportional to time (or its logarithm). The slowest row
 * carries the risk tone; the rest stay neutral, so the eye lands on the cost.
 */
export const TimeTrack = ({ rows }: TimeTrackProps) => {
  const durations = rows.map((row) => row.ms)
  const log = prefersLogScale(durations)
  const scale = durationScale(durations, log)
  const slowest = Math.max(...durations)
  return (
    <div
      {...stylex.props(styles.track)}
      data-vista-tones=""
      role="img"
      aria-label={rows.map((row) => `${row.label} ${formatDuration(row.ms)}`).join(', ')}
    >
      {log ? (
        <div {...stylex.props(styles.row)} aria-hidden="true">
          <span />
          <span {...stylex.props(styles.axis)}>
            {scale.ticks.map((tick) => (
              <span
                key={tick.ms}
                {...stylex.props(styles.tick)}
                style={{ left: `${tick.at * 100}%` }}
              >
                {tick.label}
              </span>
            ))}
          </span>
          <span />
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={row.label} {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.label)}>{row.label}</span>
          <span {...stylex.props(styles.lane)}>
            <span
              {...stylex.props(styles.fill, row.ms === slowest && styles.slow)}
              style={{ width: `${scale.position(row.ms) * 100}%` }}
            />
          </span>
          <strong {...stylex.props(styles.value)}>{formatDuration(row.ms)}</strong>
        </div>
      ))}
    </div>
  )
}

const styles = stylex.create({
  track: {
    display: 'grid',
    gap: '0.5rem',
    maxWidth: '40rem',
    fontVariantNumeric: 'tabular-nums',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(5rem, 9rem) minmax(0, 1fr) 4.5rem',
    columnGap: '0.75rem',
    alignItems: 'center',
  },
  label: {
    fontSize: '0.8125rem',
    color: tokens['--ds-gray-900'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lane: {
    display: 'block',
    height: '0.75rem',
    borderRadius: '3px',
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  fill: {
    display: 'block',
    height: '100%',
    minWidth: '3px',
    borderRadius: '3px',
    backgroundColor: tokens['--ds-gray-alpha-500'],
  },
  slow: {
    backgroundColor: 'var(--tone-risk)',
  },
  value: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    textAlign: 'right',
    color: tokens['--ds-gray-1000'],
  },
  axis: {
    position: 'relative',
    height: '0.875rem',
    fontSize: '0.6875rem',
    color: tokens['--ds-gray-800'],
  },
  tick: {
    position: 'absolute',
    transform: {
      default: 'translateX(-50%)',
      ':first-child': 'none',
      ':last-child': 'translateX(-100%)',
    },
    whiteSpace: 'nowrap',
  },
})
