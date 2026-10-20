import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Schema } from 'effect'

import { NonEmptyTrimmedString } from '../api-version.ts'
import { root } from './roots.ts'
import { InstalledRuntimeClosure, RuntimePolicyContribution } from './schema.ts'

/** Memoize a zero-arg thunk so its (filesystem) work runs at most once, lazily. */
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

const PackageJson = Schema.Struct({
  name: NonEmptyTrimmedString,
  dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  peerDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  $genie: Schema.optional(
    Schema.Struct({
      workspaceClosureDirs: Schema.optional(Schema.Array(NonEmptyTrimmedString)),
    }),
  ),
  $vista: Schema.optional(
    Schema.Struct({
      runtimePolicy: Schema.optional(RuntimePolicyContribution),
    }),
  ),
}).annotate({ identifier: 'Vista.RuntimePolicy.PackageJson' })
type PackageJson = typeof PackageJson.Type

const decodePackageJson = Schema.decodeUnknownSync(PackageJson)
const decodeInstalledRuntimeClosure = Schema.decodeUnknownSync(InstalledRuntimeClosure)

const readPackageJson = (repoRelativePath: string): PackageJson =>
  decodePackageJson(JSON.parse(readFileSync(join(root(), repoRelativePath), 'utf8')))

/**
 * Reads and caches the Vista service's own package.json so repeated policy checks share a single
 * parsed copy.
 */
export const servicePackageJson = once(
  (): PackageJson => readPackageJson('flakes/vista/service/package.json'),
)

const readClosurePackageJson = (workspaceDir: string): PackageJson | undefined => {
  const packagePath = `${workspaceDir}/package.json`
  return existsSync(join(root(), packagePath)) ? readPackageJson(packagePath) : undefined
}

const uniqueByName = (packages: readonly PackageJson[]): readonly PackageJson[] => [
  ...new Map(packages.map((pkg) => [pkg.name, pkg])).values(),
]

/**
 * Lazily computes the deduplicated set of package.json files covering the service plus every
 * workspace closure directory it declares, which together define the runtime policy's package
 * universe.
 */
export const runtimePolicyPackageJsons = once((): readonly PackageJson[] =>
  uniqueByName([
    servicePackageJson(),
    ...(servicePackageJson().$genie?.workspaceClosureDirs ?? []).flatMap((dir) => {
      const pkg = readClosurePackageJson(dir)
      return pkg === undefined ? [] : [pkg]
    }),
  ]),
)

/**
 * Returns the cached @vista/blocks package manifest, preferring the one discovered among
 * runtime-policy packages and falling back to reading it directly from disk when absent.
 */
export const kitPackageJson = once(
  (): PackageJson =>
    runtimePolicyPackageJsons().find((pkg) => pkg.name === '@vista/blocks') ??
    readPackageJson('flakes/vista/blocks/package.json'),
)

const uniqueSorted = (values: Iterable<string>): string[] => [...new Set(values)].toSorted()

const dependencyNames = (pkg: PackageJson): readonly string[] => [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

/**
 * Lazily builds and validates the installed runtime closure, consisting of the deduplicated names
 * of the service, all runtime-policy packages, and the service's dependency/peer packages plus its
 * declared workspace closure directories.
 */
export const installedRuntimeClosure = once(() =>
  decodeInstalledRuntimeClosure({
    packageNames: uniqueSorted([
      servicePackageJson().name,
      ...runtimePolicyPackageJsons().map((pkg) => pkg.name),
      ...dependencyNames(servicePackageJson()),
    ]),
    workspaceClosureDirs: uniqueSorted(servicePackageJson().$genie?.workspaceClosureDirs ?? []),
  }),
)

/**
 * Collects (once) the non-undefined runtime-policy metadata declared by each discovered package
 * under its $vista field, yielding a possibly empty list of contributions.
 */
export const runtimePolicyContributions = once((): readonly RuntimePolicyContribution[] =>
  runtimePolicyPackageJsons().flatMap((pkg) =>
    pkg.$vista?.runtimePolicy === undefined ? [] : [pkg.$vista.runtimePolicy],
  ),
)
