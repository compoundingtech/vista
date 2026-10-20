import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { Button, Dialog, Heading, Modal, Tooltip, TooltipTrigger } from 'react-aria-components'

import {
  laneActivity,
  laneEnd,
  spanHue,
  spanMarks,
  type SpanMarkId,
} from '@overeng/agent-timeline/encodings'
import type { AgentTimelineScene, Lane } from '@overeng/agent-timeline/projection'
import { Span } from '@overeng/agent-timeline/span'

import { useTheme } from '../../theme.ts'
import { Legend } from './Legend.tsx'

const EXAMPLE_WIDTH = 440
const EXAMPLE_HEIGHT = 62
const SPAN_HEIGHT = 34
const SPAN_Y = 18
const WINDOW_PADDING_RATIO = 0.16

/** Trace scene, enabled marks, and example lanes used by the visual encoding guide. */
export interface ReadingGuideProps {
  readonly scene: AgentTimelineScene
  readonly marks: ReadonlySet<SpanMarkId>
  readonly exampleLaneIds: ReadonlyArray<string>
}

interface GuideCopy {
  readonly detail: string
  readonly callout: string
}

const GUIDE_COPY = {
  'context-histogram': {
    detail:
      'Each request resolves a fraction of that request model’s window. The faint top rule is 100%; outline-only steps have unknown model capacity.',
    callout: 'context histogram',
  },
  'context-estimate': {
    detail:
      'The dotted top edge continues across each billed-input estimate stretch so estimates remain distinct from measured context snapshots.',
    callout: 'context estimate',
  },
  binned: {
    detail:
      'The stippled interval is an honest aggregate: exact timing inside it is unavailable, while request, token, tool, model, stop, and spend totals are conserved. A hatched band spans the lowest to highest context fill of each compaction segment folded into it, drawn over the time between its first and last request.',
    callout: 'binned evidence',
  },
  activity: {
    detail:
      'Working is the histogram itself, waiting on a descendant is hatched behind it, and idle remains an empty gap.',
    callout: 'activity',
  },
  'compaction-marker': {
    detail:
      'The before → after label quantifies the reset while the notch fixes it to the event time.',
    callout: 'compaction marker',
  },
  'prompt-marker': {
    detail: 'Prompt markers appear only on root spans and sit at the human input time.',
    callout: 'prompt marker',
  },
  'steering-prompt-marker': {
    detail:
      'The hollow form distinguishes steering while preserving the prompt marker’s timing channel.',
    callout: 'steering prompt',
  },
  'span-end-active': {
    detail:
      'The active form stays open to the current edge. Active means no observed exit and a last request within the published idle threshold.',
    callout: 'span end · active',
  },
  'span-end-inactive': {
    detail:
      'The faded open form stops at last activity without claiming an exit. Inactive means no observed exit and a last request beyond the idle threshold.',
    callout: 'span end · inactive',
  },
  'span-end-exited': {
    detail:
      'The exited cap is reserved for a recorded session_exit event and does not imply that the result was adopted.',
    callout: 'span end · exited',
  },
  'span-end-failed': {
    detail:
      'The error colour and glyph make a failed final request legible without relying on colour alone.',
    callout: 'span end · failed',
  },
  'span-highlight': {
    detail:
      'Selection and find matches share this single outline, leaving agent-type hue available for comparison.',
    callout: 'span highlight',
  },
  'ancestor-dimming': {
    detail:
      'Follow the dimmed path through the session tree to reach the matching descendant without mistaking the ancestor for a match.',
    callout: 'ancestor dimming',
  },
  'turn-tick': {
    detail:
      'Nearby ticks may merge at narrower widths so completed turns remain visible without becoming noise.',
    callout: 'turn tick',
  },
  'model-change': {
    detail:
      'The tick anchors the time at which subsequent requests use the new model; hover names the model active at the cursor.',
    callout: 'model change',
  },
  'cursor-line': {
    detail:
      'The line follows the inspected timestamp across the span and anchors the span hover readout.',
    callout: 'cursor line',
  },
  'span-label': {
    detail:
      'The label repeats the span name only when the viewport leaves enough room for it to remain readable.',
    callout: 'span label',
  },
} as const satisfies Record<SpanMarkId, GuideCopy>

