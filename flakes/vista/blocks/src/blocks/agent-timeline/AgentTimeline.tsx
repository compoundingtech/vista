/** Interactive Grafana-style trace view for projected agent-session trees. */
import { RegistryContext, useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { Atom } from 'effect/reactivity'
import * as React from 'react'
import {
  Button,
  DialogTrigger,
  GridList,
  GridListItem,
  Group,
  Input,
  SearchField,
  Separator,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components'
import type { Key, Selection } from 'react-aria-components'

import { SpanDetails } from '@overeng/agent-timeline/detail'
import {
  laneActivity,
  laneEnd,
  spanHue,
  spanHueMap,
  spanMarks,
} from '@overeng/agent-timeline/encodings'
import type { AgentTimelineScene, Lane } from '@overeng/agent-timeline/projection'
import { Span } from '@overeng/agent-timeline/span'
import type {
  ActivitySegment,
  SpanHue,
  TraceCursor,
  TraceViewport,
} from '@overeng/agent-timeline/types'

import { useTheme } from '../../theme.ts'
import { MinimapHover } from './MinimapHover.tsx'
import {
  clampTraceViewport,
  defaultNavigation,
  MIN_TRACE_VIEWPORT_MS,
  useTraceNavigation,
} from './navigation.ts'
import type { NavigationScheme } from './navigation.ts'
import { usePointerDrag } from './pointer-drag.ts'
import { countTraceRender, TraceProfiler } from './profiler.tsx'
import { ReadingGuide } from './ReadingGuide.tsx'
import { hiddenValues } from './refresh.ts'
import { SessionTree } from './SessionTree.tsx'
import { SpanHover, timelineHoverPoint, useTimelineHover } from './SpanHover.tsx'
import type { TimelineHoverPoint } from './SpanHover.tsx'
import { makeTraceState, nextExpansion, searchText } from './state.ts'
import type { Expansion, TraceState, VisibleLane } from './state.ts'

const BERLIN = 'Europe/Berlin'
const DEFAULT_TREE_WIDTH = 320
const MIN_TREE_WIDTH = 160
const DEFAULT_DETAILS_HEIGHT = 280
const MIN_DETAILS_HEIGHT = 120
const COLLAPSED_DETAILS_HEIGHT = 40
// StyleX needs a module-local literal; it equals TRACE_ROW_HEIGHT, which windows the rows.
const ROW_HEIGHT = 34
const OVERVIEW_HEIGHT = 36
const TOOLBAR_HEIGHT = 32
const AXIS_HEIGHT = 28
const MINIMAP_ROW_HEIGHT = OVERVIEW_HEIGHT
const MIN_VIEWPORT_MS = MIN_TRACE_VIEWPORT_MS
const MINIMAP_BINS = 96
const ALL_SPAN_MARKS = new Set(spanMarks.map((mark) => mark.id))

/** Inputs for the interactive trace explorer, including its initial time window and controls. */
export interface AgentTimelineProps {
  readonly scene: AgentTimelineScene
  readonly initialViewport?: TraceViewport
  readonly navigation?: NavigationScheme
  readonly expandedKeys?: Expansion
  readonly defaultExpandedKeys?: Expansion
  readonly onExpandedChange?: (keys: Expansion) => void
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden'; containerType: 'inline-size' }>
}

interface FlameLane {
  readonly lane: Lane
  readonly rootIndex: number
  readonly depth: number
}

const wholeUsd = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

type ResizeOrientation = 'horizontal' | 'vertical'

interface TraceResizeHandleProps {
  readonly label: string
  readonly orientation: ResizeOrientation
  readonly value: number
  readonly minimum: number
  readonly maximum: number
  readonly resetValue: number
  readonly direction: 1 | -1
  readonly onChange: (value: number) => void
}

const TraceResizeHandle = ({
  label,
  orientation,
  value,
  minimum,
  maximum,
  resetValue,
  direction,
  onChange,
}: TraceResizeHandleProps): React.ReactNode => {
  const [isHovered, setIsHovered] = React.useState(false)
  const { dragProps, isDragging } = usePointerDrag({
    onDrag: (deltaX, deltaY) => {
      const rawDelta = orientation === 'vertical' ? deltaX : deltaY
      onChange(clamp(value + rawDelta * direction, minimum, maximum))
    },
  })

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    dragProps.onKeyDown(event)
    if (event.defaultPrevented) return

    const delta =
      orientation === 'vertical'
        ? event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : 0
        : event.key === 'ArrowUp'
          ? -1
          : event.key === 'ArrowDown'
            ? 1
            : 0
    if (delta !== 0) {
      event.preventDefault()
      event.stopPropagation()
      onChange(clamp(value + delta * 16 * direction, minimum, maximum))
      return
    }
    if (event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    event.stopPropagation()
    onChange(event.key === 'Home' ? minimum : maximum)
  }

  return (
    <div
      {...dragProps}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={Math.round(minimum)}
      aria-valuemax={Math.round(maximum)}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(clamp(resetValue, minimum, maximum))}
      {...stylex.props(
        styles.resizeHandle,
        orientation === 'vertical' ? styles.verticalResizeHandle : styles.horizontalResizeHandle,
        (isDragging || isHovered) && styles.activeResizeHandle,
      )}
    >
      <Separator
        orientation={orientation}
        aria-hidden="true"
        {...stylex.props(styles.resizeSeparator)}
      />
    </div>
  )
}

const integer = new Intl.NumberFormat('en')

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const fullViewport = (scene: AgentTimelineScene): TraceViewport => ({
  start: scene.model.windowStart,
  end: scene.model.windowEnd,
})

const timeRatio = (ts: number, viewport: TraceViewport): number =>
  clamp((ts - viewport.start) / Math.max(1, viewport.end - viewport.start), 0, 1)

const wholeWindowRatio = (ts: number, scene: AgentTimelineScene): number =>
  clamp(
    (ts - scene.model.windowStart) / Math.max(1, scene.model.windowEnd - scene.model.windowStart),
    0,
    1,
  )

const orderedFlameLanes = (scene: AgentTimelineScene): ReadonlyArray<FlameLane> => {
  const rootIds = Array.from(new Set(scene.lanes.map((lane) => lane.rootId)))
  const rootIndexById = new Map(rootIds.map((rootId, rootIndex) => [rootId, rootIndex]))
  return scene.lanes.map((lane) => ({
    lane,
    rootIndex: rootIndexById.get(lane.rootId) ?? 0,
    depth: lane.depth,
  }))
}

const timeTicks = (viewport: TraceViewport): ReadonlyArray<number> => {
  const duration = viewport.end - viewport.start
  const roughStep = duration / 7
  const choices = [
    60_000,
    5 * 60_000,
    10 * 60_000,
    30 * 60_000,
    60 * 60_000,
    3 * 60 * 60_000,
    6 * 60 * 60_000,
    12 * 60 * 60_000,
    24 * 60 * 60_000,
  ]
  const step = choices.find((candidate) => candidate >= roughStep) ?? 24 * 60 * 60_000
  const ticks: number[] = []
  for (let ts = Math.ceil(viewport.start / step) * step; ts < viewport.end; ts += step)
    ticks.push(ts)
  return ticks
}

const tickFormat = (viewport: TraceViewport): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN,
    ...(viewport.end - viewport.start > 2 * 24 * 60 * 60_000
      ? { weekday: 'short', day: '2-digit', hour: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' }),
  })

/** One fixed-width minimap bucket with request volume, spend, and aggregation provenance. */
export interface MinimapBin {
  readonly from: number
  readonly count: number
  readonly usd: number
  readonly binned: boolean
}

/** Aggregate exact requests and coarse source bins into the minimap's fixed 96-bucket series. */
export const minimapBins = (scene: AgentTimelineScene): ReadonlyArray<MinimapBin> => {
  const duration = Math.max(1, scene.model.windowEnd - scene.model.windowStart)
  const width = duration / MINIMAP_BINS
  const bins: MinimapBin[] = Array.from({ length: MINIMAP_BINS }, (_, index) => ({
    from: scene.model.windowStart + index * width,
    count: 0,
    usd: 0,
    binned: false,
  }))
  const addPoint = (ts: number, count: number, usdValue: number): void => {
    const index = clamp(Math.floor((ts - scene.model.windowStart) / width), 0, bins.length - 1)
    const previous = bins[index]!
    bins[index] = {
      from: previous.from,
      count: previous.count + count,
      usd: previous.usd + usdValue,
      binned: previous.binned,
    }
  }
  for (const request of scene.model.requests) addPoint(request.ts, 1, request.usd)
  for (const aggregate of scene.model.bins) {
    const aggregateDuration = Math.max(1, aggregate.to - aggregate.from)
    const first = clamp(
      Math.floor((aggregate.from - scene.model.windowStart) / width),
      0,
      bins.length - 1,
    )
    const last = clamp(
      Math.floor((aggregate.to - scene.model.windowStart) / width),
      0,
      bins.length - 1,
    )
    for (let index = first; index <= last; index += 1) {
      const bucketFrom = scene.model.windowStart + index * width
      const bucketTo = bucketFrom + width
      const overlap = Math.max(
        0,
        Math.min(aggregate.to, bucketTo) - Math.max(aggregate.from, bucketFrom),
      )
      if (overlap === 0) continue
      const share = overlap / aggregateDuration
      const previous = bins[index]!
      bins[index] = {
        from: previous.from,
        count: previous.count + aggregate.requests * share,
        usd: previous.usd + aggregate.usd * share,
        binned: true,
      }
    }
  }
  let cumulative = 0
  return bins.map((bin) => {
    cumulative += bin.usd
    return { from: bin.from, count: bin.count, usd: cumulative, binned: bin.binned }
  })
}

const brushEdgeKeyDown = (
  event: React.KeyboardEvent<HTMLDivElement>,
  resizeByPixels: (deltaX: number) => void,
  dragKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void,
): void => {
  dragKeyDown(event)
  if (event.defaultPrevented || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
  event.preventDefault()
  event.stopPropagation()
  resizeByPixels(event.key === 'ArrowLeft' ? -1 : 1)
}

const Minimap = ({
  scene,
  viewport,
  cursor,
  onViewportChange,
  onCursor,
}: {
  readonly scene: AgentTimelineScene
  readonly viewport: TraceViewport
  readonly cursor: TraceCursor | null
  readonly onViewportChange: (viewport: TraceViewport) => void
  readonly onCursor: (cursor: TraceCursor | null) => void
}) => {
  const bins = React.useMemo(() => minimapBins(scene), [scene])
  const patternId = React.useId().replaceAll(':', '-')
  const ref = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef(viewport)
  viewportRef.current = viewport
  const maximumCount = Math.max(1, ...bins.map((bin) => bin.count))
  const maximumUsd = Math.max(0.000_001, bins.at(-1)?.usd ?? 0)
  const brushLeft = wholeWindowRatio(viewport.start, scene) * 100
  const brushRight = wholeWindowRatio(viewport.end, scene) * 100
  const moveByPixels = (deltaX: number): void => {
    const width = ref.current?.getBoundingClientRect().width ?? 1
    const duration = scene.model.windowEnd - scene.model.windowStart
    const current = viewportRef.current
    const delta = (deltaX / width) * duration
    const span = current.end - current.start
    const start = clamp(
      current.start + delta,
      scene.model.windowStart,
      scene.model.windowEnd - span,
    )
    onViewportChange({ start, end: start + span })
  }
  const resizeStartByPixels = (deltaX: number): void => {
    const width = ref.current?.getBoundingClientRect().width ?? 1
    const duration = scene.model.windowEnd - scene.model.windowStart
    onViewportChange({
      start: clamp(
        viewportRef.current.start + (deltaX / width) * duration,
        scene.model.windowStart,
        viewportRef.current.end - MIN_VIEWPORT_MS,
      ),
      end: viewportRef.current.end,
    })
  }
  const resizeEndByPixels = (deltaX: number): void => {
    const width = ref.current?.getBoundingClientRect().width ?? 1
    const duration = scene.model.windowEnd - scene.model.windowStart
    onViewportChange({
      start: viewportRef.current.start,
      end: clamp(
        viewportRef.current.end + (deltaX / width) * duration,
        viewportRef.current.start + MIN_VIEWPORT_MS,
        scene.model.windowEnd,
      ),
    })
  }
  const bodyDrag = usePointerDrag({ onDrag: moveByPixels })
  const startDrag = usePointerDrag({ onDrag: resizeStartByPixels })
  const endDrag = usePointerDrag({ onDrag: resizeEndByPixels })
  const isDragging = bodyDrag.isDragging || startDrag.isDragging || endDrag.isDragging
  const timeAtMinimapX = React.useCallback(
    (offsetX: number, width: number): number =>
      scene.model.windowStart +
      (clamp(offsetX, 0, width) / Math.max(1, width)) *
        (scene.model.windowEnd - scene.model.windowStart),
    [scene.model.windowEnd, scene.model.windowStart],
  )
  const onMinimapHover = React.useCallback(
    (hover: TimelineHoverPoint | null): void =>
      onCursor(hover === null ? null : { ts: hover.ts, laneId: null }),
    [onCursor],
  )
  const minimapHover = useTimelineHover({
    timeAtX: timeAtMinimapX,
    disabled: isDragging,
    onHover: onMinimapHover,
  })
  const bucketWidthMs = Math.max(1, scene.model.windowEnd - scene.model.windowStart) / bins.length
  const hoveredBin =
    minimapHover.hover === null
      ? null
      : bins[
          clamp(
            Math.floor((minimapHover.hover.ts - scene.model.windowStart) / bucketWidthMs),
            0,
            bins.length - 1,
          )
        ]!

  const keyboardMove = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const windowDuration = scene.model.windowEnd - scene.model.windowStart
    const delta = direction * windowDuration * 0.02
    if (event.shiftKey)
      resizeEndByPixels(
        (delta / windowDuration) * (ref.current?.getBoundingClientRect().width ?? 1),
      )
    else moveByPixels((delta / windowDuration) * (ref.current?.getBoundingClientRect().width ?? 1))
  }
  const brushBodyKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    bodyDrag.dragProps.onKeyDown(event)
    if (!event.defaultPrevented) keyboardMove(event)
  }

  const spendPath = bins
    .map((bin, index) => {
      const x = ((index + 0.5) / bins.length) * 1000
      const y = OVERVIEW_HEIGHT - 5 - (bin.usd / maximumUsd) * (OVERVIEW_HEIGHT - 14)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div
      ref={ref}
      {...stylex.props(styles.minimap)}
      aria-label="Whole-window request density and cumulative spend; stipple marks fixed aggregate bins"
      data-minimap
      onPointerMoveCapture={minimapHover.onPointerMove}
      onPointerLeave={minimapHover.onPointerLeave}
    >
      <svg
        width="100%"
        height={OVERVIEW_HEIGHT}
        viewBox={`0 0 1000 ${OVERVIEW_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id={patternId} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill={tokens['--ds-gray-800']} opacity="0.45" />
          </pattern>
        </defs>
        {bins.map((bin, index) => {
          const height = (bin.count / maximumCount) * (OVERVIEW_HEIGHT - 12)
          const x = (index / bins.length) * 1000
          const width = Math.max(1, 1000 / bins.length - 1)
          return (
            <React.Fragment key={bin.from}>
              <rect
                x={x}
                y={OVERVIEW_HEIGHT - height}
                width={width}
                height={height}
                fill={tokens['--ds-blue-700']}
                opacity={0.12 + (bin.count / maximumCount) * 0.36}
              />
              {bin.binned ? (
                <rect
                  x={x}
                  y={0}
                  width={width}
                  height={OVERVIEW_HEIGHT}
                  fill={`url(#${patternId})`}
                />
              ) : null}
            </React.Fragment>
          )
        })}
        <path
          d={spendPath}
          fill="none"
          stroke={tokens['--ds-purple-800']}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {cursor === null || isDragging ? null : (
        <div
          data-minimap-cursor
          data-cursor-time={cursor.ts}
          {...stylex.props(
            styles.minimapCursor,
            styles.leftPercent(wholeWindowRatio(cursor.ts, scene) * 100),
          )}
        />
      )}
      <div {...stylex.props(styles.minimapTitle)}>
        REQUEST DENSITY · CUMULATIVE $ · STIPPLE = BINNED
      </div>
      <div
        {...bodyDrag.dragProps}
        {...stylex.props(styles.brush, styles.brushBounds(brushLeft, brushRight - brushLeft))}
        role="slider"
        tabIndex={0}
        aria-label="Timeline viewport"
        aria-valuemin={scene.model.windowStart}
        aria-valuemax={scene.model.windowEnd}
        aria-valuenow={viewport.start}
        aria-valuetext={`${Math.round((viewport.end - viewport.start) / 60_000)} minute viewport`}
        onKeyDown={brushBodyKeyDown}
      >
        <div
          {...startDrag.dragProps}
          {...stylex.props(styles.brushHandle, styles.brushHandleStart)}
          role="slider"
          tabIndex={0}
          aria-label="Viewport start"
          aria-valuemin={scene.model.windowStart}
          aria-valuemax={viewport.end - MIN_VIEWPORT_MS}
          aria-valuenow={viewport.start}
          onKeyDown={(event) =>
            brushEdgeKeyDown(event, resizeStartByPixels, startDrag.dragProps.onKeyDown)
          }
        />
        <div
          {...endDrag.dragProps}
          {...stylex.props(styles.brushHandle, styles.brushHandleEnd)}
          role="slider"
          tabIndex={0}
          aria-label="Viewport end"
          aria-valuemin={viewport.start + MIN_VIEWPORT_MS}
          aria-valuemax={scene.model.windowEnd}
          aria-valuenow={viewport.end}
          onKeyDown={(event) =>
            brushEdgeKeyDown(event, resizeEndByPixels, endDrag.dragProps.onKeyDown)
          }
        />
      </div>
      {minimapHover.hover === null || hoveredBin === null || isDragging ? null : (
        <MinimapHover
          scene={scene}
          viewport={viewport}
          hover={minimapHover.hover}
          requestCount={Math.round(hoveredBin.count)}
          bucketWidthMs={bucketWidthMs}
          binned={hoveredBin.binned}
        />
      )}
    </div>
  )
}

