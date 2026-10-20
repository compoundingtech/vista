/**
 * ## Reading
 * Read the context histogram first: height is the fraction of each request model’s context window,
 * the faint top rule is 100%, and an outline-only step means that capacity is unknown. A dotted top
 * edge marks an estimated point. Light stipple marks folded evidence retained in a fixed time bin;
 * a hatched band inside it spans the min–max context fill of each compaction segment folded there.
 * Waiting on descendants is a light hatch; waiting and idle stretches break the area. Compaction
 * and model-change ticks preserve temporal events. Span ends distinguish active, inactive, exited,
 * and failed. Span highlight and ancestor dimming preserve session tree context.
 */
import * as React from 'react'

import { tokens } from '@vista/ui/tokens.stylex'

import { laneEnd, spanDetailTier, spanMarkIsVisible } from './encodings.ts'
import type { SpanMarkId } from './encodings.ts'
import { sessionLabel } from './labels.ts'
import type { AgentTimelineScene, Lane } from './projection.ts'
import type { ActivitySegment, SpanHue } from './types.ts'

const BAR_Y = 8
const BAR_HEIGHT = 18
const MIN_SPAN_WIDTH = 1.5
const MIN_CONTEXT_STEP_WIDTH = 1
const MERGED_TICK_DISTANCE = 2
const MIN_CONTEXT_BAND_HEIGHT = 1
const COMPACTION_LABEL_WIDTH = 68
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const errorSessionIdsByScene = new WeakMap<AgentTimelineScene, ReadonlySet<string>>()

const errorSessionIds = (scene: AgentTimelineScene): ReadonlySet<string> => {
  const cached = errorSessionIdsByScene.get(scene)
  if (cached !== undefined) return cached
  const latest = new Map<string, { readonly ts: number; readonly stopReason: string }>()
  for (const request of scene.model.requests) {
    if (request.ts >= (latest.get(request.sessionId)?.ts ?? Number.NEGATIVE_INFINITY)) {
      latest.set(request.sessionId, { ts: request.ts, stopReason: request.stopReason })
    }
  }
  const sessionIds = new Set(
    Array.from(latest)
      .filter(([, request]) => request.stopReason === 'error')
      .map(([sessionId]) => sessionId),
  )
  errorSessionIdsByScene.set(scene, sessionIds)
  return sessionIds
}

const visibleRange = (
  from: number,
  to: number,
  x: (ts: number) => number,
  width: number,
): { readonly x: number; readonly width: number } | undefined => {
  const left = clamp(x(from), 0, width)
  const right = clamp(x(to), 0, width)
  return right > left ? { x: left, width: right - left } : undefined
}

interface ContextStep {
  readonly key: string
  readonly x: number
  readonly width: number
  readonly height: number
  readonly estimated: boolean
  readonly unknownCapacity: boolean
}

/**
 * Build the context histogram at request resolution. Samples form one step area per projected
 * working segment, holding the last value through the segment end. Waiting and idle segments are
 * the only gaps; max-per-pixel downsampling keeps every aggregate within one pixel column.
 */
