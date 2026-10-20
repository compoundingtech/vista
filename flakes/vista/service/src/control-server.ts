import { accessSync, constants, existsSync } from 'node:fs'
import { join } from 'node:path'

import { Context, Effect, Layer, Metric, Schema } from 'effect'
import { HttpRouter } from 'effect/http'
import { RpcServer } from 'effect/rpc'
import { layerJson } from 'effect/rpc/RpcSerialization'

import {
  VersionSummary,
  AppSourceUnresolved,
  VersionReadFailed,
  AppVersionIdentity,
  AskInput,
  AskResult,
  AwaitInterviewInput,
  AwaitResult,
  encodeRouteOwner,
  encodeOwner,
  makeAppResource,
  OwnerIdentity,
  ImportDiagnosticInfo,
  ImportDiagnosticInput,
  InvalidSlug,
  NewAppInput,
  NewAppOk,
  PublishFailed,
  PublishInput,
  PublishOk,
  PublishPlan,
  PublishPlanInput,
  PublishPlanBlock,
  PublishPreviewInput,
  PublishPreviewOk,
  RehydrateBlocked,
  RehydrateFailed,
  RehydrateInput,
  RehydrateOk,
  RetireFailed,
  RetireOk,
  AppRow,
  RuntimePolicyInfo,
  ScaffoldExists,
  ServiceInfo,
  SlugInput,
  Slug,
  UnknownQuestion,
  UnknownApp,
  UnknownVersion,
  VistaControlApi,
} from './control.ts'
import { VistaReadApi } from './read.ts'
import type { ProviderRegistryManager } from './data/mount.ts'
import type { InterviewStore } from './interview/store.ts'
import { publishDuration, publishOperations, snapshotSkew, trackDuration } from './metrics.ts'
import { resolveAppSource, cacheDir, depsNodeModules, appsDir, root } from './paths.ts'
import {
  inspectStaticPublication,
  previewPublish,
  publish,
  publishOwnerRefusal,
  rehydrateSource,
  RehydrateTargetNotEmpty,
} from './publish.ts'
import {
  latestMeta,
  retire,
  scanAll,
  scanApp,
  scanSkew,
  snapshotDarkReason,
  type AppState,
} from './registry.ts'
import type { RenderSmoke } from './render-smoke.ts'
import {
  VistaExplorerMiddleware,
  explorerServerLayer,
  type VistaRpcExplorer,
} from './rpc-explorer.ts'
import { diagnoseVistaClientImport, vistaRuntimePolicy } from './runtime-policy/index.ts'
import { scaffold } from './scaffold.ts'
import { NoPayload, wireHandler } from './wire.ts'

const decodeAppRow = Schema.decodeUnknownSync(AppRow)
const decodeVersionSummary = Schema.decodeUnknownSync(VersionSummary)
const decodeAppRows = Schema.decodeUnknownSync(Schema.Array(AppRow))
const decodePublishOk = Schema.decodeUnknownSync(PublishOk)
const decodePublishPreviewOk = Schema.decodeUnknownSync(PublishPreviewOk)
const decodeRehydrateOk = Schema.decodeUnknownSync(RehydrateOk)
const decodeNewAppOk = Schema.decodeUnknownSync(NewAppOk)
const decodePublishPlan = Schema.decodeUnknownSync(PublishPlan)
const decodePublishPlanBlock = Schema.decodeUnknownSync(PublishPlanBlock)
const decodeRetireOk = Schema.decodeUnknownSync(RetireOk)
const decodeServiceInfo = Schema.decodeUnknownSync(ServiceInfo)
const decodeRuntimePolicyInfo = Schema.decodeUnknownSync(RuntimePolicyInfo)
const decodeAskResult = Schema.decodeUnknownSync(AskResult)
const decodeAwaitResult = Schema.decodeUnknownSync(AwaitResult)
const decodeImportDiagnosticInfo = Schema.decodeUnknownSync(ImportDiagnosticInfo)