const TimelineAxis = ({
  viewport,
  cursor,
}: {
  readonly viewport: TraceViewport
  readonly cursor: TraceCursor | null
}) => {
  const ticks = React.useMemo(() => timeTicks(viewport), [viewport])
  const formatter = React.useMemo(() => tickFormat(viewport), [viewport])
  return (
    <div data-timeline-axis {...stylex.props(styles.axis)}>
      <div data-axis-plot {...stylex.props(styles.axisPlot)}>
        {ticks.map((tick) => (
          <div
            key={tick}
            {...stylex.props(styles.tick, styles.leftPercent(timeRatio(tick, viewport) * 100))}
          >
            <span>{formatter.format(tick)}</span>
          </div>
        ))}
        <span {...stylex.props(styles.timezone)}>Europe/Berlin</span>
        {cursor !== null && cursor.ts >= viewport.start && cursor.ts <= viewport.end ? (
          <div
            {...stylex.props(
              styles.axisCursor,
              styles.leftPercent(timeRatio(cursor.ts, viewport) * 100),
            )}
          />
        ) : null}
      </div>
    </div>
  )
}

const LaneBar = React.memo(
  ({
    lane,
    scene,
    viewport,
    hue,
    segments,
    dimmed,
    matched,
    cursorTs,
  }: {
    readonly lane: Lane
    readonly scene: AgentTimelineScene
    readonly viewport: TraceViewport
    readonly hue: SpanHue
    readonly segments: ReadonlyArray<ActivitySegment>
    readonly dimmed: boolean
    readonly matched: boolean
    readonly cursorTs: number | null
  }) => {
    const x = React.useCallback(
      (ts: number) => ((ts - viewport.start) / Math.max(1, viewport.end - viewport.start)) * 1000,
      [viewport.end, viewport.start],
    )
    return (
      <svg
        width="100%"
        height={ROW_HEIGHT}
        viewBox={`0 0 1000 ${ROW_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Span
          lane={lane}
          scene={scene}
          x={x}
          width={1000}
          height={ROW_HEIGHT}
          hue={hue}
          segments={segments}
          selected={matched}
          dimmed={dimmed}
          cursorTs={cursorTs}
        />
      </svg>
    )
  },
)
LaneBar.displayName = 'LaneBar'

const RollupBars = ({
  lanes,
  scene,
  viewport,
  hues,
}: {
  readonly lanes: ReadonlyArray<Lane>
  readonly scene: AgentTimelineScene
  readonly viewport: TraceViewport
  readonly hues: ReadonlyMap<string, SpanHue>
}) => {
  if (lanes.length === 0) return null
  return (
    <svg
      width="100%"
      height={ROW_HEIGHT}
      viewBox={`0 0 1000 ${ROW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      {...stylex.props(styles.rollupOverlay)}
    >
      {lanes.map((lane, index) => {
        const start = Math.max(lane.session.startedAt, viewport.start)
        const end = Math.min(laneEnd(lane, scene), viewport.end)
        if (end <= start) return null
        const x = timeRatio(start, viewport) * 1000
        const width = Math.max(1.5, (timeRatio(end, viewport) - timeRatio(start, viewport)) * 1000)
        return (
          <rect
            key={lane.session.id}
            x={x}
            y={10 + (index % 5) * 3}
            width={width}
            height={2}
            fill={hues.get(lane.session.id)!.strong}
            opacity={0.86}
          />
        )
      })}
    </svg>
  )
}

interface LaneRowProps {
  readonly item: VisibleLane
  readonly flame: FlameLane
  readonly scene: AgentTimelineScene
  readonly viewport: TraceViewport
  readonly hues: ReadonlyMap<string, SpanHue>
  readonly store: TraceState
  readonly onCursor: (cursor: TraceCursor | null, hover: TimelineHoverPoint | null) => void
  readonly onZoom: (laneId: string) => void
}

/**
 * Memoized, and subscribed to its own cursor mark, so a cursor move re-renders only the rows
 * whose mark changed, without re-rendering the layout or the other rows.
 */
const LaneRow = React.memo(
  ({ item, flame, scene, viewport, hues, store, onCursor, onZoom }: LaneRowProps) => {
    countTraceRender('row')
    const { lane } = item
    const cursorTsAtom = React.useMemo(
      () =>
        Atom.readable((get) => {
          const cursor = get(store.cursor)
          return cursor !== null && cursor.laneId === lane.session.id ? cursor.ts : null
        }),
      [lane.session.id, store],
    )
    const cursorTs = useAtomValue(cursorTsAtom)
    // The trace owns hover in its atoms; a row-local hover state would add a second commit.
    const onPointerMove = (event: React.PointerEvent<HTMLElement>): void => {
      const hover = timelineHoverPoint(
        event,
        (offsetX, width) => viewport.start + (offsetX / width) * (viewport.end - viewport.start),
      )
      onCursor({ ts: hover.ts, laneId: lane.session.id }, hover)
    }
    const isOutsideViewport =
      laneEnd(lane, scene) < viewport.start || lane.session.startedAt > viewport.end
    return (
      <GridListItem
        id={lane.session.id}
        data-session-id={lane.session.id}
        textValue={searchText(lane)}
        className={({ isSelected, isFocusVisible, isHovered }) =>
          stylex.props(
            styles.gridRow,
            flame.rootIndex % 2 === 0 && styles.alternateRoot,
            isHovered && styles.rowHovered,
            isSelected && styles.rowSelected,
            isFocusVisible && styles.rowFocused,
          ).className ?? ''
        }
        onDoubleClick={() => onZoom(lane.session.id)}
        onPointerMove={onPointerMove}
        onPointerLeave={() => onCursor(null, null)}
      >
        <div data-trace-span-area {...stylex.props(styles.barCell)}>
          <LaneBar
            lane={lane}
            scene={scene}
            viewport={viewport}
            hue={hues.get(lane.session.id)!}
            segments={laneActivity(lane)}
            dimmed={item.isAncestorOnly || isOutsideViewport}
            matched={item.findMatch}
            cursorTs={cursorTs}
          />
          <RollupBars lanes={item.rolledUpChildren} scene={scene} viewport={viewport} hues={hues} />
        </div>
      </GridListItem>
    )
  },
)
LaneRow.displayName = 'LaneRow'

/** DOM handles and host callbacks shared by the separately rendered trace regions. */
interface TraceRefs {
  readonly root: React.RefObject<HTMLElement | null>
  readonly workspace: React.RefObject<HTMLDivElement | null>
  readonly scroller: React.RefObject<HTMLDivElement | null>
  readonly treeScroller: React.RefObject<HTMLDivElement | null>
  readonly timeline: React.RefObject<HTMLDivElement | null>
  readonly plot: React.RefObject<HTMLElement | null>
  /** Latest host expansion wiring; read at event time so host callbacks never re-render regions. */
  readonly expansion: React.RefObject<{
    readonly controlled: boolean
    readonly onChange: ((keys: Expansion) => void) | undefined
  }>
}

/** Props of every region: the atom graph, the shared handles, and the navigation scheme. */
interface RegionProps {
  readonly store: TraceState
  readonly refs: TraceRefs
  readonly navigation: NavigationScheme
}

/**
 * Viewer actions that read atoms at event time through the registry, so the regions that
 * trigger them do not subscribe to the viewport, the cursor, or the row list.
 */
const useTraceActions = ({ store, refs, navigation }: RegionProps) => {
  const registry = React.useContext(RegistryContext)
  return React.useMemo(() => {
    const setViewport = (next: TraceViewport): void =>
      registry.set(
        store.viewport,
        clampTraceViewport(
          next,
          fullViewport(registry.get(store.scene)),
          navigation.minimumViewportMs,
        ),
      )
    const scrollRowsTo = (top: number, behavior: ScrollBehavior): void => {
      refs.scroller.current?.scrollTo({ top, behavior })
      refs.treeScroller.current?.scrollTo({ top, behavior })
    }
    return {
      setViewport,
      resetViewport: (): void => setViewport(fullViewport(registry.get(store.scene))),
      zoomToLane: (laneId: string): void => {
        const scene = registry.get(store.scene)
        const lane = scene.lanes.find((candidate) => candidate.session.id === laneId)
        if (lane === undefined) return
        const duration = Math.max(MIN_VIEWPORT_MS, laneEnd(lane, scene) - lane.session.startedAt)
        const padding = duration * 0.08
        setViewport({
          start: lane.session.startedAt - padding,
          end: laneEnd(lane, scene) + padding,
        })
      },
      seek: (ts: number): void => {
        const scene = registry.get(store.scene)
        const viewport = registry.get(store.viewport)
        const safeTs = clamp(ts, scene.model.windowStart, scene.model.windowEnd)
        registry.set(store.cursor, { ts: safeTs, laneId: registry.get(store.selectedLaneId) })
        if (safeTs < viewport.start || safeTs > viewport.end) {
          const duration = viewport.end - viewport.start
          setViewport({ start: safeTs - duration / 2, end: safeTs + duration / 2 })
        }
      },
      setCursor: (cursor: TraceCursor | null, hover: TimelineHoverPoint | null): void =>
        Atom.batch(() => {
          registry.set(store.cursor, cursor)
          registry.set(store.hoverPoint, hover)
        }),
      selectLane: (laneId: string | null): void => registry.set(store.selectedLaneId, laneId),
      closeDetails: (): void => {
        const laneId = registry.get(store.selectedLaneId)
        registry.set(store.selectedLaneId, null)
        requestAnimationFrame(() => {
          const rows = refs.treeScroller.current?.querySelectorAll<HTMLElement>('[data-session-id]')
          const row = Array.from(rows ?? []).find(
            (candidate) => candidate.dataset.sessionId === laneId,
          )
          const focusTarget = row ?? refs.timeline.current
          focusTarget?.focus({ preventScroll: true })
        })
      },
      navigateFind: (direction: -1 | 1): void => {
        const visible = registry.get(store.visible)
        const matches = visible.filter((item) => item.findMatch)
        if (matches.length === 0) return
        const next = (registry.get(store.findIndex) + direction + matches.length) % matches.length
        const laneId = matches[next]!.lane.session.id
        Atom.batch(() => {
          registry.set(store.findIndex, next)
          registry.set(store.selectedLaneId, laneId)
        })
        const index = visible.findIndex((item) => item.lane.session.id === laneId)
        scrollRowsTo(Math.max(0, index * ROW_HEIGHT - ROW_HEIGHT * 2), 'smooth')
      },
      syncScroll: (nextScrollTop: number, source: React.RefObject<HTMLDivElement | null>): void => {
        Atom.batch(() => {
          registry.set(store.scrollTop, nextScrollTop)
          if (registry.get(store.hoverPoint) !== null) {
            registry.set(store.hoverPoint, null)
            registry.set(store.cursor, null)
          }
        })
        for (const target of [refs.scroller, refs.treeScroller]) {
          if (
            target === source ||
            target.current === null ||
            target.current.scrollTop === nextScrollTop
          )
            continue
          target.current.scrollTop = nextScrollTop
        }
      },
      onVirtualizedRowKeyDown: (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (
          !registry.get(store.virtualized) ||
          (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
        )
          return
        const visible = registry.get(store.visible)
        const target =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-session-id]')
            : null
        const currentIndex = visible.findIndex(
          (item) => item.lane.session.id === target?.dataset.sessionId,
        )
        if (currentIndex < 0) return
        const nextIndex = clamp(
          currentIndex + (event.key === 'ArrowDown' ? 1 : -1),
          0,
          visible.length - 1,
        )
        if (nextIndex === currentIndex) return
        event.preventDefault()
        event.stopPropagation()
        const nextId = visible[nextIndex]!.lane.session.id
        registry.set(store.selectedLaneId, nextId)
        scrollRowsTo(Math.max(0, nextIndex * ROW_HEIGHT - ROW_HEIGHT * 2), 'auto')
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const rows =
              refs.treeScroller.current?.querySelectorAll<HTMLElement>('[data-session-id]')
            Array.from(rows ?? [])
              .find((row) => row.dataset.sessionId === nextId)
              ?.focus()
          }),
        )
      },
    }
  }, [navigation.minimumViewportMs, refs, registry, store])
}

