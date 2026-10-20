import { Option, Schema } from 'effect'
import * as AsyncResult from 'effect/reactivity/AsyncResult'
import * as React from 'react'
import { describe, expect, it } from 'vitest'

import { AppRoot, Evidence, extractSemanticManifest } from './authoring.tsx'
import { DiskTreemap, metricFeedFor } from './data-components.tsx'
import { MetricSnapshot, OtelError } from './provider-contracts.ts'

const snapshot = Schema.decodeSync(MetricSnapshot)({
  capturedAt: 1_790_000_000,
  requestedRange: { kind: 'relative', last: '1h' },
  resolvedRange: { kind: 'absolute', start: 1_789_996_400, end: 1_790_000_000 },
  query: 'up',
  stepSeconds: 60,
  points: 61,
  result: { query: 'up', series: [] },
})

describe('metric retained-data feed', () => {
  it('returns retained series and the failed refresh together', async () => {
    const observedAt = '2026-09-22T12:00:00.000Z'
    const resolved = { _tag: 'Live' as const, value: snapshot, observedAt }
    const result = AsyncResult.fail<OtelError, typeof resolved>(
      new OtelError({ message: 'transport blocked' }),
      { previousSuccess: Option.some(AsyncResult.success(resolved)) },
    )

    await expect(metricFeedFor(result).fetch()).resolves.toEqual({
      _tag: 'degraded',
      value: { series: [] },
      message: 'transport blocked',
      lastSuccessAt: observedAt,
    })
  })
})

describe('DiskTreemap host selection', () => {
  it('captures separate declared hosts instead of an ambiguous hostless request', () => {
    const manifest = extractSemanticManifest(
      React.createElement(
        AppRoot,
        { title: 'Fleet disk usage', template: 'telemetry-exploration', scope: 'test' },
        React.createElement(
          Evidence,
          { id: 'fleet-disks' },
          React.createElement(DiskTreemap, {
            host: 'dev3',
            perspective: 'physical',
            boundaryId: 'root',
          }),
          React.createElement(DiskTreemap, {
            host: 'dev4',
            perspective: 'physical',
            boundaryId: 'root',
          }),
        ),
      ),
    )
    const evidence = manifest.nodes.find((node) => node.id === 'fleet-disks')
    expect(evidence?.bindings).toEqual([
      {
        provider: 'disk-index',
        operation: 'treemap',
        args: { host: 'dev3', perspective: 'physical', boundaryId: 'root' },
        policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
      },
      {
        provider: 'disk-index',
        operation: 'treemap',
        args: { host: 'dev4', perspective: 'physical', boundaryId: 'root' },
        policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
      },
    ])
  })
})
