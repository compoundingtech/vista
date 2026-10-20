import { readFileSync } from 'node:fs'
import { isIP } from 'node:net'

import * as NodeHttpClient from '@effect/platform-node/NodeHttpClient'
import {
  AppVersionIdentity,
  VersionSummary,
  AskInput,
  AskResult,
  AwaitInterviewInput,
  AwaitResult,
  ImportDiagnosticInfo,
  ImportDiagnosticInput,
  NewAppInput,
  NewAppOk,
  PublishInput,
  PublishPlan,
  PublishPlanInput,
  OwnerIdentity,
  PublishOk,
  PublishPreviewInput,
  PublishPreviewOk,
  RehydrateInput,
  RehydrateOk,
  RetireOk,
  AppRow,
  RuntimePolicyInfo,
  ServiceInfo,
  encodeRouteOwner,
  ServicePaths,
  Slug,
  InvalidSlug,
  SlugInput,
  type TrailEntry,
  VistaControlApi,
} from '@vista/service/control'
import { NoPayload, wireCall } from '@vista/service/wire'
/**
 * `VistaClient` — the CLI's Effect service surface over the standing Vista
 * service. Every command, including `new`, crosses the typed `VistaControlApi`
 * RPC boundary at `/_rpc/control`; the service owns app state and roots.
 *
 * Inputs/outputs are Effect Schema-owned through the shared RpcGroup. Failures
 * are tagged errors on the error channel; only refused connections are reported
 * as `Vista.ServiceUnreachable`. Other transport failures retain their cause.
 */
import {
  Config,
  ConfigProvider,
  Context,
  Effect,
  Layer,
  Option,
  Predicate,
  Result,
  Schema,
} from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'

export {
  VersionSummary,
  VersionReadFailed,
  InvalidSlug,
  ImportDiagnosticInfo,
  NewAppOk,
  PublishFailed,
  PublishPlan,
  PublishOk,
  PublishPreviewOk,
  RehydrateBlocked,
  RehydrateFailed,
  RehydrateOk,
  RetireOk,
  RetireFailed,
  AppRow,
  RuntimePolicyInfo,
  ScaffoldExists,
  ServiceInfo,
  ServicePaths,
  UnknownQuestion,
  UnknownVersion,
  UnknownApp,
} from '@vista/service/control'

/** The service is not reachable — control-plane commands need the running service. */
export class ServiceUnreachable extends Schema.TaggedError<ServiceUnreachable>()(
  'Vista.ServiceUnreachable',
  {
    url: Schema.String,
    message: Schema.String,
    causeMessage: Schema.String,
    cause: Schema.Defect(),
  },
) {}

/** An HTTP, codec, or protocol failure, not evidence that the service is stopped. */
export class ServiceTransportFailed extends Schema.TaggedError<ServiceTransportFailed>()(
  'Vista.ServiceTransportFailed',
  {
    url: Schema.String,
    message: Schema.String,
    status: Schema.optional(Schema.Int),
    causeMessage: Schema.String,
    cause: Schema.Defect(),
  },
) {}

/**
 * The canonical (human-facing) tailnet URL is not configured (SVC-R55). Emission
 * fails loudly rather than silently printing a dead loopback link; callers may
 * opt into `--local`/`VISTA_LOCAL` to emit the loopback URL marked non-canonical.
 */
export class CanonicalUrlUnresolved extends Schema.TaggedError<CanonicalUrlUnresolved>()(
  'Vista.CanonicalUrlUnresolved',
  {
    message: Schema.String,
  },
) {}

/**
 * Tagged error signaling an operation failed because the owner identity was rejected, carrying the
 * offending owner value and an explanatory message.
 */
export class InvalidOwnerIdentity extends Schema.TaggedError<InvalidOwnerIdentity>()(
  'Vista.InvalidOwnerIdentity',
  {
    owner: Schema.String,
    message: Schema.String,
  },
) {}

type ControlClient = RpcClient.FromGroup<typeof VistaControlApi, RpcClientError.RpcClientError>

const CONTROL_RPC_PATH = '/_rpc/control'

const trimTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

/**
 * The bundle-owned config file the CLI reads its canonical base from
 * (decision 0055): `$XDG_CONFIG_HOME/schickling/vista/public-url`, falling back
 * to `$HOME/.config/...` when `XDG_CONFIG_HOME` is unset. This matches the
 * app-paths convention (`~/.config/schickling/<tool>`) that `vista.nix` writes
 * to on a full switch and the Vista activation bundle writes on a targeted
 * deploy. Alignment holds when `XDG_CONFIG_HOME` is unset/default (the dev3
 * case); an explicit `XDG_CONFIG_HOME` must therefore match what wrote the file.
 */