/** The rows the tree and the timeline render: all of them, or the scrolled window. */
const useRowWindow = (store: TraceState) => {
  const visible = useAtomValue(store.visible)
  const firstRow = useAtomValue(store.firstRow)
  const lastRow = useAtomValue(store.lastRow)
  const windowed = React.useMemo(
    () => visible.slice(firstRow, lastRow),
    [firstRow, lastRow, visible],
  )
  return {
    windowed,
    topSpacer: firstRow * ROW_HEIGHT,
    bottomSpacer: (visible.length - lastRow) * ROW_HEIGHT,
  }
}

const useFlameById = (scene: AgentTimelineScene): ReadonlyMap<string, FlameLane> =>
  React.useMemo(
    () => new Map(orderedFlameLanes(scene).map((entry) => [entry.lane.session.id, entry])),
    [scene],
  )

/** Coverage summary, find, reading guide, and reset. Re-renders only when its own atoms change. */
const TraceToolbar = React.memo((props: RegionProps) => {
  countTraceRender('toolbar')
  const { store } = props
  const actions = useTraceActions(props)
  const scene = useAtomValue(store.scene)
  const {
    shown: visibleTotals,
    all: allTotals,
    matching: matchingAgents,
  } = useAtomValue(store.totals)
  const hasActiveFilters = useAtomValue(store.hasActiveFilters)
  const [find, setFind] = useAtom(store.find)
  const [findIndex, setFindIndex] = useAtom(store.findIndex)
  const findMatchCount = useAtomValue(store.findMatchCount)
  const readingGuideLaneIds = React.useMemo(
    () => scene.lanes.map((lane) => lane.session.id),
    [scene.lanes],
  )
  const countDenominator = hasActiveFilters
    ? allTotals.agents
    : Math.max(allTotals.agents, matchingAgents)
  return (
    <TraceProfiler region="header">
      <div {...stylex.props(styles.toolbar)} aria-label="Agent timeline controls">
        <figcaption
          {...stylex.props(styles.summary)}
          title={`${integer.format(scene.model.coverage.includedRoots)} of ${integer.format(scene.model.coverage.totalRoots)} roots on this host · ${wholeUsd.format(scene.model.coverage.includedUsd)} of ${wholeUsd.format(scene.model.coverage.totalUsd)} · ${allTotals.active}/${allTotals.inactive}/${allTotals.exited} active/inactive/exited · ${scene.model.coverage.policy}`}
          aria-label={`Trace coverage: ${integer.format(scene.model.coverage.includedRoots)} of ${integer.format(scene.model.coverage.totalRoots)} roots on this host; ${wholeUsd.format(scene.model.coverage.includedUsd)} of ${wholeUsd.format(scene.model.coverage.totalUsd)}; ${allTotals.active} active, ${allTotals.inactive} inactive, ${allTotals.exited} exited; ${scene.model.coverage.policy}`}
        >
          <strong>
            {integer.format(visibleTotals.roots)}
            {visibleTotals.roots === allTotals.roots
              ? ''
              : `/${integer.format(allTotals.roots)}`}{' '}
            roots
          </strong>
          <span>
            {' '}
            · {integer.format(visibleTotals.agents)}
            {visibleTotals.agents === countDenominator
              ? ''
              : `/${integer.format(countDenominator)}`}{' '}
            agents
          </span>
          <span> · {integer.format(visibleTotals.active)} active</span>
          <span>
            {' '}
            · {integer.format(visibleTotals.turns)}
            {visibleTotals.turns === allTotals.turns
              ? ''
              : `/${integer.format(allTotals.turns)}`}{' '}
            turns
          </span>
          <span>
            {' '}
            · {wholeUsd.format(visibleTotals.usd)}
            {visibleTotals.usd === allTotals.usd ? '' : `/${wholeUsd.format(allTotals.usd)}`}
          </span>
          {visibleTotals.compactions > 0 ? (
            <span> · {integer.format(visibleTotals.compactions)} compactions</span>
          ) : null}
        </figcaption>
        <SearchField
          value={find}
          onChange={(next) =>
            Atom.batch(() => {
              setFind(next)
              setFindIndex(0)
            })
          }
          aria-label="Find session by name or task"
          {...stylex.props(styles.search)}
        >
          <Input placeholder="Find name or task" {...stylex.props(styles.searchInput)} />
          <span {...stylex.props(styles.findCount)}>
            {findMatchCount === 0 ? '0/0' : `${findIndex + 1}/${findMatchCount}`}
          </span>
          <TooltipTrigger delay={300}>
            <Button
              aria-label="Previous match"
              isDisabled={findMatchCount === 0}
              onPress={() => actions.navigateFind(-1)}
              {...stylex.props(styles.iconButton)}
            >
              ↑
            </Button>
            <Tooltip {...stylex.props(styles.toolbarTooltip)}>Previous match</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger delay={300}>
            <Button
              aria-label="Next match"
              isDisabled={findMatchCount === 0}
              onPress={() => actions.navigateFind(1)}
              {...stylex.props(styles.iconButton)}
            >
              ↓
            </Button>
            <Tooltip {...stylex.props(styles.toolbarTooltip)}>Next match</Tooltip>
          </TooltipTrigger>
        </SearchField>
        <TooltipTrigger delay={300}>
          <DialogTrigger>
            <Button aria-label="Open reading guide" {...stylex.props(styles.iconButton)}>
              ?
            </Button>
            <ReadingGuide
              scene={scene}
              marks={ALL_SPAN_MARKS}
              exampleLaneIds={readingGuideLaneIds}
            />
          </DialogTrigger>
          <Tooltip {...stylex.props(styles.toolbarTooltip)}>Open reading guide</Tooltip>
        </TooltipTrigger>
        <Button onPress={actions.resetViewport} {...stylex.props(styles.resetButton)}>
          Reset zoom
        </Button>
      </div>
    </TraceProfiler>
  )
})
TraceToolbar.displayName = 'TraceToolbar'

