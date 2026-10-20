import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { createIdResolver, type Environment, type Plugin } from 'vite'

import { appsDir } from '../paths.ts'
import { isVistaProviderModuleSpecifier } from './import-classifier.ts'
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
 * Builds a Vite pre-enforcement plugin that enforces the runtime import policy during module
 * resolution, returning null (deferring to Vite) for generated Stylex runtime imports, provider
 * implementation modules, and non-app-authored importers while blocking policy-violating imports
 * elsewhere.
 */
export const vistaRuntimeImportPolicy = (root = appsDir()): Plugin => ({
  name: 'vista-runtime-import-policy',
  enforce: 'pre',
  resolveId(source, importer) {
    if (isServiceGeneratedStylexRuntime(root, source, importer)) return null
    // Provider implementations are loaded by the SSR registry, never traversed
    // as client modules. Their own Node/service imports are valid.
    if (importer !== undefined && isVistaProviderModuleSpecifier(importer.split('?', 1)[0]!)) {
      return null
    }
    if (!isAppAuthoredImporter(root, importer)) return null

    const problem = importPolicyProblem({ root, importer, source })
    if (problem.diagnostic.allowed) return null
    throw runtimePolicyImportError({ root, problems: [problem] })
  },
})

type DependencyResolve = (
  environment: Environment,
  id: string,
  importer?: string,
  aliasOnly?: boolean,
) => Promise<string | undefined>

/**
 * Builds a Vite pre-resolution plugin that, after config resolution installs an id resolver rooted
 * at the dependency anchor directory, resolves dependency imports whose import root is listed
 * among the runtime policy's public import roots and defers all others.
 */
export const vistaDependencyAnchorResolver = (dependencyAnchor: string): Plugin => {
  let resolveFromAnchor: DependencyResolve | undefined

  return {
    name: 'vista-dependency-anchor-resolver',
    enforce: 'pre',
    configResolved(config) {
      resolveFromAnchor = createIdResolver(config, { root: dependencyAnchor })
    },
    async resolveId(source, importer, options) {
      const policy = vistaRuntimePolicy()
      if (!policy.publicImportRoots.includes(importRoot(source))) return null

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved !== null) return resolved

      const isExactAlias = policy.aliases.some(
        (alias) => alias.public && alias.specifier === source,
      )
      if (isExactAlias) return null

      const anchorImporter = join(dependencyAnchor, 'package.json')
      const anchored = await this.resolve(source, anchorImporter, {
        ...options,
        skipSelf: true,
      })
      if (anchored !== null) return anchored

      const anchorId = await resolveFromAnchor?.(this.environment, source, anchorImporter)
      if (anchorId === undefined) return null
      return (
        (await this.resolve(anchorId, importer, { ...options, skipSelf: true })) ?? {
          id: anchorId,
        }
      )
    },
  }
}