const VISTA_PUBLIC_URL_CONFIG_SUBPATH = 'schickling/vista/public-url'

/** Normalize a raw canonical-base string: trim, strip trailing slash; empty → unset. */
const normalizeBase = (raw: string): Option.Option<string> => {
  const trimmed = trimTrailingSlash(raw.trim())
  return trimmed === '' ? Option.none() : Option.some(trimmed)
}

/**
 * Read+normalize the canonical base from the bundle-owned config file. A missing
 * file (ENOENT) or any read error is treated as "unset" (fail-loud downstream),
 * never a hard failure — standalone/CI/collaborator use has no such file (SVC-R55).
 */
const readPublicUrlFile = (path: string): Option.Option<string> => {
  try {
    return normalizeBase(readFileSync(path, 'utf8'))
  } catch {
    return Option.none()
  }
}

/**
 * Loopback control traffic must stay local. Bun 1.4.2 honors HTTP_PROXY even for
 * 127.0.0.1, and proxy: undefined, "" and false do not override that environment.
 * Use node:http's direct agent for loopback rather than mutating process-wide
 * NO_PROXY (which would race other requests). Remote URLs retain fetch behavior.
 */
const transportLayer = (serviceUrl: string) => {
  const hostname = new URL(serviceUrl).hostname
  const layer =
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    (isIP(hostname) === 4 && hostname.startsWith('127.'))
      ? NodeHttpClient.layerNodeHttp
      : FetchHttpClient.layer
  // Reject status failures before the RPC decoder can hide them behind JSON errors.
  return Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, HttpClient.filterStatusOk),
  ).pipe(Layer.provide(layer))
}

const makeProtocolLayer = (serviceUrl: string) =>
  RpcClient.layerProtocolHttp({
    url: `${trimTrailingSlash(serviceUrl)}${CONTROL_RPC_PATH}`,
    // Effect 4's HTTP RPC client posts to the empty relative URL, whose generic
    // URL join adds `/`. Preserve Vista's established browser/control boundary
    // (`/_rpc/control`, without a trailing slash) at the client edge.
    transformClient: HttpClient.mapRequest((request) =>
      request.url.endsWith('/')
        ? HttpClientRequest.setUrl(request, request.url.slice(0, -1))
        : request,
    ),
  }).pipe(Layer.provide(RpcSerialization.layerJson), Layer.provide(transportLayer(serviceUrl)))

export const normalizeTransport = <A, E>(
  effect: Effect.Effect<A, E | RpcClientError.RpcClientError>,
  serviceUrl: string,
): Effect.Effect<A, E | ServiceUnreachable | ServiceTransportFailed> =>
  effect.pipe(
    Effect.catchIf(
      Schema.is(RpcClientError.RpcClientError),
      (cause): Effect.Effect<never, ServiceUnreachable | ServiceTransportFailed> => {
        const reason = cause.reason
        // HttpError.cause is the original HTTP reason; TransportError.cause is
        // the runtime exception (possibly a nested Node fetch TypeError.cause).
        const httpReason = reason._tag === 'HttpError' ? reason.cause : undefined
        let underlying: unknown = Predicate.hasProperty(reason, 'cause') ? reason.cause : undefined
        const seen = new Set<unknown>()
        const messages: string[] = reason._tag === 'RpcClientDefect' ? [reason.message] : []
        let refused = false
        while (Predicate.isObject(underlying) && !seen.has(underlying)) {
          seen.add(underlying)
          if (underlying instanceof Error) messages.push(underlying.message)
          if (
            Predicate.hasProperty(underlying, 'code') &&
            (underlying.code === 'ECONNREFUSED' || underlying.code === 'ConnectionRefused')
          ) {
            refused = true
          }
          underlying = Predicate.hasProperty(underlying, 'cause') ? underlying.cause : undefined
        }
        const detail = messages.length > 0 ? messages.join(': ') : cause.message
        if (reason._tag === 'HttpError' && reason.kind === 'TransportError' && refused) {
          return Effect.fail(
            new ServiceUnreachable({
              url: serviceUrl,
              message: `cannot reach the vista service at ${serviceUrl} — connection refused; start it before using this command`,
              causeMessage: detail,
              cause,
            }),
          )
        }
        const response =
          Predicate.isObject(httpReason) && Predicate.hasProperty(httpReason, 'response')
            ? httpReason.response
            : undefined
        const status =
          Predicate.isObject(response) &&
          Predicate.hasProperty(response, 'status') &&
          typeof response.status === 'number'
            ? response.status
            : undefined
        return Effect.fail(
          new ServiceTransportFailed({
            url: serviceUrl,
            message: `vista service transport failed at ${serviceUrl}${status === undefined ? '' : ` (HTTP ${status})`}: ${detail}`,
            ...(status === undefined ? {} : { status }),
            causeMessage: detail,
            cause,
          }),
        )
      },
    ),
  )

