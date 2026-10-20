/** Inferred activity state for the interval between consecutive request timestamps. */
export type ActivitySegmentState = 'working' | 'waiting' | 'idle'
/** Epoch-millisecond interval of one session's inferred working, waiting, or idle activity. */
export interface ActivitySegment {
  readonly from: number
  readonly to: number
  readonly state: ActivitySegmentState
}
/** Theme-resolved colors used consistently across a span's fill, emphasis, and text. */
export interface SpanHue {
  readonly base: string
  readonly muted: string
  readonly strong: string
  readonly text: string
}
/** Visible timeline bounds expressed as epoch-millisecond timestamps. */
export interface TraceViewport {
  readonly start: number
  readonly end: number
}
/** Inspected epoch-millisecond timestamp and, when applicable, the lane under the cursor. */
export interface TraceCursor {
  readonly ts: number
  readonly laneId: string | null
}
/** User-selected predicates applied when deriving the visible trace lanes. */
export interface TraceFilters {
  readonly agentTypes: ReadonlySet<string>
  readonly models: ReadonlySet<string>
  readonly roots: ReadonlySet<string>
  readonly state: 'all' | 'active' | 'inactive' | 'exited'
  readonly minUsd: number
  readonly hasCompaction: boolean
  readonly find: string
}
