/**
 * LIVE `trace` provider (decisions 0026, 0027): the trace half of "wire live
 * data sources" (0026). Two rpcs against a Tempo backend:
 *
 *  - `getTrace({ traceId })` → an OTLP-faithful {@link TraceResult}. Tempo's
 *    `/api/traces/{id}` returns OTLP-JSON (`batches`/`resourceSpans` →
 *    `scopeSpans` → `spans`); we decode it via `Schema` and FLATTEN it to a flat
 *    span list, carrying each resource's `service.name` onto its spans.
 *  - `searchTraces({ query, limit })` → {@link TraceSummary} rows from Tempo's
 *    `/api/search` (TraceQL).
 *
 * Partial/rootless traces are returned FAITHFULLY — a missing root is the
 * renderer's concern, so we never throw on it; a span with no `parentSpanId`
 * simply carries an empty `parentSpanId` (the renderer treats empty parents as
 * roots). The id fields are base64 in the trace BODY (OTLP-JSON encodes
 * span/trace ids as base64) but hex in the `/api/search` rows and the
 * fetch-by-id path param; we keep each surface's encoding verbatim rather than
 * normalising, so base64 parent↔span linking stays internally consistent.
 *
 * EFFECTFUL (decision 0031): running `core` reads live from Tempo over the
 * network, so the freeze auto-capture pass refuses a `trace` block unless the
 * block explicitly acknowledges effectful capture.
 */
import {
  trace,
  Attr,
  SearchResult,
  Span,
  SpanEvent,
  TraceApi,
  TraceError,
  TraceResult,
  TraceSummary,
} from '@vista/blocks/internal/provider-contracts'
import { Config, Effect, Schema } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'

import { implement, mountProvider } from '../provider.ts'
export { Attr, SearchResult, Span, SpanEvent, TraceApi, TraceError, TraceResult, TraceSummary }

/**
 * Tempo base; overridable for non-dev3 hosts/tests via the `VISTA_TEMPO_URL` env
 * var, resolved through Effect `Config` (mirrors the otel provider / the
 * `otelEndpointFromConfig` idiom in `@overeng/utils/node/otel`). A LAZY config
 * descriptor, only read when `yield*`-ed inside the effectful fetch path (SSR),
 * never at module eval — app code imports this module for its schemas and a
 * browser has no `process.env` (decision 0046 browser-import safety). A malformed
 * value at the edge is a defect (`Effect.orDie`), keeping the request effect's
 * error channel `TraceError`-only.
 */
const tempoBase = Effect.orDie(
  Config.String('VISTA_TEMPO_URL').pipe(Config.withDefault('http://127.0.0.1:42032')),
)

// --- Raw OTLP-JSON wire shapes (decoded by Schema, then flattened) ---------

/** Partial OTLP `AnyValue`: the scalar variants Tempo emits for attributes. */
const AnyValue = Schema.Struct({
  stringValue: Schema.optional(Schema.String),
  intValue: Schema.optional(Schema.Union([Schema.String, Schema.Finite])),
  doubleValue: Schema.optional(Schema.Finite),
  boolValue: Schema.optional(Schema.Boolean),
})
const KeyValue = Schema.Struct({
  key: Schema.String,
  value: Schema.optional(AnyValue),
})
const RawSpan = Schema.Struct({
  spanId: Schema.optional(Schema.String),
  parentSpanId: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.String),
  startTimeUnixNano: Schema.optional(Schema.String),
  endTimeUnixNano: Schema.optional(Schema.String),
  status: Schema.optional(
    Schema.Struct({
      code: Schema.optional(Schema.String),
      message: Schema.optional(Schema.String),
    }),
  ),
  attributes: Schema.optional(Schema.Array(KeyValue)),
  events: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.optional(Schema.String),
        timeUnixNano: Schema.optional(Schema.String),
        attributes: Schema.optional(Schema.Array(KeyValue)),
      }),
    ),
  ),
})
const ScopeSpans = Schema.Struct({
  spans: Schema.optional(Schema.Array(RawSpan)),
})
const ResourceSpans = Schema.Struct({
  resource: Schema.optional(Schema.Struct({ attributes: Schema.optional(Schema.Array(KeyValue)) })),
  scopeSpans: Schema.optional(Schema.Array(ScopeSpans)),
})
/** Tempo's trace body uses `batches`; OTLP collectors use `resourceSpans`. */
export const RawTrace = Schema.Struct({
  batches: Schema.optional(Schema.Array(ResourceSpans)),
  resourceSpans: Schema.optional(Schema.Array(ResourceSpans)),
})

/**
 * Schema validating the raw trace-search response, tolerating an entirely absent traces array and
 * optional per-trace fields such as root service/name, start time, and duration.
 */
export const RawSearch = Schema.Struct({
  traces: Schema.optional(
    Schema.Array(
      Schema.Struct({
        traceID: Schema.String,
        rootServiceName: Schema.optional(Schema.String),
        rootTraceName: Schema.optional(Schema.String),
        startTimeUnixNano: Schema.optional(Schema.String),
        durationMs: Schema.optional(Schema.Finite),
      }),
    ),
  ),
})

const anyValueToString = (v: typeof AnyValue.Type | undefined): string => {
  if (v === undefined) return ''
  if (v.stringValue !== undefined) return v.stringValue
  if (v.intValue !== undefined) return String(v.intValue)
  if (v.doubleValue !== undefined) return String(v.doubleValue)
  if (v.boolValue !== undefined) return String(v.boolValue)
  return ''
}