const READING_ORDER = {
  'context-histogram': 0,
  'context-estimate': 1,
  binned: 2,
  'compaction-marker': 3,
  activity: 4,
  'prompt-marker': 5,
  'steering-prompt-marker': 6,
  'span-end-active': 7,
  'span-end-inactive': 8,
  'span-end-exited': 9,
  'span-end-failed': 10,
  'span-highlight': 11,
  'ancestor-dimming': 12,
  'turn-tick': 13,
  'model-change': 14,
  'cursor-line': 15,
  'span-label': 16,
} as const satisfies Record<SpanMarkId, number>

interface GuideExample {
  readonly lane: Lane
  readonly from: number
  readonly to: number
  readonly targetTs: number
  readonly targetY: number
  readonly selected?: boolean
  readonly dimmed?: boolean
  readonly cursorTs?: number
}

const completeWindow = (scene: AgentTimelineScene, lane: Lane) => ({
  from: lane.session.startedAt,
  to: laneEnd(lane, scene),
})

const windowAround = (
  scene: AgentTimelineScene,
  lane: Lane,
  targetTs: number,
): { readonly from: number; readonly to: number } => {
  const start = lane.session.startedAt
  const end = laneEnd(lane, scene)
  const halfWindow = Math.max(
    scene.model.parameters.idleThresholdMs,
    (end - start) * WINDOW_PADDING_RATIO,
  )
  return {
    from: Math.max(start, targetTs - halfWindow),
    to: Math.min(end, targetTs + halfWindow),
  }
}

const lastRequestEndedWithError = (scene: AgentTimelineScene, lane: Lane): boolean =>
  scene.model.requests
    .filter((request) => request.sessionId === lane.session.id)
    .toSorted((left, right) => right.ts - left.ts)[0]?.stopReason === 'error'

const shortestActivityWindow = (
  scene: AgentTimelineScene,
  lane: Lane,
): { readonly from: number; readonly to: number; readonly targetTs: number } => {
  const segments = laneActivity(lane)
  let shortest: { readonly from: number; readonly to: number } | undefined
  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    const activity = new Set<string>()
    for (let endIndex = startIndex; endIndex < segments.length; endIndex += 1) {
      const segment = segments[endIndex]!
      activity.add(segment.state)
      if (activity.size < 3) continue
      const candidate = { from: segments[startIndex]!.from, to: segment.to }
      if (shortest === undefined || candidate.to - candidate.from < shortest.to - shortest.from) {
        shortest = candidate
      }
      break
    }
  }
  const window = shortest ?? completeWindow(scene, lane)
  const waiting = segments.find(
    (segment) =>
      segment.state === 'waiting' && segment.to >= window.from && segment.from <= window.to,
  )
  const target =
    waiting ?? segments.find((segment) => segment.to >= window.from && segment.from <= window.to)
  const padding = Math.max(scene.model.parameters.activeWithinMs, (window.to - window.from) * 0.08)
  return {
    from: Math.max(lane.session.startedAt, window.from - padding),
    to: Math.min(laneEnd(lane, scene), window.to + padding),
    targetTs: target === undefined ? (window.from + window.to) / 2 : (target.from + target.to) / 2,
  }
}

