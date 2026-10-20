import { createServer } from 'node:http'

import { makeDataRuntime } from '@vista/blocks/query'
import { Context, Duration, Effect, Exit, Layer, Metric, Schema, Scope, Stream } from 'effect'
import * as KeyValueStore from 'effect/persistence/KeyValueStore'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureInProcessAllSignals, captureInProcessTrace } from '@overeng/utils-dev/otelite'

import { clockStream } from '../../../samples/checks-app/providers/clock.query.ts'
import {
  liveHibernations,
  livePollers,
  providerThrottleWait,
  streamEvents,
  streamSubscriptions,
} from '../../metrics.ts'
import { freePort } from '../../test-support.ts'
import type { SemanticCaptureBinding } from '../app.ts'
import { captureFrozenEffect } from '../freeze.ts'
import { makeProviderBudget, makeSubscriptionHub } from '../live-hub.ts'
import type { ProviderRegistry } from '../mount.ts'
import { materializeProvider } from '../provider.ts'
import otelProvider, { MetricSnapshot } from './otel.provider.ts'
import overview from './overview.provider.ts'

const closeServer = (server: ReturnType<typeof createServer>) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  )

afterEach(() => {
  vi.resetModules()
})

describe('Vista provider telemetry', () => {
  it('exports provider query spans to otelite with stable labels', async () => {
    const previousMimir = process.env.VISTA_MIMIR_URL
    const port = await freePort()
    const server = createServer((request, response) => {
      if (!request.url?.startsWith('/prometheus/api/v1/query_range')) {
        response.writeHead(404).end('not found')
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'up', job: 'otelite-smoke' },
                values: [
                  [1_800_000_000, '1'],
                  [1_800_000_060, '1'],
                ],
              },
            ],
          },
        }),
      )
    })
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
    process.env.VISTA_MIMIR_URL = `http://127.0.0.1:${port}`
    vi.resetModules()

    try {
      const provider = otelProvider

      await Effect.runPromise(
        Effect.gen(function* () {
          const mounted = yield* materializeProvider(provider)
          const trace = yield* captureInProcessTrace(
            {
              serviceName: 'vista-service-test',
              rootSpanName: 'vista.provider.otel-test',
              rootSpanLabel: 'provider.otel-test',
              exportInterval: 50,
            },
            Effect.gen(function* () {
              const result = yield* mounted.call(
                'query',
                {
                  promql: 'up',
                  range: { kind: 'relative', last: '1h' },
                  stepSeconds: 60,
                  points: 2,
                },
                'live',
              )
              const decoded = yield* Schema.decodeUnknownEffect(MetricSnapshot)(result)
              expect(decoded.result.series[0]?.metric).toBe('up')
            }),
            { spanLabelPolicy: 'off' },
          )

          trace.expectSome({
            name: 'vista.provider.otel.query',
            attrs: { 'span.label': 'otel.query', 'provider.id': 'otel', 'rpc.tag': 'query' },
          })
        }).pipe(Effect.scoped),
      )
    } finally {
      if (previousMimir === undefined) {
        delete process.env.VISTA_MIMIR_URL
      } else {
        process.env.VISTA_MIMIR_URL = previousMimir
      }
      await closeServer(server)
    }
  })
})

describe('Vista freeze telemetry', () => {
  it('exports freeze capture spans with stable labels', async () => {
    const block: SemanticCaptureBinding = {
      semanticId: 'overview',
      provider: 'overview',
      operation: 'get',
      args: { repo: 'schickling/dotfiles', pr: 1218 },
      policy: { mode: 'frozen' },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const mounted = yield* materializeProvider(overview)
        const registry = {
          providers: new Map([['overview', mounted]]),
        } as unknown as ProviderRegistry
        const trace = yield* captureInProcessTrace(
          {
            serviceName: 'vista-service-test',
            rootSpanName: 'vista.freeze-test',
            rootSpanLabel: 'freeze-test',
            exportInterval: 50,
          },
          Effect.gen(function* () {
            const report = yield* captureFrozenEffect(registry, [block])
            expect(report.results.map((result) => result._tag)).toEqual(['captured'])
          }),
          { spanLabelPolicy: 'off' },
        )

        trace.expectSome({
          name: 'vista.freeze.capture',
          attrs: { 'span.label': 'freeze.capture', 'vista.freeze.blocks': 1 },
        })
      }).pipe(Effect.scoped),
    )
  })
})