const writable = (path: string): boolean => {
  try {
    accessSync(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

const toRow = (st: AppState): AppRow => {
  const meta = latestMeta(st)
  return {
    owner: st.owner,
    slug: st.slug,
    resource: makeAppResource(st.owner, st.slug),
    latest: st.latest,
    retired: st.retired,
    ...(meta?.title !== undefined ? { title: meta.title } : {}),
    ...(meta?.template !== undefined ? { template: meta.template } : {}),
    ...(meta?.status !== undefined ? { status: meta.status } : {}),
    ...(meta?.timestamp ? { updated: meta.timestamp } : {}),
  }
}

const scopedAppId = (owner: string, slug: string): string => `${encodeOwner(owner)}/${slug}`

/** Adapt AppSource resolution failures to the control API's structured error. */
export const resolveControlAppSource = (
  owner: OwnerIdentity,
  slug: Slug,
): Effect.Effect<string, AppSourceUnresolved> =>
  Effect.try({
    try: () => resolveAppSource(owner, slug),
    catch: (cause) =>
      new AppSourceUnresolved({
        owner,
        slug,
        message: cause instanceof Error ? cause.message : String(cause),
      }),
  })

const buildPublishPlan = async (
  owner: OwnerIdentity,
  slug: Slug,
  providers: ProviderRegistryManager,
  appSource: string,
): Promise<PublishPlan> => {
  const registry = await providers.replaceVersion(
    { owner, slug, version: 'draft' },
    join(appSource, 'providers'),
  )
  const state = scanApp(owner, slug)
  const draftExists = existsSync(join(appSource, 'app.tsx'))
  const problems = draftExists ? [] : [`AppSource not found or has no app.tsx: ${appSource}`]
  const providerIds = new Set(registry.providers.keys())
  const preview = draftExists ? await previewPublish({ owner, slug }) : undefined
  const bindings = preview?.bindings ?? []
  const planBlocks = bindings.map((binding) => {
    const providerMounted = providerIds.has(binding.provider)
    const problem = providerMounted ? undefined : `provider is not mounted: ${binding.provider}`
    return decodePublishPlanBlock({
      id: binding.semanticId,
      title: binding.semanticId,
      providerId: binding.provider,
      rpcTag: binding.operation,
      policy: binding.policy,
      providerMounted,
      ...(problem === undefined ? {} : { problem }),
    })
  })
  const missing = [
    ...new Set(
      planBlocks.filter((block) => !block.providerMounted).map((block) => block.providerId),
    ),
  ].toSorted()
  problems.push(
    ...planBlocks.flatMap((block) => (block.problem ? [`${block.id}: ${block.problem}`] : [])),
  )
  const latestVersion =
    state && state.versions.length > 0 ? state.versions[state.versions.length - 1]!.version : 0
  return decodePublishPlan({
    owner,
    slug,
    draftExists,
    publishable: draftExists && problems.length === 0,
    latest: state?.latest ?? null,
    nextVersion: draftExists ? latestVersion + 1 : null,
    source: { appTsx: draftExists },
    freeze: {
      total: planBlocks.length,
      frozen: planBlocks.filter((block) => block.policy.mode === 'frozen').length,
      live: planBlocks.filter((block) => block.policy.mode === 'live').length,
      subscription: planBlocks.filter((block) => block.policy.mode === 'subscription').length,
      effectfulAcknowledged: planBlocks.filter(
        (block) =>
          'effectfulCapture' in block.policy && block.policy.effectfulCapture === 'acknowledged',
      ).length,
      unresolved: 0,
      blocks: planBlocks,
    },
    providers: {
      mounted: [...providerIds].toSorted(),
      missing,
    },
    problems,
  })
}

/**
 * Dependencies injected into the control handler, including the provider registry, interview
 * store, service start time, a post-refresh callback, and optional render-smoke and telemetry
 * layers.
 */
export interface VistaControlOptions {
  readonly providers: ProviderRegistryManager
  readonly interview: InterviewStore
  readonly startedAt: number
  readonly refreshApp: (owner: OwnerIdentity, slug: Slug) => void
  /** Per-review render smoke (decision 0058); `undefined` disables it (browser-
   * free publish, the default off the deployed closure). Wired in `server.ts`. */
  readonly renderSmoke?: RenderSmoke
  /**
   * Telemetry layer merged into the RPC server runtime (Track G3 / decision 0062).
   * Without a tracer in this runtime the control-plane `Effect.withSpan`s are
   * no-ops; merging the service `withTelemetry` layer makes them export AND lets
   * the freeze/provider spans nest under the publish handler's span (OBS-R71).
   * Defaults to `Layer.empty` so tests/embedders carry zero telemetry surface.
   */
  readonly telemetryLayer?: Layer.Layer<never, never, never>
  readonly explorer?: VistaRpcExplorer
  /** Canonical human-facing base URL used by immutable app version summaries. */
  readonly publicBaseUrl?: string
  /** The startup AppIndex, refreshed on publish/retire and by discovery routes. */
  readonly listApps: () => Iterable<AppState>
}

/** Shared per-version read; both RPC routes must agree on validity and canonical URL. */
const readVersion = (
  { owner, slug, version }: AppVersionIdentity,
  publicUrl: string | undefined,
) =>
  Effect.gen(function* () {
    const state = scanApp(owner, slug)
    const meta = state?.versions.find((candidate) => candidate.version === version)
    const appId = scopedAppId(owner, slug)
    if (!state || !meta) {
      return yield* new UnknownVersion({
        owner,
        slug,
        version,
        message: `unknown Vista app version: vista://${appId}/v${version}`,
      })
    }
    const publicBaseUrl = publicUrl?.trim().replace(/\/+$/, '')
    if (!publicBaseUrl) {
      return yield* new VersionReadFailed({
        owner,
        slug,
        version,
        message: 'the Vista service has no canonical public URL configured',
      })
    }
    const publication = inspectStaticPublication(owner, slug, version)
    const stateName = state.retired
      ? 'expired'
      : snapshotDarkReason(owner, slug, version) === null && publication._tag === 'verified'
        ? 'ready'
        : 'failed'
    return decodeVersionSummary({
      owner,
      schemaVersion: 1,
      uri: `vista://${appId}/v${version}`,
      slug,
      version,
      author: meta.author,
      timestamp: meta.timestamp,
      changeSummary: meta.changeSummary,
      parent: meta.parent,
      retired: state.retired,
      state: stateName,
      canonicalUrl: `${publicBaseUrl}/r/${encodeRouteOwner(owner)}/${slug}/v${version}/`,
      ...(meta.title !== undefined ? { title: meta.title } : {}),
      ...(meta.template !== undefined ? { template: meta.template } : {}),
      ...(meta.status !== undefined ? { status: meta.status } : {}),
    })
  })

/** Read group shares the control row/version projections, but cannot mount writes. */
export const createVistaReadHandler = (options: VistaControlOptions) => {
  const handlers = VistaReadApi.toLayer(
    Effect.succeed(
      VistaReadApi.of({
        'vista.read.apps.list': wireHandler(
          'vista.read.apps.list',
          NoPayload,
          Schema.Array(AppRow),
          () => Effect.sync(() => decodeAppRows(Array.from(options.listApps(), toRow))),
        ),
        'vista.read.version.get': wireHandler(
          'vista.read.version.get',
          AppVersionIdentity,
          VersionSummary,
          (input) => readVersion(input, options.publicBaseUrl),
        ),
      }),
    ),
  )
  const appLayer = Layer.provide(
    RpcServer.layerHttp({ group: VistaReadApi, path: '/_rpc/read', protocol: 'http' }),
    Layer.mergeAll(handlers, layerJson, HttpRouter.layer, options.telemetryLayer ?? Layer.empty),
  )
  const webHandler = HttpRouter.toWebHandler(appLayer)
  return {
    handler: (request: Request) => webHandler.handler(request, Context.empty()),
    dispose: webHandler.dispose,
  }
}

/** Constructs the control RPC handler, including the existing mutation procedures. */
export const createVistaControlHandler = (options: VistaControlOptions) => {
  const handlers = VistaControlApi.toLayer(
    Effect.succeed(
      VistaControlApi.of({
        'vista.apps.list': wireHandler(
          'vista.control.apps.list',
          NoPayload,
          Schema.Array(AppRow),
          () =>
            Effect.gen(function* () {
              const apps = [...scanAll().values()]
              // Loud half (SVC-R15 / decisions 0061, 0069, 0072): surface published versions
              // whose frozen snapshot.json fails closed — `skew` (non-current apiVersion) or
              // `malformed` (present but not a well-formed envelope) — since both render
              // `unsupported` (go dark). Reuse the same `scanAll()` the rows already ran so
              // the apps dir is walked ONCE, and reuse the one `dark` list for BOTH the
              // count gauge and the per-version log so it is classified once.
              const dark = scanSkew(apps)
              // STATE, not an event: `set` the count of currently-dark versions for BOTH
              // reasons every scan (0 when none), so a reason that drops to zero is reset —
              // no stale series, cardinality bounded to two series. `slug`/`version` stay
              // out of the labels; the per-version detail is the structured log below.
              const skewN = dark.filter((d) => d.reason === 'skew').length
              const malformedN = dark.filter((d) => d.reason === 'malformed').length
              yield* Effect.forEach(
                [
                  ['skew', skewN],
                  ['malformed', malformedN],
                ] as const,
                ([reason, count]) =>
                  Metric.update(Metric.withAttributes(snapshotSkew, { reason }), count),
                { discard: true },
              )
              // The WHICH-version-is-dark signal: one structured warn per dark version so an
              // operator can query slug/version/reason without paying for them as labels.
              yield* Effect.forEach(
                dark,
                ({ owner, slug, version, reason }) =>
                  Effect.logWarning('vista published snapshot dark at scan').pipe(
                    Effect.annotateLogs({
                      owner,
                      slug,
                      version: String(version),
                      reason,
                    }),
                  ),
                { discard: true },
              )
              return decodeAppRows(apps.map(toRow))
            }),
        ),

        'vista.app.get': wireHandler(
          'vista.control.app.get',
          SlugInput,
          AppRow,
          ({ owner, slug }) =>
            Effect.gen(function* () {
              const st = scanApp(owner, slug)
              if (!st) {
                return yield* new UnknownApp({
                  owner,
                  slug,
                  message: `unknown app: ${scopedAppId(owner, slug)}`,
                })
              }
              return decodeAppRow(toRow(st))
            }),
        ),

        'vista.version.get': wireHandler(
          'vista.control.version.get',
          AppVersionIdentity,
          VersionSummary,
          (input) => readVersion(input, options.publicBaseUrl),
        ),

        'vista.app.new': wireHandler(
          'vista.control.app.new',
          NewAppInput,
          NewAppOk,
          ({ owner, slug, dryRun }) =>
            Effect.gen(function* () {
              const appSource = yield* resolveControlAppSource(owner, slug)
              const result = yield* scaffold(slug, {
                ...(dryRun === undefined ? {} : { dryRun }),
                appSource,
              }).pipe(
                Effect.catchTags({
                  'Vista.InvalidSlug': (error) =>
                    Effect.fail(
                      new InvalidSlug({
                        owner,
                        slug: error.slug,
                        message: `invalid app slug: ${error.slug}`,
                      }),
                    ),
                  'Vista.ScaffoldExists': (error) =>
                    Effect.fail(
                      new ScaffoldExists({
                        owner,
                        slug: error.slug,
                        path: error.path,
                        message: `app draft already exists: ${error.path}`,
                      }),
                    ),
                }),
              )
              options.refreshApp(owner, slug)
              return decodeNewAppOk({
                owner,
                ...result,
              })
            }),
        ),

        'vista.publish': wireHandler('vista.control.publish', PublishInput, PublishOk, (input) =>
          Effect.gen(function* () {
            const refusal = publishOwnerRefusal(input.owner, input.slug)
            if (refusal !== undefined) return yield* refusal
            yield* resolveControlAppSource(input.owner, input.slug)
            const outcome = yield* Effect.gen(function* () {
              const runtime = yield* Effect.context<never>()
              const parentSpan = yield* Effect.currentSpan.pipe(Effect.orDie)
              return yield* Effect.tryPromise({
                try: () =>
                  publish(
                    {
                      owner: input.owner,
                      slug: input.slug,
                      author: input.author,
                      changeSummary: input.changeSummary,
                      ...(input.trail === undefined ? {} : { trail: input.trail }),
                    },
                    options.providers,
                    options.renderSmoke,
                    { runtime, parentSpan },
                  ),
                catch: (cause) =>
                  new PublishFailed({
                    owner: input.owner,
                    slug: input.slug,
                    message: String(cause instanceof Error ? cause.message : cause),
                    cause: String(cause),
                  }),
              })
            }).pipe(
              Effect.withSpan('vista.control.publish', {
                attributes: {
                  'span.label': 'publish',
                  'vista.app.owner': input.owner,
                  'vista.app.slug': input.slug,
                },
              }),
              trackDuration(publishDuration),
              Effect.tap(() =>
                Metric.update(
                  Metric.withAttributes(publishOperations, { outcome: 'published' }),
                  1,
                ),
              ),
              Effect.tapError(() =>
                Metric.update(Metric.withAttributes(publishOperations, { outcome: 'failed' }), 1),
              ),
            )
            options.refreshApp(input.owner, input.slug)
            return decodePublishOk({
              owner: outcome.owner,
              slug: outcome.slug,
              version: outcome.version,
              frozen: outcome.bindings.filter((binding) => binding.policy.mode === 'frozen').length,
              live: outcome.bindings.filter((binding) => binding.policy.mode === 'live').length,
              subscription: outcome.bindings.filter(
                (binding) => binding.policy.mode === 'subscription',
              ).length,
            })
          }),
        ),

        'vista.publish.preview': wireHandler(
          'vista.control.publish.preview',
          PublishPreviewInput,
          PublishPreviewOk,
          (input) =>
            Effect.gen(function* () {
              const refusal = publishOwnerRefusal(input.owner, input.slug)
              if (refusal !== undefined) return yield* refusal
              yield* resolveControlAppSource(input.owner, input.slug)
              const preview = yield* Effect.tryPromise({
                try: () =>
                  previewPublish({
                    owner: input.owner,
                    slug: input.slug,
                  }),
                catch: (cause) =>
                  new PublishFailed({
                    owner: input.owner,
                    slug: input.slug,
                    message: String(cause instanceof Error ? cause.message : cause),
                    cause: String(cause),
                  }),
              })
              return decodePublishPreviewOk({
                owner: preview.owner,
                slug: preview.slug,
                nextVersion: preview.nextVersion,
                ...(preview.title !== undefined ? { title: preview.title } : {}),
                ...(preview.template !== undefined ? { template: preview.template } : {}),
              })
            }),
        ),

        'vista.publish.plan': wireHandler(
          'vista.control.publish.plan',
          PublishPlanInput,
          PublishPlan,
          ({ owner, slug }) =>
            Effect.gen(function* () {
              const refusal = publishOwnerRefusal(owner, slug)
              if (refusal !== undefined) return yield* refusal
              const appSource = yield* resolveControlAppSource(owner, slug)
              return yield* Effect.tryPromise({
                try: () => buildPublishPlan(owner, slug, options.providers, appSource),
                catch: (cause) =>
                  new PublishFailed({
                    owner,
                    slug,
                    message: String(cause instanceof Error ? cause.message : cause),
                    cause: String(cause),
                  }),
              })
            }),
        ),

        'vista.rehydrate': wireHandler(
          'vista.control.rehydrate',
          RehydrateInput,
          RehydrateOk,
          (input) =>
            Effect.gen(function* () {
              const appSource = yield* resolveControlAppSource(input.owner, input.slug)
              if (!scanApp(input.owner, input.slug)) {
                return yield* new UnknownApp({
                  owner: input.owner,
                  slug: input.slug,
                  message: `unknown app: ${scopedAppId(input.owner, input.slug)}`,
                })
              }
              const result = yield* Effect.try({
                try: () =>
                  rehydrateSource({
                    owner: input.owner,
                    slug: input.slug,
                    ...(input.version !== undefined ? { version: input.version } : {}),
                  }),
                catch: (cause) =>
                  cause instanceof RehydrateTargetNotEmpty
                    ? new RehydrateBlocked({
                        owner: input.owner,
                        slug: input.slug,
                        path: cause.path,
                        message: cause.message,
                      })
                    : new RehydrateFailed({
                        owner: input.owner,
                        slug: input.slug,
                        message: String(cause instanceof Error ? cause.message : cause),
                        cause: String(cause),
                      }),
              })
              return decodeRehydrateOk({
                owner: input.owner,
                slug: result.slug,
                version: result.version,
                appSource,
                files: result.files,
              })
            }),
        ),

        'vista.app.retire': wireHandler(
          'vista.control.app.retire',
          SlugInput,
          RetireOk,
          ({ owner, slug }) =>
            Effect.gen(function* () {
              if (!scanApp(owner, slug)) {
                return yield* new UnknownApp({
                  owner,
                  slug,
                  message: `unknown app: ${scopedAppId(owner, slug)}`,
                })
              }
              yield* Effect.tryPromise({
                try: async () => {
                  retire(owner, slug)
                  await options.providers.closeApp(owner, slug)
                },
                catch: (cause) =>
                  new RetireFailed({
                    owner,
                    slug,
                    message: `retire failed for ${scopedAppId(owner, slug)}: ${String(cause)}`,
                    cause: String(cause),
                  }),
              })
              options.refreshApp(owner, slug)
              return decodeRetireOk({ owner, slug })
            }),
        ),

        'vista.service.info': wireHandler(
          'vista.control.service.info',
          NoPayload,
          ServiceInfo,
          () =>
            Effect.succeed(
              decodeServiceInfo({
                urlPath: '/_rpc/control',
                apps: scanAll().size,
                uptimeMs: Date.now() - options.startedAt,
                paths: {
                  root: root(),
                  apps: appsDir(),
                  cache: cacheDir(),
                  deps: depsNodeModules(),
                  diagnostics: {
                    rootInNixStore: root().startsWith('/nix/store/'),
                    rootWritable: writable(root()),
                    reviewsWritable: writable(appsDir()),
                    cacheWritable: writable(cacheDir()),
                    depsExists: existsSync(depsNodeModules()),
                  },
                },
              }),
            ),
        ),

        'vista.runtime.policy': wireHandler(
          'vista.control.runtime.policy',
          NoPayload,
          RuntimePolicyInfo,
          () => Effect.succeed(decodeRuntimePolicyInfo(vistaRuntimePolicy())),
        ),

        'vista.import.diagnose': wireHandler(
          'vista.control.import.diagnose',
          ImportDiagnosticInput,
          ImportDiagnosticInfo,
          ({ specifier }) =>
            Effect.succeed(decodeImportDiagnosticInfo(diagnoseVistaClientImport(specifier))),
        ),

        'vista.interview.ask': wireHandler(
          'vista.control.interview.ask',
          AskInput,
          AskResult,
          (input) =>
            Effect.gen(function* () {
              if (!scanApp(input.owner, input.appId)) {
                return yield* new UnknownApp({
                  owner: input.owner,
                  slug: input.appId,
                  message: `unknown app: ${scopedAppId(input.owner, input.appId)}`,
                })
              }
              const stored = options.interview.ask(
                scopedAppId(input.owner, input.appId),
                input.question,
              )
              return decodeAskResult({
                owner: input.owner,
                appId: input.appId,
                questionId: stored.questionId,
              })
            }),
        ),

        'vista.interview.await': wireHandler(
          'vista.control.interview.await',
          AwaitInterviewInput,
          AwaitResult,
          ({ owner, appId, questionId }) =>
            Effect.gen(function* () {
              const scopedId = scopedAppId(owner, appId)
              const outcome = yield* Effect.promise(() =>
                options.interview.awaitAnswer(scopedId, questionId, 2_500),
              )
              if (outcome._tag === 'unknown') {
                return yield* new UnknownQuestion({
                  owner,
                  appId,
                  questionId,
                  message: `unknown interview question: ${scopedId} ${questionId}`,
                })
              }
              return decodeAwaitResult(
                outcome._tag === 'answered'
                  ? {
                      _tag: 'answered',
                      owner,
                      appId,
                      questionId,
                      answer: outcome.answer,
                    }
                  : {
                      _tag: 'pending',
                      owner,
                      appId,
                      questionId,
                    },
              )
            }),
        ),
      }),
    ),
  )

  const handlerLayer = Layer.mergeAll(
    handlers,
    layerJson,
    HttpRouter.layer,
    options.telemetryLayer ?? Layer.empty,
  )
  const appLayer = options.explorer
    ? RpcServer.layer(VistaControlApi.middleware(VistaExplorerMiddleware)).pipe(
        Layer.provide(
          explorerServerLayer({
            explorer: options.explorer,
            path: '/_rpc/control',
            group: VistaControlApi,
          }).pipe(Layer.provide(layerJson)),
        ),
        Layer.provide(handlerLayer),
      )
    : Layer.provide(
        RpcServer.layerHttp({
          group: VistaControlApi,
          path: '/_rpc/control',
          protocol: 'http',
        }),
        handlerLayer,
      )
  const webHandler = HttpRouter.toWebHandler(appLayer)
  return {
    handler: (request: Request) => webHandler.handler(request, Context.empty()),
    dispose: webHandler.dispose,
  }
}