const selectGuideExample = (
  scene: AgentTimelineScene,
  exampleLaneIds: ReadonlyArray<string>,
  markId: SpanMarkId,
): GuideExample | undefined => {
  const candidates = exampleLaneIds.flatMap((id) => {
    const lane = scene.lanes.find((candidate) => candidate.session.id === id)
    return lane === undefined ? [] : [lane]
  })
  const first = (predicate: (lane: Lane) => boolean): Lane | undefined => candidates.find(predicate)
  const example = (
    lane: Lane | undefined,
    targetTs: number | undefined,
    targetY: number,
    options?: Pick<GuideExample, 'selected' | 'dimmed' | 'cursorTs'>,
    window?: { readonly from: number; readonly to: number },
  ): GuideExample | undefined => {
    if (lane === undefined || targetTs === undefined) return undefined
    return {
      lane,
      ...(window ?? windowAround(scene, lane, targetTs)),
      targetTs,
      targetY,
      ...options,
    }
  }

  switch (markId) {
    case 'context-histogram': {
      const lane = first((candidate) =>
        candidate.samples.some((sample) => sample.contextTokens !== null),
      )
      const sample = lane?.samples
        .filter((candidate) => candidate.contextTokens !== null)
        .toSorted((left, right) => (right.contextTokens ?? 0) - (left.contextTokens ?? 0))[0]
      return example(
        lane,
        sample?.ts,
        17,
        undefined,
        lane === undefined ? undefined : completeWindow(scene, lane),
      )
    }
    case 'context-estimate': {
      const request = scene.model.requests.find(
        (candidate) =>
          candidate.contextTokens === null && exampleLaneIds.includes(candidate.sessionId),
      )
      const lane =
        request === undefined
          ? undefined
          : first((candidate) => candidate.session.id === request.sessionId)
      return example(lane, request?.ts, 9)
    }
    case 'binned': {
      const lane = first((candidate) => candidate.bins.length > 0)
      const bin = lane?.bins[0]
      return example(lane, bin === undefined ? undefined : (bin.from + bin.to) / 2, 17)
    }
    case 'activity': {
      const lane =
        first((candidate) => {
          const activity = new Set(laneActivity(candidate).map((segment) => segment.state))
          return activity.size === 3
        }) ?? first((candidate) => laneActivity(candidate).length > 1)
      if (lane === undefined) return undefined
      const window = shortestActivityWindow(scene, lane)
      return example(lane, window.targetTs, 29, undefined, window)
    }
    case 'compaction-marker': {
      const lane = first((candidate) => candidate.compactions.length > 0)
      const compaction =
        lane?.compactions.find(
          (candidate) => candidate.before !== null && candidate.after !== null,
        ) ?? lane?.compactions[0]
      return example(lane, compaction?.ts, 8)
    }
    case 'prompt-marker': {
      const lane = first((candidate) => candidate.humanPrompts.some((prompt) => !prompt.steering))
      const prompt = lane?.humanPrompts.find((candidate) => !candidate.steering)
      return example(lane, prompt?.ts, 6)
    }
    case 'steering-prompt-marker': {
      const lane = first((candidate) => candidate.humanPrompts.some((prompt) => prompt.steering))
      const prompt = lane?.humanPrompts.find((candidate) => candidate.steering)
      return example(lane, prompt?.ts, 6)
    }
    case 'span-end-active': {
      const lane = first((candidate) => candidate.status._tag === 'active')
      if (lane === undefined) return undefined
      const end = laneEnd(lane, scene)
      return example(lane, end, 17, undefined, {
        from: Math.max(lane.session.startedAt, end - (end - lane.session.startedAt) * 0.4),
        to: end,
      })
    }
    case 'span-end-inactive': {
      const lane = first((candidate) => candidate.status._tag === 'inactive')
      if (lane === undefined) return undefined
      const end = laneEnd(lane, scene)
      return example(lane, end, 17, undefined, {
        from: Math.max(lane.session.startedAt, end - (end - lane.session.startedAt) * 0.4),
        to: end,
      })
    }
    case 'span-end-exited': {
      const lane = first(
        (candidate) =>
          candidate.status._tag === 'exited' && !lastRequestEndedWithError(scene, candidate),
      )
      if (lane === undefined) return undefined
      const end = laneEnd(lane, scene)
      return example(lane, end, 17, undefined, {
        from: Math.max(lane.session.startedAt, end - (end - lane.session.startedAt) * 0.4),
        to: end,
      })
    }
    case 'span-end-failed': {
      const lane = first(
        (candidate) =>
          candidate.status._tag === 'exited' && lastRequestEndedWithError(scene, candidate),
      )
      if (lane === undefined) return undefined
      const end = laneEnd(lane, scene)
      return example(lane, end, 17, undefined, {
        from: Math.max(lane.session.startedAt, end - (end - lane.session.startedAt) * 0.4),
        to: end,
      })
    }
    case 'span-highlight': {
      const lane = first((candidate) => candidate.compactions.length > 0) ?? candidates[0]
      if (lane === undefined) return undefined
      const window = completeWindow(scene, lane)
      return example(lane, (window.from + window.to) / 2, 8, { selected: true }, window)
    }
    case 'ancestor-dimming': {
      const lane =
        first((candidate) =>
          scene.forks.some((fork) => fork.parentSessionId === candidate.session.id),
        ) ?? candidates[0]
      if (lane === undefined) return undefined
      const window = completeWindow(scene, lane)
      return example(lane, (window.from + window.to) / 2, 17, { dimmed: true }, window)
    }
    case 'turn-tick': {
      const lane = first((candidate) => candidate.samples.some((sample) => sample.isAgentTurn))
      const sample = lane?.samples.find((candidate) => candidate.isAgentTurn)
      return example(lane, sample?.ts, 17)
    }
    case 'model-change': {
      const lane = first((candidate) =>
        candidate.models.some((entry) => entry.from > candidate.session.startedAt),
      )
      const change = lane?.models.find((entry) => entry.from > lane.session.startedAt)
      return example(lane, change?.from, 8)
    }
    case 'cursor-line': {
      const lane = first((candidate) => candidate.samples.length > 0)
      const sample = lane?.samples[Math.floor((lane?.samples.length ?? 1) / 2)]
      return example(
        lane,
        sample?.ts,
        17,
        sample === undefined ? undefined : { cursorTs: sample.ts },
      )
    }
    case 'span-label': {
      const lane = first((candidate) => candidate.session.name !== null) ?? candidates[0]
      if (lane === undefined) return undefined
      const window = completeWindow(scene, lane)
      return example(lane, (window.from + window.to) / 2, 17, undefined, window)
    }
  }
}

