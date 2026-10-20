import {
  makeMimirLayer,
  makeOtelProvider,
  QueryResult,
  Sample,
  Series,
} from '@vista/data/providers/otel.provider'
import { Effect } from 'effect'

/**
 * Well-known symbol on globalThis used as a counter key so tests can count metric queries issued
 * against the review OpenTelemetry provider.
 */
export const reviewMetricCalls = Symbol.for('vista.samples.review.metricCalls')

const layer = makeMimirLayer({
  query: (request) =>
    Effect.sync(() => {
      const previous = Reflect.get(globalThis, reviewMetricCalls)
      const revision = typeof previous === 'number' ? previous + 1 : 1
      Reflect.set(globalThis, reviewMetricCalls, revision)
      return new QueryResult({
        query: request.promql,
        series: [
          new Series({
            metric: 'http_requests_total',
            labels: { service_name: 'vista-review' },
            samples: [
              new Sample({ t: request.range.start, v: revision }),
              new Sample({ t: request.range.end, v: revision + 1 }),
            ],
          }),
        ],
      })
    }),
})

export default makeOtelProvider(layer)