/** Session tree and filters. Independent of the viewport and the cursor. */
const TraceTree = React.memo((props: RegionProps) => {
  countTraceRender('tree')
  const { store, refs } = props
  const actions = useTraceActions(props)
  const scene = useAtomValue(store.scene)
  const { agentTypes, models, roots } = useAtomValue(store.options)
  const {
    agentTypes: selectedAgentTypes,
    models: selectedModels,
    roots: selectedRoots,
  } = useAtomValue(store.selected)
  const setHiddenAgentTypes = useAtomSet(store.hiddenAgentTypes)
  const setHiddenModels = useAtomSet(store.hiddenModels)
  const setHiddenRoots = useAtomSet(store.hiddenRoots)
  const [stateFilter, setStateFilter] = useAtom(store.stateFilter)
  const [minimumUsd, setMinimumUsd] = useAtom(store.minimumUsd)
  const [hasCompaction, setHasCompaction] = useAtom(store.hasCompaction)
  const [filterText, setFilterText] = useAtom(store.filterText)
  const [expansion, setExpansionAtom] = useAtom(store.expansion)
  const expandedKeys = useAtomValue(store.expanded)
  const selectedLaneId = useAtomValue(store.selectedLaneId)
  const compactTree = useAtomValue(store.compactTree)
  const { directIds, beforeCollapse } = useAtomValue(store.filtered)
  const virtualized = useAtomValue(store.virtualized)
  const { all: allTotals, matching: matchingAgents } = useAtomValue(store.totals)
  const hasActiveFilters = useAtomValue(store.hasActiveFilters)
  const { windowed, topSpacer, bottomSpacer } = useRowWindow(store)
  const flameById = useFlameById(scene)
  const parentIds = React.useMemo(
    () => new Set(scene.forks.map((fork) => fork.parentSessionId)),
    [scene.forks],
  )
  const sessionTreeSource = virtualized ? windowed : beforeCollapse
  const sessionTreeItems = React.useMemo(
    () =>
      sessionTreeSource.map((item) => ({
        lane: item.lane,
        depth: flameById.get(item.lane.session.id)!.depth,
        isAncestorOnly: item.isAncestorOnly,
        hasChildren: parentIds.has(item.lane.session.id),
        wallDurationMs: item.lane.wallMs,
        activeDurationMs: item.lane.activeMs,
      })),
    [flameById, parentIds, sessionTreeSource],
  )
  const setExpansion = (next: Expansion): void => {
    const { controlled, onChange } = refs.expansion.current
    if (!controlled) setExpansionAtom(next)
    onChange?.(next)
  }
  const setSelectedAgentTypes = (shown: ReadonlySet<string>): void =>
    setHiddenAgentTypes(hiddenValues(agentTypes, shown))
  const setSelectedModels = (shown: ReadonlySet<string>): void =>
    setHiddenModels(hiddenValues(models, shown))
  const setSelectedRoots = (shown: ReadonlySet<string>): void =>
    setHiddenRoots(hiddenValues(roots, shown))
  const clearFilters = (): void =>
    Atom.batch(() => {
      setFilterText('')
      setHiddenAgentTypes(new Set())
      setHiddenModels(new Set())
      setHiddenRoots(new Set())
      setStateFilter('all')
      setMinimumUsd(0)
      setHasCompaction(false)
    })
  return (
    <TraceProfiler region="tree">
      <SessionTree
        items={sessionTreeItems}
        topSpacer={topSpacer}
        bottomSpacer={bottomSpacer}
        virtualized={virtualized}
        expandedKeys={expandedKeys}
        onExpandedChange={(keys) =>
          setExpansion(nextExpansion(expansion, new Set(Array.from(keys, String)), scene))
        }
        selectedLaneId={selectedLaneId}
        onSelectedLaneIdChange={actions.selectLane}
        onExpandAll={() => setExpansion('all')}
        onCollapseAll={() => setExpansion(new Set())}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        agentTypes={agentTypes}
        selectedAgentTypes={selectedAgentTypes}
        onSelectedAgentTypesChange={setSelectedAgentTypes}
        models={models}
        selectedModels={selectedModels}
        onSelectedModelsChange={setSelectedModels}
        roots={roots}
        selectedRoots={selectedRoots}
        onSelectedRootsChange={setSelectedRoots}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        minimumUsd={minimumUsd}
        onMinimumUsdChange={setMinimumUsd}
        hasCompaction={hasCompaction}
        onHasCompactionChange={setHasCompaction}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        matchingCount={directIds.size}
        totalCount={
          hasActiveFilters ? allTotals.agents : Math.max(allTotals.agents, matchingAgents)
        }
        compact={compactTree}
        scrollRef={refs.treeScroller}
        onScroll={(nextScrollTop) => actions.syncScroll(nextScrollTop, refs.treeScroller)}
        onVirtualizedRowKeyDown={actions.onVirtualizedRowKeyDown}
        columnHeaderHeight={AXIS_HEIGHT}
      />
    </TraceProfiler>
  )
})
TraceTree.displayName = 'TraceTree'

