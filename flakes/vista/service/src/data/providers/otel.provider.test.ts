import { bind, encodeBinding } from '@vista/blocks/internal/data-contract'
import {
  AbsoluteMetricRange,
  MetricQueryArgs,
  otel,
} from '@vista/blocks/internal/provider-contracts'
import { Effect, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { PromMatrix, resolveRange } from './otel.provider.ts'

const args: MetricQueryArgs = {
  promql: 'up',
  range: { kind: 'relative', last: '5m' },
  stepSeconds: 60,
  points: 6,
}

describe('otel metric ranges', () => {
  it('resolves relative and absolute ranges deterministically with the point cap', () => {
    expect(resolveRange(args, 1_000)).toEqual({ kind: 'absolute', start: 700, end: 1_000 })
    expect(
      resolveRange(
        {
          range: { kind: 'absolute', start: 0, end: 1_000 },
          stepSeconds: 60,
          points: 3,
        },
        99_999,
      ),
    ).toEqual({ kind: 'absolute', start: 880, end: 1_000 })
  })

  it('rejects reversed or empty absolute ranges', () => {
    expect(() =>
      Schema.decodeSync(AbsoluteMetricRange)({
        kind: 'absolute',
        start: 1_000,
        end: 1_000,
      }),
    ).toThrow(/start must be before end/u)
    expect(() =>
      Schema.decodeSync(AbsoluteMetricRange)({
        kind: 'absolute',
        start: 2_000,
        end: 1_000,
      }),
    ).toThrow(/start must be before end/u)
  })

  it('requires an integer point count of at least two', () => {
    expect(() => Schema.decodeSync(MetricQueryArgs)({ ...args, points: 1 })).toThrow()
    expect(() => Schema.decodeSync(MetricQueryArgs)({ ...args, points: 2.5 })).toThrow()
    expect(Schema.decodeSync(MetricQueryArgs)({ ...args, points: 2 }).points).toBe(2)
  })

  it('rejects non-matrix and unsuccessful Prometheus responses', () => {
    expect(() =>
      Schema.decodeUnknownSync(PromMatrix)({
        status: 'success',
        data: { resultType: 'vector', result: [] },
      }),
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(PromMatrix)({
        status: 'error',
        data: { resultType: 'matrix', result: [] },
      }),
    ).toThrow()
  })

  it('does not alias snapshot keys across step, points, or authored range changes', async () => {
    const variants: MetricQueryArgs[] = [
      args,
      { ...args, stepSeconds: 30 },
      { ...args, points: 7 },
      { ...args, range: { kind: 'relative', last: '1h' } },
    ]
    const keys = await Promise.all(
      variants.map((variant) =>
        Effect.runPromise(encodeBinding(bind(otel.ops.query, variant))).then(({ key }) => key),
      ),
    )

    expect(new Set(keys).size).toBe(4)
  })
})
