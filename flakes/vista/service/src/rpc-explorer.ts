import { AsyncLocalStorage } from 'node:async_hooks'

import {
  DiskIndexApi,
  GhApi,
  OmpUsageApi,
  OtelApi,
  OverviewApi,
  PtyApi,
  PyroscopeApi,
  TraceApi,
} from '@vista/blocks/internal/provider-contracts'
import { Duration, Effect, Layer, Metric, Schema } from 'effect'
import { RpcMiddleware, RpcSchema, RpcServer } from 'effect/rpc'
import type { RpcGroup } from 'effect/rpc'

import {
  defaultNormalizationBounds,
  makeExplorer,
  makeRpcDescriptors,
  type CapturePolicies,
  type ExplorerEncodedDecodersByTag,
  type ExplorerConfig,
  type ExplorerServices,
} from '@overeng/effect-rpc-explorer'
import {
  decorateServerProtocol as observeServerProtocol,
  makeProtocolObserver,
  makeServerObserverMiddleware,
} from '@overeng/effect-rpc-observer'

import { decodeRouteOwner, VistaControlApi } from './control.ts'

/** Same-origin route for snapshot and watch diagnostics RPCs. */
export const INSPECTOR_RPC_PATH = '/_rpc-inspector'

const activeCapacity = 256

/** Middleware tag shared by control and provider groups. */
export const VistaExplorerMiddleware =
  RpcMiddleware.Service<'VistaExplorerMiddleware'>()('VistaExplorerMiddleware')

/**
 * Explorer live descriptors erase schema services. Vista's concrete control,
 * built-in provider and authored sample success/error schemas are service-free:
 * strict wire transforms only delegate to those schemas; defaults use Effect.succeed.
 * Upstream ask: effect-utils-manager message e9931209e7b7dfdc:
 * typed LiveRpcDescriptor / sync-decoder helper.
 * Remove this cast when effect-utils exports a typed descriptor or a sync-decoder helper.
 */
export const syncCaptureDecoder = (schema: Schema.Top) =>
  Schema.decodeUnknownOption(schema as Schema.Codec<unknown, unknown, never, never>)

/** Binds protocol and decoded-handler observation to the same scoped observer. */
export const explorerServerLayer = ({
  explorer,
  path,
  group: mountedGroup,
}: {
  readonly explorer: ExplorerServices
  readonly path: `/${string}`
  readonly group: RpcGroup.Any
}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const protocol = yield* RpcServer.makeProtocolHttp({ path })
      const encodedDecoders: ExplorerEncodedDecodersByTag = new Map(
        makeRpcDescriptors(mountedGroup).flatMap(({ tag, live }) => {
          const schema = live?.successSchema
          if (schema === undefined || !RpcSchema.isStreamSchema(schema)) return []
          return [
            [
              tag,
              {
                streamElement: syncCaptureDecoder(protocol.codecFor(schema.success)),
                streamError: syncCaptureDecoder(protocol.codecFor(schema.error)),
              },
            ],
          ]
        }),
      )
      const observer = yield* makeProtocolObserver({
        side: 'server',
        capacity: activeCapacity,
        connectionId: (clientId) => connectionIdForRoute(routeContext.getStore(), clientId),
        sinks: [
          {
            capture: true,
            sink: explorer.makeCaptureSink({
              side: 'server',
              encodedDecodersByTag: encodedDecoders,
            }),
          },
        ],
      })
      return Layer.merge(
        Layer.succeed(
          RpcServer.Protocol,
          observeServerProtocol({ protocol, observer, requestObservation: 'middleware' }),
        ),
        Layer.succeed(VistaExplorerMiddleware, makeServerObserverMiddleware({ observer })),
      )
    }),
  )

/** The route is request-local, not a process-wide mutable current-app pointer. */
const routeContext = new AsyncLocalStorage<string>()

