/**
 * The live telemetry providers (decision 0026): `otel`/metrics against Mimir and
 * `trace` against Tempo. Two layers of coverage:
 *
 *  - UNIT: decode a CAPTURED fixture through each provider's exported Schema +
 *    projection (matrix → `QueryResult`, OTLP-JSON → flat `TraceResult`, Tempo
 *    search → `SearchResult`). These run in CI with no backend — they assert the
 *    decode/flatten/`service.name`-carry/rootless handling deterministically.
 *  - LIVE: run each provider's real `core` against the dev3 loopback backends and
 *    assert a non-empty, schema-valid decode. Gated on reachability plus known
 *    fixture-data probes, mirroring the `PLAYWRIGHT_BROWSERS_PATH` const-gate in
 *    `heavy-blocks.browser.test.ts` — auto-runs on dev3 when data exists,
 *    auto-skips in CI or during telemetry gaps.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { bind, Operation } from '@vista/blocks/internal/data-contract'
import { trace } from '@vista/blocks/internal/provider-contracts'
import { flamebearerToNestedSet } from '@vista/flamebearer'
import { Effect, Layer, Schema } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { describe, expect, it } from 'vitest'

import otelProvider, {
  MetricSnapshot,
  MimirLive,
  PromMatrix,
  projectMatrix,
  QueryResult,
  Sample,
} from './otel.provider.ts'
import pyroscopeProvider, {
  ProfileResult,
  projectFlamegraph,
  RawFlamegraph,
} from './pyroscope.provider.ts'
import traceProvider, {
  flattenTrace,
  projectSearch,
  RawSearch,
  RawTrace,
  SearchResult,
  TraceResult,
} from './trace.provider.ts'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__')
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'))

const MIMIR = process.env.VISTA_MIMIR_URL ?? 'http://127.0.0.1:42030'
const TEMPO = process.env.VISTA_TEMPO_URL ?? 'http://127.0.0.1:42032'
const PYROSCOPE = process.env.VISTA_PYROSCOPE_URL ?? 'http://127.0.0.1:42035'
const CPU_PROFILE = 'process_cpu:cpu:nanoseconds:cpu:nanoseconds'

const reachable = async (url: string): Promise<boolean> => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}

const mimirHasSeries = async (promql: string): Promise<boolean> => {
  try {
    const url = new URL(`${MIMIR}/prometheus/api/v1/query`)
    url.searchParams.set('query', promql)
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) return false
    const body = (await r.json()) as {
      data?: { result?: unknown[] }
    }
    return Array.isArray(body.data?.result) && body.data.result.length > 0
  } catch {
    return false
  }
}

const pyroscopeQueryReady = async (): Promise<boolean> => {
  const until = Date.now()
  try {
    const r = await fetch(`${PYROSCOPE}/querier.v1.QuerierService/SelectMergeStacktraces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        profile_typeID: CPU_PROFILE,
        label_selector: '{service_name="runner-scaler"}',
        start: until - 60 * 60 * 1000,
        end: until,
      }),
      signal: AbortSignal.timeout(3000),
    })
    return r.ok
  } catch {
    return false
  }
}

const MIMIR_UP = await reachable(`${MIMIR}/prometheus/api/v1/query?query=1`)
const MIMIR_HAS_ALLOY_BUILD_INFO = MIMIR_UP && (await mimirHasSeries('alloy_build_info'))
const TEMPO_UP = await reachable(`${TEMPO}/api/search?limit=1`)
const PYROSCOPE_UP = await pyroscopeQueryReady()

const queryCore = (payload: Parameters<typeof otelProvider.core.query>[0]) =>
  otelProvider.core
    .query(payload)
    .pipe(Effect.provide(MimirLive.pipe(Layer.provide(FetchHttpClient.layer))))
const getTraceCore = (payload: Parameters<typeof traceProvider.core.getTrace>[0]) =>
  traceProvider.core.getTrace(payload).pipe(Effect.provide(FetchHttpClient.layer))
const searchCore = (payload: Parameters<typeof traceProvider.core.searchTraces>[0]) =>
  traceProvider.core.searchTraces(payload).pipe(Effect.provide(FetchHttpClient.layer))
const getProfileCore = (payload: Parameters<typeof pyroscopeProvider.core.getProfile>[0]) =>
  pyroscopeProvider.core.getProfile(payload).pipe(Effect.provide(FetchHttpClient.layer))

describe('otel/metrics provider — fixture decode (no backend)', () => {
  it('decodes a multi-series Prometheus matrix into QueryResult', () => {
    const decoded = Schema.decodeUnknownSync(PromMatrix)(fixture('prom-matrix'))
    const qr = projectMatrix('alloy_build_info', decoded)
    // round-trip through the success Schema → proves it is schema-valid
    Schema.decodeSync(QueryResult)(Schema.encodeSync(QueryResult)(qr))

    expect(qr.series).toHaveLength(2)
    expect(qr.series[0]!.metric).toBe('alloy_build_info')
    // `__name__` is lifted to `metric` and removed from the carried labels
    expect(qr.series[0]!.labels.__name__).toBeUndefined()
    expect(qr.series[0]!.labels.job).toBe('infra/observability-gateway')
    expect(qr.series[0]!.samples).toHaveLength(3)
    expect(qr.series[0]!.samples[0]).toMatchObject({ t: 1782564344, v: 1 })
  })

  it('strictly rejects non-finite Prometheus sample values', () => {
    expect(() => Schema.decodeSync(Sample)({ t: 1, v: Number.NaN })).toThrow()
    expect(() => Schema.decodeSync(Sample)({ t: 1, v: Number.POSITIVE_INFINITY })).toThrow()
  })

  it('empty PromQL fails on the typed OtelError channel', async () => {
    const err = await Effect.runPromise(
      Effect.flip(
        queryCore({
          promql: '  ',
          range: { kind: 'relative', last: '5m' },
          stepSeconds: 60,
          points: 5,
        }),
      ),
    )
    expect(err._tag).toBe('OtelError')
  })
})

describe('pyroscope/profiles provider — fixture decode + flamebearer reconstruction (no backend)', () => {
  it('decodes a Pyroscope flamebearer (int64-strings coerced) into ProfileResult', () => {
    const decoded = Schema.decodeUnknownSync(RawFlamegraph)(fixture('pyro-flamebearer'))
    const pr = projectFlamegraph(CPU_PROFILE, '{}', decoded)
    // round-trip through the success Schema → proves it is schema-valid
    Schema.decodeSync(ProfileResult)(Schema.encodeSync(ProfileResult)(pr))

    expect(pr.names.length).toBeGreaterThan(0)
    expect(pr.names[0]).toBe('total')
    expect(pr.levels.length).toBeGreaterThan(0)
    // int64-string `total` coerced to a finite number
    expect(Number.isFinite(pr.total)).toBe(true)
    expect(pr.total).toBeGreaterThan(0)
    // the root level is a single node spanning the whole profile (total samples)
    expect(pr.levels[0]).toEqual([0, pr.total, 0, 0])
  })

  it('reconstructs a well-formed DFS pre-order nested-set tree from the fixture', () => {
    const decoded = Schema.decodeUnknownSync(RawFlamegraph)(fixture('pyro-flamebearer'))
    const pr = projectFlamegraph(CPU_PROFILE, '{}', decoded)
    const rows = flamebearerToNestedSet({
      names: pr.names,
      levels: pr.levels,
      total: pr.total,
      maxSelf: pr.maxSelf,
    })

    // The root row is the whole profile.
    expect(rows.length).toBeGreaterThan(1)
    expect(rows[0]!.level).toBe(0)
    expect(rows[0]!.label).toBe('total')
    expect(rows[0]!.value).toBe(pr.total)

    // No-drop guarantee: every flamebearer node (4 values per node, all levels)
    // becomes exactly one nested-set row. This is the unambiguous completeness check
    // — a parent-misassignment that orphans a subtree would yield FEWER rows that
    // still satisfy the structural invariants below (and the rendered flamegraph
    // collapses single-child equal-value chains, so a visual cannot catch a drop).
    const nodeCount = pr.levels.reduce((n, level) => n + level.length / 4, 0)
    expect(rows.length).toBe(nodeCount)

    // Nested-set invariant (what `@grafana/flamegraph`'s `nestedSetToLevels` relies
    // on): rows are DFS pre-order, so each row's parent is the most recent prior row
    // one level shallower (a running stack). Reconstruct the parent for every row and
    // assert (a) the stack is never empty for a non-root, (b) child.level ==
    // parent.level + 1, and accumulate children-sums per parent for the value check.
    const stack: { level: number; value: number; childSum: number }[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      while (stack.length > 0 && stack[stack.length - 1]!.level >= row.level) {
        const popped = stack.pop()!
        // a node's children never sum to more than the node itself
        expect(popped.childSum).toBeLessThanOrEqual(popped.value)
      }
      if (i === 0) {
        expect(row.level).toBe(0)
      } else {
        const parent = stack[stack.length - 1]!
        expect(row.level).toBe(parent.level + 1)
        parent.childSum += row.value
      }
      expect(row.self).toBeLessThanOrEqual(row.value)
      stack.push({ level: row.level, value: row.value, childSum: 0 })
    }
    while (stack.length > 0) {
      const popped = stack.pop()!
      expect(popped.childSum).toBeLessThanOrEqual(popped.value)
    }
  })

  it('empty profileTypeId fails on the typed PyroscopeError channel', async () => {
    const err = await Effect.runPromise(
      Effect.flip(getProfileCore({ profileTypeId: '  ', labelSelector: '{}', from: 0, until: 1 })),
    )
    expect(err._tag).toBe('PyroscopeError')
  })
})

describe('trace provider — fixture decode (no backend)', () => {
  it('flattens OTLP-JSON to a flat span list, carrying service.name + roots', () => {
    const decoded = Schema.decodeUnknownSync(RawTrace)(fixture('tempo-trace'))
    const tr = flattenTrace('a7ccc272f7d9452ee360040c5ec24f0f', decoded)
    Schema.decodeSync(TraceResult)(Schema.encodeSync(TraceResult)(tr))

    expect(tr.spans).toHaveLength(2)
    const root = tr.spans.find((s) => s.parentSpanId === '')!
    const child = tr.spans.find((s) => s.parentSpanId !== '')!
    // rootless handling: a missing parentSpanId is carried as '' (not thrown)
    expect(root.name).toBe('genie/command')
    expect(child.parentSpanId).toBe(root.spanId)
    // service.name carried from the resource onto every span
    expect(root.serviceName).toBe('genie')
    expect(child.serviceName).toBe('genie')
    expect(root.statusCode).toBe('STATUS_CODE_OK')
    // AnyValue variants flatten to their scalar string form
    expect(root.attributes.find((a) => a.key === 'genie.files')?.value).toBe('12')
    expect(child.attributes.find((a) => a.key === 'genie.valid')?.value).toBe('true')
    expect(root.events).toHaveLength(1)
    expect(root.events[0]!.name).toBe('discovery.start')
  })

  it('projects Tempo search rows into summaries (optional fields default)', () => {
    const decoded = Schema.decodeUnknownSync(RawSearch)(fixture('tempo-search'))
    const sr = projectSearch('{}', decoded)
    Schema.decodeSync(SearchResult)(Schema.encodeSync(SearchResult)(sr))

    expect(sr.traces).toHaveLength(2)
    expect(sr.traces[0]!.traceId).toBe('a7ccc272f7d9452ee360040c5ec24f0f')
    expect(sr.traces[0]!.durationMs).toBe(109)
    // second row has no durationMs → defaulted to 0, not undefined
    expect(sr.traces[1]!.durationMs).toBe(0)
    expect(sr.traces[1]!.rootServiceName).toBe('evergreen')
  })

  it('declares the trace search → getTrace dependency with Operation.flatMap', () => {
    const latest = Operation.flatMap(
      trace.ops.searchTraces,
      (result) => {
        const newest = result.traces.toSorted((left, right) =>
          BigInt(left.startTimeUnixNano) < BigInt(right.startTimeUnixNano) ? 1 : -1,
        )[0]!
        return bind(trace.ops.getTrace, { traceId: newest.traceId })
      },
      { id: 'trace.latest/v1', successSchema: TraceResult },
    )
    const search = projectSearch('{}', Schema.decodeUnknownSync(RawSearch)(fixture('tempo-search')))
    expect(latest.select(search).args).toEqual({
      traceId: 'a7ccc272f7d9452ee360040c5ec24f0f',
    })
  })
})

describe('otel/metrics provider — LIVE Mimir (dev3 loopback)', () => {
  it.skipIf(!MIMIR_HAS_ALLOY_BUILD_INFO)(
    'runs core.query against real Mimir → non-empty schema-valid series',
    async () => {
      const snapshot = await Effect.runPromise(
        queryCore({
          promql: 'alloy_build_info',
          range: { kind: 'relative', last: '5m' },
          stepSeconds: 60,
          points: 5,
        }),
      )
      Schema.decodeSync(MetricSnapshot)(Schema.encodeSync(MetricSnapshot)(snapshot))
      expect(snapshot.result.series.length).toBeGreaterThan(0)
      expect(snapshot.result.series[0]!.samples.length).toBeGreaterThan(0)
      console.log(
        `[live mimir] series=${snapshot.result.series.length} metric=${snapshot.result.series[0]!.metric} samples=${snapshot.result.series[0]!.samples.length}`,
      )
    },
  )
})

describe('trace provider — LIVE Tempo (dev3 loopback)', () => {
  it.skipIf(!TEMPO_UP)(
    'searches then fetches a real trace → non-empty schema-valid spans',
    async () => {
      const search = await Effect.runPromise(searchCore({ query: '{}', limit: 5 }))
      expect(search.traces.length).toBeGreaterThan(0)
      const traceId = search.traces[0]!.traceId
      const tr = await Effect.runPromise(getTraceCore({ traceId }))
      Schema.decodeSync(TraceResult)(Schema.encodeSync(TraceResult)(tr))
      expect(tr.spans.length).toBeGreaterThan(0)
      console.log(
        `[live tempo] searched=${search.traces.length} traceId=${traceId} spans=${tr.spans.length} svc=${tr.spans[0]!.serviceName}`,
      )
    },
  )
})

describe('pyroscope/profiles provider — LIVE Pyroscope (dev3 loopback)', () => {
  it.skipIf(!PYROSCOPE_UP)(
    'runs core.getProfile against real Pyroscope → non-empty schema-valid flamebearer',
    async () => {
      const until = Date.now()
      const from = until - 60 * 60 * 1000 // last hour
      const pr = await Effect.runPromise(
        getProfileCore({ profileTypeId: CPU_PROFILE, labelSelector: '{}', from, until }),
      )
      Schema.decodeSync(ProfileResult)(Schema.encodeSync(ProfileResult)(pr))
      expect(pr.names.length).toBeGreaterThan(0)
      expect(pr.levels.length).toBeGreaterThan(0)
      expect(pr.total).toBeGreaterThan(0)
      const rows = flamebearerToNestedSet({
        names: pr.names,
        levels: pr.levels,
        total: pr.total,
        maxSelf: pr.maxSelf,
      })
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]!.label).toBe('total')
      console.log(
        `[live pyroscope] type=${pr.profileTypeId} names=${pr.names.length} levels=${pr.levels.length} total=${pr.total} treeRows=${rows.length}`,
      )
    },
  )
})
