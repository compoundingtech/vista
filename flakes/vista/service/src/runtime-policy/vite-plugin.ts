import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { parse } from '@babel/parser'
import { createIdResolver, type Environment, type Plugin, type ResolverFunction } from 'vite'

import { appsDir } from '../paths.ts'
import { classifyVistaClientImport, isVistaProviderModuleSpecifier } from './import-classifier.ts'
import { importPolicyProblem, runtimePolicyImportError } from './import-diagnostics.ts'
import { importRoot, vistaRuntimePolicy } from './project.ts'

const isInsideDir = (dir: string, path: string): boolean => {
  const rel = relative(dir, path)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

const isAppAuthoredImporter = (root: string, importer: string | undefined): importer is string =>
  importer !== undefined && isInsideDir(root, importer)

const isServiceGeneratedStylexRuntime = (
  root: string,
  source: string,
  importer: string | undefined,
): boolean =>
  source === 'virtual:stylex:runtime' &&
  importer !== undefined &&
  resolve(importer) === resolve(root, 'index.html') &&
  !existsSync(importer)

/**
 * Enforces the runtime import policy at both ordinary and alias resolver boundaries.
 * Generated StyleX imports, provider implementations, and non-authored importers
 * retain the same exemptions at either boundary.
 */
const enforceRuntimeImportPolicy = (
  root: string,
  source: string,
  importer: string | undefined,
): void => {
  if (isServiceGeneratedStylexRuntime(root, source, importer)) return
  // Provider implementations are loaded by the SSR registry, never traversed
  // as client modules. Their own Node/service imports are valid.
  if (importer !== undefined && isVistaProviderModuleSpecifier(importer.split('?', 1)[0]!)) return
  if (!isAppAuthoredImporter(root, importer)) return
  const problem = importPolicyProblem({ root, importer, source })
  if (!problem.diagnostic.allowed) {
    throw runtimePolicyImportError({ root, problems: [problem] })
  }
}

export const vistaRuntimeImportPolicy = (root = appsDir()): Plugin => ({
  name: 'vista-runtime-import-policy',
  enforce: 'pre',
  resolveId(source, importer) {
    enforceRuntimeImportPolicy(root, source, importer)
    return null
  },
})

type DependencyEnvironment = Pick<Environment, 'name' | 'getTopLevelConfig' | 'config' | 'logger'>
type DependencyResolve = (
  environment: DependencyEnvironment,
  id: string,
  importer?: string,
  aliasOnly?: boolean,
) => Promise<string | undefined>

/**
 * Builds a Vite pre-resolution plugin that, after config resolution installs an id resolver rooted
 * at the dependency anchor directory, resolves dependency imports whose import root is listed
 * among the runtime policy's public import roots and defers all others.
 */
export const vistaDependencyAnchorResolver = (
  dependencyAnchor: string,
  draft?: { root: string; include: readonly string[] },
): Plugin => {
  let resolveFromAnchor: DependencyResolve | undefined
  const publicSeeds =
    draft?.include.filter((source) => classifyVistaClientImport(source)._tag === 'provided') ?? []
  const anchorEnvironments = new WeakMap<DependencyEnvironment, DependencyEnvironment>()
  const seedEntries = new Map<string, ReadonlyMap<string, string>>()
  const anchorImporter = join(dependencyAnchor, 'package.json')
  const resolveAnchored = (environment: DependencyEnvironment, source: string) => {
    let anchored = anchorEnvironments.get(environment)
    if (anchored === undefined) {
      // The internal resolver must retain policy aliases but not recurse through
      // the seed aliases that delegate back to it.
      const config = {
        ...environment.config,
        resolve: {
          ...environment.config.resolve,
          alias: environment.config.resolve.alias.filter(
            (alias) => alias.customResolver !== resolveSeed,
          ),
        },
      }
      anchored = new Proxy(environment, {
        get: (target, property, receiver) =>
          property === 'config' ? config : Reflect.get(target, property, receiver),
      })
      anchorEnvironments.set(environment, anchored)
    }
    return resolveFromAnchor?.(anchored, source, anchorImporter)
  }
  const resolveSeed: ResolverFunction = function (source, importer) {
    enforceRuntimeImportPolicy(draft!.root, source, importer)
    return seedEntries.get(this.environment.name)?.get(source) ?? null
  }

  return {
    name: 'vista-dependency-anchor-resolver',
    enforce: 'pre',
    config() {
      if (draft === undefined) return
      return {
        resolve: {
          // Vite's manual include resolver runs only aliases and its built-in
          // resolver, not resolveId plugins. Keep seed ids unchanged so imports
          // share optimizer metadata; match exactly, never alias package subpaths.
          alias: publicSeeds.map((source) => ({
            find: new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
            replacement: source,
            customResolver: resolveSeed,
          })),
        },
      }
    },
    configResolved(config) {
      resolveFromAnchor = createIdResolver(config, { root: dependencyAnchor })
    },
    async applyToEnvironment(environment) {
      if (draft !== undefined) {
        // Vite's alias ResolverFunction is synchronous. Resolve asynchronously
        // during environment initialization, before optimizer/import resolution.
        const entries = new Map<string, string>()
        for (const source of publicSeeds) {
          const resolved = await resolveAnchored(environment, source)
          if (resolved !== undefined) entries.set(source, resolved)
        }
        seedEntries.set(environment.name, entries)
      }
      return true
    },
    async transform(code, id) {
      // Babel resolves StyleX token imports itself, before Vite's resolveId.
      // Give both spellings the canonical absolute filename even when authored
      // sources live outside the workspace's node_modules ancestry.
      const extension = /\.[cm]?([jt]sx?)(?:\?|$)/.exec(id)?.[1]
      if (extension === undefined || !code.includes('/tokens.stylex')) return null
      const ast = parse(code, {
        sourceType: 'unambiguous',
        plugins:
          extension === 'tsx'
            ? ['typescript', 'jsx']
            : extension === 'ts'
              ? ['typescript']
              : extension === 'jsx'
                ? ['jsx']
                : [],
      })
      let transformed = code
      for (const node of ast.program.body.toReversed()) {
        if (
          node.type !== 'ImportDeclaration' &&
          node.type !== 'ExportNamedDeclaration' &&
          node.type !== 'ExportAllDeclaration'
        ) continue
        const source = node.source
        if (
          source === null ||
          source === undefined ||
          (source.value !== '@overeng/geist-design-system/tokens.stylex' &&
            source.value !== '@vista/ui/tokens.stylex') ||
          source.start === null ||
          source.start === undefined ||
          source.end === null ||
          source.end === undefined
        ) continue
        const canonical = await this.resolve('@vista/ui/tokens.stylex', anchorImporter)
        if (canonical === null) continue
        transformed =
          transformed.slice(0, source.start) +
          JSON.stringify(canonical.id.split('?', 1)[0]) +
          transformed.slice(source.end)
      }
      return transformed === code ? null : { code: transformed, map: null }
    },
    async resolveId(source, importer, options) {
      const policy = vistaRuntimePolicy()
      if (!policy.publicImportRoots.includes(importRoot(source))) return null

      // Resolve legacy entries through the canonical package before Vite sees
      // a forwarding module, so React contexts, CSS and StyleX tokens share IDs.
      if (importRoot(source) === '@overeng/geist-design-system') {
        const canonical = `@vista/ui${source.slice('@overeng/geist-design-system'.length)}`
        return (
          (await this.resolve(canonical, importer, { ...options, skipSelf: true })) ??
          this.resolve(canonical, anchorImporter, { ...options, skipSelf: true })
        )
      }

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved !== null) return resolved

      const isExactAlias = policy.aliases.some(
        (alias) => alias.public && alias.specifier === source,
      )
      if (isExactAlias) return null

      // Prefer normal resolution, then the same dependency anchor used by seeds.
      const anchored = await this.resolve(source, anchorImporter, {
        ...options,
        skipSelf: true,
      })
      if (anchored !== null) return anchored

      const anchorId = await resolveAnchored(this.environment, source)
      if (anchorId === undefined) return null
      return (
        (await this.resolve(anchorId, importer, { ...options, skipSelf: true })) ?? {
          id: anchorId,
        }
      )
    },
  }
}