describe('Vista data runtime telemetry', () => {
  it('exports exact hydration and refresh outcomes with their execution spans', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const signals = yield* captureInProcessAllSignals(
          {
            serviceName: 'vista-service-data-runtime-test',
            rootSpanName: 'vista.data-runtime-test',
            rootSpanLabel: 'data-runtime-test',
            exportInterval: 50,
          },
          Effect.gen(function* () {
            const telemetryContext = yield* Effect.context<never>()
            const runtime = makeDataRuntime({
              appVersionId: 'otel/data-runtime/success',
              snapshot: {
                apiVersion: 2,
                frozenAt: '2026-09-20T12:00:00.000Z',
                entries: {},
              },
              dataBaseUrl: 'http://vista.test/_data/',
              telemetryContext,
            })
            runtime.refresh('otel-test', 'read', () => undefined)
            // The refresh caller still observes the original failure; telemetry records it.
            yield* Effect.try(() =>
              runtime.refresh('otel-test', 'read', () => {
                throw new Error('refresh failed')
              }),
            ).pipe(Effect.ignore)
            runtime.dispose()

            // The malformed snapshot remains fail-closed after telemetry records it.
            yield* Effect.try(() =>
              makeDataRuntime({
                appVersionId: 'otel/data-runtime/error',
                snapshot: { apiVersion: 2, entries: {} },
                dataBaseUrl: 'http://vista.test/_data/',
                telemetryContext,
              }),
            ).pipe(Effect.ignore)
          }),
          { trace: { spanLabelPolicy: 'off' } },
        )

        signals.metrics.expectOne({
          name: 'vista_data_hydrations',
          value: 1,
          attrs: {
            'app.version.id': 'otel/data-runtime/success',
            outcome: 'success',
          },
        })
        signals.metrics.expectOne({
          name: 'vista_data_hydrations',
          value: 1,
          attrs: {
            'app.version.id': 'otel/data-runtime/error',
            outcome: 'error',
          },
        })
        signals.metrics.expectOne({
          name: 'vista_data_refreshes',
          value: 1,
          attrs: {
            'app.version.id': 'otel/data-runtime/success',
            'provider.id': 'otel-test',
            'rpc.tag': 'read',
            trigger: 'explicit',
            outcome: 'success',
          },
        })
        signals.metrics.expectOne({
          name: 'vista_data_refreshes',
          value: 1,
          attrs: {
            'app.version.id': 'otel/data-runtime/success',
            'provider.id': 'otel-test',
            'rpc.tag': 'read',
            trigger: 'explicit',
            outcome: 'error',
          },
        })
        signals.trace.expectSome({
          name: 'vista.data.hydrate',
          attrs: { 'span.label': 'data.hydrate' },
        })
        signals.trace.expectSome({
          name: 'vista.data.refresh',
          attrs: { 'span.label': 'data.refresh' },
        })
      }).pipe(Effect.scoped),
    )
  })
})

describe('Vista live runtime telemetry', () => {
  it('conforms subscription lifetime, event, hibernation, and throttle telemetry', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const storeContext = yield* Layer.build(KeyValueStore.layerMemory)
        const store = Context.get(storeContext, KeyValueStore.KeyValueStore)
        const budget = yield* makeProviderBudget({
          external: { limit: 1, window: '10 millis' },
        })
        const versionScope = yield* Scope.make()
        const hub = yield* makeSubscriptionHub({
          appVersionId: 'otel/live/1',
          store,
          budget,
          idleTimeToLive: '10 millis',
        }).pipe(Effect.provideService(Scope.Scope, versionScope))

        const trace = yield* captureInProcessTrace(
          {
            serviceName: 'vista-service-test',
            rootSpanName: 'vista.live-test',
            rootSpanLabel: 'live-test',
            exportInterval: 50,
          },
          Effect.gen(function* () {
            yield* budget.run('clock', Effect.void)
            yield* budget.run('clock', Effect.void)
            const constrainedInterval = yield* budget.pollInterval('clock', 4, {
              min: '10 millis',
              max: '100 millis',
            })
            expect(Duration.toMillis(constrainedInterval)).toBe(100)
            yield* hub
              .subscribe(
                clockStream,
                { lane: 'otel' },
                {
                  _tag: 'subscribable',
                  initial: () => Effect.succeed({ cursor: 'tick-0', ticks: 0 }),
                  stream: () =>
                    Stream.succeed({
                      _tag: 'Tick' as const,
                      cursor: 'tick-1',
                      ticks: 1,
                    }).pipe(Stream.concat(Stream.never)),
                },
              )
              .pipe(Stream.take(1), Stream.runDrain)
            yield* Effect.sleep('30 millis')

            const subscriptions = yield* Metric.value(
              Metric.withAttributes(streamSubscriptions, {
                provider: 'clock',
                rpc: 'clockStream',
              }),
            )
            const pollers = yield* Metric.value(
              Metric.withAttributes(livePollers, { provider: 'clock' }),
            )
            const events = yield* Metric.value(
              Metric.withAttributes(streamEvents, {
                provider: 'clock',
                rpc: 'clockStream',
              }),
            )
            const hibernations = yield* Metric.value(
              Metric.withAttributes(liveHibernations, { outcome: 'persisted' }),
            )
            const throttle = yield* Metric.value(
              Metric.withAttributes(providerThrottleWait, {
                provider: 'clock',
                resource: 'live',
              }),
            )
            expect(subscriptions.value).toBe(0)
            expect(pollers.value).toBe(0)
            expect(Number(events.count)).toBeGreaterThanOrEqual(1)
            expect(Number(hibernations.count)).toBeGreaterThanOrEqual(1)
            expect(throttle.count).toBeGreaterThanOrEqual(1)
          }),
          { spanLabelPolicy: 'off' },
        )

        trace.expectSome({
          name: 'vista.live.clock.clockStream',
          attrs: {
            'span.label': 'clock.clockStream',
            'app.version.id': 'otel/live/1',
          },
        })
        trace.expectSome({
          name: 'vista.live.wake',
          attrs: { 'span.label': 'live.wake', 'app.version.id': 'otel/live/1' },
        })
        trace.expectSome({
          name: 'vista.live.hibernate',
          attrs: { 'span.label': 'live.hibernate', 'app.version.id': 'otel/live/1' },
        })
        yield* Scope.close(versionScope, Exit.void)
      }).pipe(Effect.scoped),
    )
  })
})
