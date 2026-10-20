import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'

import { Icon, type IconName } from './icons.tsx'

/** Where a lane of work stands; `you` means it waits on the reader. */
export type LaneState = 'you' | 'doing' | 'todo' | 'done'

/** One parallel lane of work and its current step. */
export interface ProgressLane {
  readonly label: string
  readonly state: LaneState
  readonly detail: string
}

/** Props for ProgressLanes: the parallel lanes, in the order the reader should scan them. */
export interface ProgressLanesProps {
  readonly lanes: readonly ProgressLane[]
}

const states: Record<LaneState, { readonly icon: IconName; readonly label: string }> = {
  you: { icon: 'hand', label: 'Waiting on you' },
  doing: { icon: 'loader-circle', label: 'In progress' },
  todo: { icon: 'circle-dashed', label: 'To do' },
  done: { icon: 'circle-check', label: 'Done' },
}

/**
 * Parallel work state, one row per lane: a state glyph, the lane, and its current step. A lane
 * waiting on the reader carries the you tone; finished lanes recede.
 */
export const ProgressLanes = ({ lanes }: ProgressLanesProps) => (
  <ul {...stylex.props(styles.list)} data-vista-tones="">
    {lanes.map((lane) => (
      <li key={lane.label} {...stylex.props(styles.row)} data-state={lane.state}>
        <span {...stylex.props(styles.icon, inks[lane.state])}>
          <Icon name={states[lane.state].icon} size={14} aria-label={states[lane.state].label} />
        </span>
        <span
          {...stylex.props(
            styles.lane,
            lane.state === 'you' && styles.laneYou,
            lane.state === 'done' && styles.receded,
          )}
        >
          {lane.label}
        </span>
        <span {...stylex.props(styles.detail)} title={lane.detail}>
          {lane.detail}
        </span>
      </li>
    ))}
  </ul>
)

const styles = stylex.create({
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    maxWidth: '48rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.125rem minmax(6rem, 10rem) minmax(0, 1fr)',
    columnGap: '0.625rem',
    alignItems: 'center',
    paddingBlock: '0.375rem',
    fontSize: '0.8125rem',
    borderBottomWidth: {
      default: 1,
      ':last-child': 0,
    },
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-200'],
  },
  icon: {
    display: 'flex',
  },
  lane: {
    fontWeight: 500,
    color: tokens['--ds-gray-1000'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  laneYou: {
    fontWeight: 600,
    color: 'var(--tone-you-ink)',
  },
  receded: {
    color: tokens['--ds-gray-900'],
  },
  detail: {
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const inks = stylex.create({
  you: { color: 'var(--tone-you-ink)' },
  doing: { color: tokens['--ds-gray-1000'] },
  todo: { color: tokens['--ds-gray-800'] },
  done: { color: 'var(--tone-done-ink)' },
})