const makeVistaClient = Effect.gen(function* () {
  // `serviceUrl` is the LOOPBACK RPC transport target only (decision 0051): the
  // endpoint the CLI reaches its local service on. It is never the emitted,
  // human-facing app URL — that is the canonical tailnet URL resolved below.
  const serviceUrl = yield* Config.String('VISTA_URL').pipe(
    Config.withDefault('http://127.0.0.1:5192'),
  )
  const author = yield* Config.String('VISTA_AUTHOR').pipe(
    Config.withDefault(process.env.USER ?? 'agent'),
  )
  // Preserve the construction-time provider without reading ST_AGENT until needed.
  const configProvider = yield* ConfigProvider.ConfigProvider
  const resolveOwner = Effect.gen(function* () {
    const rawOwner = yield* Config.String('ST_AGENT')
    const decodedOwner = Schema.decodeResult(OwnerIdentity)(rawOwner)
    if (Result.isFailure(decodedOwner)) {
      return yield* new InvalidOwnerIdentity({
        owner: rawOwner,
        message: `ST_AGENT is not a valid Vista owner identity: ${rawOwner}`,
      })
    }
    return decodedOwner.success
  }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider))
  // The canonical, human-facing base URL for this Vista instance
  // (`https://vista-<host>.<tailnet-suffix>`), plumbed at deploy time by the
  // Vista activation bundle / `vista.nix` (decisions 0051, 0055). Vista only
  // ever emits its OWN app URLs, and this value is deploy-time-known, so it
  // is read directly — no runtime resolver, no network on the emit path.
  //
  // Source precedence (decision 0055): the `VISTA_PUBLIC_URL` env is an explicit
  // OVERRIDE (for `--local`/tests/dev); the canonical base is otherwise sourced
  // from the bundle-owned config file the deploy writes. Both sources go through
  // the same normalization (trim → strip-trailing-slash → empty-means-unset), so
  // an unset/empty result stays fail-loud unless `--local`/`VISTA_LOCAL`.
  const envBase = yield* Config.String('VISTA_PUBLIC_URL').pipe(
    Config.option,
    Config.map(Option.flatMap(normalizeBase)),
  )
  const xdgConfigHome = yield* Config.String('XDG_CONFIG_HOME').pipe(Config.option)
  const home = yield* Config.String('HOME').pipe(Config.option)
  const configFilePath = Option.match(xdgConfigHome, {
    onSome: (dir) => Option.some(`${trimTrailingSlash(dir)}/${VISTA_PUBLIC_URL_CONFIG_SUBPATH}`),
    onNone: () =>
      Option.map(home, (h) => `${trimTrailingSlash(h)}/.config/${VISTA_PUBLIC_URL_CONFIG_SUBPATH}`),
  })
  // Env override wins; otherwise read the bundle-owned config file (if a config
  // dir is resolvable at all). A missing file → unset → fail-loud/`--local`.
  const publicBase = Option.orElse(envBase, () => Option.flatMap(configFilePath, readPublicUrlFile))
  // `--local`/`VISTA_LOCAL` opt-in: emit the loopback URL, clearly marked
  // non-canonical, instead of failing loud when no canonical URL is configured
  // (SVC-R55).
  const localDefault = yield* Config.Boolean('VISTA_LOCAL').pipe(Config.withDefault(false))

  const identity = Effect.fn('VistaClient.identity')(function* (slug: string) {
    const owner = yield* resolveOwner
    if (!Schema.is(Slug)(slug)) {
      return yield* new InvalidSlug({ owner, slug, message: `invalid app slug: ${slug}` })
    }
    return { owner, slug }
  })

  const withControl = <A, E>(
    f: (client: ControlClient) => Effect.Effect<A, E | RpcClientError.RpcClientError>,
  ): Effect.Effect<A, E | ServiceUnreachable | ServiceTransportFailed> =>
    normalizeTransport(
      Effect.gen(function* () {
        const client: ControlClient = yield* RpcClient.make(VistaControlApi)
        return yield* f(client)
      }).pipe(Effect.scoped, Effect.provide(makeProtocolLayer(serviceUrl))),
      serviceUrl,
    )

  const list = Effect.fn('VistaClient.list')(function* () {
    return yield* withControl((client) =>
      wireCall(
        'vista.apps.list',
        NoPayload,
        Schema.Array(AppRow),
      )((env) => client['vista.apps.list'](env), null),
    )
  })

  const get = Effect.fn('VistaClient.get')(function* (slug: string) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall('vista.app.get', SlugInput, AppRow)((env) => client['vista.app.get'](env), app),
    )
  })

  const getVersion = Effect.fn('VistaClient.getVersion')(function* (slug: string, version: number) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.version.get',
        AppVersionIdentity,
        VersionSummary,
      )((env) => client['vista.version.get'](env), { ...app, version }),
    )
  })

  const newApp = Effect.fn('VistaClient.newApp')(function* (
    slug: string,
    options: { readonly dryRun?: boolean } = {},
  ) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.app.new',
        NewAppInput,
        NewAppOk,
      )((env) => client['vista.app.new'](env), {
        ...app,
        ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
      }),
    )
  })

  const publish = Effect.fn('VistaClient.publish')(function* (
    slug: string,
    changeSummary: string,
    trail?: ReadonlyArray<TrailEntry> | undefined,
  ) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.publish',
        PublishInput,
        PublishOk,
      )((env) => client['vista.publish'](env), {
        ...app,
        author,
        changeSummary,
        ...(trail === undefined ? {} : { trail: [...trail] }),
      }),
    )
  })

  const publishPreview = Effect.fn('VistaClient.publishPreview')(function* (slug: string) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.publish.preview',
        PublishPreviewInput,
        PublishPreviewOk,
      )((env) => client['vista.publish.preview'](env), {
        ...app,
      }),
    )
  })

  const rehydrate = Effect.fn('VistaClient.rehydrate')(function* (slug: string, version?: number) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.rehydrate',
        RehydrateInput,
        RehydrateOk,
      )((env) => client['vista.rehydrate'](env), {
        ...app,
        ...(version !== undefined ? { version } : {}),
      }),
    )
  })

  const publishPlan = Effect.fn('VistaClient.publishPlan')(function* (slug: string) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.publish.plan',
        PublishPlanInput,
        PublishPlan,
      )((env) => client['vista.publish.plan'](env), {
        ...app,
      }),
    )
  })

  const retire = Effect.fn('VistaClient.retire')(function* (slug: string) {
    const app = yield* identity(slug)
    return yield* withControl((client) =>
      wireCall(
        'vista.app.retire',
        SlugInput,
        RetireOk,
      )((env) => client['vista.app.retire'](env), app),
    )
  })
  const serviceInfo = Effect.fn('VistaClient.serviceInfo')(function* () {
    return yield* withControl((client) =>
      wireCall(
        'vista.service.info',
        NoPayload,
        ServiceInfo,
      )((env) => client['vista.service.info'](env), null),
    )
  })

  const runtimePolicy = Effect.fn('VistaClient.runtimePolicy')(function* () {
    return yield* withControl((client) =>
      wireCall(
        'vista.runtime.policy',
        NoPayload,
        RuntimePolicyInfo,
      )((env) => client['vista.runtime.policy'](env), null),
    )
  })

  const diagnoseImport = Effect.fn('VistaClient.diagnoseImport')(function* (specifier: string) {
    return yield* withControl((client) =>
      wireCall(
        'vista.import.diagnose',
        ImportDiagnosticInput,
        ImportDiagnosticInfo,
      )((env) => client['vista.import.diagnose'](env), { specifier }),
    )
  })

  const ask = Effect.fn('VistaClient.ask')(function* (input: Omit<AskInput, 'owner'>) {
    const { owner } = yield* identity(input.appId)
    return yield* withControl((client) =>
      wireCall(
        'vista.interview.ask',
        AskInput,
        AskResult,
      )((env) => client['vista.interview.ask'](env), { ...input, owner }),
    )
  })

  const awaitOnce = Effect.fn('VistaClient.awaitOnce')(function* (
    appId: string,
    questionId: string,
  ) {
    const { owner } = yield* identity(appId)
    return yield* withControl((client) =>
      wireCall(
        'vista.interview.await',
        AwaitInterviewInput,
        AwaitResult,
      )((env) => client['vista.interview.await'](env), {
        owner,
        appId,
        questionId,
      }),
    )
  })

  const awaitAnswered = Effect.fn('VistaClient.awaitAnswered')(function* (
    appId: string,
    questionId: string,
    deadlineMs = 600_000,
  ) {
    const until = Date.now() + deadlineMs
    while (Date.now() < until) {
      const result = yield* awaitOnce(appId, questionId)
      if (result._tag === 'answered') return { _tag: 'answered' as const, answer: result.answer }
    }
    return { _tag: 'timeout' as const }
  })

  const reviewPath = (owner: string, base: string, slug: string, version?: string): string => {
    const sel = version ?? 'latest'
    return `${trimTrailingSlash(base)}/r/${encodeRouteOwner(owner)}/${slug}/${sel}${sel === 'latest' ? '' : '/'}`
  }

  /**
   * The shared "is a app URL emittable, and from which base?" decision
   * (SVC-R14/SVC-R55), factored so `urlFor` and {@link ensureUrlEmittable} cannot
   * diverge — on EITHER the base selection or the fail-loud branch. Emission
   * needs a canonical base (`VISTA_PUBLIC_URL`/config file → `canonical: true`)
   * OR an explicit `--local`/`VISTA_LOCAL` opt-in (loopback → `canonical:
   * false`). When neither holds it fails `CanonicalUrlUnresolved` — this is the
   * single source of that fail-loud rule.
   */
  const resolveEmission = (
    options: { readonly local?: boolean } = {},
  ): Effect.Effect<
    { readonly base: string; readonly canonical: boolean },
    CanonicalUrlUnresolved
  > => {
    if (Option.isSome(publicBase)) {
      return Effect.succeed({ base: publicBase.value, canonical: true })
    }
    // SVC-R55: `--local` flag OR `VISTA_LOCAL` env either opts into local mode. The
    // CLI passes a concrete `local: false` when the flag is absent, so `||`
    // (not `??`) is required for the env-alone path to be honoured.
    const local = options.local || localDefault
    if (local) {
      return Effect.succeed({ base: serviceUrl, canonical: false })
    }
    return Effect.fail(
      new CanonicalUrlUnresolved({
        message:
          'no canonical tailnet URL is configured (VISTA_PUBLIC_URL is unset), so no cross-host app URL can be emitted',
      }),
    )
  }

  /**
   * Build the canonical app URL (SVC-R14/SVC-R55). Emits the canonical tailnet URL
   * from `VISTA_PUBLIC_URL` (`canonical: true`); when it is unset, fails loud
   * unless local mode is opted into, in which case it emits the loopback URL
   * marked `canonical: false` (never a silent dead loopback link).
   */
  const urlFor = Effect.fn('VistaClient.urlFor')(function* (
    slug: string,
    version?: string,
    options: { readonly local?: boolean } = {},
  ) {
    const owner = yield* resolveOwner
    const { base, canonical } = yield* resolveEmission(options)
    return { url: reviewPath(owner, base, slug, version), canonical }
  })

  /**
   * Precondition guard for the freeze-then-emit `publish` flow: succeeds iff a
   * later `urlFor` is guaranteed to emit, and otherwise fails EXACTLY as
   * `urlFor` would (same {@link resolveEmission} predicate). Callers run this
   * BEFORE the irreversible publish/freeze so a URL misconfiguration can never
   * leave a successful publish behind (which a `--local` retry would then
   * double-publish).
   */
  const ensureUrlEmittable = (
    options: { readonly local?: boolean } = {},
  ): Effect.Effect<void, CanonicalUrlUnresolved> => Effect.asVoid(resolveEmission(options))

  /** Diagnostic view of the canonical base for `vista debug service`. */
  const publicBaseInfo = Option.isSome(publicBase)
    ? `${publicBase.value} (canonical)`
    : 'unresolved — VISTA_PUBLIC_URL is unset'

  const rpcUrl = `${trimTrailingSlash(serviceUrl)}${CONTROL_RPC_PATH}`

  return {
    serviceUrl,
    rpcUrl,
    author,
    resolveOwner,
    list,
    get,
    getVersion,
    newApp,
    publish,
    publishPreview,
    rehydrate,
    publishPlan,
    retire,
    serviceInfo,
    runtimePolicy,
    diagnoseImport,
    ask,
    awaitOnce,
    awaitAnswered,
    urlFor,
    ensureUrlEmittable,
    publicBaseInfo,
  } as const
})

/**
 * Context service exposing the Vista client whose implementation is built by makeVistaClient and
 * provided through the Default layer.
 */
export class VistaClient extends Context.Service<
  VistaClient,
  Effect.Success<typeof makeVistaClient>
>()('Vista.Client') {
  static readonly Default = Layer.effect(VistaClient, makeVistaClient)
}
