import * as React from 'react'

import type { TraceViewport } from '@overeng/agent-timeline/types'

/** Smallest permitted trace viewport duration, in milliseconds. */
export const MIN_TRACE_VIEWPORT_MS = 5_000
const PINCH_DELTA_GAIN = 4
const DOM_DELTA_PIXEL = 0
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2
const CHROME_ZOOM_BASE = 1.2
const CHROME_ZOOM_DIVISOR = 53
const KEYBOARD_PAN_PX = 160
const KEYBOARD_ZOOM_IN_FACTOR = 0.7
const KEYBOARD_ZOOM_OUT_FACTOR = 1.43
const SHIFT_KEYBOARD_MULTIPLIER = 2.5

/** Tunable gains and edge behavior for the single production trace navigation model. */
export interface NavigationScheme {
  readonly zoomGain: number
  readonly panGain: number
  readonly minimumViewportMs: number
  readonly transitionMs: 0 | 100
}

/** Production navigation configuration for Agent Timeline. */
export const defaultNavigation: NavigationScheme = {
  zoomGain: 1,
  panGain: 1,
  minimumViewportMs: MIN_TRACE_VIEWPORT_MS,
  transitionMs: 100,
}

/** One viewport action resolved from a wheel gesture. */
export type TraceNavigationAction = 'zoom' | 'panX' | 'scrollRows'

/** Screen-space selection shown while a select-to-zoom drag is active. */
export interface TraceDragSelection {
  readonly fromX: number
  readonly toX: number
}

/** React handlers and ephemeral rendering state owned by trace navigation. */
export interface TraceNavigationHandlers {
  readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
  readonly selection: TraceDragSelection | null
}

interface DragState {
  readonly mode: 'selectZoom' | 'pan'
  readonly pointerId: number
  readonly fromClientX: number
  readonly plotLeft: number
  readonly plotWidth: number
  readonly viewport: TraceViewport
  readonly laneId: string | null
}

/** Inputs required to bind navigation to a bounded trace viewport. */
export interface TraceNavigationArgs {
  readonly scheme: NavigationScheme
  readonly window: TraceViewport
  readonly viewport: TraceViewport
  readonly onViewport: (viewport: TraceViewport) => void
  readonly rootRef: React.RefObject<HTMLElement | null>
  readonly plotRef: React.RefObject<HTMLElement | null>
  readonly onActivateLane: (laneId: string) => void
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

/** Clamp a viewport without changing its duration unless it exceeds the available window. */
export const clampTraceViewport = (
  viewport: TraceViewport,
  window: TraceViewport,
  minimumViewportMs = MIN_TRACE_VIEWPORT_MS,
): TraceViewport => {
  const windowDuration = Math.max(1, window.end - window.start)
  const minimumDuration = Math.min(minimumViewportMs, windowDuration)
  const requestedDuration = Number.isFinite(viewport.end - viewport.start)
    ? viewport.end - viewport.start
    : windowDuration
  const duration = clamp(requestedDuration, minimumDuration, windowDuration)
  const requestedStart = Number.isFinite(viewport.start) ? viewport.start : window.start
  const start = clamp(requestedStart, window.start, window.end - duration)
  return { start, end: start + duration }
}

/** Convert DOM wheel units to CSS-pixel-like deltas before applying tunable gains. */
export const normalizeWheelDelta = (delta: number, deltaMode: number, pageSize: number): number =>
  delta *
  (deltaMode === DOM_DELTA_LINE ? 16 : deltaMode === DOM_DELTA_PAGE ? Math.max(1, pageSize) : 1)

const isPinchWheel = (
  event: Pick<WheelEvent, 'ctrlKey' | 'metaKey' | 'deltaMode' | 'deltaY'>,
): boolean =>
  event.ctrlKey &&
  !event.metaKey &&
  event.deltaMode === DOM_DELTA_PIXEL &&
  Math.abs(event.deltaY) <= 50

/** Resolve the fixed N2 wheel vocabulary independently from viewport math. */
export const wheelAction = (
  event: Pick<WheelEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'deltaMode' | 'deltaX' | 'deltaY'>,
): TraceNavigationAction => {
  if (Math.abs(event.deltaX) > 0.01 && !isPinchWheel(event)) return 'panX'
  if (event.ctrlKey || event.metaKey) return 'zoom'
  if (event.shiftKey) return 'panX'
  return 'scrollRows'
}

const eventPlotRect = (
  eventTarget: EventTarget | null,
  root: HTMLElement,
  plot: HTMLElement | null,
): DOMRect | null => {
  const target = eventTarget instanceof Element ? eventTarget : null
  const spanArea = target?.closest<HTMLElement>('[data-trace-span-area]') ?? null
  if (spanArea !== null && root.contains(spanArea)) return spanArea.getBoundingClientRect()
  return target !== null && plot?.contains(target) === true ? plot.getBoundingClientRect() : null
}

const eventLaneId = (eventTarget: EventTarget | null, container: HTMLElement): string | null => {
  const target = eventTarget instanceof Element ? eventTarget : null
  const row = target?.closest<HTMLElement>('[data-session-id]') ?? null
  return row !== null && container.contains(row) ? (row.dataset.sessionId ?? null) : null
}

const isTextEntry = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.matches('input, textarea, select, [contenteditable="true"]')
}

