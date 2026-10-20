import * as React from 'react'

/** Gated regions of the trace whose React commits the perf-gate tests count. */
export type TraceRenderRegion = 'header' | 'tree' | 'rows' | 'details'

/**
 * Counters the perf-gate harness reads. `${region}` counts `React.Profiler` commits of a region's
 * subtree, including commits React Aria makes inside it; `${region}.ms` sums their
 * `actualDuration`; `fn.${component}` counts function renders of the trace's own components.
 * A harness opts in by defining `globalThis.agentTimelineRenders`; otherwise nothing is recorded.
 */
export type TraceRenderCounts = Record<string, number>

declare global {
  // oxlint-disable-next-line no-var -- a global counter bag must be declared with `var`.
  var agentTimelineRenders: TraceRenderCounts | undefined
}

const record: React.ProfilerOnRenderCallback = (id, _phase, actualDuration) => {
  const counts = globalThis.agentTimelineRenders
  if (counts === undefined) return
  counts[id] = (counts[id] ?? 0) + 1
  counts[`${id}.ms`] = (counts[`${id}.ms`] ?? 0) + actualDuration
}

/**
 * Count commits of one trace region. Place it inside the region's memoized component: a Profiler
 * whose parent re-renders reports a commit even when the memoized child bails out.
 */
export const TraceProfiler = ({
  region,
  children,
}: {
  readonly region: TraceRenderRegion
  readonly children: React.ReactNode
}) => (
  <React.Profiler id={region} onRender={record}>
    {children}
  </React.Profiler>
)

/** Count one function render of a trace component, separating own renders from subtree commits. */
export const countTraceRender = (component: string): void => {
  const counts = globalThis.agentTimelineRenders
  if (counts !== undefined) counts[`fn.${component}`] = (counts[`fn.${component}`] ?? 0) + 1
}
