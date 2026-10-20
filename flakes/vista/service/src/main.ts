import { NodeServices, NodeRuntime } from '@effect/platform-node'
import { Config, Effect, Layer, Schema } from 'effect'
/**
 * Service entrypoint (decision 0060). Effect-native: `NodeRuntime.runMain` drives
 * one program that starts the standing service under an `acquireRelease` (so
 * SIGINT/SIGTERM interrupt → the finalizer closes it cleanly, replacing the manual
 * `process.on` handlers) and provides the service's OTel tracer layer (decision
 * 0062 / OBS-R69/R70): `service.name=vista-service`, `service.version=machineVersion`.
 * The telemetry layer is composed HERE (not inside `startService`) so tests and
 * embedders boot with zero telemetry surface. Run via `node
 * --experimental-strip-types src/main.ts` for local dev; the Nix module supplies
 * the runtime and `OTEL_*` env in production (decisions 0017 / G5).
 */
import { FetchHttpClient } from 'effect/http'

import { ServiceIdentity, otelEndpointFromConfig, withTelemetry } from '@overeng/utils/node/otel'

import { resolveVistaBuildInfo } from './build-info.ts'
import { startService } from './server.ts'
import { backfillThumbnails } from './thumbnail-backfill.ts'

const program = Effect.gen(function* () {
  // Local-only admin command, using the same VISTA_APPS registry as this service.
  // vista-service backfill-thumbnails [http://127.0.0.1:4178]
  if (process.argv[2] === 'backfill-thumbnails') {
    const baseUrl = new URL(
      process.argv[3] ?? `http://127.0.0.1:${process.env.VISTA_PORT ?? '4178'}`,
    )
    if (
      baseUrl.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(baseUrl.hostname) ||
      baseUrl.username !== '' ||
      baseUrl.password !== '' ||
      baseUrl.pathname !== '/' ||
      baseUrl.search !== '' ||
      baseUrl.hash !== ''
    ) {
      return yield* Effect.die('backfill-thumbnails requires a loopback HTTP service origin')
    }
    const result = yield* Effect.promise(() => backfillThumbnails(baseUrl.origin))
    yield* Effect.logInfo(
      `Vista thumbnail backfill: ${result.written} written, ${result.skipped} skipped`,
    )
    return
  }
  // Port: the positional arg wins for local dev; otherwise `Config` (VISTA_PORT),
  // defaulting to 5192 — the one place the service reads its listen port.
  const argvPort = process.argv[2]
  const port =
    argvPort !== undefined && argvPort !== ''
      ? Number(argvPort)
      : yield* Config.Number('VISTA_PORT').pipe(Config.withDefault(4178))

  // Telemetry and every browser bootstrap resolve the same embedded package
  // identity. The protocol-safe machine form is the OTel service version.
  const buildInfo = resolveVistaBuildInfo()
  const identity = yield* Effect.orDie(
    Schema.decodeEffect(ServiceIdentity)({
      name: 'vista-service',
      namespace: 'schickling',
      version: buildInfo.machineVersion,
    }),
  )
  const endpoint = yield* otelEndpointFromConfig()

  // The request-boundary runtime layer (decision 0060 hosts the tracer here). The
  // OTLP exporter needs an HTTP client + the node context; `withTelemetry` is a
  // no-op exporter when no endpoint is configured (`shape: 'service'` flush/export
  // defaults). Requirements are discharged so the layer is self-contained.
  const appLayer = withTelemetry({ identity, shape: 'service', endpoint }).pipe(
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(NodeServices.layer),
  )

  const started = yield* Effect.acquireRelease(
    Effect.promise(() => startService(port, appLayer)),
    (service) => Effect.promise(() => service.close()),
  )
  yield* Effect.logInfo(`vista service listening on http://127.0.0.1:${started.port}`)
  return yield* Effect.never
}).pipe(Effect.scoped)

NodeRuntime.runMain(program)
