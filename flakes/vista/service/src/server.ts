/**
 * The standing Vista service. Receipt-verified publication directories are the
 * only live-byte source for `/r/<owner>/<slug>/{latest,vN}`. One non-HTTP Vite
 * runtime derives semantic projections and loads data providers; it is never a
 * fallback serving path. Each draft has a separate Vite server with HMR and a
 * slug-scoped same-origin WebSocket.
 *
 * Provider routes remain live, but a published `/_data/<id>` request first
 * verifies the selected publication receipt. The app index at `/` lists owned
 * active and retired apps.
 */
import { randomUUID } from 'node:crypto'
import {
  constants,
  closeSync,
  fstatSync,
  openSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, isAbsolute, join, relative, sep } from 'node:path'

import { NodeHttpServer, NodeHttpServerRequest } from '@effect/platform-node'
import type { SemanticManifest } from '@vista/blocks/contract'
import type { GrafanaTraceConfig } from '@vista/blocks/shell'
import react from '@vitejs/plugin-react'
import { Context, Effect, Exit, Result, Layer, ManagedRuntime, Schema, Scope } from 'effect'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http'
import { RpcServer, RpcSerialization } from 'effect/rpc'
import { createServer as createViteServer, type Plugin, type ViteDevServer } from 'vite'

import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

import { resolveVistaBuildInfo, type VistaBuildInfo } from './build-info.ts'
import { readVistaChangelogCompanion, VISTA_CHANGELOG_FILE } from './changelog-companion.ts'
import {
  createVistaControlHandler,
  createVistaReadHandler,
  resolveControlAppSource,
} from './control-server.ts'
import { decodeRouteOwner, encodeOwner, encodeRouteOwner, OwnerIdentity, Slug } from './control.ts'
import { bindingsFromManifest } from './data/app.ts'
import {
  createProviderRegistry,
  providerSsrProxy,
  resolveProvider,
  type ProviderRegistry,
  type ProviderRegistryManager,
} from './data/mount.ts'
import { deriveProjection, type DerivedProjection } from './derive-projection.ts'
import { vistaFaviconPath } from './favicon.ts'
import { resolveVistaGrafanaConfig } from './grafana-config.ts'
import { renderIndex, renderPublicationFailure } from './index-page.ts'
import { handleInterview } from './interview/endpoints.ts'
import { createInterviewStore, type InterviewStore } from './interview/store.ts'
import { cacheDir, depsNodeModules, blocksDir, appsDir, appsNodeModules, root } from './paths.ts'
import { decodePublicationSemanticManifestJson } from './publication-semantics.ts'
import {
  inspectStaticPublication,
  invalidateVerifiedPublications,
  projectVerifiedPublicationFile,
  readVerifiedPublicationFile,
  resolveVerifiedStaticPublicationFile,
  verifyPublishedProviderModule,
  type VerifiedPublicationIndex,
} from './publish.ts'
import { latestMeta, scanAll, scanApp, versionDir, type AppState } from './registry.ts'
import { makeBrowserMountSmoke } from './render-smoke.ts'
import {
  INSPECTOR_RPC_PATH,
  makeVistaRpcExplorer,
  rpcRouteFromPath,
  withRpcRoute,
  type VistaRpcExplorer,
} from './rpc-explorer.ts'
import { actorSource } from './runtime-facts.ts'
import {
  vistaRuntimePolicy,
  vistaViteResolveConfig,
  validateVistaAppSource,
} from './runtime-policy/index.ts'
import {
  vistaDependencyAnchorResolver,
  vistaRuntimeImportPolicy,
} from './runtime-policy/vite-plugin.ts'
import { semanticExtractor } from './semantic-extractor.ts'

/** Authored service imports are shipped separately from the compiled Bun entrypoint. */
const SERVICE_SRC = join(root(), 'flakes', 'vista', 'service', 'src')

/** Memoize a zero-arg thunk so its (filesystem/policy) work runs at most once, lazily. */
const once = <T>(f: () => T): (() => T) => {
  let value: T
  let done = false
  return () => {
    if (!done) {
      value = f()
      done = true
    }
    return value
  }
}

const runtimeFsAllow = once((): string[] => {
  const overrides = {
    'flakes/vista/blocks': blocksDir(),
  } as const
  return [
    SERVICE_SRC,
    ...vistaRuntimePolicy().installed.workspaceClosureDirs.map(
      (dir) => overrides[dir as keyof typeof overrides] ?? join(root(), dir),
    ),
  ]
})

/** effect packages stay external so SSR providers share one realm with the host. */
const ssrExternal = once((): string[] => [...vistaRuntimePolicy().ssrExternal])

/**
 * Seed for the draft dep-optimizer: the optimize roots the Genie-projected
 * runtime policy already carries (decision 0044). Discovery stays on (0052), so
 * nothing is missed; seeding only lets a cold draft converge in one optimizer
 * pass instead of one pass per lazily discovered dep family.
 */
const optimizeInclude = once((): string[] => [...vistaRuntimePolicy().optimizeInclude])

/**
 * Hosts Vite's dev-server Host header check accepts (`server.allowedHosts`). Vista
 * is served over the tailnet at `https://vista.<tailnet>/...` and reached by its
 * MagicDNS name (e.g. `dev3.tail8108.ts.net`), so the default allows Tailscale
 * MagicDNS (the `.ts.net` suffix, Vite's leading-dot subdomain syntax) plus
 * localhost/127.0.0.1 for local dev. We deliberately do NOT use `allowedHosts:
 * true` — that disables the DNS-rebinding guard entirely. A `.ts.net` literal in
 * the IP path (e.g. `100.x.y.z`) bypasses the check in Vite already, so this list
 * only governs hostname access. `VISTA_ALLOWED_HOSTS` (comma-separated) overrides
 * the default for other tailnet/proxy fronts.
 */
const ALLOWED_HOSTS: string[] = (process.env.VISTA_ALLOWED_HOSTS ?? '.ts.net,localhost,127.0.0.1')
  .split(',')
  .map((h) => h.trim())
  .filter((h) => h.length > 0)

/**
 * Shared resolve config. `dedupe` keeps React a singleton across the declarative
 * renderer and the escape hatch (decision 0006). Aliases resolve first-class
 * workspace runtime packages to their source. External deps still resolve by the
 * normal walk-up to the shared `node_modules`; we do not maintain an arbitrary
 * per-review dep alias map (decisions 0006/0017/0025).
 */
const resolveConfig = once(() => ({
  dedupe: [...vistaViteResolveConfig().dedupe],
  alias: vistaViteResolveConfig().alias,
}))

/** Evaluate public app imports through the Node-safe semantic surface. */
const semanticResolveConfig = once(() => ({
  dedupe: [...vistaViteResolveConfig().dedupe],
  alias: {
    ...vistaViteResolveConfig().alias,
    '@vista/blocks': join(blocksDir(), 'src', 'internal-authoring.ts'),
  },
}))
/**
 * Shared mutable state of the standing service: per-slug app state, the canonical build identity,
 * the published non-HTTP Vite runtime used for projection and provider loading, and per-review
 * live draft servers (with coalescing bookkeeping for in-flight draft creations).
 */
