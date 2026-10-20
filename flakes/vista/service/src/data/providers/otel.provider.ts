import {
  type AbsoluteMetricRange,
  type MetricQueryArgs,
  type MetricRange,
  MetricSnapshot,
  otel,
  OtelApi,
  OtelError,
  QueryResult,
  Sample,
  Series,
} from '@vista/blocks/internal/provider-contracts'
import { Clock, Config, Context, Effect, Layer, Schema } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'

import { implement, mountProvider } from '../provider.ts'

export { MetricSnapshot, OtelApi, OtelError, QueryResult, Sample, Series }

const PromValue = Schema.Tuple([Schema.Finite, Schema.String])
const PromSeries = Schema.Struct({
  metric: Schema.Record(Schema.String, Schema.String),
  values: Schema.Array(PromValue),
})
/**
 * Schema validating a successful Prometheus/Mimir range-query response whose resultType is
 * 'matrix' and whose result is an array of labeled series.
 */
export const PromMatrix = Schema.Struct({
  status: Schema.Literal('success'),
  data: Schema.Struct({
    resultType: Schema.Literal('matrix'),
    result: Schema.Array(PromSeries),
  }),
})

const toSeries = (raw: typeof PromSeries.Type): Series => {
  const { __name__, ...labels } = raw.metric
  return new Series({
    metric: __name__ ?? '',
    labels,
    samples: raw.values.map(([t, v]) => new Sample({ t, v: Number(v) })),
  })
}

/**
 * Converts a decoded Prometheus matrix response into a QueryResult that keeps the originating
 * PromQL string and maps each PromSeries into a Series.
 */
export const projectMatrix = (promql: string, decoded: typeof PromMatrix.Type): QueryResult =>
  new QueryResult({ query: promql, series: decoded.data.result.map(toSeries) })

const LAST_SECONDS: Record<Extract<MetricRange, { readonly kind: 'relative' }>['last'], number> = {
  '30s': 30,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3_600,
  '6h': 21_600,
  '24h': 86_400,
}

/** Resolve author intent at one explicit instant and enforce the authored point cap. */
export const resolveRange = (
  args: Pick<MetricQueryArgs, 'range' | 'stepSeconds' | 'points'>,
  at: number,
): AbsoluteMetricRange => {
  const requested =
    args.range.kind === 'absolute'
      ? args.range
      : { kind: 'absolute' as const, start: at - LAST_SECONDS[args.range.last], end: at }
  const boundedStart = requested.end - Math.max(args.points - 1, 0) * args.stepSeconds
  return {
    kind: 'absolute',
    start: Math.max(requested.start, boundedStart),
    end: requested.end,
  }
}

/**
 * Request contract for a Mimir range query consisting of the PromQL text, an absolute time range,
 * and the step interval in seconds.
 */
export interface MimirQuery {
  readonly promql: string
  readonly range: AbsoluteMetricRange
  readonly stepSeconds: number
}

/**
 * Contract for a Mimir query client whose single query method returns a QueryResult effect that
 * fails with OtelError.
 */
export interface MimirService {
  readonly query: (request: MimirQuery) => Effect.Effect<QueryResult, OtelError>
}

/** Effect Context tag 'Vista/Mimir' that carries the MimirService contract through the environment. */
export class Mimir extends Context.Service<Mimir, MimirService>()('Vista/Mimir') {}

/** Creates a Layer that publishes the given MimirService instance as the Mimir context. */
export const makeMimirLayer = (service: MimirService): Layer.Layer<Mimir> =>
  Layer.succeed(Mimir, service)

const makeMimirLive = Effect.gen(function* () {
  const base = yield* Config.String('VISTA_MIMIR_URL').pipe(
    Config.withDefault('http://127.0.0.1:42030'),
    Effect.orDie,
  )
  const client = yield* HttpClient.HttpClient
  const query = Effect.fn('vista.provider.otel.mimir.query')(function* (request: MimirQuery) {
    const params = new URLSearchParams({
      query: request.promql,
      start: String(request.range.start),
      end: String(request.range.end),
      step: String(request.stepSeconds),
    })
    const response = yield* client.get(`${base}/prometheus/api/v1/query_range?${params.toString()}`)
    if (response.status < 200 || response.status >= 300) {
      return yield* new OtelError({
        message: `Mimir query_range ${response.status} for ${request.promql}`,
      })
    }
    const decoded = yield* HttpClientResponse.schemaBodyJson(PromMatrix)(response)
    return projectMatrix(request.promql, decoded)
  })
  return {
    query: (request: MimirQuery) =>
      query(request).pipe(
        Effect.catchIf(
          (error) => !(error instanceof OtelError),
          (error) => Effect.fail(new OtelError({ message: `otel query failed: ${String(error)}` })),
        ),
      ),
  } satisfies MimirService
})

/**
 * Layer that builds the live Mimir client, reading its base URL from VISTA_MIMIR_URL (defaulting
 * to http://127.0.0.1:42030) and issuing range queries over the environment's HTTP client.
 */
export const MimirLive = Layer.effect(Mimir, makeMimirLive)

const queryAt = (
  args: MetricQueryArgs,
  at: number,
  queryRange?: AbsoluteMetricRange,
): Effect.Effect<MetricSnapshot, OtelError, Mimir> =>
  Effect.gen(function* () {
    if (args.promql.trim() === '') {
      return yield* new OtelError({ message: 'empty PromQL query' })
    }
    const resolvedRange = resolveRange(args, at)
    const mimir = yield* Mimir
    const result = yield* mimir.query({
      promql: args.promql,
      range: queryRange ?? resolvedRange,
      stepSeconds: args.stepSeconds,
    })
    return yield* Schema.decodeEffect(MetricSnapshot, { onExcessProperty: 'error' })({
      capturedAt: at,
      requestedRange: args.range,
      resolvedRange,
      query: args.promql,
      stepSeconds: args.stepSeconds,
      points: args.points,
      result,
    }).pipe(
      Effect.mapError(
        (cause) => new OtelError({ message: `metric snapshot schema failed: ${String(cause)}` }),
      ),
    )
  })

/**
 * Effectful implementation of the otel capability whose query handler resolves the current
 * wall-clock time and delegates to queryAt to validate the PromQL, resolve the metric range, and
 * query Mimir.
 */
export const otelImplementation = implement(otel, {
  purity: 'effectful',
  handlers: {
    query: (args) =>
      Effect.flatMap(Clock.currentTimeMillis, (millis) => queryAt(args, millis / 1_000)),
  },
})

/**
 * Factory that mounts the otel provider implementation onto the supplied Mimir layer, with the
 * module default wiring MimirLive over FetchHttpClient.
 */
export const makeOtelProvider = (layer: Layer.Layer<Mimir>) =>
  mountProvider(otelImplementation, layer)

export default makeOtelProvider(MimirLive.pipe(Layer.provide(FetchHttpClient.layer)))
