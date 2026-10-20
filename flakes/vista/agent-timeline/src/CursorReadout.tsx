import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import { scale, tokens } from '@vista/ui/tokens.stylex'

import {
  activitySegmentAt,
  clock,
  integer,
  minuteClock,
  money,
  shortModel,
  tokenLabel,
} from './format.ts'
import { sessionLabel } from './labels.ts'
import { valuesAt } from './projection.ts'
import type { AgentTimelineScene, Lane } from './projection.ts'
import type { ActivitySegment, SpanHue } from './types.ts'

/** Evidence required to summarize one lane at an exact trace timestamp. */
export interface CursorReadoutProps {
  readonly theme?: 'light' | 'dark'
  readonly scene: AgentTimelineScene
  readonly lane: Lane
  readonly ts: number
  readonly hue: SpanHue
  readonly segments: ReadonlyArray<ActivitySegment>
}

/** Render model, activity, and tool state for a lane at the cursor timestamp. */
export const CursorReadout = ({
  theme = 'light',
  scene,
  lane,
  ts,
  hue,
  segments,
}: CursorReadoutProps): ReactNode => {
  const label = sessionLabel(lane.session)
  const values = valuesAt(lane, ts)
  const activitySegment = activitySegmentAt(segments, ts)
  const compaction = values.isAfterCompaction
  const lastToolRequest = scene.model.requests.findLast(
    (request) =>
      request.sessionId === lane.session.id && request.ts <= ts && request.tools.length > 0,
  )
  const lastTool = values.lastTool ?? lastToolRequest?.tools.at(-1) ?? null

  return (
    <div {...stylex.props(styles.readout)} data-theme={theme}>
      <div {...stylex.props(styles.readoutHeader)}>
        <span
          {...stylex.props(styles.hueSwatch)}
          style={{ backgroundColor: hue.base }}
          aria-hidden="true"
        />
        <strong>{label.primary}</strong>
        {label.type ? <span>‹{label.type}›</span> : null}
        <span>
          · {shortModel(values.model)}
          {values.modelChangedAt === null
            ? ''
            : ` · changed ${minuteClock.format(values.modelChangedAt)}`}
        </span>
        <span
          {...stylex.props(
            styles.stateText,
            activitySegment === 'working' && styles.workingText,
            activitySegment === 'waiting' && styles.waitingText,
          )}
        >
          {activitySegment}
        </span>
      </div>
      <div {...stylex.props(styles.readoutLine)}>
        <time dateTime={new Date(ts).toISOString()}>{clock.format(ts)}</time>
        <span>{activitySegment}</span>
      </div>
      <div {...stylex.props(styles.readoutLine)}>
        <span>
          context {tokenLabel(values.contextTokens)}
          {values.contextTokens === null
            ? ''
            : values.isContextEstimated
              ? ' · estimated'
              : ' · measured'}
        </span>
        {compaction === null ? null : (
          <span {...stylex.props(styles.compactionReadout)}>
            ↓ {tokenLabel(compaction.before)} → {tokenLabel(compaction.after)} at{' '}
            {minuteClock.format(compaction.ts)}
          </span>
        )}
      </div>
      <div {...stylex.props(styles.readoutLine)}>
        <span>{money.format(values.cumulativeUsd)} so far</span>
        <span>· {integer.format(values.requests)} requests</span>
      </div>
      <div {...stylex.props(styles.readoutLine, styles.lastTool)}>last tool: {lastTool ?? '—'}</div>
    </div>
  )
}

const styles = stylex.create({
  readout: {
    minWidth: '18rem',
    maxWidth: '25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    fontSize: '0.72rem',
  },
  readoutHeader: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: scale.space1 },
  hueSwatch: {
    width: scale.space1,
    minHeight: scale.space4,
    flex: '0 0 auto',
    borderRadius: scale.radiusSm,
  },
  stateText: { color: tokens['--ds-gray-800'], fontWeight: 600 },
  workingText: { color: tokens['--ds-green-900'] },
  waitingText: { color: tokens['--ds-amber-900'] },
  readoutLine: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: scale.space1,
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontVariantNumeric: 'tabular-nums',
  },
  compactionReadout: { color: tokens['--ds-amber-900'] },
  lastTool: { color: tokens['--ds-gray-800'] },
})