/** Map a routed request to the visible app URL, including the moving latest slot. */
export const rpcRouteFromPath = (url: string): string | undefined => {
  const path = url.split('?', 1)[0]
  if (path === '/_rpc/control') return 'control'
  const match =
    /^\/r\/([^/]+)\/([a-z0-9][a-z0-9-]*)\/(draft|latest|v\d+)\/_data\/[a-z0-9-]+\/?$/.exec(
      path ?? '',
    )
  if (match === null) return undefined
  const owner = decodeRouteOwner(match[1]!)
  return owner === undefined ? undefined : `${owner}/${match[2]}/${match[3]}`
}

/** Retained connection identity scoped to the routed app or control endpoint. */
export const connectionIdForRoute = (route: string | undefined, clientId: number): string =>
  `${route ?? 'control'}:${clientId}`

/** Carries the incoming route through asynchronous request processing. */
export const withRpcRoute = <T>(route: string, run: () => T): T => routeContext.run(route, run)

/** Host policy wins over RPC annotations; terminal payloads are never retained. */
const ptyTags = new Set(makeRpcDescriptors(PtyApi).map(({ tag }) => tag))
const omit: CapturePolicies = {
  requestPayload: { _tag: 'omit' },
  success: { _tag: 'omit' },
  typedFailure: { _tag: 'omit' },
  defect: { _tag: 'omit' },
  streamElement: { _tag: 'omit' },
  streamError: { _tag: 'omit' },
  headers: { _tag: 'omit' },
}
const reveal: CapturePolicies = {
  requestPayload: { _tag: 'reveal' },
  success: { _tag: 'reveal' },
  typedFailure: { _tag: 'reveal' },
  defect: { _tag: 'reveal' },
  streamElement: { _tag: 'reveal' },
  streamError: { _tag: 'reveal' },
  headers: { _tag: 'omit' },
}
/** Per-RPC host capture: terminal procedures omit all content, others omit only headers. */
export const vistaCapturePolicy: NonNullable<ExplorerConfig['capture']> = ({ tag }) =>
  ptyTags.has(tag) ? omit : reveal

const group: RpcGroup.Any = VistaControlApi.merge(
  OverviewApi,
  GhApi,
  OtelApi,
  TraceApi,
  OmpUsageApi,
  PyroscopeApi,
  PtyApi,
  DiskIndexApi,
)

/** The two host capabilities use the existing Effect/OTLP meter, never a second SDK. */
const telemetry = (
  runMetric: (effect: Effect.Effect<void>) => void,
): ExplorerConfig['telemetry'] => ({
  registerRetainedGauge: ({ name, description, observe }) => {
    const gauge = Metric.gauge(name, { description })
    const sample = () => {
      for (const { value, attributes } of observe()) {
        runMetric(Metric.update(Metric.withAttributes(gauge, attributes), value))
      }
    }
    sample()
    const interval = setInterval(sample, 10_000)
    interval.unref()
    return () => clearInterval(interval)
  },
  registerNormalizationHistogram: ({ name, description, boundaries }) => {
    const histogram = Metric.histogram(name, { description, boundaries })
    return ({ value, attributes }) => {
      runMetric(Metric.update(Metric.withAttributes(histogram, attributes), value))
    }
  },
})

/** Creates one scoped explorer for every Vista-owned RPC group. */
export const makeVistaRpcExplorer = (runMetric: (effect: Effect.Effect<void>) => void) =>
  makeExplorer({
    group,
    config: {
      instanceId: 'vista-service',
      bounds: {
        active: { maxCount: activeCapacity, maxAge: Duration.minutes(10) },
        completed: { maxCount: 512, maxAge: Duration.minutes(10) },
        streamValuesPerRecord: 16,
        normalized: defaultNormalizationBounds,
        deltas: { maxCount: 1024, maxAge: Duration.minutes(10) },
        subscriberQueue: 32,
      },
      capture: vistaCapturePolicy,
      telemetry: telemetry(runMetric),
    },
  })

/** Service-owned explorer instance passed to mounted control and provider handlers. */
export type VistaRpcExplorer = ExplorerServices

/** The service explorer plus the app version whose provider mounts register descriptors with it. */
export interface ProviderExplorer {
  readonly explorer: VistaRpcExplorer
  /** `service` or `<owner>/<slug>/<version>`; with the provider id it names one mount owner. */
  readonly appVersionId: string
}