export interface ServiceState {
  apps: Map<string, AppState>
  /** Canonical package build identity injected into every AppShell bootstrap. */
  readonly buildInfo: VistaBuildInfo
  /** The non-HTTP Vite runtime used for projection and provider module loading. */
  readonly published: ViteDevServer
  /** Per-slug live draft servers (HMR + watch); the only per-review servers. */
  readonly drafts: Map<string, ViteDevServer>
  /**
   * In-flight draft creations. A cold draft load issues parallel requests before
   * the first `createViteServer` resolves; without coalescing, each would build
   * its own server and attach a second HMR upgrade listener for the same path.
   */
  readonly draftsPending: Map<string, Promise<ViteDevServer>>
  /** SSR-mounted data providers, keyed by id (decision 0027). */
  readonly providers: ProviderRegistryManager
  /** Typed control-plane RPC: CLI/agent/browser-shell operations. */
  readonly control: {
    readonly handler: (req: Request) => Promise<Response>
    readonly dispose: () => Promise<void>
  }
  /** One service-wide observer, shared by control and every mounted provider. */
  readonly explorer: VistaRpcExplorer
  /** Separate undecorated inspector transport, excluded from observation. */
  readonly inspector: {
    readonly handler: (req: Request) => Promise<Response>
    readonly dispose: () => Promise<void>
  }
  /** Separate allowlisted read-only RPC surface. */
  readonly read: {
    readonly handler: (req: Request) => Promise<Response>
    readonly dispose: () => Promise<void>
  }
  /** The interview question store (decision 0013) — one store, shared by agent + browser. */
  readonly interview: InterviewStore
}

/** `/r/<encoded-owner>/<slug>/(draft|latest|vN)/...`. */
const ownedRouteRe = /^\/r\/([^/]+)\/([a-z0-9][a-z0-9-]*)\/(draft|latest|v\d+)(\/.*)?$/

const appKey = (owner: string, slug: string): string => `${encodeRouteOwner(owner)}/${slug}`

const readApp = (owner: OwnerIdentity, slug: Slug): AppState | null => scanApp(owner, slug)

const isLoopbackRequest = (req: IncomingMessage): boolean =>
  req.socket.remoteAddress === '127.0.0.1' ||
  req.socket.remoteAddress === '::1' ||
  req.socket.remoteAddress === '::ffff:127.0.0.1'

const send = (res: ServerResponse, code: number, body: string, type = 'text/plain'): void => {
  res.statusCode = code
  res.setHeader('content-type', type)
  res.end(body)
}

const sendPublicationFailure = (
  res: ServerResponse,
  owner: string,
  slug: string,
  version: number,
  rest: string,
  failure: 'receiptless' | 'untrusted',
): void => {
  res.setHeader('cache-control', 'no-store')
  if (isBootstrapPath(rest)) {
    return send(
      res,
      409,
      renderPublicationFailure({ owner, slug, version, failure }),
      'text/html; charset=utf-8',
    )
  }
  return send(
    res,
    409,
    failure === 'receiptless'
      ? 'publication receipt unavailable'
      : 'publication trust verification failed',
  )
}

const redirect = (res: ServerResponse, location: string): void => {
  res.statusCode = 302
  res.setHeader('location', location)
  res.end()
}

const staticContentType = (path: string): string => {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    default:
      return 'application/octet-stream'
  }
}

const serveStaticVersion = (
  req: IncomingMessage,
  res: ServerResponse,
  owner: OwnerIdentity,
  slug: Slug,
  version: number,
  rest: string,
): 'served' | 'missing' | 'receiptless' | 'untrusted' | 'invalid' => {
  const verification = inspectScopedStatic(owner, slug, version)
  if (verification._tag !== 'verified') return verification._tag
  let path: string | null
  try {
    path = resolveVerifiedStaticPublicationFile(verification.receipt, rest)
  } catch {
    return 'invalid'
  }
  if (path === null) return 'missing'
  let file
  try {
    file = readVerifiedPublicationFile(verification.index, path)
  } catch (cause) {
    console.error('publication trust verification failed', {
      owner,
      slug,
      version,
      reason: cause instanceof Error ? cause.message : String(cause),
    })
    return 'untrusted'
  }
  if (file === null) {
    console.error('publication trust verification failed', {
      owner,
      slug,
      version,
      reason: 'requested publication file is absent from the verified inventory',
    })
    return 'untrusted'
  }
  res.statusCode = 200
  res.setHeader('content-type', staticContentType(file.path))
  if (req.method === 'HEAD') res.end()
  else res.end(projectVerifiedPublicationFile(verification.index, file))
  return 'served'
}

const appTitle = (st: AppState): string =>
  latestMeta(st)?.title ??
  st.versions.toReversed().find((version) => version.title)?.title ??
  st.slug

/**
 * Typed contract for the browser index's `/_vista/apps` feed (Track B3). The
 * shape is the nested `slug × versions` app row the index shell renders; encoding
 * the built body through it makes a drift in the projection a decode error at the
 * serving seam instead of a silently malformed page. It stays a serving response
 * (0065), NOT a control-RPC procedure, so it lives with the route rather than in
 * `VistaControlApi`. Optional `currentSlug`/`currentVersion`/`retired` encode as
 * absent keys (never `null`), preserving the exact prior wire.
 */
const AppRowVersion = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  title: Schema.optional(Schema.String),
  timestamp: Schema.String,
  publisher: Schema.String,
  changeSummary: Schema.String,
}).annotate({ identifier: 'Vista.AppsFeed.Version' })

const AppRow = Schema.Struct({
  owner: OwnerIdentity,
  routeKey: Schema.String,
  slug: Slug,
  title: Schema.String,
  // Served-feed wire (0065): `latest` is the registry's `vN` version number, or `null`
  // when the app has no published version yet.
  latest: Schema.NullOr(Schema.Finite),
  retired: Schema.optional(Schema.Literal(true)),
  versions: Schema.Array(AppRowVersion),
}).annotate({ identifier: 'Vista.AppsFeed.AppRow' })

const AppsFeed = Schema.Struct({
  currentSlug: Schema.optional(Schema.String),
  currentVersion: Schema.optional(Schema.String),
  apps: Schema.Array(AppRow),
  currentOwner: Schema.optional(Schema.String),
}).annotate({ identifier: 'Vista.AppsFeed' })

const encodeAppsFeed = Schema.encodeSync(AppsFeed)

const renderAppsJson = (apps: Map<string, AppState>, query: URLSearchParams): string =>
  JSON.stringify(
    encodeAppsFeed({
      currentOwner: query.get('owner') ?? undefined,
      currentSlug: query.get('slug') ?? undefined,
      currentVersion: query.get('version') ?? undefined,
      apps: [...apps.values()]
        .toSorted((a, b) =>
          a.owner === b.owner ? a.slug.localeCompare(b.slug) : a.owner.localeCompare(b.owner),
        )
        .map((app) => ({
          owner: app.owner,
          routeKey: appKey(app.owner, app.slug),
          slug: app.slug,
          title: appTitle(app),
          latest: app.latest,
          retired: app.retired || undefined,
          versions: app.versions.map((version) => ({
            id: `v${version.version}`,
            label: `v${version.version}`,
            title: version.title,
            timestamp: version.timestamp,
            publisher: version.author,
            changeSummary: version.changeSummary,
          })),
        })),
    }),
  )
