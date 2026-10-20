import { describe, expect, it } from 'vitest'

import type { TraceData, TraceSpan } from '../../model.ts'
import { diffTraces } from './TraceDiff.tsx'

const span = (spanId: string, parentSpanId: string, name: string, startMs: number): TraceSpan => ({
  spanId,
  parentSpanId,
  name,
  serviceName: 'api',
  startTimeUnixNano: String(startMs * 1_000_000),
  endTimeUnixNano: String((startMs + 10) * 1_000_000),
})

const trace = (...spans: TraceSpan[]): TraceData => ({ traceId: 't', spans })

describe('diffTraces parent cycles', () => {
  it('keeps every span of a parent cycle, rooted at its earliest span', () => {
    // a ↔ b form a cycle; c hangs below b. Nothing in the trace is a root.
    const cyclic = trace(span('a', 'b', 'a', 0), span('b', 'a', 'b', 1), span('c', 'b', 'c', 2))
    const model = diffTraces(cyclic, cyclic)
    expect(model.rows.map((row) => [row.name, row.depth, row.kind])).toEqual([
      ['a', 0, 'unchanged'],
      ['b', 1, 'unchanged'],
      ['c', 2, 'unchanged'],
    ])
  })

  it('reports a span that moves into a cycle remnant as a structural change, not as missing', () => {
    const before = trace(span('r', '', 'root', 0), span('x', 'r', 'x', 1))
    const after = trace(
      span('r', '', 'root', 0),
      span('a', 'b', 'a', 2),
      span('b', 'a', 'b', 3),
      span('x', 'b', 'x', 4),
    )
    const model = diffTraces(before, after)
    expect(model.rows.map((row) => row.name).toSorted()).toEqual(['a', 'b', 'root', 'x'])
    expect(model.counts.added).toBe(2)
    expect(model.rows.find((row) => row.name === 'x')?.kind).toBe('moved')
  })
})
