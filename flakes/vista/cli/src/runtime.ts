import type { Effect as EffectType } from 'effect'

import type { CliBuildIdentity } from '@overeng/utils/node/cli-version'

/**
 * Map a known tagged failure to a single dense `vista: <problem>` stderr line
 * (sk-cli-design: problems-first, no stack trace, no file paths). Returns `null`
 * for anything we do not recognise so it surfaces through the default runtime
 * handler — we never swallow an unexpected defect into a misleading clean line.
 */
const cleanMessage = (e: unknown): string | null => {
  if (typeof e !== 'object' || e === null || !('_tag' in e)) return null
  const tag = (e as { _tag: unknown })._tag
  const msg = (e as { message?: unknown }).message
  const slug = (e as { slug?: unknown }).slug
  const path = (e as { path?: unknown }).path
  const url = (e as { url?: unknown }).url
  switch (tag) {
    case 'Vista.ScaffoldExists':
      return `"${String(slug)}" already has a draft at ${String(path)} — edit it, publish it, or remove it before re-scaffolding`
    case 'Vista.InvalidSlug':
      return `invalid slug "${String(slug)}" — use lowercase letters, digits, and single hyphens (e.g. my-review); no dots, slashes, or path segments`
    case 'Vista.UnknownApp':
      return `unknown app "${String(slug)}" — run \`vista list\` to see the known slugs`
    case 'Vista.AskUsageError':
    case 'Vista.VersionUsageError':
    case 'Vista.VersionReadFailed':
    case 'Vista.UnknownVersion':
    case 'Vista.InvalidOwnerIdentity':
      return String(msg)
    case 'Vista.ServiceUnreachable':
      return `the Vista service is not reachable at ${String(url)} — start it or set VISTA_URL, then retry`
    case 'Vista.ServiceTransportFailed':
      return String(msg)
    case 'Vista.CanonicalUrlUnresolved':
      return `${String(msg)} — pass --local (or set VISTA_LOCAL=1) to emit the loopback URL instead, clearly marked non-canonical`
    case 'Vista.PublishFailed':
      return `publish failed for "${String(slug)}": ${String(msg)}`
    case 'Vista.RetireFailed':
      return `retire failed for "${String(slug)}": ${String(msg)}`
    case 'Vista.RehydrateBlocked':
      return String(msg)
    case 'Vista.RehydrateFailed':
      return `rehydrate failed for "${String(slug)}": ${String(msg)}`
    default:
      return null
  }
}

/** Run the canonical command tree with error rendering and scoped telemetry. */
export const runCli = async (buildIdentity: CliBuildIdentity): Promise<void> => {
  const [
    FetchHttpClient,
    NodeRuntime,
    NodeServices,
    EffectRuntime,
    Cli,
    Otel,
    VistaCommands,
    VistaClientModule,
  ] = await Promise.all([
    import('effect/http/FetchHttpClient'),
    // The root barrel also imports optional providers (including Redis).
    import('@effect/platform-node/NodeRuntime'),
    import('@effect/platform-node/NodeServices'),
    import('effect'),
    import('effect/cli'),
    import('@overeng/utils/node/otel'),
    import('./index.ts'),
    import('./VistaClient.ts'),
  ])
  const { Console, Effect, Layer, Metric, Schema } = EffectRuntime
  const { ServiceIdentity, otelEndpointFromConfig, withTelemetry } = Otel
  const { advisoryReview, vistaCheckCommand, vistaCommand } = VistaCommands
  const { VistaClient } = VistaClientModule

  // The invoked subcommand (best-effort: the first token after the entrypoint;
  // flags fall through to the effective `help`). Used as the invocation-span
  // attribute + the metric dimension so traces/metrics are sliceable per command.
  const command = process.argv.slice(2).find((a) => a.startsWith('-') === false) ?? 'help'
  const argv = process.argv
  const invocations = Metric.counter('vista_cli_invocations', {
    description: 'vista CLI invocations by subcommand',
  }).pipe(Metric.withAttributes({ command }))

  // OTel bootstrap (decision 0062 / OBS-R69/R70): `service.name=vista-cli`,
  // `service.version=machineVersion` (protocol form — NOT the display prose). The
  // typed identity makes a malformed name a decode error at the composition root.
  const identity = Schema.decodeSync(ServiceIdentity)({
    name: 'vista-cli',
    namespace: 'schickling',
    version: buildIdentity.machineVersion,
  })

  const program = Effect.gen(function* () {
    // Resolve the OTLP endpoint at the edge (via `Config`) so the telemetry layer
    // stays a pure function of its input. `withTelemetry` wires traces + metrics +
    // logs with `shape: 'cli'` export/flush defaults; zero exporter overhead when
    // no endpoint is configured, and it joins the parent publish trace via
    // `TRACEPARENT` when present.
    const endpoint = yield* otelEndpointFromConfig()

    const telemetry = withTelemetry({ identity, shape: 'cli', endpoint })
    const observe = <A, E, R>(invoked: EffectType.Effect<A, E, R>) =>
      invoked.pipe(
        // One invocation span per `vista <command>` run (OBS-R72). The service-side
        // provider/publish/freeze spans nest under it once traceparent propagation
        // across the control RPC lands (G3/D2); until then this is the CLI-local
        // trace. The counter increments on every outcome (success or failure).
        Effect.withSpan('vista.cli', { attributes: { 'vista.command': command } }),
        Effect.ensuring(Metric.update(invocations, 1)),
        // `Effect.scoped` discharges command-internal scopes; the OTel exporter flush
        // finalizer is awaited on exit.
        Effect.scoped,
        // Render known failures as a clean `vista: ...` line + non-zero exit, with a
        // ` (vista <version>)` diagnostic suffix so a stderr line pins the build that
        // produced it (decision 0064 / AGT.CLI-R67). Genuinely-unexpected defects
        // fall through to the default runtime trace (already stack-annotated).
        Effect.catch((e) => {
          const clean = cleanMessage(e)
          if (clean === null) return Effect.fail(e)
          // Set the exit code rather than `process.exit(1)`: a hard exit bypasses
          // the scope finalizers, dropping the OTel exporter flush (the span/metric
          // for a FAILED command would never ship). Node exits with this code once
          // the effect completes and the finalizers — including the flush — run.
          return Console.error(`vista: ${clean} (vista ${buildIdentity.displayVersion})`).pipe(
            Effect.andThen(
              typeof e === 'object' && e !== null && 'cause' in e
                ? Console.error(
                    `  cause: ${String('causeMessage' in e ? e.causeMessage : e.cause)}`,
                  )
                : Effect.void,
            ),
            Effect.andThen(Effect.sync(() => void (process.exitCode = 1))),
          )
        }),
      )

    const executed =
      command === 'check'
        ? observe(
            Cli.Command.runWith(vistaCheckCommand, {
              version: buildIdentity.displayVersion,
            })(argv.slice(2)),
          ).pipe(
            Effect.provide(
              Layer.mergeAll(NodeServices.layer, telemetry).pipe(
                Layer.provideMerge(FetchHttpClient.layer),
              ),
            ),
          )
        : observe(
            Cli.Command.runWith(vistaCommand, {
              version: buildIdentity.displayVersion,
            })(argv.slice(2)),
          ).pipe(
            Effect.provide(
              Layer.mergeAll(NodeServices.layer, VistaClient.Default, telemetry).pipe(
                Layer.provideMerge(FetchHttpClient.layer),
              ),
            ),
          )

    yield* executed
  })

  const guarded = command === 'review' ? advisoryReview(program) : program
  guarded.pipe(NodeRuntime.runMain())
}