/** Details for the selected lane; the only details subtree that follows the cursor. */
const SelectedSpanDetails = React.memo(
  ({ lane, ...props }: RegionProps & { readonly lane: Lane }) => {
    countTraceRender('selected-details')
    const actions = useTraceActions(props)
    const theme = useTheme()
    const scene = useAtomValue(props.store.scene)
    const cursor = useAtomValue(props.store.cursor)
    const hue = React.useMemo(() => spanHue(lane, scene, theme), [lane, scene, theme])
    return (
      <SpanDetails
        theme={theme}
        scene={scene}
        lane={lane}
        cursor={cursor}
        hue={hue}
        segments={laneActivity(lane)}
        onSelectLane={actions.selectLane}
        onSeek={actions.seek}
        onZoomToLane={actions.zoomToLane}
        onClose={actions.closeDetails}
        height="100%"
      />
    )
  },
)
SelectedSpanDetails.displayName = 'SelectedSpanDetails'

/** Bottom details pane: a hint until a lane is selected. */
const TraceDetails = React.memo((props: RegionProps) => {
  countTraceRender('details')
  const scene = useAtomValue(props.store.scene)
  const selectedLaneId = useAtomValue(props.store.selectedLaneId)
  const selectedLane =
    selectedLaneId === null
      ? undefined
      : scene.lanes.find((lane) => lane.session.id === selectedLaneId)
  return (
    <TraceProfiler region="details">
      {selectedLane === undefined ? (
        <header {...stylex.props(styles.collapsedDetails)} aria-label="Agent timeline details">
          <strong>Span details</strong>
          <span {...stylex.props(styles.collapsedDetailsHint)}>
            Select a span to inspect requests, context, spend, and children.
          </span>
        </header>
      ) : (
        <SelectedSpanDetails {...props} lane={selectedLane} />
      )}
    </TraceProfiler>
  )
})
TraceDetails.displayName = 'TraceDetails'