/**
 * Ensure the apps-root `node_modules` symlink points at THIS service
 * generation's shared dep closure (0006). Must be self-healing across deploys:
 * each deploy ships a new `depsNodeModules()` store path and older generations are
 * eventually GC'd. A create-if-absent symlink is not enough — a stale link left
 * pointing at a GC'd workspace makes Vite resolve app deps (react, …) as
 * un-externalizable source and inline their CJS entry (`module is not defined`),
 * blanking every fresh publish. Note `existsSync` follows the link, so a dangling
 * link reads as absent yet `symlinkSync` then throws `EEXIST` on the link node —
 * the old create-if-absent guard could never replace it. So we read the current
 * target and atomically retarget whenever it differs (absent, dangling, or an old
 * generation), replacing via temp-symlink + rename so a concurrent request never
 * observes a missing link. On an actual retarget the disposable optimizer cache
 * (decision 0029) is discarded, since its metadata references the old workspace.
 */
const ensureDepsSymlink = (): void => {
  mkdirSync(appsDir(), { recursive: true })
  let current: string | undefined
  try {
    current = readlinkSync(appsNodeModules())
  } catch {
    /* not a symlink or absent → treat as needing (re)creation */
  }
  if (current === depsNodeModules()) return

  const tmp = `${appsNodeModules()}.tmp-${process.pid}`
  try {
    rmSync(tmp, { force: true })
    symlinkSync(depsNodeModules(), tmp)
    renameSync(tmp, appsNodeModules())
  } catch {
    /* a concurrent publisher may have retargeted it first; harmless */
    rmSync(tmp, { force: true })
    return
  }

  // Deps changed under the disposable optimizer cache → drop it so a stale
  // prebundle keyed to the old workspace can't shadow the fresh closure.
  rmSync(cacheDir(), { recursive: true, force: true })
}

const inspectScopedStatic = (owner: OwnerIdentity, slug: Slug, version: number) => {
  const verification = inspectStaticPublication(owner, slug, version)
  if (verification._tag === 'untrusted') {
    console.error('publication trust verification failed', {
      owner,
      slug,
      version,
      reason: verification.reason,
    })
  }
  return verification
}

/**
 * Upstream StyleX keeps its dev CSS collector alive until `server.httpServer`
 * closes. Draft Vite servers run in middleware mode, so their own httpServer is
 * null while HMR uses Vista's long-lived shared server. Give StyleX a dedicated
 * lifecycle emitter and close it with the draft plugin container instead.
 */
const draftStylexVitePlugins = (appSource: string, base: string): Plugin[] => {
  const lifecycleServer = new http.Server()
  const [compiler, ...support] = createStylexVitePlugins({
    externalPackages: [
      '@vista/blocks',
      '@vista/ui',
      '@overeng/agent-timeline',
      '@overeng/devbar',
      '@overeng/effect-rpc-explorer-react',
      '@overeng/stylex-tokens',
    ],
    entries: [join(appSource, 'app.tsx')],
  }) as Plugin[]
  if (compiler === undefined || typeof compiler.configureServer !== 'function') {
    throw new Error('StyleX compiler no longer exposes the expected configureServer lifecycle hook')
  }
  const configureServer = compiler.configureServer
  const load = compiler.load
  if (typeof load !== 'function') {
    throw new Error('StyleX compiler no longer exposes the expected virtual runtime load hook')
  }
  let closed = false

  return [
    {
      ...compiler,
      configureServer(server) {
        // StyleX registers before Vite strips `base`, but its CSS middleware
        // only recognizes a root URL. Adapt only that draft-scoped endpoint;
        // all other requests retain their original URL and routing semantics.
        const middlewares = Object.assign(Object.create(server.middlewares), {
          use(
            handler: (
              req: IncomingMessage,
              res: ServerResponse,
              next: (error?: unknown) => void,
            ) => void,
          ) {
            server.middlewares.use((req, res, next) => {
              const originalUrl = req.url
              const pathname = originalUrl?.split('?')[0]
              if (pathname === '/virtual:stylex.css') return next()
              if (pathname !== `${base}virtual:stylex.css`) return handler(req, res, next)
              req.url = originalUrl?.slice(base.length - 1)
              return handler(req, res, (error) => {
                req.url = originalUrl
                next(error)
              })
            })
            return middlewares
          },
        })
        // Vite exposes middleware state through accessors. A read-only view
        // avoids assigning through those setters into the real server.
        const lifecycleView = new Proxy(server, {
          get(target, property, receiver) {
            if (property === 'httpServer') return lifecycleServer
            if (property === 'middlewares') return middlewares
            return Reflect.get(target, property, receiver)
          },
        })
        return configureServer.call(this, lifecycleView)
      },
      async load(id, ...args) {
        const result = await load.call(this, id, ...args)
        if (!id.includes('virtual:stylex:runtime') && !id.includes('virtual:stylex:css-only')) {
          return result
        }
        // The upstream runtime fetches root CSS. Keep it relative to the
        // draft document, so neither initial load nor HMR escapes its owner.
        return typeof result === 'string'
          ? result.replaceAll("'/virtual:stylex.css'", "'./virtual:stylex.css'")
          : result && {
              ...result,
              code: result.code.replaceAll("'/virtual:stylex.css'", "'./virtual:stylex.css'"),
            }
      },
    },
    ...support,
    {
      name: 'vista-draft-stylex-lifecycle',
      closeBundle() {
        if (closed) return
        closed = true
        lifecycleServer.emit('close')
      },
    },
  ]
}

