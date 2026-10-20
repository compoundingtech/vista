import * as stylex from '@stylexjs/stylex'
import * as React from 'react'
import { Popover } from 'react-aria-components'

import { CursorReadout } from '@overeng/agent-timeline/compact'
import type { AgentTimelineScene, Lane } from '@overeng/agent-timeline/projection'
import type { SpanHue, ActivitySegment, TraceCursor } from '@overeng/agent-timeline/types'

import { useTheme } from '../../theme.ts'

/** Viewport-relative bounds used to place hover cursors and popovers. */
export interface TimelineHoverRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Hover timestamp and pointer geometry resolved against a timeline plot. */
export interface TimelineHoverPoint {
  readonly ts: number
  readonly cursorX: number
  readonly targetRect: TimelineHoverRect
  readonly plotRect: TimelineHoverRect
}

/** Coordinate conversion and notification inputs for shared timeline hovering. */
export interface UseTimelineHoverArgs {
  readonly timeAtX: (offsetX: number, width: number) => number
  readonly plotRef?: React.RefObject<Element | null> | undefined
  readonly disabled?: boolean
  readonly onHover?: (hover: TimelineHoverPoint | null) => void
}

/** Reactive hover state and pointer handlers attached to a timeline surface. */
export interface TimelineHoverBinding {
  readonly hover: TimelineHoverPoint | null
  readonly cursorTs: number | null
  readonly onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerLeave: () => void
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const hoverRect = (rect: DOMRect): TimelineHoverRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
})

/** Resolve a pointer event over a time plot into a timestamp and viewport-relative bounds. */
export const timelineHoverPoint = (
  event: React.PointerEvent<HTMLElement>,
  timeAtX: (offsetX: number, width: number) => number,
  plotRef?: React.RefObject<Element | null>,
): TimelineHoverPoint => {
  const targetBounds = event.currentTarget.getBoundingClientRect()
  const plotBounds = plotRef?.current?.getBoundingClientRect() ?? targetBounds
  const cursorX = clamp(event.clientX, plotBounds.left, plotBounds.right)
  return {
    ts: timeAtX(cursorX - plotBounds.left, Math.max(1, plotBounds.width)),
    cursorX,
    targetRect: hoverRect(targetBounds),
    plotRect: hoverRect(plotBounds),
  }
}

/** Convert pointer position over a time plot into a timestamp and viewport-relative bounds. */
export const useTimelineHover = ({
  timeAtX,
  plotRef,
  disabled = false,
  onHover,
}: UseTimelineHoverArgs): TimelineHoverBinding => {
  const [hover, setHover] = React.useState<TimelineHoverPoint | null>(null)
  React.useLayoutEffect(() => {
    if (!disabled) return
    setHover(null)
    onHover?.(null)
  }, [disabled, onHover])
  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      if (disabled) return
      const nextHover = timelineHoverPoint(event, timeAtX, plotRef)
      setHover(nextHover)
      onHover?.(nextHover)
    },
    [disabled, onHover, plotRef, timeAtX],
  )
  const onPointerLeave = React.useCallback((): void => {
    setHover(null)
    onHover?.(null)
  }, [onHover])
  return { hover, cursorTs: hover?.ts ?? null, onPointerMove, onPointerLeave }
}

/** Timeline hover inputs augmented with the lane used to produce trace cursors. */
export interface UseSpanHoverArgs {
  readonly lane: Lane
  readonly timeAtX: (offsetX: number, width: number) => number
  readonly plotRef?: React.RefObject<Element | null>
  readonly disabled?: boolean
  readonly onCursor?: (cursor: TraceCursor | null, hover: TimelineHoverPoint | null) => void
}

/** Hover state and event handlers returned for a specific span lane. */
export type SpanHoverBinding = TimelineHoverBinding

/** Add lane identity to the shared timeline hover used by span rows and the minimap. */
export const useSpanHover = ({
  lane,
  timeAtX,
  plotRef,
  disabled = false,
  onCursor,
}: UseSpanHoverArgs): SpanHoverBinding => {
  const onHover = React.useCallback(
    (hover: TimelineHoverPoint | null): void => {
      onCursor?.(hover === null ? null : { ts: hover.ts, laneId: lane.session.id }, hover)
    },
    [lane.session.id, onCursor],
  )
  return useTimelineHover({ timeAtX, plotRef, disabled, onHover })
}

/** Selected span evidence and geometry used by the cursor-following readout. */
export interface SpanHoverProps {
  readonly lane: Lane
  readonly scene: AgentTimelineScene
  readonly hue: SpanHue
  readonly segments: ReadonlyArray<ActivitySegment>
  readonly hover: TimelineHoverPoint | null
}

/** Cursor-following, non-modal span hover shared by the full trace and isolated span stories. */
export const SpanHover = ({
  lane,
  scene,
  hue,
  segments,
  hover,
}: SpanHoverProps): React.ReactNode => {
  const theme = useTheme()
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [popoverWidth, setPopoverWidth] = React.useState(0)

  React.useLayoutEffect(() => {
    if (hover === null || popoverRef.current === null) return
    const nextWidth = popoverRef.current.getBoundingClientRect().width
    setPopoverWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
  }, [hover])

  if (hover === null) return null

  const plotRight = hover.plotRect.left + hover.plotRect.width
  const minimumCenter = hover.plotRect.left + popoverWidth / 2
  const maximumCenter = plotRight - popoverWidth / 2
  const popoverCenter =
    minimumCenter <= maximumCenter
      ? clamp(hover.cursorX, minimumCenter, maximumCenter)
      : hover.plotRect.left + hover.plotRect.width / 2
  const rowCenter = hover.targetRect.left + hover.targetRect.width / 2

  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden="true"
        data-span-hover-anchor
        {...stylex.props(
          styles.anchor,
          styles.anchorBounds(
            hover.targetRect.left,
            hover.targetRect.top,
            hover.targetRect.width,
            hover.targetRect.height,
          ),
        )}
      />
      <Popover
        ref={popoverRef}
        triggerRef={anchorRef}
        isOpen
        isNonModal
        placement="top"
        offset={8}
        crossOffset={popoverCenter - rowCenter}
        shouldFlip
        aria-label="Span hover"
        data-span-hover
        data-theme={theme}
        {...stylex.props(styles.popover)}
      >
        <CursorReadout
          theme={theme}
          scene={scene}
          lane={lane}
          ts={hover.ts}
          hue={hue}
          segments={segments}
        />
      </Popover>
    </>
  )
}

const styles = stylex.create({
  anchor: { position: 'fixed', pointerEvents: 'none' },
  anchorBounds: (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
  }),
  popover: { pointerEvents: 'none' },
})