const GuideMarkExample = ({
  scene,
  marks,
  exampleLaneIds,
  markId,
  callout = GUIDE_COPY[markId].callout,
}: ReadingGuideProps & {
  readonly markId: SpanMarkId
  readonly callout?: string
}): React.ReactNode => {
  const theme = useTheme()
  const selected = selectGuideExample(scene, exampleLaneIds, markId)
  if (selected === undefined) {
    return (
      <div role="status" {...stylex.props(styles.missingExample)}>
        No real-fixture example is available for this span mark.
      </div>
    )
  }

  const duration = Math.max(1, selected.to - selected.from)
  const x = (ts: number): number => 16 + ((ts - selected.from) / duration) * (EXAMPLE_WIDTH - 32)
  const targetX = Math.min(EXAMPLE_WIDTH - 8, Math.max(8, x(selected.targetTs)))

  return (
    <svg
      width="100%"
      height={EXAMPLE_HEIGHT}
      viewBox={`0 0 ${EXAMPLE_WIDTH} ${EXAMPLE_HEIGHT}`}
      role="img"
      aria-label={`${callout} on a real span`}
      {...stylex.props(styles.example)}
    >
      <g transform={`translate(0 ${SPAN_Y})`}>
        <Span
          lane={selected.lane}
          scene={scene}
          x={x}
          width={EXAMPLE_WIDTH}
          height={SPAN_HEIGHT}
          hue={spanHue(selected.lane, scene, theme)}
          segments={laneActivity(selected.lane)}
          marks={marks}
          {...(selected.selected === undefined ? {} : { selected: selected.selected })}
          {...(selected.dimmed === undefined ? {} : { dimmed: selected.dimmed })}
          cursorTs={selected.cursorTs ?? null}
        />
      </g>
      <text
        x="8"
        y="10"
        fill={tokens['--ds-gray-900']}
        fontFamily={scale.fontSans}
        fontSize="10"
        fontWeight="600"
      >
        {callout}
      </text>
      <line
        x1="128"
        y1="8"
        x2={targetX}
        y2={SPAN_Y + selected.targetY}
        stroke={tokens['--ds-gray-700']}
        strokeWidth="1"
      />
      <circle cx={targetX} cy={SPAN_Y + selected.targetY} r="2" fill={tokens['--ds-gray-900']} />
    </svg>
  )
}