const toAttrs = (kvs: ReadonlyArray<typeof KeyValue.Type> | undefined): Attr[] =>
  (kvs ?? []).map((kv) => new Attr({ key: kv.key, value: anyValueToString(kv.value) }))

/** Flatten an OTLP-JSON trace into a flat span list, carrying `service.name`. */
export const flattenTrace = (traceId: string, raw: typeof RawTrace.Type): TraceResult => {
  const resourceSpans = raw.batches ?? raw.resourceSpans ?? []
  const spans: Span[] = []
  for (const rs of resourceSpans) {
    const resourceAttrs = rs.resource?.attributes ?? []
    const serviceName = anyValueToString(resourceAttrs.find((a) => a.key === 'service.name')?.value)
    for (const ss of rs.scopeSpans ?? []) {
      for (const s of ss.spans ?? []) {
        spans.push(
          new Span({
            spanId: s.spanId ?? '',
            parentSpanId: s.parentSpanId ?? '',
            name: s.name ?? '',
            serviceName,
            kind: s.kind ?? '',
            startTimeUnixNano: s.startTimeUnixNano ?? '',
            endTimeUnixNano: s.endTimeUnixNano ?? '',
            statusCode: s.status?.code ?? '',
            statusMessage: s.status?.message ?? '',
            attributes: toAttrs(s.attributes),
            events: (s.events ?? []).map(
              (e) =>
                new SpanEvent({
                  name: e.name ?? '',
                  timeUnixNano: e.timeUnixNano ?? '',
                  attributes: toAttrs(e.attributes),
                }),
            ),
          }),
        )
      }
    }
  }
  return new TraceResult({ traceId, spans })
}

/** Project a decoded Tempo search response into the provider's success shape. */
export const projectSearch = (query: string, raw: typeof RawSearch.Type): SearchResult =>
  new SearchResult({
    query,
    traces: (raw.traces ?? []).map(
      (t) =>
        new TraceSummary({
          traceId: t.traceID,
          rootServiceName: t.rootServiceName ?? '',
          rootTraceName: t.rootTraceName ?? '',
          startTimeUnixNano: t.startTimeUnixNano ?? '',
          durationMs: t.durationMs ?? 0,
        }),
    ),
  })

const fetchJson = <A, I>(
  url: string,
  schema: Schema.Codec<A, I>,
  what: string,
): Effect.Effect<A, TraceError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const res = yield* client.get(url)
    if (res.status < 200 || res.status >= 300) {
      return yield* new TraceError({ message: `Tempo ${what} ${res.status}` })
    }
    return yield* HttpClientResponse.schemaBodyJson(schema)(res)
  }).pipe(
    Effect.catchIf(
      (e) => !(e instanceof TraceError),
      (e) => Effect.fail(new TraceError({ message: `${what} failed: ${String(e)}` })),
    ),
  )

const getTrace = (
  traceId: string,
): Effect.Effect<TraceResult, TraceError, HttpClient.HttpClient> =>
  traceId.trim() === ''
    ? Effect.fail(new TraceError({ message: 'empty traceId' }))
    : Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan('traceId', traceId)
        const base = yield* tempoBase
        const raw = yield* fetchJson(
          `${base}/api/traces/${encodeURIComponent(traceId)}`,
          RawTrace,
          'getTrace',
        )
        return flattenTrace(traceId, raw)
      })

const searchTraces = (
  query: string,
  limit: number,
): Effect.Effect<SearchResult, TraceError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ query, limit })
    // TraceQL requires a non-empty selector; `{}` matches all traces.
    const q = query.trim() === '' ? '{}' : query
    const params = new URLSearchParams({ q, limit: String(limit) })
    const base = yield* tempoBase
    const raw = yield* fetchJson(
      `${base}/api/search?${params.toString()}`,
      RawSearch,
      'searchTraces',
    )
    return projectSearch(query, raw)
  })

/**
 * Searches up to twenty traces matching the query, selects the one with the greatest
 * startTimeUnixNano (missing values treated as zero), and fetches its full trace, failing with a
 * TraceError when nothing matched.
 */
export const latestTrace = (
  query: string,
): Effect.Effect<TraceResult, TraceError, HttpClient.HttpClient> =>
  Effect.flatMap(searchTraces(query, 20), (result) => {
    const newest = result.traces.toSorted((left, right) => {
      const leftStart = BigInt(left.startTimeUnixNano || '0')
      const rightStart = BigInt(right.startTimeUnixNano || '0')
      return leftStart < rightStart ? 1 : leftStart > rightStart ? -1 : 0
    })[0]
    return newest === undefined
      ? Effect.fail(new TraceError({ message: `no traces matched '${query}'` }))
      : getTrace(newest.traceId)
  })

/**
 * Effectful implementation of the trace provider that wires the getTrace, searchTraces, and
 * latestTrace handlers directly to their module-level functions.
 */
export const traceImplementation = implement(trace, {
  purity: 'effectful',
  handlers: {
    getTrace: ({ traceId }) => getTrace(traceId),
    searchTraces: ({ query, limit }) => searchTraces(query, limit),
    latestTrace: ({ query }) => latestTrace(query),
  },
})

export default mountProvider(traceImplementation, FetchHttpClient.layer)