// The cursor-following pieces subscribe to the cursor themselves, so a hover never re-renders
// the layout.
const CursorMinimap = ({
  store,
  scene,
  viewport,
  onViewportChange,
}: {
  readonly store: TraceState
  readonly scene: AgentTimelineScene
  readonly viewport: TraceViewport
  readonly onViewportChange: (viewport: TraceViewport) => void
}) => {
  const [cursor, setCursor] = useAtom(store.cursor)
  return (
    <Minimap
      scene={scene}
      viewport={viewport}
      cursor={cursor}
      onViewportChange={onViewportChange}
      onCursor={setCursor}
    />
  )
}

const CursorAxis = ({
  store,
  viewport,
}: {
  readonly store: TraceState
  readonly viewport: TraceViewport
}) => {
  const cursor = useAtomValue(store.cursor)
  return <TimelineAxis viewport={viewport} cursor={cursor} />
}

const CursorSpanHover = ({
  store,
  scene,
  laneById,
  hues,
}: {
  readonly store: TraceState
  readonly scene: AgentTimelineScene
  readonly laneById: ReadonlyMap<string, Lane>
  readonly hues: ReadonlyMap<string, SpanHue>
}) => {
  const cursor = useAtomValue(store.cursor)
  const hover = useAtomValue(store.hoverPoint)
  const lane = cursor === null || cursor.laneId === null ? undefined : laneById.get(cursor.laneId)
  if (lane === undefined || hover === null) return null
  return (
    <SpanHover
      scene={scene}
      lane={lane}
      hue={hues.get(lane.session.id)!}
      segments={laneActivity(lane)}
      hover={hover}
    />
  )
}