const draftBootstrap = (
  base: string,
  appSource: string,
  initialProjection: DerivedProjection,
  refreshProjection: () => Promise<DerivedProjection>,
  buildInfo: VistaBuildInfo,
  changelogHref: string,
  grafana: GrafanaTraceConfig | undefined,
): Plugin => {
  let projection = initialProjection
  let sourceRevision = 0
  let projectedRevision = 0
  let refreshInFlight: Promise<void> | undefined
  // Coalesce concurrent module loads. If another source edit lands while a
  // projection is deriving, the revision loop derives again before returning.
  const currentProjection = async (): Promise<DerivedProjection> => {
    for (;;) {
      if (projectedRevision === sourceRevision) return projection
      if (refreshInFlight === undefined) {
        const revision = sourceRevision
        refreshInFlight = refreshProjection()
          .then((refreshed) => {
            projection = refreshed
            projectedRevision = revision
          })
          .finally(() => {
            refreshInFlight = undefined
          })
      }
      await refreshInFlight
    }
  }

  const publicId = 'virtual:vista-draft-entry.tsx'
  const resolvedId = `\0${publicId}`
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" type="image/svg+xml" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/${publicId}"></script>
  </body>
</html>
`
  return {
    name: 'vista-draft-bootstrap',
    enforce: 'pre',
    resolveId: (id, importer) =>
      id === publicId &&
      (importer === undefined || importer.split('?', 1)[0]?.endsWith('/index.html') === true)
        ? resolvedId
        : undefined,
    load: async (id) => {
      if (id !== resolvedId) return undefined
      const current = await currentProjection()
      return `import '@vista/ui/document.css'
import '@overeng/effect-rpc-explorer-react/styles.css'
import { AppShell, serviceHostRuntime, VistaHostRuntimeProvider } from '@vista/blocks/shell'
import { DataRuntimeProvider, Snapshot } from '@vista/blocks/query'
import { Schema } from 'effect'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import AuthoredApp from ${JSON.stringify(join(appSource, 'app.tsx'))}

const snapshot = Schema.decodeUnknownSync(Snapshot, { onExcessProperty: 'error' })({
  apiVersion: 2,
  frozenAt: '1970-01-01T00:00:00.000Z',
  entries: {},
})

createRoot(document.getElementById('root')).render(
  createElement(
    VistaHostRuntimeProvider,
    { value: serviceHostRuntime },
    createElement(
    AppShell,
    {
      title: ${JSON.stringify(current.title)},
      status: ${JSON.stringify(current.status)},
      buildInfo: ${JSON.stringify(buildInfo)},
      changelogHref: ${JSON.stringify(changelogHref)},
      grafana: ${JSON.stringify(grafana)},
    },
    createElement(
      DataRuntimeProvider,
      {
        actorSource: ${JSON.stringify(actorSource())},
        appVersionId: ${JSON.stringify(base.slice(3, -1))},
        dataBaseUrl: ${JSON.stringify(`${base}_data/`)},
        snapshot,
      },
      createElement(AuthoredApp),
    ),
    ),
  ),
)
`
    },
    handleHotUpdate: (context) => {
      const sourceRelative = relative(appSource, context.file)
      if (
        sourceRelative === '..' ||
        sourceRelative.startsWith(`..${sep}`) ||
        isAbsolute(sourceRelative)
      ) {
        return
      }

      sourceRevision += 1
      const entry = context.server.moduleGraph.getModuleById(resolvedId)
      if (entry !== undefined) context.server.moduleGraph.invalidateModule(entry)
      context.server.ws.send({ type: 'full-reload' })
      return []
    },
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?', 1)[0]
        if (
          path !== base &&
          path !== `${base}index.html` &&
          path !== '/' &&
          path !== '/index.html'
        ) {
          return next()
        }
        void server.transformIndexHtml(base, html).then(
          (transformed) => {
            res.statusCode = 200
            res.setHeader('content-type', 'text/html; charset=utf-8')
            res.end(transformed)
          },
          (cause: unknown) => next(cause instanceof Error ? cause : new Error(String(cause))),
        )
      })
    },
  }
}

const ensureDraft = async (
  state: ServiceState,
  owner: OwnerIdentity,
  slug: Slug,
  appRoot: string,
  httpServer: http.Server,
): Promise<ViteDevServer> => {
  const key = appKey(owner, slug)
  const existing = state.drafts.get(key)
  if (existing) return existing
  const pending = state.draftsPending.get(key)
  if (pending) return pending
  const creation = createDraft(state, owner, slug, appRoot, httpServer).finally(() => {
    state.draftsPending.delete(key)
  })
  state.draftsPending.set(key, creation)
  return creation
}

const createDraft = async (
  state: ServiceState,
  owner: OwnerIdentity,
  slug: Slug,
  appRoot: string,
  httpServer: http.Server,
): Promise<ViteDevServer> => {
  const key = appKey(owner, slug)
  validateVistaAppSource(appRoot)
  await state.providers.ensureVersion({ owner, slug, version: 'draft' }, join(appRoot, 'providers'))
  const refreshProjection = () =>
    deriveProjection(state.published, join(appRoot, 'app.tsx'), {
      invalidate: true,
    })
  const projection = await refreshProjection()
  const base = `/r/${key}/draft/`
  // Vite forms the HMR WS endpoint as `posix.join(base, server.ws.path)` on
  // both sides, then matches the upgrade pathname exactly. `path` is therefore
  // a bare suffix. Each draft attaches one identity-scoped upgrade listener to
  // Vista's shared HTTP server, so drafts coexist without a second port.
  const hmrPath = '__vista_hmr__'
  const draft = await createViteServer({
    root: appRoot,
    base,
    configFile: false,
    appType: 'custom',
    // Optimizer URLs expose this absolute path via @fs: keep its owner/slug
    // components unreserved without changing the authored source layout.
    cacheDir: join(cacheDir(), 'draft', encodeRouteOwner(owner), slug),
    plugins: [
      draftBootstrap(
        base,
        appRoot,
        projection,
        refreshProjection,
        state.buildInfo,
        `./${VISTA_CHANGELOG_FILE}`,
        resolveVistaGrafanaConfig(),
      ),
      vistaRuntimeImportPolicy(appRoot),
      vistaDependencyAnchorResolver(dirname(depsNodeModules())),
      ...draftStylexVitePlugins(appRoot, base),
      react(),
    ],
    resolve: resolveConfig(),
    // Auto-discovery (decision 0052) seeded with the Genie-projected optimize
    // roots (decision 0044): Vite still scans the true transitive graph and
    // prebundles every dep with correct interop; the seed only reduces the
    // number of cold-load optimizer passes. Nothing here is hand-maintained.
    optimizeDeps: { include: optimizeInclude() },
    ssr: {
      external: ssrExternal(),
      noExternal: [
        '@vista/blocks',
        '@vista/ui',
        '@overeng/devbar',
        '@overeng/effect-rpc-explorer-react',
        '@overeng/stylex-tokens',
      ],
    },
    server: {
      middlewareMode: true,
      allowedHosts: ALLOWED_HOSTS,
      // Drafts are disposable and may close while a browser is still loading.
      // Do not launch background transforms that Vite must drain during close.
      preTransformRequests: false,
      // `server.ws` owns the transport, while a null client port makes Vite's
      // browser client infer the page origin through loopback and HTTPS fronts.
      ws: { server: httpServer, path: hmrPath },
      fs: {
        allow: [appsDir(), depsNodeModules(), cacheDir(), ...runtimeFsAllow()],
        strict: false,
      },
    },
  })
  state.drafts.set(key, draft)
  return draft
}

/** Evict an owned app's draft server (frees its watcher/cache). */
export const evictDraft = async (
  state: ServiceState,
  owner: OwnerIdentity,
  slug: Slug,
): Promise<void> => {
  const key = appKey(owner, slug)
  const draft = state.drafts.get(key)
  if (draft) {
    await draft.close()
    state.drafts.delete(key)
  }
  await state.providers.closeVersion({ owner, slug, version: 'draft' })
}

class PublishedProviderVerificationError extends Error {}

/** Verify the complete publication-owned provider graph before Vite evaluates its entry. */
const publishedProviderVerifier =
  (index: VerifiedPublicationIndex) =>
  (modulePath: string): void => {
    const serviceProviders = join(SERVICE_SRC, 'data', 'providers')
    const serviceRelative = relative(serviceProviders, modulePath)
    if (
      serviceRelative !== '..' &&
      !serviceRelative.startsWith(`..${sep}`) &&
      !isAbsolute(serviceRelative)
    ) {
      return
    }

    const absolutePath =
      modulePath === index.directory || modulePath.startsWith(`${index.directory}${sep}`)
        ? modulePath
        : join(appsDir(), modulePath.replace(/^[/\\]+/, ''))
    const publicationRelative = relative(index.directory, absolutePath)
    if (
      publicationRelative === '..' ||
      publicationRelative.startsWith(`..${sep}`) ||
      isAbsolute(publicationRelative)
    ) {
      throw new PublishedProviderVerificationError(
        `provider module is outside the verified publication: ${modulePath}`,
      )
    }
    try {
      verifyPublishedProviderModule(index, absolutePath)
    } catch (cause) {
      throw new PublishedProviderVerificationError(
        `published provider integrity verification failed: ${modulePath}`,
        { cause },
      )
    }
  }

const declaredPtySessions = (manifest: SemanticManifest): readonly string[] => [
  ...new Set(
    bindingsFromManifest(manifest)
      .filter((binding) => binding.provider === 'pty' && binding.operation === 'screen')
      .flatMap((binding) => {
        if (typeof binding.args !== 'object' || binding.args === null) return []
        const sessionId = Reflect.get(binding.args, 'sessionId')
        return typeof sessionId === 'string' && sessionId !== '' ? [sessionId] : []
      }),
  ),
]

const publishedPtySessions = (index: VerifiedPublicationIndex): readonly string[] => {
  const manifestFile = readVerifiedPublicationFile(
    index,
    join(index.directory, index.receipt.semantics.path),
  )
  if (manifestFile === null) throw new Error('published semantic manifest is absent')
  const decoded = decodePublicationSemanticManifestJson(manifestFile.bytes.toString('utf8'))
  if (Result.isFailure(decoded)) {
    throw new Error(`published semantic manifest is invalid: ${String(decoded.failure)}`)
  }
  return declaredPtySessions(decoded.success)
}

const viewerCookie = (req: IncomingMessage): string | undefined => {
  const cookie = req.headers.cookie
  if (cookie === undefined) return undefined
  for (const part of cookie.split(';')) {
    const [name, value] = part.trim().split('=', 2)
    if (name === 'vista_livepty_viewer' && value !== undefined && value !== '') return value
  }
  return undefined
}

const trustedViewer = (
  req: IncomingMessage,
  mint: boolean,
): {
  readonly actor?: string
  readonly source?: 'loopback-dev' | 'tailscale'
  readonly setCookie?: string
} => {
  const source = actorSource()
  if (source === 'tailscale' && isLoopbackRequest(req)) {
    const login = req.headers['tailscale-user-login']
    if (typeof login === 'string' && login.trim() !== '') {
      return { actor: `tailscale:${login}`, source }
    }
    return {}
  }
  if (source !== 'loopback-dev' || !isLoopbackRequest(req)) return {}
  const existing = viewerCookie(req)
  if (existing !== undefined) return { actor: `local:${existing}`, source }
  if (!mint) return {}
  const id = randomUUID()
  return {
    actor: `local:${id}`,
    source,
    setCookie: `vista_livepty_viewer=${id}; Path=/; HttpOnly; SameSite=Lax`,
  }
}

/**
 * Mint the local identity on the serialized HTML bootstrap response. Data calls
 * only consume this cookie; they never race to replace it while the page starts.
 */
const establishViewerIdentity = (req: IncomingMessage, res: ServerResponse): void => {
  const viewer = trustedViewer(req, true)
  if (viewer.setCookie !== undefined) res.setHeader('set-cookie', viewer.setCookie)
}

const isBootstrapPath = (rest: string): boolean =>
  rest === '' || rest === '/' || rest === '/index.html'

const handleData = async (
  registry: ProviderRegistry,
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
  ptySessions: readonly string[] = [],
): Promise<void> => {
  const mounted = resolveProvider(registry, id)
  if (!mounted) return send(res, 404, `unknown provider: ${id}`)
  try {
    await registry.ensureFresh(mounted.id)
  } catch (cause) {
    if (cause instanceof PublishedProviderVerificationError) {
      return send(res, 409, 'publication trust verification failed')
    }
    throw cause
  }
  const fresh = resolveProvider(registry, id)!
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (
      k === 'x-vista-trusted-actor' ||
      k === 'x-vista-trusted-actor-source' ||
      k === 'x-vista-app-version'
    )
      continue
    if (typeof v === 'string') headers.set(k, v)
    else if (Array.isArray(v)) headers.set(k, v.join(', '))
  }
  const viewer = trustedViewer(req, false)
  if (viewer.actor !== undefined) headers.set('x-vista-trusted-actor', viewer.actor)
  if (viewer.source !== undefined) headers.set('x-vista-trusted-actor-source', viewer.source)
  const identity = registry.identity
  headers.set(
    'x-vista-app-version',
    identity === 'service' ? 'service' : `${identity.owner}/${identity.slug}/${identity.version}`,
  )
  if (id === 'pty') {
    headers.set('x-vista-declared-pty-sessions', JSON.stringify(ptySessions))
  }
  const abort = new AbortController()
  req.once('aborted', () => abort.abort())
  const init: RequestInit = { method: req.method ?? 'GET', headers, signal: abort.signal }
  if (body) init.body = new Uint8Array(body)
  const providerUrl = new URL(req.url ?? '/', 'http://localhost')
  providerUrl.pathname = `/_data/${id}${providerUrl.pathname.endsWith('/') ? '/' : ''}`
  const webReq = new Request(providerUrl, init)
  const webRes = await withRpcRoute(rpcRouteFromPath(req.url ?? '') ?? 'service', () =>
    fresh.handler(webReq),
  )
  if (res.destroyed || res.writableEnded || res.headersSent) {
    await webRes.body?.cancel()
    return
  }
  res.statusCode = webRes.status
  webRes.headers.forEach((value, key) => res.setHeader(key, value))
  if (webRes.body === null) {
    res.end()
    return
  }
  const reader = webRes.body.getReader()
  res.once('close', () => void reader.cancel())
  while (!res.destroyed) {
    const chunk = await reader.read()
    if (chunk.done) break
    if (!res.write(Buffer.from(chunk.value))) {
      await new Promise<void>((resolve) => res.once('drain', resolve))
    }
  }
  if (!res.destroyed) res.end()
}

const toWebRequest = async (
  req: IncomingMessage,
  origin = 'http://localhost',
): Promise<Request> => {
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v)
    else if (Array.isArray(v)) headers.set(k, v.join(', '))
  }
  const init: RequestInit = { method: req.method ?? 'GET', headers }
  if (body) init.body = new Uint8Array(body)
  return new Request(`${origin}${req.url ?? '/'}`, init)
}

const sendWebResponse = async (res: ServerResponse, webRes: Response): Promise<void> => {
  if (res.destroyed || res.writableEnded || res.headersSent) {
    await webRes.body?.cancel()
    return
  }
  res.statusCode = webRes.status
  webRes.headers.forEach((value, key) => res.setHeader(key, value))
  if (webRes.body === null) {
    res.end()
    return
  }
  const reader = webRes.body.getReader()
  res.once('close', () => void reader.cancel())
  while (!res.destroyed) {
    const chunk = await reader.read()
    if (chunk.done) break
    if (!res.write(Buffer.from(chunk.value))) {
      await new Promise<void>((resolve) => res.once('drain', resolve))
    }
  }
  if (!res.destroyed) res.end()
}

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

/** Parse the raw query string off a node request URL. */
const queryOf = (url: string): URLSearchParams =>
  new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')

const serveHealth = (res: ServerResponse): void =>
  send(res, 200, JSON.stringify({ ok: true, actorSource: actorSource() }), 'application/json')

const serveChangelog = (res: ServerResponse): void => {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(readVistaChangelogCompanion())
}

/** Serve the canonical Vista color SVG for browsers' conventional favicon request. */
const serveFavicon = (res: ServerResponse): void => {
  res.statusCode = 200
  res.setHeader('content-type', 'image/svg+xml')
  res.end(readFileSync(vistaFaviconPath()))
}

const serveApps = (state: ServiceState, req: IncomingMessage, res: ServerResponse): void => {
  state.apps = scanAll()
  send(res, 200, renderAppsJson(state.apps, queryOf(req.url ?? '/')), 'application/json')
}

const serveControl = async (
  state: ServiceState,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> =>
  sendWebResponse(
    res,
    await withRpcRoute('control', async () => state.control.handler(await toWebRequest(req))),
  )

const serveInspector = async (
  state: ServiceState,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => sendWebResponse(res, await state.inspector.handler(await toWebRequest(req)))

const serveRead = async (
  state: ServiceState,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => sendWebResponse(res, await state.read.handler(await toWebRequest(req)))

// Interview browser bridge (decisions 0013/0038): agent `ask`/`await` commands
// cross `VistaControlApi`; the browser still polls pending questions and posts
// scoped answers against the same in-service store. An unhandled path is a 404 —
// the same outcome the old fall-through produced.
const serveInterview = async (
  state: ServiceState,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const url = req.url ?? '/'
  const path = url.split('?')[0]!
  if (await handleInterview(state.interview, req, res, path, queryOf(url))) return
  send(res, 404, 'not found')
}

// App index (decision 0028): rebuilt from disk so it is always current (SVC-R18).
const serveIndex = (state: ServiceState, res: ServerResponse): void => {
  state.apps = scanAll()
  send(res, 200, renderIndex(state.apps), 'text/html')
}

/**
 * Route-owned review gateway (decision 0065). Published surfaces serve only
 * receipt-verified static files. Draft surfaces delegate to their scoped Vite
 * middleware. The Effect router sends all unmatched requests here.
 */
const serveReview = async (
  state: ServiceState,
  httpServer: http.Server,
  port: number,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const url = req.url ?? '/'
  const path = url.split('?')[0]!

  // Vite internals are draft-only and must never escape through the global route.
  if (/^\/r\/(?:@fs\/|@id\/|@vite\/|@react-refresh|\.vite\/|node_modules\/)/.test(path)) {
    return send(res, 404, 'not found')
  }

  const match = ownedRouteRe.exec(path)
  if (match === null) return send(res, 404, 'not found')
  let owner: OwnerIdentity
  try {
    const decodedOwner = decodeRouteOwner(match[1]!)
    if (decodedOwner === undefined) return send(res, 400, 'invalid owner encoding')
    owner = Schema.decodeSync(OwnerIdentity)(decodedOwner)
  } catch {
    return send(res, 400, 'invalid owner identity')
  }
  const decodedSlug = Schema.decodeResult(Slug)(match[2]!)
  if (Result.isFailure(decodedSlug)) return send(res, 400, 'invalid slug')
  const slug = decodedSlug.success
  const canonicalOwner = encodeRouteOwner(owner)
  if (match[1] !== canonicalOwner) {
    res.statusCode = 308
    res.setHeader('location', `/r/${canonicalOwner}${url.slice(3 + match[1]!.length)}`)
    res.end()
    return
  }
  const sel = match[3]!
  const rest = match[4] ?? ''
  const key = appKey(owner, slug)
  const routeBase = `/r/${key}`

  // `/_data/<id>` under any surface → provider call.
  const dm = /^\/_data\/([a-z0-9][a-z0-9-]*)\/?$/.exec(rest)
  const st = readApp(owner, slug)

  if (sel === 'draft') {
    if (st?.retired) {
      await evictDraft(state, owner, slug)
      return send(res, 410, `app retired: ${key}`)
    }
    const appSource = await Effect.runPromise(resolveControlAppSource(owner, slug))
    if (!existsSync(appSource)) return send(res, 404, `no AppSource: ${key}`)
    if (rest === `/${VISTA_CHANGELOG_FILE}`) return serveChangelog(res)
    if (rest === '/favicon.ico') return serveFavicon(res)
    if (dm) {
      const registry = await state.providers.ensureVersion(
        { owner, slug, version: 'draft' },
        join(appSource, 'providers'),
      )
      const projection = await deriveProjection(state.published, join(appSource, 'app.tsx'), {
        invalidate: true,
      })
      return handleData(registry, req, res, dm[1]!, declaredPtySessions(projection.semantics))
    }
    if (isBootstrapPath(rest)) establishViewerIdentity(req, res)
    if (path === `${routeBase}/draft`) return redirect(res, `${routeBase}/draft/`)
    const draft = await ensureDraft(state, owner, slug, appSource, httpServer)
    return draft.middlewares(req, res, () => send(res, 404, 'not found (draft)'))
  }

  if (!st) return send(res, 404, `unknown app: ${key}`)
  state.apps.set(`${encodeOwner(owner)}/${slug}`, st)
  if (st.retired && sel === 'latest') return send(res, 410, `app retired: ${key}`)

  // `/latest` is a canonical follow-latest route, not a pin. Keep the browser URL
  // stable and rewrite only the in-process Vite request to the current immutable
  // version source. Bare `/latest` still redirects to `/latest/` so relative
  // module URLs resolve against a directory-like base.
  if (sel === 'latest') {
    if (st.latest === null) return send(res, 404, `no versions: ${slug}`)
    if (path === `${routeBase}/latest`) return redirect(res, `${routeBase}/latest/`)
    if (dm) {
      const verification = inspectScopedStatic(owner, slug, st.latest)
      if (verification._tag !== 'verified') {
        return send(
          res,
          409,
          verification._tag === 'receiptless'
            ? 'publication receipt unavailable'
            : 'publication trust verification failed',
        )
      }
      const registry = await state.providers
        .ensureVersion(
          { owner, slug, version: st.latest },
          join(versionDir(owner, slug, st.latest), 'providers'),
          { verifyModule: publishedProviderVerifier(verification.index) },
        )
        .catch((cause: unknown) => {
          if (cause instanceof PublishedProviderVerificationError) return undefined
          throw cause
        })
      if (registry === undefined) return send(res, 409, 'publication trust verification failed')
      return handleData(registry, req, res, dm[1]!, publishedPtySessions(verification.index))
    }
    if (isBootstrapPath(rest)) establishViewerIdentity(req, res)
    const staticResult = serveStaticVersion(req, res, owner, slug, st.latest, rest)
    if (staticResult === 'served') return
    if (staticResult === 'missing') return send(res, 404, 'not found (static latest)')
    if (staticResult === 'invalid') return send(res, 400, 'invalid published path')
    return sendPublicationFailure(res, owner, slug, st.latest, rest, staticResult)
  }

  // A published version is served only from its verified static inventory.
  const v = Number(sel.slice(1))
  const surface = versionDir(owner, slug, v)
  const localRenderCandidate = isLoopbackRequest(req) && existsSync(join(surface, '.publishing'))
  if (!st.versions.some((x) => x.version === v) && !localRenderCandidate) {
    return send(res, 404, `no such version: ${sel}`)
  }
  if (!existsSync(surface)) return send(res, 404, `surface missing: ${sel}`)
  // Display-only derivatives live outside the signed executable inventory.
  if (rest === '/_thumbnail.png') {
    if (!st.versions.some((entry) => entry.version === v)) return send(res, 404, 'not found')
    const verification = inspectScopedStatic(owner, slug, v)
    if (verification._tag !== 'verified') {
      return send(
        res,
        409,
        verification._tag === 'receiptless'
          ? 'publication receipt unavailable'
          : 'publication trust verification failed',
      )
    }
    let descriptor: number | undefined
    try {
      descriptor = openSync(
        join(surface, 'thumbnail.png'),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      )
      if (!fstatSync(descriptor).isFile()) return send(res, 404, 'not found')
      const bytes = readFileSync(descriptor)
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return send(res, 404, 'not found')
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('allow', 'GET, HEAD')
        return send(res, 405, 'method not allowed')
      }
      res.statusCode = 200
      res.setHeader('content-type', 'image/png')
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-security-policy', "default-src 'none'; sandbox")
      res.setHeader('content-length', bytes.length)
      res.end(req.method === 'HEAD' ? undefined : bytes)
      return
    } catch {
      return send(res, 404, 'not found')
    } finally {
      if (descriptor !== undefined) closeSync(descriptor)
    }
  }
  if (dm) {
    const verification = inspectScopedStatic(owner, slug, v)
    if (verification._tag !== 'verified') {
      return send(
        res,
        409,
        verification._tag === 'receiptless'
          ? 'publication receipt unavailable'
          : 'publication trust verification failed',
      )
    }
    const registry = await state.providers
      .ensureVersion({ owner, slug, version: v }, join(surface, 'providers'), {
        verifyModule: publishedProviderVerifier(verification.index),
      })
      .catch((cause: unknown) => {
        if (cause instanceof PublishedProviderVerificationError) return undefined
        throw cause
      })
    if (registry === undefined) return send(res, 409, 'publication trust verification failed')
    return handleData(registry, req, res, dm[1]!, publishedPtySessions(verification.index))
  }
  if (isBootstrapPath(rest)) establishViewerIdentity(req, res)
  const staticResult = serveStaticVersion(req, res, owner, slug, v, rest)
  if (staticResult === 'served') return
  if (staticResult === 'missing') return send(res, 404, 'not found (static)')
  if (staticResult === 'invalid') return send(res, 400, 'invalid published path')
  return sendPublicationFailure(res, owner, slug, v, rest, staticResult)
}

/**
 * Bridge an imperative node request handler into an Effect route (decision 0060,
 * spike topology B). The handler runs on the raw `IncomingMessage`/`ServerResponse`
 * retrieved from the platform request, and the Effect resolves only once the node
 * response has actually finished — so `vite.middlewares` (which owns `res.end()`)
 * and the sync `send`/`redirect` helpers both work unchanged. Because the platform
 * `handleResponse` short-circuits once `res.writableEnded`, returning
 * `HttpServerResponse.empty()` after the node handler ended the response never
 * double-writes. The error mapping mirrors the pre-migration `createServer`
 * callback (`Vista.RuntimePolicyError` → 400, else 500), guarded by `headersSent`.
 */
const nodeRoute = (
  span: string,
  fn: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const nodeReq = NodeHttpServerRequest.toIncomingMessage(request)
    const nodeRes = NodeHttpServerRequest.toServerResponse(request)
    yield* Effect.callback<void>((resume) => {
      let handlerDone = false
      let responseDone = nodeRes.destroyed || nodeRes.writableEnded
      let settled = false
      const settle = (): void => {
        if (settled || !handlerDone || !responseDone) return
        settled = true
        resume(Effect.void)
      }
      const responseFinished = (): void => {
        responseDone = true
        settle()
      }
      // Register completion listeners BEFORE invoking `fn`: a synchronous `send()`
      // can emit `finish` before a later-attached listener would see it. A client
      // disconnect alone does not release the Effect route: the handler may still
      // be awaiting a provider response and must retain response ownership until
      // that work has observed the closed socket and returned.
      nodeRes.once('finish', responseFinished)
      nodeRes.once('close', responseFinished)
      Promise.resolve()
        .then(() => fn(nodeReq, nodeRes))
        .catch((e: unknown) => {
          console.error('request error', e)
          if ((e as { _tag?: string })._tag === 'Vista.RuntimePolicyError') {
            if (!nodeRes.destroyed && !nodeRes.headersSent) {
              send(nodeRes, 400, (e as Error).message)
            }
          } else if (!nodeRes.destroyed && !nodeRes.headersSent) {
            send(nodeRes, 500, `internal error: ${(e as Error).message}`)
          }
          if (!nodeRes.destroyed && !nodeRes.writableEnded) nodeRes.end()
        })
        .finally(() => {
          handlerDone = true
          if (nodeRes.destroyed || nodeRes.writableEnded) responseDone = true
          settle()
        })
    })
    return HttpServerResponse.empty()
  }).pipe(Effect.withSpan(span))

/**
 * The Effect-native request router (decision 0060). Typed API routes for the
 * control/interview/publish/index surface; the review-serving `/r/*` tree is the
 * catch-all delegating to Vite. `find-my-way` gives the static routes precedence
 * over the `/*` wildcard, so the ordering here is declarative, not positional.
 */
const buildRouter = (state: ServiceState, httpServer: http.Server, port: number) =>
  HttpRouter.addAll([
    HttpRouter.route(
      'GET',
      '/health',
      nodeRoute('vista.service.health', (_req, res) => serveHealth(res)),
    ),
    HttpRouter.route(
      'GET',
      '/favicon.ico',
      nodeRoute('vista.service.favicon', (_req, res) => serveFavicon(res)),
    ),
    HttpRouter.route(
      'GET',
      '/_vista/apps',
      nodeRoute('vista.service.apps', (req, res) => serveApps(state, req, res)),
    ),
    HttpRouter.route(
      '*',
      '/_rpc/control',
      nodeRoute('vista.service.control', (req, res) => serveControl(state, req, res)),
    ),
    HttpRouter.route(
      '*',
      INSPECTOR_RPC_PATH,
      nodeRoute('vista.service.rpcInspector', (req, res) => serveInspector(state, req, res)),
    ),
    HttpRouter.route(
      '*',
      '/_rpc/read',
      nodeRoute('vista.service.read', (req, res) => serveRead(state, req, res)),
    ),
    HttpRouter.route(
      '*',
      '/_answer',
      nodeRoute('vista.service.interview', (req, res) => serveInterview(state, req, res)),
    ),
    HttpRouter.route(
      '*',
      '/_interview/*',
      nodeRoute('vista.service.interview', (req, res) => serveInterview(state, req, res)),
    ),
    HttpRouter.route(
      'GET',
      '/',
      nodeRoute('vista.service.index', (_req, res) => serveIndex(state, res)),
    ),
    HttpRouter.route(
      'GET',
      '/r',
      nodeRoute('vista.service.index', (_req, res) => serveIndex(state, res)),
    ),
    HttpRouter.route(
      '*',
      '/*',
      nodeRoute('vista.service.review', (req, res) =>
        serveReview(state, httpServer, port, req, res),
      ),
    ),
  ]).pipe(Layer.provide(HttpRouter.layer))

/**
 * Handle returned by starting the service, exposing the shared ServiceState, the listening port,
 * and a close function that shuts the service down.
 */
export interface StartedService {
  readonly state: ServiceState
  readonly port: number
  readonly close: () => Promise<void>
}

/**
 * Start the standing service on `port` (decision 0060). The request boundary is
 * Effect-native: an `@effect/platform` `HttpRouter` attached to the shared
 * `http.Server` via `NodeHttpServer.makeHandler` + a manual `server.on('request')`
 * — NEVER `serveEffect`, which would install a competing `upgrade` listener and
 * corrupt Vite's HMR WebSocket frames (spike-backed invariant). Vite keeps its own
 * per-draft `upgrade` listener, so HMR is unchanged.
 *
 * `makeHandler` captures the runtime it is run in and forks each request into it,
 * so running it inside a `ManagedRuntime` built from `appLayer` gives every
 * request fiber that layer's context — this is where the service's OTel tracer
 * lives (Track G / decision 0062). `appLayer` defaults to `Layer.empty` so tests
 * (and any embedder) boot with zero telemetry surface; production supplies the
 * `withTelemetry` layer from `main.ts`. The long-lived runtime is disposed in
 * `close()`, flushing the exporter.
 */
export const startService = async <ROut = never>(
  port: number,
  // `Layer`'s `ROut` is invariant, so a single non-generic type cannot accept both
  // `Layer.empty` (tests) and a service-providing telemetry layer (`main.ts`). The
  // generic + `never` default keeps both call shapes type-safe; the cast only
  // applies when the default is used (ROut = never), where it is an identity.
  appLayer: Layer.Layer<ROut, never, never> = Layer.empty as Layer.Layer<ROut, never, never>,
): Promise<StartedService> => {
  const startedAt = Date.now()
  const buildInfo = resolveVistaBuildInfo()
  ensureDepsSymlink()
  mkdirSync(cacheDir(), { recursive: true })

  // One non-HTTP Vite runtime evaluates projection and provider modules. It has
  // no HTTP routing path; published bytes come only from verified static output.
  const published = await createViteServer({
    root: appsDir(),
    base: '/r/',
    configFile: false,
    appType: 'mpa',
    cacheDir: join(cacheDir(), 'published'),
    plugins: [
      providerSsrProxy(),
      semanticExtractor(),
      vistaRuntimeImportPolicy(),
      vistaDependencyAnchorResolver(dirname(depsNodeModules())),
      react(),
      {
        name: 'vista-publication-ssr-only',
        configEnvironment(name, config) {
          // React's config hook adds client prebundle entries even with
          // discovery off. Clear them after plugin config has been merged.
          if (name === 'client') {
            config.optimizeDeps = { ...config.optimizeDeps, noDiscovery: true, include: [] }
          }
        },
      },
    ],
    resolve: semanticResolveConfig(),
    // This runtime only evaluates SSR modules; published HTTP bytes are static.
    // A client optimizer would prebundle the entire browser graph on every cold
    // service start without ever serving it, competing with provider loading.
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { external: ssrExternal() },
    server: {
      middlewareMode: true,
      allowedHosts: ALLOWED_HOSTS,
      hmr: false,
      ws: false,
      watch: null,
      fs: {
        allow: [appsDir(), depsNodeModules(), cacheDir(), ...runtimeFsAllow()],
        strict: false,
      },
    },
  })

  const runtime = ManagedRuntime.make(appLayer)
  const explorerScope = await runtime.runPromise(Scope.make())
  const explorer = await runtime.runPromise(
    makeVistaRpcExplorer((metric) => {
      runtime.runSync(metric)
    }).pipe(Effect.provideService(Scope.Scope, explorerScope)),
  )
  const providers = await createProviderRegistry(published, appsDir(), explorer)
  // Mount the service's shipped providers in the projection runtime.
  const preDir = join(SERVICE_SRC, 'data', 'providers')
  await loadPreconfiguredProviders(providers.base, preDir)

  const interview = createInterviewStore()
  // Per-review render smoke (decision 0058). Enabled explicitly by
  // `VISTA_RENDER_SMOKE=1` — the deployed service closure wires it on (with a
  // Nix Chromium via `PLAYWRIGHT_BROWSERS_PATH`); local dev and the service test
  // suites leave it off (undefined → publish skips it), so publishing stays
  // browser-free unless the render guarantee is explicitly demanded. Bound to
  // this server's own base URL so the smoke loads the just-frozen `/r/<slug>/vN/`.
  const renderSmoke =
    process.env.VISTA_RENDER_SMOKE === '1'
      ? makeBrowserMountSmoke(`http://127.0.0.1:${port}`)
      : undefined
  const publicBaseUrl = process.env.VISTA_PUBLIC_URL?.trim()
  let state!: ServiceState
  const handlerOptions = {
    providers,
    explorer,
    interview,
    startedAt,
    listApps: () => state.apps.values(),
    ...(renderSmoke !== undefined ? { renderSmoke } : {}),
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
    refreshApp: (owner: OwnerIdentity, slug: Slug) => {
      const key = `${encodeOwner(owner)}/${slug}`
      invalidateVerifiedPublications(owner, slug)
      const refreshed = readApp(owner, slug)
      if (refreshed) state.apps.set(key, refreshed)
      else state.apps.delete(key)
    },
    // Same runtime layer that backs the request boundary (D1): the control-plane
    // spans share the service tracer, so a CLI↔service publish is one trace (G3).
    telemetryLayer: appLayer as Layer.Layer<never, never, never>,
  } as const
  const control = createVistaControlHandler(handlerOptions)
  const read = createVistaReadHandler(handlerOptions)
  const inspectorWebHandler = HttpRouter.toWebHandler(
    Layer.provide(
      RpcServer.layerHttp({
        group: explorer.inspector.group,
        path: INSPECTOR_RPC_PATH,
        protocol: 'http',
      }),
      Layer.mergeAll(explorer.inspector.layer, RpcSerialization.layerNdjson, HttpRouter.layer),
    ),
  )

  state = {
    apps: scanAll(),
    published,
    drafts: new Map(),
    draftsPending: new Map(),
    providers,
    buildInfo,
    explorer,
    inspector: {
      handler: (request) => inspectorWebHandler.handler(request, Context.empty()),
      dispose: inspectorWebHandler.dispose,
    },
    control,
    read,
    interview,
  }

  // Topology B (decision 0060): the http.Server is created with NO request
  // callback; the Effect handler is attached via `server.on('request')` and Vite
  // keeps its OWN per-draft `upgrade` listener. Each draft is created with
  // `hmr.server: httpServer` + a slug-scoped `hmr.path`, so Vite installs its own
  // upgrade listener matching its joined WS path (`/r/<encoded-owner>/<slug>/draft/__vista_hmr__`)
  // exactly. Multiple drafts coexist because each listener only claims its own
  // path; non-matching upgrades fall through — and nothing here touches `upgrade`.
  const httpServer = http.createServer()

  // Long-lived runtime hosting the request context (the OTel tracer in prod). Run
  // `makeHandler` INSIDE it so per-request fibers inherit its layer.
  const { handler, requestScope } = await runtime.runPromise(
    Effect.gen(function* () {
      const handlerScope = yield* Scope.make()
      const httpEffect = yield* HttpRouter.toHttpEffect(buildRouter(state, httpServer, port)).pipe(
        Effect.provideService(Scope.Scope, handlerScope),
      )
      const requestHandler = yield* NodeHttpServer.makeHandler(httpEffect, { scope: handlerScope })
      return { handler: requestHandler, requestScope: handlerScope }
    }),
  )
  httpServer.on('request', handler)

  await new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', resolve))
  console.log(
    `vista service listening on http://127.0.0.1:${port}  (index: /, apps: /r/<encoded-owner>/<slug>/latest)`,
  )

  const close = async (): Promise<void> => {
    for (const draft of state.drafts.values()) await draft.close()
    await state.control.dispose()
    await state.inspector.dispose()
    await state.read.dispose()
    await state.providers.close()
    await published.close()
    // Stop accepting new requests before disposing the runtime (flushes the OTel
    // exporter finalizer).
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    await Effect.runPromise(Scope.close(requestScope, Exit.succeed(undefined)))
    await runtime.runPromise(Scope.close(explorerScope, Exit.succeed(undefined)))
    await runtime.dispose()
  }
  return { state, port, close }
}

/** Load the service's shipped pre-configured providers by absolute path. */
const loadPreconfiguredProviders = async (
  registry: ProviderRegistry,
  dir: string,
): Promise<void> => {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.provider.ts')) continue
    await registry.reload(join(dir, f))
  }
}