/** Registry-driven overlay that teaches every span mark currently drawn. */
export const ReadingGuide = ({
  scene,
  marks,
  exampleLaneIds,
}: ReadingGuideProps): React.ReactNode => {
  const theme = useTheme()
  const visibleMarks = spanMarks
    .filter((mark) => marks.has(mark.id))
    .toSorted((left, right) => READING_ORDER[left.id] - READING_ORDER[right.id])

  return (
    <Modal isDismissable data-theme={theme} {...stylex.props(styles.modal)}>
      <Dialog aria-labelledby="trace-reading-guide-title" {...stylex.props(styles.dialog)}>
        {({ close }) => (
          <>
            <header {...stylex.props(styles.header)}>
              <div>
                <Heading
                  id="trace-reading-guide-title"
                  slot="title"
                  {...stylex.props(styles.title)}
                >
                  Reading guide
                </Heading>
                <p {...stylex.props(styles.introduction)}>
                  Read one span from left to right. Hue identifies agent type; each row below
                  isolates a span mark drawn in this agent timeline.
                </p>
              </div>
              <TooltipTrigger delay={300}>
                <Button
                  aria-label="Close reading guide"
                  onPress={close}
                  {...stylex.props(styles.closeButton)}
                >
                  ×
                </Button>
                <Tooltip {...stylex.props(styles.tooltip)}>Close reading guide</Tooltip>
              </TooltipTrigger>
            </header>
            <section {...stylex.props(styles.legendSection)}>
              <h2 {...stylex.props(styles.sectionTitle)}>Legend</h2>
              <Legend scene={scene} marks={marks} />
              <p {...stylex.props(styles.legendRules)}>
                Status uses the {Math.round(scene.model.parameters.idleThresholdMs / 60_000)}-minute
                idle threshold: active has no observed exit and recent requests; inactive has no
                observed exit and older activity; exited requires a recorded exit. Wall is first to
                last request. Active is the sum of inter-request gaps at or below{' '}
                {Math.round(scene.model.parameters.activeWithinMs / 60_000)} minutes, matching
                omp-usage.
              </p>
            </section>
            <div {...stylex.props(styles.rows)}>
              <section {...stylex.props(styles.row)}>
                <div {...stylex.props(styles.copy)}>
                  <h3 {...stylex.props(styles.markLabel)}>Span and agent-type hue</h3>
                  <p {...stylex.props(styles.description)}>
                    One span represents one agent session. Active spans remain open to now, inactive
                    spans have a faded open end at last activity, and only a recorded exit receives
                    a cap. Hue identifies agent type.
                  </p>
                </div>
                <GuideMarkExample
                  scene={scene}
                  marks={marks}
                  exampleLaneIds={exampleLaneIds}
                  markId="context-histogram"
                  callout="agent-type hue"
                />
              </section>
              {visibleMarks.map((mark) => (
                <section
                  key={mark.id}
                  data-testid="trace-reading-guide-row"
                  data-span-mark={mark.id}
                  {...stylex.props(styles.row)}
                >
                  <div {...stylex.props(styles.copy)}>
                    <h3 {...stylex.props(styles.markLabel)}>{mark.label}</h3>
                    <p {...stylex.props(styles.description)}>
                      {mark.description} {GUIDE_COPY[mark.id].detail}
                    </p>
                  </div>
                  <GuideMarkExample
                    scene={scene}
                    marks={marks}
                    exampleLaneIds={exampleLaneIds}
                    markId={mark.id}
                  />
                </section>
              ))}
            </div>
            <footer {...stylex.props(styles.footer)}>
              <strong>Reading order</strong>
              <span>
                Span and agent-type hue → context fraction and provenance → binned evidence →
                compaction and model changes → activity → prompt marker → span status → highlight
                and ancestor dimming.
              </span>
            </footer>
          </>
        )}
      </Dialog>
    </Modal>
  )
}