/** Dense session trace with filtering, brushing, zooming, cursor readout, and span details. */
const TraceLayout = React.memo(
  ({ style, ...props }: RegionProps & { readonly style: AgentTimelineProps['style'] }) => {
    countTraceRender('layout')
    const { store, refs, navigation } = props
    const theme = useTheme()
    const actions = useTraceActions(props)
    const scene = useAtomValue(store.scene)
    const viewport = useAtomValue(store.viewport)
    const selectedLaneId = useAtomValue(store.selectedLaneId)
    const [treeWidth, setTreeWidth] = useAtom(store.treeWidth)
    const [detailsHeight, setDetailsHeight] = useAtom(store.detailsHeight)
    const [treeMaximum, setTreeMaximum] = useAtom(store.treeMaximum)
    const [detailsMaximum, setDetailsMaximum] = useAtom(store.detailsMaximum)
    const [compactTree, setCompactTree] = useAtom(store.compactTree)
    const setViewportHeight = useAtomSet(store.viewportHeight)
    const { windowed, topSpacer, bottomSpacer } = useRowWindow(store)
    const full = React.useMemo(() => fullViewport(scene), [scene])
    const flameById = useFlameById(scene)
    const hues = React.useMemo(() => spanHueMap(scene, theme), [scene, theme])
    const laneById = React.useMemo(
      () => new Map(scene.lanes.map((lane) => [lane.session.id, lane])),
      [scene.lanes],
    )
    const selection = React.useMemo(
      (): ReadonlySet<Key> => new Set(selectedLaneId === null ? [] : [selectedLaneId]),
      [selectedLaneId],
    )
    const hasSelection = selectedLaneId !== null && laneById.has(selectedLaneId)

    const compactTreeRef = React.useRef(false)
    React.useLayoutEffect(() => {
      const root = refs.root.current
      const workspace = refs.workspace.current
      const scroller = refs.scroller.current
      if (root === null || workspace === null || scroller === null) return
      // One observer and one batch, so a layout change costs one commit.
      const measure = () =>
        Atom.batch(() => {
          setViewportHeight(scroller.clientHeight)
          const nextCompactTree = root.clientWidth < 900
          const compactTreeChanged = compactTreeRef.current !== nextCompactTree
          const nextTreeMaximum = Math.max(MIN_TREE_WIDTH, root.clientWidth * 0.5)
          const nextDetailsMaximum = Math.max(MIN_DETAILS_HEIGHT, workspace.clientHeight * 0.7)
          setTreeMaximum(nextTreeMaximum)
          setDetailsMaximum(nextDetailsMaximum)
          setTreeWidth((current) =>
            compactTreeChanged
              ? nextCompactTree
                ? MIN_TREE_WIDTH
                : clamp(DEFAULT_TREE_WIDTH, MIN_TREE_WIDTH, nextTreeMaximum)
              : clamp(current, MIN_TREE_WIDTH, nextTreeMaximum),
          )
          setDetailsHeight((current) => clamp(current, MIN_DETAILS_HEIGHT, nextDetailsMaximum))
          compactTreeRef.current = nextCompactTree
          setCompactTree(nextCompactTree)
        })
      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(root)
      observer.observe(workspace)
      observer.observe(scroller)
      return () => observer.disconnect()
    }, [
      refs,
      setCompactTree,
      setDetailsHeight,
      setDetailsMaximum,
      setTreeMaximum,
      setTreeWidth,
      setViewportHeight,
    ])

    const navigationHandlers = useTraceNavigation({
      scheme: navigation,
      window: full,
      viewport,
      onViewport: actions.setViewport,
      rootRef: refs.root,
      plotRef: refs.plot,
      onActivateLane: actions.selectLane,
    })

    return (
      <figure
        ref={refs.root}
        {...stylex.props(styles.root, style)}
        data-theme={theme}
        data-navigation="default"
        data-viewport-start={viewport.start}
        data-viewport-end={viewport.end}
        onKeyDownCapture={(event) => {
          const target = event.target
          if (
            event.key !== 'Escape' ||
            !(target instanceof Node) ||
            !refs.root.current?.contains(target)
          )
            return
          if (
            target instanceof HTMLElement &&
            (target.matches('input, textarea, select, [contenteditable="true"]') ||
              target.closest('[aria-label="Agent timeline details"]') !== null ||
              target.dataset.pointerDragging === 'true')
          )
            return
          event.stopPropagation()
          actions.resetViewport()
        }}
      >
        <div
          ref={refs.workspace}
          {...stylex.props(
            styles.workspace,
            styles.detailsRows(
              hasSelection ? detailsHeight : COLLAPSED_DETAILS_HEIGHT,
              hasSelection,
            ),
          )}
        >
          <div {...stylex.props(styles.mainGrid, styles.treeColumns(treeWidth))}>
            <TraceToolbar {...props} />
            <div {...stylex.props(styles.overviewShell)}>
              <CursorMinimap
                store={store}
                scene={scene}
                viewport={viewport}
                onViewportChange={actions.setViewport}
              />
            </div>
            <div {...stylex.props(styles.plotAxis)}>
              <CursorAxis store={store} viewport={viewport} />
            </div>
            <TraceTree {...props} />
            <TraceResizeHandle
              label="Resize session tree"
              orientation="vertical"
              value={treeWidth}
              minimum={MIN_TREE_WIDTH}
              maximum={treeMaximum}
              resetValue={compactTree ? MIN_TREE_WIDTH : DEFAULT_TREE_WIDTH}
              direction={1}
              onChange={setTreeWidth}
            />
            <section
              ref={refs.plot}
              {...stylex.props(styles.plotPane)}
              aria-label="Agent session spans"
            >
              <Group
                ref={refs.timeline}
                aria-label="Trace timeline navigation"
                tabIndex={0}
                {...stylex.props(styles.timeline)}
                onPointerDownCapture={navigationHandlers.onPointerDown}
                onPointerMoveCapture={navigationHandlers.onPointerMove}
                onPointerUpCapture={navigationHandlers.onPointerUp}
                onPointerCancel={navigationHandlers.onPointerCancel}
                onKeyDownCapture={navigationHandlers.onKeyDown}
              >
                <div
                  ref={refs.scroller}
                  {...stylex.props(styles.rowScroller)}
                  onScroll={(event) =>
                    actions.syncScroll(event.currentTarget.scrollTop, refs.scroller)
                  }
                  onKeyDownCapture={actions.onVirtualizedRowKeyDown}
                >
                  {topSpacer > 0 ? <div style={{ height: topSpacer }} /> : null}
                  <TraceProfiler region="rows">
                    <GridList
                      aria-label="Agent session spans"
                      selectionMode="single"
                      selectedKeys={selection}
                      onSelectionChange={(keys: Selection) => {
                        const key = keys === 'all' ? undefined : Array.from(keys)[0]
                        actions.selectLane(key === undefined ? null : String(key))
                      }}
                      onAction={(key) => actions.selectLane(String(key))}
                      {...stylex.props(styles.grid)}
                    >
                      {windowed.map((item) => (
                        <LaneRow
                          key={item.lane.session.id}
                          item={item}
                          flame={flameById.get(item.lane.session.id)!}
                          scene={scene}
                          viewport={viewport}
                          hues={hues}
                          store={store}
                          onCursor={actions.setCursor}
                          onZoom={actions.zoomToLane}
                        />
                      ))}
                    </GridList>
                  </TraceProfiler>
                  {bottomSpacer > 0 ? <div style={{ height: bottomSpacer }} /> : null}
                </div>
                {navigationHandlers.selection !== null
                  ? (() => {
                      const rect = refs.timeline.current?.getBoundingClientRect()
                      if (rect === undefined) return null
                      const left = clamp(
                        Math.min(
                          navigationHandlers.selection.fromX,
                          navigationHandlers.selection.toX,
                        ) - rect.left,
                        0,
                        rect.width,
                      )
                      const width = Math.min(
                        Math.abs(
                          navigationHandlers.selection.toX - navigationHandlers.selection.fromX,
                        ),
                        rect.width - left,
                      )
                      return (
                        <div
                          data-trace-drag-selection
                          {...stylex.props(styles.dragSelection, styles.dragBounds(left, width))}
                        />
                      )
                    })()
                  : null}
                <CursorSpanHover store={store} scene={scene} laneById={laneById} hues={hues} />
              </Group>
            </section>
          </div>
          {hasSelection ? (
            <TraceResizeHandle
              label="Resize span details"
              orientation="horizontal"
              value={detailsHeight}
              minimum={MIN_DETAILS_HEIGHT}
              maximum={detailsMaximum}
              resetValue={DEFAULT_DETAILS_HEIGHT}
              direction={-1}
              onChange={setDetailsHeight}
            />
          ) : null}
          <div {...stylex.props(styles.detailsPane)}>
            <TraceDetails {...props} />
          </div>
        </div>
      </figure>
    )
  },
)
TraceLayout.displayName = 'TraceLayout'

const makeTraceRefs = (): TraceRefs => ({
  root: React.createRef<HTMLElement>(),
  workspace: React.createRef<HTMLDivElement>(),
  scroller: React.createRef<HTMLDivElement>(),
  treeScroller: React.createRef<HTMLDivElement>(),
  timeline: React.createRef<HTMLDivElement>(),
  plot: React.createRef<HTMLElement>(),
  expansion: { current: { controlled: false, onChange: undefined } },
})

/**
 * Owns the atom graph and feeds host props into it. The regions read the scene from the graph,
 * so a live refresh re-renders them once, from one batched update, instead of once for the new
 * prop and again for the synchronized atoms.
 */