const contextStepArea = (
  lane: Lane,
  x: (ts: number) => number,
  width: number,
): ReadonlyArray<ContextStep> => {
  if (lane.samples.length === 1) {
    const sample = lane.samples[0]!
    const height =
      sample.contextFraction === null
        ? BAR_HEIGHT
        : clamp(sample.contextFraction, 0, 1) * BAR_HEIGHT
    const center = x(sample.ts)
    if (center < 0 || center > width) return []
    let left = clamp(center, 0, width)
    let right = Math.min(width, left + MIN_CONTEXT_STEP_WIDTH)
    if (right - left < MIN_CONTEXT_STEP_WIDTH) {
      left = Math.max(0, right - MIN_CONTEXT_STEP_WIDTH)
    }
    return right <= left || height <= 0
      ? []
      : [
          {
            key: 'isolated',
            x: left,
            width: right - left,
            height,
            estimated: sample.isContextEstimated,
            unknownCapacity: sample.contextFraction === null,
          },
        ]
  }

  let sampleIndex = 0

  return lane.activity
    .filter((segment) => segment.state === 'working')
    .flatMap((segment, runIndex) => {
      while (
        lane.samples[sampleIndex] !== undefined &&
        lane.samples[sampleIndex]!.ts < segment.from
      ) {
        sampleIndex += 1
      }

      const run: Array<{
        readonly x: number
        readonly height: number
        readonly estimated: boolean
        readonly unknownCapacity: boolean
      }> = []
      while (
        lane.samples[sampleIndex] !== undefined &&
        lane.samples[sampleIndex]!.ts <= segment.to
      ) {
        const sample = lane.samples[sampleIndex]!
        run.push({
          x: x(sample.ts),
          height:
            sample.contextFraction === null
              ? BAR_HEIGHT
              : clamp(sample.contextFraction, 0, 1) * BAR_HEIGHT,
          estimated: sample.isContextEstimated,
          unknownCapacity: sample.contextFraction === null,
        })
        sampleIndex += 1
      }

      const segmentLeft = x(segment.from)
      const segmentRight = x(segment.to)
      if (run.length === 0 || segmentRight < -MIN_CONTEXT_STEP_WIDTH || segmentLeft > width)
        return []

      const byColumn: Array<{
        readonly column: number
        readonly firstX: number
        readonly height: number
        readonly estimated: boolean
        readonly unknownCapacity: boolean
        readonly count: number
      }> = []
      for (const sample of run) {
        const column = Math.floor(sample.x)
        const previous = byColumn.at(-1)
        if (previous?.column !== column) {
          byColumn.push({
            column,
            firstX: sample.x,
            height: sample.height,
            estimated: sample.estimated,
            unknownCapacity: sample.unknownCapacity,
            count: 1,
          })
          continue
        }
        const takesMaximum = sample.height > previous.height
        byColumn[byColumn.length - 1] = {
          column,
          firstX: previous.firstX,
          height: takesMaximum ? sample.height : previous.height,
          estimated: takesMaximum
            ? sample.estimated
            : previous.estimated || (sample.height === previous.height && sample.estimated),
          unknownCapacity: previous.unknownCapacity || sample.unknownCapacity,
          count: previous.count + 1,
        }
      }

      return byColumn.flatMap((sample, index) => {
        const next = byColumn[index + 1]
        const rawLeft = index === 0 ? segmentLeft : sample.count > 1 ? sample.column : sample.firstX
        const rawRight =
          next === undefined ? segmentRight : next.count > 1 ? next.column : next.firstX
        let left = clamp(rawLeft, 0, width)
        let right = clamp(rawRight, 0, width)
        if (right - left < MIN_CONTEXT_STEP_WIDTH) {
          if (right >= width) left = Math.max(0, right - MIN_CONTEXT_STEP_WIDTH)
          else right = Math.min(width, left + MIN_CONTEXT_STEP_WIDTH)
        }
        if (right <= left || sample.height <= 0) return []
        return [
          {
            key: `${runIndex}:${sample.column}`,
            x: left,
            width: right - left,
            height: sample.height,
            estimated: sample.estimated,
            unknownCapacity: sample.unknownCapacity,
          },
        ]
      })
    })
}

interface TurnTick {
  readonly key: string
  readonly x: number
}

const mergeTurnTicks = (ticks: ReadonlyArray<TurnTick>): ReadonlyArray<TurnTick> => {
  const merged: TurnTick[] = []
  for (const tick of ticks) {
    const previous = merged.at(-1)
    if (previous === undefined || tick.x - previous.x >= MERGED_TICK_DISTANCE) merged.push(tick)
  }
  return merged
}

const formatContextTokens = (tokensValue: number | null): string =>
  tokensValue === null
    ? '—'
    : tokensValue >= 1_000
      ? `${Math.round(tokensValue / 1_000)}k`
      : `${tokensValue}`

/** Geometry, evidence, and visual state used to draw one session span in an SVG lane. */
export interface SpanProps {
  readonly lane: Lane
  readonly scene: AgentTimelineScene
  readonly x: (ts: number) => number
  readonly width: number
  readonly height: number
  readonly hue: SpanHue
  readonly segments: ReadonlyArray<ActivitySegment>
  readonly marks?: ReadonlySet<SpanMarkId>
  readonly selected?: boolean
  readonly dimmed?: boolean
  readonly cursorTs?: number | null
}

