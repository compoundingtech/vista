import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'

import { Icon, type IconName } from './icons.tsx'
import { Mark } from './Mark.tsx'
import { durationScale, formatDuration, prefersLogScale } from './scale.ts'

/**
 * One cause or intervention. It counts as proven only when `proof` names the measurement
 * (before/after or A/B with n); otherwise it renders as a hypothesis and `next` names the
 * experiment that would prove it.
 */
export interface Finding {
  readonly title: string
  readonly icon?: IconName
  /** The intervention this finding suggests. */
  readonly fix?: ReactNode
  /** Measured gap in milliseconds; omit when not quantified. */
  readonly gap?: number
  /** What one gap is per, e.g. `per page open`. */
  readonly unit?: string
  /** The measurement proving the saving. */
  readonly proof?: ReactNode
  /** For a hypothesis: what to measure next, and its estimated cost. */
  readonly next?: ReactNode
  readonly cost?: ReactNode
  /** The finding to act on first. */
  readonly start?: boolean
}

/** Props for RankedFindings: findings in any order; the list ranks them by measured gap. */
export interface RankedFindingsProps {
  readonly findings: readonly Finding[]
}

/**
 * Causes ranked by measured gap. Proven savings draw solid, hypotheses dashed, so certainty is
 * visible before any text is read; one finding may carry the start-here mark. Gaps decades
 * apart switch the axis to log.
 */
export const RankedFindings = ({ findings }: RankedFindingsProps) => {
  const ranked = findings.toSorted((a, b) => (b.gap ?? -1) - (a.gap ?? -1))
  const gaps = ranked.flatMap((finding) => (finding.gap === undefined ? [] : [finding.gap]))
  const log = prefersLogScale(gaps)
  const scale = durationScale(gaps, log)
  return (
    <div {...stylex.props(styles.list)} data-vista-tones="">
      <div {...stylex.props(styles.row, styles.head)} aria-hidden="true">
        <span />
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
      </div>
      <ol {...stylex.props(styles.items)}>
        {ranked.map((finding, index) => {
          const proven = finding.proof !== undefined
          return (
            <li key={finding.title} {...stylex.props(styles.row, styles.item)}>
              <span {...stylex.props(styles.rank, finding.start === true && styles.rankStart)}>
                {index + 1}
              </span>
              <div {...stylex.props(styles.what)}>
                <span {...stylex.props(styles.title)}>
                  {finding.icon === undefined ? null : <Icon name={finding.icon} size={15} />}
                  {finding.title}
                </span>
                {finding.fix === undefined ? null : (
                  <span {...stylex.props(styles.fix)}>
                    <Icon name="arrow-right" size={12} />
                    {finding.fix}
                  </span>
                )}
                {finding.start === true ? <Mark tone="recommend">Start here</Mark> : null}
              </div>
              {finding.gap === undefined ? (
                <span {...stylex.props(styles.unmeasured)}>Not quantified</span>
              ) : (
                <div
                  {...stylex.props(styles.bar)}
                  role="img"
                  aria-label={`Measured gap ${formatDuration(finding.gap)}${finding.unit === undefined ? '' : ` ${finding.unit}`}, ${proven ? 'proven' : 'not proven'}`}
                >
                  <span
                    {...stylex.props(
                      styles.fill,
                      proven ? styles.fillProven : styles.fillHypothesis,
                    )}
                    style={{ width: `${scale.position(finding.gap) * 100}%` }}
                  />
                  <span {...stylex.props(styles.value)}>
                    <strong {...stylex.props(styles.valueNumber)}>
                      {formatDuration(finding.gap)}
                    </strong>
                    {finding.unit === undefined ? null : ` ${finding.unit}`}
                  </span>
                </div>
              )}
              <div {...stylex.props(styles.status)}>
                <Mark tone={proven ? 'done' : 'unproven'} />
                {proven ? (
                  <span {...stylex.props(styles.note)}>{finding.proof}</span>
                ) : finding.next === undefined ? null : (
                  <span {...stylex.props(styles.note)}>Next: {finding.next}</span>
                )}
              </div>
              <span {...stylex.props(styles.cost)}>
                {finding.cost === undefined ? null : (
                  <>
                    <Icon name="coins" size={13} aria-label="Cost" />
                    {finding.cost}
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const NARROW = '@media (max-width: 52rem)'

const styles = stylex.create({
  list: {
    display: 'flex',
    flexDirection: 'column',
    color: tokens['--ds-gray-1000'],
    fontVariantNumeric: 'tabular-nums',
  },
  items: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: {
      default: '1.75rem minmax(12rem, 16rem) minmax(8rem, 1fr) minmax(7rem, 11rem) 5rem',
      [NARROW]: '1.5rem minmax(0, 1fr) minmax(0, 1fr)',
    },
    columnGap: '1.125rem',
    rowGap: '0.5rem',
    alignItems: 'center',
  },
  head: {
    paddingBottom: '0.5rem',
  },
  item: {
    paddingBlock: '1rem',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-200'],
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
  rank: {
    alignSelf: 'start',
    fontSize: '1.25rem',
    fontWeight: 650,
    color: tokens['--ds-gray-800'],
  },
  rankStart: {
    color: 'var(--tone-recommend-ink)',
  },
  what: {
    display: 'grid',
    gap: '0.25rem',
    justifyItems: 'start',
  },
  title: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  fix: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.3rem',
    fontSize: '0.75rem',
    lineHeight: '1.1rem',
    color: tokens['--ds-gray-900'],
  },
  bar: {
    position: 'relative',
    height: '1.875rem',
    display: 'flex',
    alignItems: 'center',
    gridColumn: { default: 'auto', [NARROW]: '2 / -1' },
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: '0.45rem',
    bottom: '0.45rem',
    minWidth: '3px',
    borderRadius: '3px',
    boxSizing: 'border-box',
  },
  fillProven: {
    backgroundColor: 'var(--tone-risk)',
  },
  fillHypothesis: {
    borderWidth: '1.5px',
    borderStyle: 'dashed',
    borderColor: 'var(--tone-risk)',
    backgroundColor: 'color-mix(in oklab, var(--tone-risk) 14%, transparent)',
  },
  value: {
    position: 'absolute',
    right: 0,
    paddingLeft: '0.5rem',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
    backgroundColor: tokens['--ds-background-100'],
  },
  valueNumber: {
    fontSize: '0.9375rem',
    fontWeight: 650,
    color: tokens['--ds-gray-1000'],
  },
  unmeasured: {
    fontSize: '0.75rem',
    color: tokens['--ds-gray-800'],
    gridColumn: { default: 'auto', [NARROW]: '2 / -1' },
  },
  status: {
    display: 'grid',
    gap: '0.125rem',
    justifyItems: 'start',
    gridColumn: { default: 'auto', [NARROW]: '2' },
  },
  note: {
    fontSize: '0.6875rem',
    lineHeight: '1rem',
    color: tokens['--ds-gray-900'],
  },
  cost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.8125rem',
    color: tokens['--ds-gray-900'],
  },
})
