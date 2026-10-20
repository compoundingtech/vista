import { join } from 'node:path'

import { Effect, Schema } from 'effect'

import { VISTA_API_VERSION } from '../api-version.ts'
import { installedRuntimeClosure, runtimePolicyContributions } from './package-inputs.ts'
import { islandDir, blocksDir, root } from './roots.ts'
import {
  RuntimePolicyError,
  RuntimePolicyProjection,
  RuntimePolicySource,
  type RemoteImportRule,
  type RuntimeAliasContribution,
  type RuntimeAlias,
  type RuntimePolicyContribution,
} from './schema.ts'

const decodeRuntimePolicySource = Schema.decodeUnknownSync(RuntimePolicySource)
const decodeRuntimePolicyProjection = Schema.decodeUnknownSync(RuntimePolicyProjection)

/** Memoize a zero-arg thunk so its work runs at most once, lazily. */
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

const uniqueSorted = (values: Iterable<string>): string[] => [...new Set(values)].toSorted()

/**
 * Reduces an import specifier to its owning package root, keeping both the scope and name segments
 * for scoped packages and otherwise taking the first path segment (falling back to the whole
 * specifier if no segment exists).
 */
export const importRoot = (specifier: string): string =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier)

const aliasRoot = (alias: RuntimeAlias): string => importRoot(alias.specifier)

const serviceOwnedImportRoots = (contribution: RuntimePolicyContribution): readonly string[] => [
  ...(contribution.serviceOwnedImportRoots ?? []),
  ...(contribution.slices ?? []).flatMap(serviceOwnedImportRoots),
]

const publicImportRoots = (contribution: RuntimePolicyContribution): readonly string[] => [
  ...(contribution.publicImportRoots ?? []),
  ...(contribution.slices ?? []).flatMap(publicImportRoots),
]

const optimizeInclude = (
  contribution: RuntimePolicyContribution,
  inheritedExcludeRoots: ReadonlySet<string> = new Set(),
  inheritedServiceOwnedRoots: ReadonlySet<string> = new Set(),
): readonly string[] => {
  const serviceOwned = new Set([
    ...inheritedServiceOwnedRoots,
    ...serviceOwnedImportRoots(contribution),
  ])
  const exclude = new Set([...inheritedExcludeRoots, ...(contribution.optimizeExcludeRoots ?? [])])
  const derivesPublicRoots = 'name' in contribution
  return [
    ...(contribution.optimizeInclude ?? []),
    ...(derivesPublicRoots
      ? (contribution.publicImportRoots ?? []).filter(
          (candidate) => !exclude.has(candidate) && !serviceOwned.has(candidate),
        )
      : []),
    ...(contribution.slices ?? []).flatMap((slice) =>
      optimizeInclude(slice, exclude, serviceOwned),
    ),
  ]
}

const cssImports = (contribution: RuntimePolicyContribution): readonly string[] => [
  ...(contribution.cssImports ?? []),
  ...(contribution.slices ?? []).flatMap(cssImports),
]

const aliases = (contribution: RuntimePolicyContribution): readonly RuntimeAliasContribution[] => [
  ...(contribution.aliases ?? []),
  ...(contribution.slices ?? []).flatMap(aliases),
]

const remoteImports = (contribution: RuntimePolicyContribution): readonly RemoteImportRule[] => [
  ...(contribution.remoteImports ?? []),
  ...(contribution.slices ?? []).flatMap(remoteImports),
]

const ssrExternal = (contribution: RuntimePolicyContribution): readonly string[] => [
  ...(contribution.ssrExternal ?? []),
  ...(contribution.slices ?? []).flatMap(ssrExternal),
]

const dedupe = (contribution: RuntimePolicyContribution): readonly string[] => [
  ...(contribution.dedupe ?? []),
  ...(contribution.slices ?? []).flatMap(dedupe),
]

const resolveAliasTarget = (alias: RuntimeAliasContribution): RuntimeAlias => {
  const target = (() => {
    switch (alias.target.kind) {
      case 'root-relative':
        return join(root(), alias.target.path)
      case 'service-src':
        return join(root(), 'flakes', 'vista', 'service', 'src', alias.target.path)
      case 'blocks':
        return join(blocksDir(), alias.target.path)
      case 'island':
        return join(islandDir(), alias.target.path)
    }
  })()
  return { specifier: alias.specifier, target, public: alias.public }
}

/**
 * Merges the given (or discovered) contributions into a single validated RuntimePolicySource,
 * deduplicating and sorting import roots, optimize includes, and CSS imports, resolving alias
 * targets, and combining remote-import rules.
 */
