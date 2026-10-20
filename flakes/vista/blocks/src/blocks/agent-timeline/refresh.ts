import type { TraceViewport } from '@overeng/agent-timeline/types'

import { clampTraceViewport, MIN_TRACE_VIEWPORT_MS } from './navigation.ts'

/** A viewport this close to the window end follows "now" on refresh; matches the provider's refresh floor. */
export const LIVE_EDGE_TOLERANCE_MS = 60_000

/**
 * Carries a viewport across a data refresh whose window moved. A viewport touching the previous
 * window end slides with the window (tail mode); any other viewport keeps its absolute times.
 */
export const followTraceWindow = ({
  viewport,
  previousWindow,
  nextWindow,
  minimumViewportMs = MIN_TRACE_VIEWPORT_MS,
}: {
  readonly viewport: TraceViewport
  readonly previousWindow: TraceViewport
  readonly nextWindow: TraceViewport
  readonly minimumViewportMs?: number
}): TraceViewport => {
  const shift = nextWindow.end - previousWindow.end
  const atEdge = viewport.end >= previousWindow.end - LIVE_EDGE_TOLERANCE_MS
  const moved =
    atEdge && shift > 0 ? { start: viewport.start + shift, end: viewport.end + shift } : viewport
  return clampTraceViewport(moved, nextWindow, minimumViewportMs)
}

/**
 * Values the viewer has not hidden. Filters store hidden values so that values first seen after
 * a refresh are shown by default.
 */
export const shownValues = <A>(options: ReadonlyArray<A>, hidden: ReadonlySet<A>): ReadonlySet<A> =>
  new Set(options.filter((option) => !hidden.has(option)))

/** Inverse of {@link shownValues}: the options missing from a shown set become hidden. */
export const hiddenValues = <A>(options: ReadonlyArray<A>, shown: ReadonlySet<A>): Set<A> =>
  new Set(options.filter((option) => !shown.has(option)))