const AgentTimelineSurface = ({
  scene,
  initialViewport,
  navigation = defaultNavigation,
  style,
  expandedKeys: controlledExpandedKeys,
  defaultExpandedKeys,
  onExpandedChange,
}: AgentTimelineProps) => {
  const registry = React.useContext(RegistryContext)
  // The atom graph and DOM handles are instance resources, not React viewer state.
  const [store] = React.useState(() =>
    makeTraceState(
      scene,
      initialViewport,
      navigation.minimumViewportMs,
      controlledExpandedKeys ?? defaultExpandedKeys,
    ),
  )
  const [refs] = React.useState(makeTraceRefs)
  React.useLayoutEffect(() => {
    refs.expansion.current = {
      controlled: controlledExpandedKeys !== undefined,
      onChange: onExpandedChange,
    }
  }, [controlledExpandedKeys, onExpandedChange, refs])
  React.useLayoutEffect(() => {
    if (controlledExpandedKeys !== undefined) registry.set(store.expansion, controlledExpandedKeys)
  }, [controlledExpandedKeys, registry, store])
  const previousScene = React.useRef(scene)
  React.useLayoutEffect(() => {
    const previous = previousScene.current
    if (previous === scene) return
    previousScene.current = scene
    Atom.batch(() => {
      registry.set(store.viewport, store.applyScene(previous, scene, registry.get(store.viewport)))
      registry.set(store.scene, scene)
    })
  }, [registry, scene, store])
  return <TraceLayout store={store} refs={refs} navigation={navigation} style={style} />
}

/**
 * Render an agent timeline. Viewer state survives live refreshes; it resets only when the horizon
 * changes, because a different horizon is a different trace rather than a newer one.
 */
export const AgentTimeline = (props: AgentTimelineProps) => (
  <AgentTimelineSurface key={props.scene.model.horizon} {...props} />
)

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    margin: 0,
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontSans,
  },
  toolbar: {
    gridColumn: 3,
    minWidth: 0,
    height: TOOLBAR_HEIGHT,
    gridRow: 1,
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    boxSizing: 'border-box',
    paddingInline: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
  },
  workspace: {
    flex: '1 1 auto',
    display: 'grid',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  detailsRows: (height: number, expanded: boolean) => ({
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: `minmax(0, 1fr) ${expanded ? 1 : 0}px ${height}px`,
  }),
  mainGrid: {
    gridColumn: 1,
    gridRow: 1,
    display: 'grid',
    gridTemplateRows: `${TOOLBAR_HEIGHT}px ${MINIMAP_ROW_HEIGHT}px ${AXIS_HEIGHT}px minmax(0, 1fr)`,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  treeColumns: (width: number) => ({
    gridTemplateColumns: `${width}px 1px minmax(0, 1fr)`,
  }),
  plotPane: {
    gridColumn: 3,
    gridRow: 4,
    position: 'relative',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    touchAction: 'none',
  },
  detailsPane: {
    gridColumn: 1,
    gridRow: 3,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  collapsedDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space3,
    width: '100%',
    height: COLLAPSED_DETAILS_HEIGHT,
    minWidth: 0,
    boxSizing: 'border-box',
    paddingInline: scale.space3,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    fontSize: '0.75rem',
  },
  collapsedDetailsHint: {
    minWidth: 0,
    overflow: 'hidden',
    color: tokens['--ds-gray-700'],
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resizeHandle: {
    position: 'relative',
    zIndex: 4,
    boxSizing: 'border-box',
    backgroundColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':focus-visible': tokens['--ds-gray-alpha-700'],
    },
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
    outlineOffset: -1,
    touchAction: 'none',
    userSelect: 'none',
  },
  resizeSeparator: {
    display: 'block',
    width: '100%',
    height: '100%',
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'inherit',
  },
  verticalResizeHandle: {
    gridColumn: 2,
    gridRow: '1 / 5',
    width: 1,
    cursor: 'col-resize',
    '::after': { content: '""', position: 'absolute', insetBlock: 0, insetInline: -4 },
  },
  horizontalResizeHandle: {
    gridColumn: 1,
    gridRow: 2,
    height: 1,
    cursor: 'row-resize',
    '::after': { content: '""', position: 'absolute', insetInline: 0, insetBlock: -4 },
  },
  activeResizeHandle: { backgroundColor: tokens['--ds-gray-alpha-700'] },
  search: {
    flex: '0 1 222px',
    display: 'flex',
    alignItems: 'center',
    minWidth: 142,
    height: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
  },
  searchInput: {
    width: 138,
    minWidth: 54,
    height: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-foreground'],
    paddingInline: scale.space2,
    font: 'inherit',
    fontSize: '0.68rem',
    outline: 'none',
  },
  findCount: {
    flex: '0 0 auto',
    color: tokens['--ds-gray-700'],
    fontFamily: scale.fontMono,
    fontSize: '0.62rem',
    fontVariantNumeric: 'tabular-nums',
  },
  iconButton: {
    flex: '0 0 auto',
    width: 24,
    height: 24,
    borderWidth: 0,
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  resetButton: {
    flex: '0 0 auto',
    height: 26,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-foreground'],
    paddingInline: scale.space2,
    font: 'inherit',
    fontSize: '0.65rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  summary: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    minWidth: 0,
    overflow: 'hidden',
    color: tokens['--ds-gray-800'],
    fontSize: '0.62rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  toolbarTooltip: {
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
  overviewShell: {
    gridColumn: 3,
    gridRow: 2,
    height: MINIMAP_ROW_HEIGHT,
    minWidth: 0,
    backgroundColor: tokens['--ds-gray-100'],
  },
  plotAxis: { gridColumn: 3, gridRow: 3, minWidth: 0, minHeight: 0 },
  minimap: {
    position: 'relative',
    width: '100%',
    height: OVERVIEW_HEIGHT,
    overflow: 'visible',
    backgroundColor: tokens['--ds-gray-alpha-100'],
    touchAction: 'none',
  },
  minimapCursor: {
    position: 'absolute',
    zIndex: 3,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: tokens['--ds-red-900'],
    pointerEvents: 'none',
  },
  minimapTitle: {
    position: 'absolute',
    top: 5,
    left: 7,
    color: tokens['--ds-gray-800'],
    fontSize: '0.58rem',
    fontWeight: 600,
    letterSpacing: '0.03em',
    pointerEvents: 'none',
  },
  brush: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-blue-900'],
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 9%, transparent)`,
    cursor: 'grab',
    touchAction: 'none',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  brushBounds: (left: number, width: number) => ({
    left: `${left}%`,
    width: `${Math.max(0.4, width)}%`,
  }),
  brushHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 7,
    backgroundColor: tokens['--ds-blue-800'],
    cursor: 'ew-resize',
    touchAction: 'none',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
    '::after': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      insetInline: -4,
    },
  },
  brushHandleStart: { left: -4 },
  brushHandleEnd: { right: -4 },
  axis: {
    position: 'relative',
    height: 28,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
  },
  axisPlot: { position: 'relative', width: '100%', height: '100%', minWidth: 0 },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-gray-alpha-400'],
    color: tokens['--ds-gray-700'],
    fontFamily: scale.fontMono,
    fontSize: '0.58rem',
  },
  leftPercent: (left: number) => ({ left: `${left}%` }),
  timezone: {
    position: 'absolute',
    right: scale.space1,
    bottom: 2,
    color: tokens['--ds-gray-600'],
    fontSize: '0.55rem',
  },
  axisCursor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: tokens['--ds-red-900'],
    pointerEvents: 'none',
  },
  timeline: {
    gridRow: 2,
    position: 'relative',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    touchAction: 'none',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  rowScroller: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflowY: 'auto',
    scrollbarGutter: 'stable',
  },
  grid: { display: 'block', minWidth: 0, outline: 'none' },
  gridRow: {
    display: 'block',
    height: ROW_HEIGHT,
    minWidth: 0,
    color: tokens['--ds-foreground'],
    outline: 'none',
    cursor: 'default',
  },
  alternateRoot: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  rowHovered: { backgroundColor: tokens['--ds-gray-alpha-200'] },
  rowSelected: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 10%, transparent)`,
  },
  rowFocused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -2,
  },
  barCell: { position: 'relative', width: '100%', height: ROW_HEIGHT, minWidth: 0 },
  rollupOverlay: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  dragSelection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderInlineWidth: 1,
    borderInlineStyle: 'solid',
    borderInlineColor: tokens['--ds-blue-900'],
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 14%, transparent)`,
    pointerEvents: 'none',
  },
  dragBounds: (left: number, width: number) => ({ left, width }),
})
