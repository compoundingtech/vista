import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Effect, Layer, Schema, Tracer } from 'effect'
import { FetchHttpClient } from 'effect/http'

import { ServiceIdentity, otelEndpointFromConfig, withTelemetry } from '@overeng/utils/node/otel'

import { resolveVistaBuildInfo } from './build-info.ts'
import { PublishFailed, PublishOk } from './control.ts'
import { createProviderRegistry } from './data/mount.ts'
import { appsDir, root } from './paths.ts'
import { PublishWorkerRequestJson, PublishWorkerResponseJson } from './publish-worker-protocol.ts'
import { publish } from './publish.ts'
import { makeBrowserMountSmoke } from './render-smoke.ts'
import { createPublicationRuntime, loadPreconfiguredProviders } from './server.ts'

/** A single transaction owns every evaluator, provider and native build allocation. */
const program = Effect.gen(function* () {
  const request = yield* Schema.decodeEffect(PublishWorkerRequestJson)(readFileSync(0, 'utf8'))
  const identity = yield* Schema.decodeEffect(ServiceIdentity)({
    name: 'vista-service',
    namespace: 'schickling',
    version: resolveVistaBuildInfo().machineVersion,
  })
  const endpoint = yield* otelEndpointFromConfig()
  const telemetry = withTelemetry({ identity, shape: 'service', endpoint }).pipe(
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(NodeServices.layer),
  )
  const transaction = Effect.gen(function* () {
    const vite = yield* Effect.acquireRelease(Effect.promise(createPublicationRuntime), (runtime) =>
      Effect.promise(() => runtime.close()),
    )
    const providers = yield* Effect.acquireRelease(
      Effect.promise(() => createProviderRegistry(vite, appsDir())),
      (registry) => Effect.promise(() => registry.close()),
    )
    yield* Effect.promise(() =>
      loadPreconfiguredProviders(
        providers.base,
        join(root(), 'flakes', 'vista', 'service', 'src', 'data', 'providers'),
      ),
    )
    const runtime = yield* Effect.context<never>()
    const parentSpan = yield* Effect.currentSpan
    const outcome = yield* Effect.tryPromise({
      try: () =>
        publish(
          request.input,
          providers,
          request.renderBaseUrl === undefined
            ? undefined
            : makeBrowserMountSmoke(request.renderBaseUrl),
          { runtime, parentSpan },
        ),
      catch: (cause) =>
        new PublishFailed({
          owner: request.input.owner,
          slug: request.input.slug,
          message: cause instanceof Error ? cause.message : String(cause),
          cause: String(cause),
        }),
    })
    return yield* Schema.decodeEffect(PublishOk)({
      owner: outcome.owner,
      slug: outcome.slug,
      version: outcome.version,
      frozen: outcome.bindings.filter((binding) => binding.policy.mode === 'frozen').length,
      live: outcome.bindings.filter((binding) => binding.policy.mode === 'live').length,
      subscription: outcome.bindings.filter((binding) => binding.policy.mode === 'subscription')
        .length,
    })
  }).pipe(
    Effect.scoped,
    Effect.withParentSpan(Tracer.externalSpan(request.parentSpan)),
    Effect.withSpan('vista.publish.worker'),
    Effect.provide(telemetry),
  )
  const response = yield* transaction.pipe(
    Effect.map((result) => ({ _tag: 'Published' as const, version: 1 as const, result })),
    Effect.catchTag('Vista.PublishFailed', (error) =>
      Effect.succeed({ _tag: 'Failed' as const, version: 1 as const, error }),
    ),
  )
  // fd3 carries only this envelope. stdout/stderr remain the service's normal logs.
  // Resource finalizers and telemetry flushing have completed before it is sent.
  const encoded = yield* Schema.encodeEffect(PublishWorkerResponseJson)(response)
  yield* Effect.sync(() => writeFileSync(3, encoded))
})

NodeRuntime.runMain(program)
