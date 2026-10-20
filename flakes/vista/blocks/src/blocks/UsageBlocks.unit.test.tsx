import { Option, Result, Schema } from 'effect'
import * as AsyncResult from 'effect/reactivity/AsyncResult'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { type LensChecked, LensEnvelope, OmpUsageError } from '../provider-contracts.ts'
import { SpendByProjectView, usageChronologyChart, UsageEvidenceStatus } from './UsageBlocks.tsx'

const envelope = Schema.decodeSync(LensEnvelope)({
  lens: 'usage_over_time',
  version: 8,
  window: '7d',
  computed_at: '2026-09-20T12:00:00.000Z',
  coverage: {
    ledger_rows: 10,
    ledger_usd: 18,
    attributed_share: 1,
    seat_share: 1,
    seat_identity_share: 1,
    account_share: 1,
    hosts: ['dev3'],
    first_ts: '2026-09-13T12:00:00.000Z',
    last_ts: '2026-09-20T12:00:00.000Z',
  },
  coverage_gate: 0.95,
  coverage_ok: true,
  provenance: {
    pricing_source: 'test',
    omp_version: 'test',
    ledger_schema: 6,
  },
  rows: [
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: 'opus',
      group_by: 'model',
      token_type: 'input',
      usd: 8,
    },
    {
      bucket: 'hour',
      bucket_start: '2026-09-19T01:00:00+02:00',
      group: 'opus',
      group_by: 'model',
      token_type: 'input',
      usd: 100,
    },
    {
      bucket: 'week',
      bucket_start: '2026-09-15T00:00:00+02:00',
      group: 'opus',
      group_by: 'model',
      token_type: 'input',
      usd: 200,
    },
    {
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group: 'opus',
      group_by: 'model',
      token_type: 'output',
      usd: null,
    },
  ],
})

const denseEnvelope = Schema.decodeSync(LensEnvelope)({
  ...envelope,
  rows: [
    ...['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'].map((group, index) => ({
      bucket: 'day',
      bucket_start: '2026-09-19T00:00:00+02:00',
      group,
      group_by: 'worktree',
      token_type: 'input',
      usd: 10 - index,
    })),
    {
      bucket: 'day',
      bucket_start: '2026-09-20T00:00:00+02:00',
      group: 'eta',
      group_by: 'worktree',
      token_type: 'input',
      usd: 20,
    },
  ],
})

describe('usageChronologyChart', () => {
  it("renders only bucket='day' and token_type='input' without summing other granularities", () => {
    const chart = Result.getOrThrow(usageChronologyChart(envelope))
    expect(chart.data).toEqual([{ label: '2026-09-19', values: { opus: 8 } }])
  })

  it('keeps the five highest-cost series and combines the remainder per day', () => {
    const chart = Result.getOrThrow(usageChronologyChart(denseEnvelope))
    expect(chart.series.map((series) => series.label)).toEqual([
      'eta',
      'alpha',
      'beta',
      'gamma',
      'delta',
      'Other (2)',
    ])
    expect(chart.data).toEqual([
      {
        label: '2026-09-19',
        values: {
          eta: 4,
          alpha: 10,
          beta: 9,
          gamma: 8,
          delta: 7,
          __other__: 11,
        },
      },
      {
        label: '2026-09-20',
        values: {
          eta: 20,
          alpha: 0,
          beta: 0,
          gamma: 0,
          delta: 0,
          __other__: 0,
        },
      },
    ])
  })

  it('fails rather than presenting partial evidence when any row does not decode', () => {
    const malformed = Schema.decodeSync(LensEnvelope)({
      ...envelope,
      rows: [...envelope.rows, { bucket: 'day', usd: 'not-a-number' }],
    })

    expect(Result.isFailure(usageChronologyChart(malformed))).toBe(true)
  })
})

describe('usage retained-data status', () => {
  it('keeps provenance visible and reports a failed refresh with last-success time', () => {
    const frozenAt = '2026-09-20T12:00:00.000Z'
    const value: LensChecked = { _tag: 'ok', envelope }
    const resolved = { _tag: 'Frozen' as const, value, frozenAt }
    const result = AsyncResult.fail<OmpUsageError, typeof resolved>(
      new OmpUsageError({
        reason: 'transport',
        message: 'connection refused',
        transient: true,
      }),
      { previousSuccess: Option.some(AsyncResult.success(resolved)) },
    )
    const html = renderToStaticMarkup(<UsageEvidenceStatus resolved={resolved} result={result} />)

    expect(html).toContain('Provenance: Frozen')
    expect(html).toContain('Live refresh degraded')
    expect(html).toContain('Transport unavailable: connection refused')
    expect(html).toContain(`dateTime="${frozenAt}"`)
  })
})

describe('project drilldown disclosure', () => {
  it('marks the frozen top five and makes every lower row explicitly live-only', () => {
    const projectEnvelope = Schema.decodeSync(LensEnvelope)({
      ...envelope,
      lens: 'spend_by_project',
      rows: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'].map((key, index) => ({
        key,
        rank: index + 1,
        usd: 12 - index,
        requests: 20 - index,
      })),
    })
    const html = renderToStaticMarkup(
      <SpendByProjectView outcome={{ _tag: 'ok', envelope: projectEnvelope }} />,
    )

    expect(html.match(/>Captured</g)).toHaveLength(5)
    expect(html).toContain('Not captured — opens live')
    expect(html).toContain('aria-controls="usage-project-6"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('derives capture provenance from rank when rows arrive out of order', () => {
    const projectEnvelope = Schema.decodeSync(LensEnvelope)({
      ...envelope,
      lens: 'spend_by_project',
      rows: [
        { key: 'zeta', rank: 6, usd: 7, requests: 14 },
        { key: 'beta', rank: 2, usd: 11, requests: 18 },
        { key: 'alpha', rank: 1, usd: 12, requests: 20 },
        { key: 'eta', rank: 7, usd: 6, requests: 12 },
      ],
    })
    const html = renderToStaticMarkup(
      <SpendByProjectView outcome={{ _tag: 'ok', envelope: projectEnvelope }} />,
    )
    const zeta = html.slice(html.indexOf('>zeta</span>'), html.indexOf('>beta</span>'))
    const beta = html.slice(html.indexOf('>beta</span>'), html.indexOf('>alpha</span>'))
    const eta = html.slice(html.indexOf('>eta</span>'))

    expect(zeta).toContain('Not captured — opens live')
    expect(beta).toContain('>Captured</span>')
    expect(eta).toContain('Not captured — opens live')
    expect(html.match(/>Captured</g)).toHaveLength(2)
  })
})