export const projectVistaRuntimePolicySource = (
  contributions: readonly RuntimePolicyContribution[] = runtimePolicyContributions(),
): RuntimePolicySource =>
  decodeRuntimePolicySource({
    schemaVersion: VISTA_API_VERSION,
    publicImportRoots: uniqueSorted(contributions.flatMap(publicImportRoots)),
    serviceOwnedImportRoots: uniqueSorted(contributions.flatMap(serviceOwnedImportRoots)),
    optimizeInclude: uniqueSorted(contributions.flatMap((c) => optimizeInclude(c))),
    cssImports: uniqueSorted(contributions.flatMap(cssImports)),
    aliases: contributions.flatMap(aliases).map(resolveAliasTarget),
    remoteImports: contributions
      .flatMap(remoteImports)
      .toSorted((left, right) => left.name.localeCompare(right.name)),
    ssrExternal: uniqueSorted(contributions.flatMap(ssrExternal)),
    dedupe: uniqueSorted(contributions.flatMap(dedupe)),
  })

/**
 * Computes once the runtime policy source projected from the runtime-policy contributions
 * discovered in the current environment.
 */
export const vistaRuntimePolicySource = once(
  (): RuntimePolicySource => projectVistaRuntimePolicySource(),
)

const ensureRootsInstalled = (
  policy: RuntimePolicySource,
  installedPackageNames: ReadonlySet<string>,
): readonly string[] => {
  // Service-owned roots resolve to service-served sources/artifacts, not npm
  // packages in the dependency closure. They are projected from discovered Vista
  // runtime-policy metadata so optional packages can contribute this contract.
  const serviceOwnedRoots = new Set(policy.serviceOwnedImportRoots)
  return uniqueSorted([
    ...policy.publicImportRoots
      .filter((candidate) => !serviceOwnedRoots.has(candidate))
      .filter((candidate) => !installedPackageNames.has(candidate))
      .map(
        (candidate) => `public import root is not in the service dependency closure: ${candidate}`,
      ),
    ...policy.optimizeInclude
      .map(importRoot)
      .filter((candidate) => !installedPackageNames.has(candidate))
      .map(
        (candidate) =>
          `optimized import root is not in the service dependency closure: ${candidate}`,
      ),
    ...policy.cssImports
      .map(importRoot)
      .filter((candidate) => !installedPackageNames.has(candidate))
      .map((candidate) => `CSS import root is not in the service dependency closure: ${candidate}`),
    ...policy.aliases
      .map(aliasRoot)
      .filter((candidate) => !serviceOwnedRoots.has(candidate))
      .filter((candidate) => !installedPackageNames.has(candidate))
      .map((candidate) => `alias root is not in the service dependency closure: ${candidate}`),
  ])
}

/**
 * Projects the runtime policy source against the installed dependency closure, returning a
 * RuntimePolicyError listing problems whenever any policy root is not satisfied by the installed
 * packages.
 */
export const projectVistaRuntimePolicy = Effect.fn('vista.runtime-policy.project')(function* (
  policy: RuntimePolicySource = vistaRuntimePolicySource(),
) {
  const installedPackageNames = new Set(installedRuntimeClosure().packageNames)
  const problems = ensureRootsInstalled(policy, installedPackageNames)
  if (problems.length > 0) {
    return yield* new RuntimePolicyError({
      message: 'Vista runtime policy does not match the installed service dependency closure',
      problems: [...problems],
    })
  }

  return decodeRuntimePolicyProjection({
    schemaVersion: VISTA_API_VERSION,
    publicImportRoots: uniqueSorted(policy.publicImportRoots),
    serviceOwnedImportRoots: uniqueSorted(policy.serviceOwnedImportRoots),
    optimizeInclude: uniqueSorted(policy.optimizeInclude),
    cssImports: uniqueSorted(policy.cssImports),
    // Package roots permit package subpaths. Aliases are narrower: only aliases
    // marked public are authored imports, while internal service bridges remain
    // resolvable for `@vista/blocks` implementation modules.
    aliases: [...policy.aliases].toSorted(
      (left, right) =>
        right.specifier.length - left.specifier.length ||
        left.specifier.localeCompare(right.specifier),
    ),
    remoteImports: [...policy.remoteImports].toSorted((left, right) =>
      left.name.localeCompare(right.name),
    ),
    ssrExternal: uniqueSorted(policy.ssrExternal),
    dedupe: uniqueSorted(policy.dedupe),
    installed: installedRuntimeClosure(),
  })
})

/**
 * Synchronously computes (once) the validated runtime policy projection by running the projecting
 * effect against the current policy source and installed closure.
 */
export const vistaRuntimePolicy = once(
  (): RuntimePolicyProjection => Effect.runSync(projectVistaRuntimePolicy()),
)

/**
 * Derives once the Vite resolver settings from the projected runtime policy, exposing the dedupe
 * list and a specifier-to-target alias map for use in Vite config.
 */
export const vistaViteResolveConfig = once(() => {
  const policy = vistaRuntimePolicy()
  return {
    dedupe: policy.dedupe,
    alias: Object.fromEntries(policy.aliases.map((alias) => [alias.specifier, alias.target])),
  } as const
})