/** Render one agent-session span into the caller-owned SVG. */
export const Span = React.memo(
  ({
    lane,
    scene,
    x,
    width,
    height,
    hue,
    segments,
    marks,
    selected = false,
    dimmed = false,
    cursorTs = null,
  }: SpanProps): React.ReactElement => {
    const startX = clamp(x(lane.session.startedAt), 0, width)
    const rawEndX = x(laneEnd(lane, scene))
    const endX = clamp(rawEndX, 0, width)
    const spanWidth = Math.max(endX - startX, MIN_SPAN_WIDTH)
    const tier = spanDetailTier(spanWidth)
    const markIsVisible = (id: SpanMarkId): boolean =>
      (marks === undefined || marks.has(id)) && spanMarkIsVisible(id, tier)
    const histogram = React.useMemo(() => contextStepArea(lane, x, width), [lane, width, x])
    const visibleSegments = React.useMemo(
      () =>
        segments.flatMap((segment) => {
          const range = visibleRange(segment.from, segment.to, x, width)
          return range === undefined ? [] : [{ ...segment, ...range }]
        }),
      [segments, width, x],
    )
    const positions = lane.samples.flatMap((sample) => {
      const turnX = x(sample.ts)
      return sample.isAgentTurn && turnX >= startX && turnX <= endX
        ? [{ key: `${sample.ts}:${sample.requests}`, x: turnX }]
        : []
    })
    const turnPositions = tier === 'span-content' ? mergeTurnTicks(positions) : positions
    const visibleModelChanges = React.useMemo(
      () =>
        lane.models
          .filter((entry) => entry.from > lane.session.startedAt)
          .flatMap((entry) => {
            const eventX = x(entry.from)
            return eventX >= startX && eventX <= endX ? [{ ...entry, x: eventX }] : []
          }),
      [endX, lane.models, lane.session.startedAt, startX, x],
    )
    const visibleBins = React.useMemo(
      () =>
        lane.bins.flatMap((bin) => {
          const range = visibleRange(bin.from, bin.to, x, width)
          return range === undefined ? [] : [{ ...bin, ...range }]
        }),
      [lane.bins, width, x],
    )
    const visibleContextBands = React.useMemo(
      () =>
        lane.contextBands.flatMap((band) => {
          const fromX = x(band.from)
          const toX = x(band.to)
          if (toX < 0 || fromX > width) return []
          const left = clamp(fromX, 0, width)
          const right = clamp(Math.max(toX, left + MIN_CONTEXT_STEP_WIDTH), 0, width)
          if (right <= left) return []
          const top = BAR_Y + BAR_HEIGHT - clamp(band.maxFraction, 0, 1) * BAR_HEIGHT
          const bottom = BAR_Y + BAR_HEIGHT - clamp(band.minFraction, 0, 1) * BAR_HEIGHT
          const bandHeight = Math.max(bottom - top, MIN_CONTEXT_BAND_HEIGHT)
          return [
            {
              key: `${band.from}:${band.compactionEpoch}`,
              x: left,
              width: right - left,
              y: Math.min(top, BAR_Y + BAR_HEIGHT - bandHeight),
              height: bandHeight,
              approximate: band.estimated || band.partialCapacity,
            },
          ]
        }),
      [lane.contextBands, width, x],
    )
    let occupiedUntil = startX
    const visibleCompactions = lane.compactions.flatMap((event) => {
      const eventX = x(event.ts)
      if (eventX < startX || eventX > endX) return []
      let labelSide: 'right' | 'left' | null = null
      if (tier === 'span-label' && event.before !== null && event.after !== null) {
        const rightStart = eventX + 5
        const rightEnd = rightStart + COMPACTION_LABEL_WIDTH
        const leftStart = eventX - 5 - COMPACTION_LABEL_WIDTH
        if (rightStart >= occupiedUntil && rightEnd <= endX) {
          labelSide = 'right'
          occupiedUntil = rightEnd + 4
        } else if (leftStart >= occupiedUntil && eventX - 5 <= endX) {
          labelSide = 'left'
          occupiedUntil = eventX + 4
        }
      }
      return [{ event, eventX, labelSide }]
    })
    const id = React.useId().replaceAll(':', '-')
    const clipId = `${id}-span`
    const waitingPatternId = `${id}-waiting`
    const binnedPatternId = `${id}-binned`
    const bandPatternId = `${id}-context-band`
    const cursorX = cursorTs === null ? null : x(cursorTs)
    const endedWithError =
      lane.status._tag === 'exited' && errorSessionIds(scene).has(lane.session.id)
    const terminalVisible = rawEndX >= 0 && rawEndX <= width
    const label = sessionLabel(lane.session).primary

    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={startX} y={BAR_Y} width={spanWidth} height={BAR_HEIGHT} rx={2} />
          </clipPath>
          <pattern
            id={waitingPatternId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke={hue.strong} strokeWidth="1" opacity="0.34" />
          </pattern>
          <pattern id={binnedPatternId} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.65" fill={tokens['--ds-gray-700']} opacity="0.44" />
          </pattern>
          <pattern
            id={bandPatternId}
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <line x1="0" y1="0" x2="0" y2="3" stroke={hue.base} strokeWidth="1.1" />
          </pattern>
        </defs>
        <g opacity={markIsVisible('ancestor-dimming') && dimmed ? 0.26 : 1}>
          <rect
            x={startX}
            y={BAR_Y}
            width={spanWidth}
            height={BAR_HEIGHT}
            rx={2}
            fill={tokens['--ds-gray-alpha-100']}
            stroke={
              markIsVisible('span-highlight') && selected ? tokens['--ds-amber-900'] : hue.strong
            }
            strokeWidth={markIsVisible('span-highlight') && selected ? 2 : 0.8}
          />
          <g clipPath={`url(#${clipId})`}>
            {markIsVisible('binned')
              ? visibleBins.map((bin) => (
                  <rect
                    key={`${bin.from}:${bin.to}`}
                    x={bin.x}
                    y={BAR_Y}
                    width={bin.width}
                    height={BAR_HEIGHT}
                    fill={`url(#${binnedPatternId})`}
                  />
                ))
              : null}
            {markIsVisible('binned') && markIsVisible('context-histogram')
              ? visibleContextBands.map((band) => (
                  <rect
                    key={band.key}
                    data-context-band
                    x={band.x}
                    y={band.y}
                    width={band.width}
                    height={band.height}
                    fill={`url(#${bandPatternId})`}
                    stroke={hue.base}
                    strokeWidth={0.6}
                    strokeDasharray={band.approximate ? '1 2' : undefined}
                    opacity={0.8}
                  />
                ))
              : null}
            {markIsVisible('activity')
              ? visibleSegments
                  .filter((segment) => segment.state === 'waiting')
                  .map((segment) => (
                    <rect
                      key={`${segment.from}:waiting`}
                      x={segment.x}
                      y={BAR_Y}
                      width={segment.width}
                      height={BAR_HEIGHT}
                      fill={`url(#${waitingPatternId})`}
                    />
                  ))
              : null}
            {markIsVisible('context-histogram') ? (
              <>
                <line
                  x1={startX}
                  x2={endX}
                  y1={BAR_Y + 0.5}
                  y2={BAR_Y + 0.5}
                  stroke={hue.strong}
                  strokeWidth={0.75}
                  opacity={0.24}
                />
                {histogram.map((bucket) =>
                  bucket.unknownCapacity ? (
                    <rect
                      key={bucket.key}
                      x={bucket.x}
                      y={BAR_Y + 1}
                      width={bucket.width}
                      height={BAR_HEIGHT - 2}
                      fill="none"
                      stroke={hue.base}
                      strokeWidth={0.85}
                      opacity={0.72}
                    />
                  ) : (
                    <rect
                      key={bucket.key}
                      x={bucket.x}
                      y={BAR_Y + BAR_HEIGHT - bucket.height}
                      width={bucket.width}
                      height={bucket.height}
                      fill={hue.base}
                      opacity={0.86}
                    />
                  ),
                )}
              </>
            ) : null}
            {markIsVisible('context-estimate')
              ? histogram
                  .filter((bucket) => bucket.estimated)
                  .map((bucket) => (
                    <line
                      key={`${bucket.key}:estimate`}
                      x1={bucket.x}
                      x2={bucket.x + bucket.width}
                      y1={BAR_Y + BAR_HEIGHT - bucket.height}
                      y2={BAR_Y + BAR_HEIGHT - bucket.height}
                      stroke={hue.text}
                      strokeWidth={1.2}
                      strokeDasharray="1 3"
                      opacity={0.9}
                    />
                  ))
              : null}
            {markIsVisible('compaction-marker')
              ? visibleCompactions.map(({ event, eventX, labelSide }) => {
                  const compactionLabel = `${formatContextTokens(event.before)} → ${formatContextTokens(event.after)}`
                  return (
                    <g key={event.ts}>
                      <path
                        d={`M${eventX - 3},${BAR_Y} L${eventX},${BAR_Y + 4} L${eventX + 3},${BAR_Y}`}
                        fill={tokens['--ds-background-100']}
                        stroke={hue.strong}
                        strokeWidth={0.8}
                      />
                      <line
                        x1={eventX}
                        x2={eventX}
                        y1={BAR_Y + 4}
                        y2={BAR_Y + BAR_HEIGHT}
                        stroke={tokens['--ds-background-100']}
                        strokeWidth={1.5}
                      />
                      {labelSide === null ? null : (
                        <text
                          x={eventX + (labelSide === 'right' ? 5 : -5)}
                          y={BAR_Y + 7}
                          textAnchor={labelSide === 'right' ? 'start' : 'end'}
                          fill={tokens['--ds-foreground']}
                          stroke={tokens['--ds-background-100']}
                          strokeWidth={2}
                          paintOrder="stroke"
                          fontSize={8}
                          fontWeight={600}
                          pointerEvents="none"
                        >
                          {compactionLabel}
                        </text>
                      )}
                    </g>
                  )
                })
              : null}
            {markIsVisible('span-label') ? (
              <text
                x={startX + 5}
                y={BAR_Y + 16}
                fill={hue.text}
                fontSize={8}
                fontWeight={600}
                opacity={0.78}
                pointerEvents="none"
              >
                {label}
              </text>
            ) : null}
          </g>
          {markIsVisible('turn-tick')
            ? turnPositions.map((turn) => (
                <line
                  key={turn.key}
                  x1={turn.x}
                  x2={turn.x}
                  y1={BAR_Y + BAR_HEIGHT - 8}
                  y2={BAR_Y + BAR_HEIGHT - 1}
                  stroke={hue.text}
                  strokeWidth={1.2}
                  opacity={0.9}
                />
              ))
            : null}
          {markIsVisible('model-change')
            ? visibleModelChanges.map((entry) => (
                <line
                  key={`${entry.from}:${entry.model}`}
                  x1={entry.x}
                  x2={entry.x}
                  y1={BAR_Y - 1}
                  y2={BAR_Y + 6}
                  stroke={tokens['--ds-purple-900']}
                  strokeWidth={1.5}
                />
              ))
            : null}
          {lane.depth === 0 &&
          (markIsVisible('prompt-marker') || markIsVisible('steering-prompt-marker'))
            ? lane.humanPrompts.flatMap((prompt) => {
                const promptX = x(prompt.ts)
                const visible = markIsVisible(
                  prompt.steering ? 'steering-prompt-marker' : 'prompt-marker',
                )
                if (!visible || promptX < startX || promptX > endX) return []
                return [
                  <path
                    key={prompt.ts}
                    d={`M${promptX - 4},${BAR_Y - 2} L${promptX + 4},${BAR_Y - 2} L${promptX},${BAR_Y + 2} Z`}
                    fill={
                      prompt.steering ? tokens['--ds-background-100'] : tokens['--ds-amber-900']
                    }
                    stroke={tokens['--ds-amber-900']}
                    strokeWidth={0.9}
                  />,
                ]
              })
            : null}
          {terminalVisible && lane.status._tag === 'active' && markIsVisible('span-end-active') ? (
            <g transform={`translate(${endX} ${BAR_Y + BAR_HEIGHT / 2})`}>
              <circle
                r={4}
                fill={tokens['--ds-background-100']}
                stroke={tokens['--ds-green-900']}
                strokeWidth={1.5}
              />
              <circle r={1.4} fill={tokens['--ds-green-900']} />
            </g>
          ) : null}
          {terminalVisible &&
          lane.status._tag === 'inactive' &&
          markIsVisible('span-end-inactive') ? (
            <circle
              cx={endX}
              cy={BAR_Y + BAR_HEIGHT / 2}
              r={4}
              fill={tokens['--ds-background-100']}
              stroke={tokens['--ds-gray-700']}
              strokeWidth={1.2}
              strokeDasharray="1 1"
              opacity={0.62}
            />
          ) : null}
          {terminalVisible &&
          lane.status._tag === 'exited' &&
          !endedWithError &&
          markIsVisible('span-end-exited') ? (
            <line
              x1={endX}
              x2={endX}
              y1={BAR_Y - 1}
              y2={BAR_Y + BAR_HEIGHT + 1}
              stroke={hue.strong}
              strokeWidth={1.6}
            />
          ) : null}
          {terminalVisible && endedWithError && markIsVisible('span-end-failed') ? (
            <g stroke={tokens['--ds-red-900']} strokeWidth={1.6}>
              <line x1={endX} x2={endX} y1={BAR_Y - 1} y2={BAR_Y + BAR_HEIGHT + 1} />
              <line x1={endX - 2.5} x2={endX + 2.5} y1={BAR_Y + 6} y2={BAR_Y + 11} />
              <line x1={endX + 2.5} x2={endX - 2.5} y1={BAR_Y + 6} y2={BAR_Y + 11} />
            </g>
          ) : null}
        </g>
        {markIsVisible('cursor-line') && cursorX !== null && cursorX >= 0 && cursorX <= width ? (
          <line
            x1={cursorX}
            x2={cursorX}
            y1={0}
            y2={height}
            stroke={tokens['--ds-red-900']}
            strokeWidth={1}
            pointerEvents="none"
          />
        ) : null}
      </g>
    )
  },
)
Span.displayName = 'Span'
