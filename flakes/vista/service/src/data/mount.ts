import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { strictJsonWire } from '@vista/blocks/internal/data-contract'
import { agentTimeline, AgentTimelineError } from '@vista/blocks/internal/provider-contracts'
import { Context, Effect, Exit, Layer, Schema, SchemaTransformation, Scope } from 'effect'
import * as KeyValueStore from 'effect/persistence/KeyValueStore'
import type * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import type { Plugin, ViteDevServer } from 'vite'

import { liveStateDir } from '../paths.ts'
import type { VistaRpcExplorer } from '../rpc-explorer.ts'
import {
  makeProviderBudget,
  makeSubscriptionHub,
  type ProviderBudget,
  type ProviderSubscriptionGeneration,
} from './live-hub.ts'
import { isProviderMount, materializeProvider, type MountedProvider } from './provider.ts'
export type { MountedProvider } from './provider.ts'

const PROVIDER_PROXY = '\0vista-provider:'
const PROVIDER_PROXY_PUBLIC = 'virtual:vista-provider:'

const providerModuleId = (root: string, modulePath: string): string => {
  const absolute = isAbsolute(modulePath) ? modulePath : join(root, modulePath.replace(/^\//, ''))
  return `${PROVIDER_PROXY_PUBLIC}${Buffer.from(absolute).toString('base64url')}`
}

/**
 * Anchor every provider implementation to the service Vite realm. The virtual
 * issuer prevents the client runtime policy from treating a direct SSR load as
 * an app-authored import, and externalized packages resolve from the service
 * dependency closure instead of the catalog path.
 */
export const providerSsrProxy = (): Plugin => ({
  name: 'vista-provider-ssr-proxy',
  enforce: 'pre',
  resolveId(id) {
    return id.startsWith(PROVIDER_PROXY_PUBLIC)
      ? `${PROVIDER_PROXY}${id.slice(PROVIDER_PROXY_PUBLIC.length)}`
      : undefined
  },
  load(id) {
    if (!id.startsWith(PROVIDER_PROXY)) return undefined
    const path = Buffer.from(id.slice(PROVIDER_PROXY.length), 'base64url').toString('utf8')
    return `export { default } from ${JSON.stringify(path)}`
  },
})

/**
 * Identifies which provider bundle a registry holds by repository owner and slug plus a published
 * version number or the draft slot.
 */
export interface ProviderRegistryIdentity {
  readonly owner: string
  readonly slug: string
  readonly version: number | 'draft'
}

/**
 * Options accepted when (re)loading provider modules, chiefly an optional async hook used to
 * validate a module before it is mounted.
 */
export interface ProviderRegistryLoadOptions {
  readonly verifyModule?: (modulePath: string) => Promise<void> | void
}

/**
 * A loaded set of mounted providers backed by the Vite dev server, supporting lookup by id or
 * module path, hot reload of changed modules, freshness checks, verifier injection, and graceful
 * retirement or shutdown.
 */
export interface ProviderRegistry {
  readonly identity: ProviderRegistryIdentity | 'service'
  readonly providers: Map<string, MountedProvider>
  readonly vite: ViteDevServer
  readonly reload: (modulePath: string) => Promise<MountedProvider>
  readonly ensureFresh: (id: string) => Promise<void>
  readonly modulePaths: () => readonly string[]
  readonly modulePath: (id: string) => string | undefined
  readonly setModuleVerifier: (verifyModule: ProviderRegistryLoadOptions['verifyModule']) => void
  readonly retire: () => Promise<void>
  readonly close: () => Promise<void>
}

/** Resolve retained publication data URLs through the current service contract. */
export const resolveProvider = <TRpcs extends Rpc.AnyWithProps>(
  registry: { readonly providers: ReadonlyMap<string, MountedProvider<TRpcs>> },
  id: string,
): MountedProvider<TRpcs> | undefined =>
  registry.providers.get(id === 'agent-trace' ? agentTimeline.id : id)

/**
 * Retained publication clients decode the previous tagged failure, while handler
 * code and the canonical endpoint continue using AgentTimelineError.
 */
const retainedTimelineError = Schema.TaggedStruct('AgentTraceError', {
  reason: AgentTimelineError.fields.reason,
  message: AgentTimelineError.fields.message,
}).pipe(
  Schema.decodeTo(
    AgentTimelineError,
    SchemaTransformation.transform({
      decode: ({ reason, message }) => ({ _tag: 'AgentTimelineError' as const, reason, message }),
      encode: ({ reason, message }) => ({ _tag: 'AgentTraceError' as const, reason, message }),
    }),
  ),
)

/** The old data URL serves its historical error encoding through the same mounted core. */
export const agentTimelineWireAliases = [
  {
    id: 'agent-trace',
    group: RpcGroup.make(
      agentTimeline.group.requests.get('load')!.setError(strictJsonWire(retainedTimelineError)),
    ),
  },
] as const

const createVersionRegistry = async (
  vite: ViteDevServer,
  root: string,
  identity: ProviderRegistryIdentity | 'service',
  budget: ProviderBudget,
  options: ProviderRegistryLoadOptions = {},
  explorer?: VistaRpcExplorer,
): Promise<ProviderRegistry> => {
  const providers = new Map<string, MountedProvider>()
  const providerResources = new Map<
    string,
    { readonly scope: Scope.Closeable; readonly generation: ProviderSubscriptionGeneration }
  >()
  const paths = new Map<string, string>()
  const dirty = new Set<string>()
  const reloads = new Map<string, Promise<MountedProvider>>()
  let verifyModule = options.verifyModule
  let closed = false
  let closePromise: Promise<void> | undefined
  const scope = await Effect.runPromise(Scope.make())
  const storeContext = await Effect.runPromise(
    Layer.build(
      KeyValueStore.layerFileSystem(liveStateDir()).pipe(
        Layer.provide([NodeFileSystem.layer, NodePath.layer]),
      ),
    ).pipe(Effect.provideService(Scope.Scope, scope)),
  )
  const store = Context.get(storeContext, KeyValueStore.KeyValueStore)
  const appVersionId =
    identity === 'service' ? 'service' : `${identity.owner}/${identity.slug}/${identity.version}`
  const subscriptionHub = await Effect.runPromise(
    makeSubscriptionHub({ appVersionId, store, budget }).pipe(
      Effect.provideService(Scope.Scope, scope),
    ),
  )

  const absoluteModulePath = (modulePath: string): string =>
    isAbsolute(modulePath) ? modulePath : join(root, modulePath.replace(/^\//, ''))

  const reload = async (modulePath: string): Promise<MountedProvider> => {
    if (closed) throw new Error('provider registry is closed')
    const absolute = absoluteModulePath(modulePath)
    const inFlight = reloads.get(absolute)
    if (inFlight !== undefined) return inFlight

    const pending = (async () => {
      await verifyModule?.(absolute)
      const loaded = (await vite.ssrLoadModule(providerModuleId(root, modulePath))) as {
        readonly default?: unknown
      }
      if (!isProviderMount(loaded.default)) {
        throw new TypeError(
          `${modulePath}: default export must be mountProvider(implementation, layer)`,
        )
      }

      const generation = subscriptionHub.providerGeneration(loaded.default.id)
      const providerScope = await Effect.runPromise(Scope.fork(scope))
      let mounted: MountedProvider
      try {
        mounted = await Effect.runPromise(
          materializeProvider(
            loaded.default,
            generation.hub,
            budget,
            explorer === undefined ? undefined : { explorer, appVersionId },
            loaded.default.id === agentTimeline.id ? agentTimelineWireAliases : [],
          ).pipe(Effect.provideService(Scope.Scope, providerScope)),
        )
      } catch (cause) {
        await Effect.runPromise(generation.retire)
        await Effect.runPromise(Scope.close(providerScope, Exit.fail(cause)))
        throw cause
      }

      const existing = providerResources.get(mounted.id)
      providers.set(mounted.id, mounted)
      providerResources.set(mounted.id, { scope: providerScope, generation })
      paths.set(mounted.id, modulePath)
      dirty.delete(mounted.id)
      if (existing !== undefined) {
        await Effect.runPromise(existing.generation.retire)
        await Effect.runPromise(Scope.close(existing.scope, Exit.void))
      }
      return mounted
    })()
    reloads.set(absolute, pending)
    try {
      return await pending
    } finally {
      if (reloads.get(absolute) === pending) reloads.delete(absolute)
    }
  }

  const ensureFresh = async (id: string): Promise<void> => {
    if (!dirty.has(id)) return
    const modulePath = paths.get(id)
    if (modulePath === undefined) return
    await reload(modulePath)
  }

  const onChange = (file: string): void => {
    for (const [id, modulePath] of paths) {
      if (absoluteModulePath(modulePath) === file) dirty.add(id)
    }
  }
  vite.watcher.on('change', onChange)

  const close = (): Promise<void> => {
    if (closePromise !== undefined) return closePromise
    closed = true
    vite.watcher.off('change', onChange)
    closePromise = (async () => {
      await Promise.allSettled(reloads.values())
      await Effect.runPromise(Scope.close(scope, Exit.void))
      providers.clear()
      providerResources.clear()
      paths.clear()
      dirty.clear()
    })()
    return closePromise
  }

  return {
    identity,
    providers,
    vite,
    reload,
    ensureFresh,
    modulePath: (id) => {
      const modulePath = paths.get(id)
      return modulePath === undefined ? undefined : absoluteModulePath(modulePath)
    },
    modulePaths: () => [...paths.values()],
    setModuleVerifier: (nextVerifier) => {
      verifyModule = nextVerifier
    },
    retire: async () => {
      await Effect.runPromise(subscriptionHub.retire)
      await close()
    },
    close,
  }
}

const registryKey = ({ owner, slug, version }: ProviderRegistryIdentity): string =>
  `${owner}\0${slug}\0${version}`

/**
 * Owns the base service registry alongside versioned registries and atomically swaps in or lazily
 * creates a registry for a given identity by loading providers from the supplied directory.
 */
export interface ProviderRegistryManager {
  readonly vite: ViteDevServer
  readonly base: ProviderRegistry
  readonly versions: ReadonlyMap<string, ProviderRegistry>
  readonly replaceVersion: (
    identity: ProviderRegistryIdentity,
    providersDir: string,
    options?: ProviderRegistryLoadOptions,
  ) => Promise<ProviderRegistry>
  readonly ensureVersion: (
    identity: ProviderRegistryIdentity,
    providersDir: string,
    options?: ProviderRegistryLoadOptions,
  ) => Promise<ProviderRegistry>
  readonly getVersion: (identity: ProviderRegistryIdentity) => ProviderRegistry | undefined
  readonly retainVersion: (identity: ProviderRegistryIdentity) => Promise<void>
  readonly closeVersion: (identity: ProviderRegistryIdentity) => Promise<void>
  readonly closeApp: (owner: string, slug: string) => Promise<void>
  readonly close: () => Promise<void>
}

/**
 * Asynchronously creates the registry manager, wiring a shared provider budget and building the
 * base service registry from the given Vite dev server and root directory.
 */
export const createProviderRegistry = async (
  vite: ViteDevServer,
  root: string,
  explorer?: VistaRpcExplorer,
): Promise<ProviderRegistryManager> => {
  const budget = await Effect.runPromise(makeProviderBudget())
  const base = await createVersionRegistry(vite, root, 'service', budget, {}, explorer)
  const versions = new Map<string, ProviderRegistry>()
  const verifiers = new Map<string, ProviderRegistryLoadOptions['verifyModule']>()
  const operations = new Map<string, Promise<unknown>>()
  const retiring = new Set<ProviderRegistry>()
  const retirements = new Set<Promise<void>>()
  let closed = false

  const serializeApp = async <T>(
    identity: Pick<ProviderRegistryIdentity, 'owner' | 'slug'>,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const key = `${identity.owner}\0${identity.slug}`
    const previous = operations.get(key) ?? Promise.resolve()
    const pending = previous.catch(() => undefined).then(operation)
    operations.set(key, pending)
    try {
      return await pending
    } finally {
      if (operations.get(key) === pending) operations.delete(key)
    }
  }

  const retireRegistry = (registry: ProviderRegistry): void => {
    retiring.add(registry)
    let retirement: Promise<void>
    retirement = registry
      .retire()
      .catch(() => registry.close())
      .finally(() => {
        retiring.delete(registry)
        retirements.delete(retirement)
      })
    retirements.add(retirement)
  }

  const replaceVersion = (
    identity: ProviderRegistryIdentity,
    providersDir: string,
    options: ProviderRegistryLoadOptions = {},
  ): Promise<ProviderRegistry> => {
    if (closed) return Promise.reject(new Error('provider registry manager is closed'))
    return serializeApp(identity, async () => {
      const key = registryKey(identity)
      if (options.verifyModule !== undefined) verifiers.set(key, options.verifyModule)
      const verifyModule = options.verifyModule ?? verifiers.get(key)
      const candidate = await createVersionRegistry(
        vite,
        root,
        identity,
        budget,
        verifyModule === undefined ? {} : { verifyModule },
        explorer,
      )
      try {
        for (const modulePath of base.modulePaths()) await candidate.reload(modulePath)
        for (const modulePath of discoverProviders(root, providersDir))
          await candidate.reload(modulePath)
      } catch (cause) {
        await candidate.close()
        throw cause
      }

      const displaced = versions.get(key)
      versions.set(key, candidate)
      if (displaced !== undefined) retireRegistry(displaced)
      return candidate
    })
  }

  const ensureVersion = (
    identity: ProviderRegistryIdentity,
    providersDir: string,
    options: ProviderRegistryLoadOptions = {},
  ): Promise<ProviderRegistry> => {
    if (closed) return Promise.reject(new Error('provider registry manager is closed'))
    return serializeApp(identity, async () => {
      const key = registryKey(identity)
      if (options.verifyModule !== undefined) verifiers.set(key, options.verifyModule)
      const existing = versions.get(key)
      if (existing !== undefined) {
        if (options.verifyModule !== undefined) {
          existing.setModuleVerifier(options.verifyModule)
        }
        return existing
      }

      const verifyModule = options.verifyModule ?? verifiers.get(key)
      const candidate = await createVersionRegistry(
        vite,
        root,
        identity,
        budget,
        verifyModule === undefined ? {} : { verifyModule },
        explorer,
      )
      try {
        for (const modulePath of base.modulePaths()) await candidate.reload(modulePath)
        for (const modulePath of discoverProviders(root, providersDir))
          await candidate.reload(modulePath)
      } catch (cause) {
        await candidate.close()
        throw cause
      }
      versions.set(key, candidate)
      return candidate
    })
  }

  const closeVersion = (identity: ProviderRegistryIdentity): Promise<void> =>
    serializeApp(identity, async () => {
      const key = registryKey(identity)
      const registry = versions.get(key)
      versions.delete(key)
      verifiers.delete(key)
      await registry?.close()
    })

  const closeApp = (owner: string, slug: string): Promise<void> =>
    serializeApp({ owner, slug }, async () => {
      const matches = [...versions.entries()].filter(([, registry]) => {
        const identity = registry.identity
        return identity !== 'service' && identity.owner === owner && identity.slug === slug
      })
      for (const [key, registry] of matches) {
        versions.delete(key)
        verifiers.delete(key)
        await registry.close()
      }
    })

  return {
    vite,
    base,
    versions,
    replaceVersion,
    ensureVersion,
    getVersion: (identity) => versions.get(registryKey(identity)),
    retainVersion: (identity) =>
      serializeApp(identity, async () => {
        const keep = registryKey(identity)
        const matches = [...versions.entries()].filter(([key, registry]) => {
          const current = registry.identity
          return (
            key !== keep &&
            current !== 'service' &&
            current.owner === identity.owner &&
            current.slug === identity.slug
          )
        })
        for (const [key, registry] of matches) {
          versions.delete(key)
          verifiers.delete(key)
          retireRegistry(registry)
        }
      }),
    closeVersion,
    closeApp,
    close: async () => {
      if (closed) return
      closed = true
      await Promise.allSettled(operations.values())
      for (const registry of versions.values()) await registry.close()
      for (const registry of retiring) await registry.close()
      versions.clear()
      verifiers.clear()
      await Promise.allSettled(retirements)
      await base.close()
    },
  }
}

/** Discover app-local server implementations; query descriptors are client files. */
export const discoverProviders = (root: string, dir: string): string[] => {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.provider.ts')) continue
    const path = join(dir, file)
    out.push(isAbsolute(path) ? path : join(root, path))
  }
  return out.toSorted()
}