const styles = stylex.create({
  modal: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'grid',
    placeItems: 'center',
    padding: scale.space4,
    backgroundColor: 'color-mix(in srgb, var(--ds-background-100) 68%, transparent)',
  },
  dialog: {
    display: 'flex',
    flexDirection: 'column',
    width: 720,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    boxShadow: tokens['--ds-shadow-medium'],
    outline: 'none',
    fontFamily: scale.fontSans,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: scale.space4,
    flex: 'none',
    paddingBlock: scale.space4,
    paddingInline: scale.space5,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
  },
  title: {
    margin: 0,
    color: tokens['--ds-foreground'],
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  introduction: {
    maxWidth: 560,
    marginBlock: scale.space1,
    marginInline: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.78rem',
    lineHeight: 1.5,
  },
  closeButton: {
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    width: 28,
    height: 28,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': tokens['--ds-gray-alpha-200'],
      ':active': tokens['--ds-gray-alpha-300'],
    },
    color: tokens['--ds-gray-900'],
    font: 'inherit',
    fontSize: '1rem',
    lineHeight: 1,
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  legendSection: {
    flex: 'none',
    paddingBlockStart: scale.space3,
    paddingInline: scale.space5,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-300'],
  },
  legendRules: {
    marginBlock: scale.space2,
    color: tokens['--ds-gray-800'],
    fontSize: '0.7rem',
    lineHeight: 1.45,
  },
  sectionTitle: {
    marginBlock: 0,
    color: tokens['--ds-foreground'],
    fontSize: '0.78rem',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  tooltip: {
    maxWidth: 320,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    fontSize: '0.68rem',
    outline: 'none',
  },
  rows: {
    minHeight: 0,
    overflowY: 'auto',
    scrollbarGutter: 'stable',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 0.86fr) minmax(320px, 1.14fr)',
      '@media (max-width: 680px)': 'minmax(0, 1fr)',
    },
    gap: scale.space5,
    alignItems: 'center',
    paddingBlock: scale.space4,
    paddingInline: scale.space5,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-300'],
  },
  copy: {
    minWidth: 0,
  },
  markLabel: {
    margin: 0,
    color: tokens['--ds-foreground'],
    fontSize: '0.78rem',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  description: {
    marginBlockStart: scale.space1,
    marginBlockEnd: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.72rem',
    lineHeight: 1.5,
  },
  example: {
    display: 'block',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-100'],
  },
  missingExample: {
    display: 'grid',
    placeItems: 'center',
    minHeight: EXAMPLE_HEIGHT,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    color: tokens['--ds-gray-700'],
    fontSize: '0.7rem',
  },
  footer: {
    display: 'flex',
    gap: scale.space2,
    flexDirection: {
      default: 'row',
      '@media (max-width: 680px)': 'column',
    },
    flex: 'none',
    paddingBlock: scale.space3,
    paddingInline: scale.space5,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-800'],
    fontSize: '0.7rem',
    lineHeight: 1.45,
  },
})