/** Apply the production trace input vocabulary to a bounded viewport. */
export const useTraceNavigation = ({
  scheme,
  window,
  viewport,
  onViewport,
  rootRef,
  plotRef,
  onActivateLane,
}: TraceNavigationArgs): TraceNavigationHandlers => {
  const viewportRef = React.useRef(viewport)
  const schemeRef = React.useRef(scheme)
  const windowRef = React.useRef(window)
  const onViewportRef = React.useRef(onViewport)
  const onActivateLaneRef = React.useRef(onActivateLane)
  const dragRef = React.useRef<DragState | null>(null)
  const transitionFrameRef = React.useRef<number | null>(null)
  const lastPointerRatioRef = React.useRef(0.5)
  const [selection, setSelection] = React.useState<TraceDragSelection | null>(null)
  viewportRef.current = viewport
  schemeRef.current = scheme
  windowRef.current = window
  onViewportRef.current = onViewport
  onActivateLaneRef.current = onActivateLane

  const cancelTransition = React.useCallback((): void => {
    if (transitionFrameRef.current === null) return
    cancelAnimationFrame(transitionFrameRef.current)
    transitionFrameRef.current = null
  }, [])

  React.useEffect(() => cancelTransition, [cancelTransition])

  const commitViewport = React.useCallback(
    (next: TraceViewport, transitionMs: number): void => {
      const activeScheme = schemeRef.current
      const clamped = clampTraceViewport(next, windowRef.current, activeScheme.minimumViewportMs)
      cancelTransition()
      if (transitionMs <= 0) {
        viewportRef.current = clamped
        onViewportRef.current(clamped)
        return
      }
      const from = viewportRef.current
      const startedAt = performance.now()
      const step = (now: number): void => {
        const progress = clamp((now - startedAt) / transitionMs, 0, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
        const frame = {
          start: from.start + (clamped.start - from.start) * eased,
          end: from.end + (clamped.end - from.end) * eased,
        }
        viewportRef.current = frame
        onViewportRef.current(frame)
        if (progress >= 1) {
          transitionFrameRef.current = null
          return
        }
        transitionFrameRef.current = requestAnimationFrame(step)
      }
      transitionFrameRef.current = requestAnimationFrame(step)
    },
    [cancelTransition],
  )

  const panByPixels = React.useCallback(
    (pixels: number, plotWidth?: number, transitionMs = 0): void => {
      const activeViewport = viewportRef.current
      const activeScheme = schemeRef.current
      const width = Math.max(1, plotWidth ?? plotRef.current?.clientWidth ?? 1)
      const duration = activeViewport.end - activeViewport.start
      const delta = (pixels / width) * duration * activeScheme.panGain
      commitViewport(
        { start: activeViewport.start + delta, end: activeViewport.end + delta },
        transitionMs,
      )
    },
    [commitViewport, plotRef],
  )

  const zoomByFactor = React.useCallback(
    (factor: number, anchorTs?: number, transitionMs = 0): void => {
      const activeViewport = viewportRef.current
      const currentDuration = activeViewport.end - activeViewport.start
      const anchor =
        anchorTs ?? activeViewport.start + currentDuration * lastPointerRatioRef.current
      const anchorRatio = clamp(
        (anchor - activeViewport.start) / Math.max(1, currentDuration),
        0,
        1,
      )
      const duration = currentDuration * factor
      commitViewport(
        {
          start: anchor - duration * anchorRatio,
          end: anchor + duration * (1 - anchorRatio),
        },
        transitionMs,
      )
    },
    [commitViewport],
  )

  const zoomByPixels = React.useCallback(
    (pixels: number, anchorTs: number, pinch: boolean): void => {
      const activeScheme = schemeRef.current
      const adjustedPixels = pixels * (pinch ? PINCH_DELTA_GAIN : 1) * activeScheme.zoomGain
      const factor = Math.pow(CHROME_ZOOM_BASE, adjustedPixels / CHROME_ZOOM_DIVISOR)
      zoomByFactor(factor, anchorTs, 0)
    },
    [zoomByFactor],
  )

  React.useLayoutEffect(() => {
    const node = rootRef.current
    if (node === null) return
    const handleWheel = (event: WheelEvent): void => {
      const action = wheelAction(event)
      if (action === 'scrollRows') return
      const plotRect = eventPlotRect(event.target, node, plotRef.current)
      if (plotRect === null) return
      event.preventDefault()
      cancelTransition()
      const pageSize = node.clientHeight
      if (action === 'panX') {
        const rawDelta = Math.abs(event.deltaX) > 0.01 ? event.deltaX : event.deltaY
        panByPixels(normalizeWheelDelta(rawDelta, event.deltaMode, pageSize), plotRect.width, 0)
        return
      }
      const normalized = normalizeWheelDelta(event.deltaY, event.deltaMode, pageSize)
      const ratio = clamp((event.clientX - plotRect.left) / Math.max(1, plotRect.width), 0, 1)
      lastPointerRatioRef.current = ratio
      const activeViewport = viewportRef.current
      const anchor = activeViewport.start + ratio * (activeViewport.end - activeViewport.start)
      zoomByPixels(normalized, anchor, isPinchWheel(event))
    }
    node.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => node.removeEventListener('wheel', handleWheel, { capture: true })
  }, [cancelTransition, panByPixels, plotRef, rootRef, zoomByPixels])

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      if (event.button !== 0) return
      const root = rootRef.current
      if (root === null) return
      const plotRect = eventPlotRect(event.target, root, plotRef.current)
      if (plotRect === null) return
      cancelTransition()
      event.currentTarget.setPointerCapture(event.pointerId)
      lastPointerRatioRef.current = clamp(
        (event.clientX - plotRect.left) / Math.max(1, plotRect.width),
        0,
        1,
      )
      const mode = event.shiftKey ? 'pan' : 'selectZoom'
      dragRef.current = {
        mode,
        pointerId: event.pointerId,
        fromClientX: event.clientX,
        plotLeft: plotRect.left,
        plotWidth: Math.max(1, plotRect.width),
        viewport: viewportRef.current,
        laneId: eventLaneId(event.target, root),
      }
      if (mode === 'selectZoom') setSelection({ fromX: event.clientX, toX: event.clientX })
      event.preventDefault()
    },
    [cancelTransition, plotRef, rootRef],
  )

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const root = rootRef.current
      if (root !== null) {
        const plotRect = eventPlotRect(event.target, root, plotRef.current)
        if (plotRect !== null) {
          lastPointerRatioRef.current = clamp(
            (event.clientX - plotRect.left) / Math.max(1, plotRect.width),
            0,
            1,
          )
        }
      }
      const drag = dragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      if (drag.mode === 'selectZoom') {
        setSelection({ fromX: drag.fromClientX, toX: event.clientX })
        return
      }
      const delta =
        -((event.clientX - drag.fromClientX) / drag.plotWidth) *
        (drag.viewport.end - drag.viewport.start)
      commitViewport({ start: drag.viewport.start + delta, end: drag.viewport.end + delta }, 0)
    },
    [commitViewport, plotRef, rootRef],
  )

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const drag = dragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      const movement = Math.abs(event.clientX - drag.fromClientX)
      if (drag.mode === 'selectZoom' && movement > 4) {
        const activeViewport = drag.viewport
        const fromRatio = clamp((drag.fromClientX - drag.plotLeft) / drag.plotWidth, 0, 1)
        const toRatio = clamp((event.clientX - drag.plotLeft) / drag.plotWidth, 0, 1)
        const fromTs =
          activeViewport.start + fromRatio * (activeViewport.end - activeViewport.start)
        const toTs = activeViewport.start + toRatio * (activeViewport.end - activeViewport.start)
        commitViewport(
          { start: Math.min(fromTs, toTs), end: Math.max(fromTs, toTs) },
          schemeRef.current.transitionMs,
        )
      } else if (drag.mode === 'selectZoom' && drag.laneId !== null) {
        onActivateLaneRef.current(drag.laneId)
      }
      dragRef.current = null
      setSelection(null)
    },
    [commitViewport],
  )

  const onPointerCancel = React.useCallback((event: React.PointerEvent<HTMLElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setSelection(null)
  }, [])

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      if (event.target !== event.currentTarget || isTextEntry(event.target)) return
      const key = event.key.toLocaleLowerCase()
      const panLeft = key === 'a' || event.key === 'ArrowLeft'
      const panRight = key === 'd' || event.key === 'ArrowRight'
      const zoomIn =
        key === 'w' || event.key === 'ArrowUp' || event.key === '+' || event.key === '='
      const zoomOut =
        key === 's' || event.key === 'ArrowDown' || event.key === '-' || event.key === '_'
      const multiplier = event.shiftKey ? SHIFT_KEYBOARD_MULTIPLIER : 1
      const transitionMs = schemeRef.current.transitionMs
      if (event.key === 'Escape') {
        event.preventDefault()
        commitViewport(windowRef.current, 0)
      } else if (panLeft || panRight) {
        event.preventDefault()
        panByPixels((panLeft ? -1 : 1) * KEYBOARD_PAN_PX * multiplier, undefined, transitionMs)
      } else if (zoomIn || zoomOut) {
        event.preventDefault()
        const factor = Math.pow(
          zoomIn ? KEYBOARD_ZOOM_IN_FACTOR : KEYBOARD_ZOOM_OUT_FACTOR,
          multiplier,
        )
        zoomByFactor(factor, undefined, transitionMs)
      }
    },
    [commitViewport, panByPixels, zoomByFactor],
  )

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown, selection }
}
