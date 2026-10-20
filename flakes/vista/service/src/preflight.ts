import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import type { SemanticManifest } from '@vista/blocks/internal/authoring'
import {
  agentTimeline,
  diskIndex,
  gh,
  ompUsage,
  otel,
  overview,
  pyroscope,
  pty,
  trace,
} from '@vista/blocks/internal/provider-contracts'
import react from '@vitejs/plugin-react'
import { Result, Schema } from 'effect'
import { createServer as createViteServer, type ViteDevServer } from 'vite'

import { createStylexVitePlugins } from '@overeng/utils/node/stylex'

import { bindingsFromManifest, type SemanticCaptureBinding } from './data/app.ts'
import { discoverProviders } from './data/mount.ts'
import { isProviderMount } from './data/provider.ts'
import { deriveProjection, type DerivedProjection } from './derive-projection.ts'
import { depsNodeModules } from './paths.ts'
import type {
  VistaCheckDiagnostic,
  VistaCheckFailed,
  VistaCheckReady,
  VistaCheckResult,
} from './preflight-contract.ts'
import {
  validateVistaAppSource,
  vistaRuntimePolicy,
  vistaViteResolveConfig,
} from './runtime-policy/index.ts'
import { unfilledScaffoldSlots } from './scaffold.ts'
import { semanticExtractor } from './semantic-extractor.ts'
import { typecheckVistaSource } from './source-typecheck.ts'

/**
 * Ready variant of the preflight result that bundles the passing check report with the derived
 * projection produced from it.
 */
export interface VistaPreflightReady {
  readonly _tag: 'ready'
  readonly report: VistaCheckReady
  readonly projection: DerivedProjection
}

/** Failed variant of the preflight result, carrying only the failing check report with no projection. */
export interface VistaPreflightFailed {
  readonly _tag: 'failed'
  readonly report: VistaCheckFailed
}

/**
 * Discriminated union of the ready and failed preflight outcomes, tagged so callers can narrow on
 * _tag.
 */
export type VistaPreflightResult = VistaPreflightReady | VistaPreflightFailed

type NoServicePayloadSchema = Schema.ConstraintDecoder<unknown>

interface PreflightRequest {
  readonly payloadSchema: NoServicePayloadSchema
  readonly kind: 'unary' | 'subscription' | 'command'
}

interface PreflightProvider {
  readonly id: string
  readonly group: {
    readonly requests: ReadonlyMap<string, PreflightRequest>
  }
  readonly ops: Readonly<Record<string, unknown>>
}
interface DynamicPreflightProvider {
  readonly id: string
  readonly group: {
    readonly requests: ReadonlyMap<string, unknown>
  }
  readonly ops: Readonly<Record<string, unknown>>
}

const shippedProviders = [
  agentTimeline,
  diskIndex,
  gh,
  ompUsage,
  otel,
  overview,
  pyroscope,
  pty,
  trace,
] satisfies readonly DynamicPreflightProvider[]

const unique = (values: Iterable<string>): string[] => [
  ...new Set([...values].map((value) => value.trim()).filter((value) => value.length > 0)),
]

/**
 * Resolve the complete Provider contract catalog for one AppSource. All
 * admission entrypoints use this exact discovery path; loading a mount inspects
 * only its contract metadata and never builds the implementation Layer.
 */
export const admitVistaProviders = async (
  vite: ViteDevServer,
  evaluationRoot: string,
): Promise<readonly DynamicPreflightProvider[]> => {
  const local: DynamicPreflightProvider[] = []
  for (const modulePath of discoverProviders(evaluationRoot, join(evaluationRoot, 'providers'))) {
    const loaded = (await vite.ssrLoadModule(modulePath)) as { readonly default?: unknown }
    if (!isProviderMount(loaded.default)) {
      throw new TypeError(
        `${modulePath}: default export must be mountProvider(implementation, layer)`,
      )
    }
    local.push(loaded.default.implementation.contract)
  }
  return [...shippedProviders, ...local]
}

const authoredSource = (
  inputPath: string,
): { readonly appSource: string; readonly appPath: string } => {
  const appSource = resolve(inputPath)
  return { appSource, appPath: join(appSource, 'app.tsx') }
}

const sourceFailure = (
  appPath: string,
  message: string,
  consequences: readonly string[] = [],
): VistaPreflightFailed => ({
  _tag: 'failed',
  report: {
    _tag: 'failed',
    path: appPath,
    diagnostic: { code: 'source', message, consequences: unique(consequences) },
  },
})

const isRuntimePolicyError = (
  cause: unknown,
): cause is {
  readonly _tag: 'Vista.RuntimePolicyError'
  readonly message: string
  readonly problems: readonly string[]
} =>
  typeof cause === 'object' &&
  cause !== null &&
  '_tag' in cause &&
  cause._tag === 'Vista.RuntimePolicyError' &&
  'problems' in cause &&
  Array.isArray(cause.problems)

const normalizeEvaluationLines = (
  cause: unknown,
  appPath: string,
  evaluationAppPath?: string,
): readonly string[] => {
  const normalizedAppPath = appPath.replaceAll('\\', '/')
  const raw = cause instanceof Error ? cause.message : String(cause)
  const normalizedEvaluationPath = evaluationAppPath?.replaceAll('\\', '/')
  const normalized = raw
    .replaceAll('\\', '/')
    .replaceAll(normalizedEvaluationPath ?? '\0', normalizedAppPath)
    .replaceAll('\\', '/')
    .replaceAll(/[^\s:]*\.papp-[^\s:/]+\/app\.tsx/g, normalizedAppPath)
    .replaceAll(
      /(^|[\s:(])\/app\.tsx(?=[:\s]|$)/g,
      (_match, prefix: string) => `${prefix}${normalizedAppPath}`,
    )
  const lines = unique(normalized.split('\n'))
  if (lines.length === 0) return ['semantic evaluation failed']
  lines[0] = lines[0]!
    .replace(/^could not extract semantic manifest from .*?:\s*/, '')
    .replace(/^.*?semantic evaluation failed:\s*/, '')
    .replace(/^Error:\s*/, '')
  return unique(lines)
}
const evaluationFailure = (
  appPath: string,
  cause: unknown,
  evaluationAppPath?: string,
): VistaPreflightFailed => {
  const lines = normalizeEvaluationLines(cause, appPath, evaluationAppPath)
  const root = lines[0] ?? 'semantic evaluation failed'
  return {
    _tag: 'failed',
    report: {
      _tag: 'failed',
      path: appPath,
      diagnostic: {
        code: 'evaluation',
        message: root,
        consequences: unique(lines.slice(1)),
      },
    },
  }
}

const normalizePreflightProviders = (
  providers: Iterable<DynamicPreflightProvider>,
):
  | { readonly _tag: 'ready'; readonly providers: readonly PreflightProvider[] }
  | { readonly _tag: 'failed'; readonly diagnostic: VistaCheckDiagnostic } => {
  const normalized: PreflightProvider[] = []
  const problems: string[] = []

  for (const provider of providers) {
    const requests = new Map<string, PreflightRequest>()
    for (const [operation, request] of provider.group.requests) {
      const descriptor = provider.ops[operation]
      if (
        (typeof request !== 'object' && typeof request !== 'function') ||
        request === null ||
        !('payloadSchema' in request) ||
        !Schema.isSchema(request.payloadSchema)
      ) {
        problems.push(`${provider.id}.${operation}: request has no payload Schema`)
        continue
      }
      if (
        (typeof descriptor !== 'object' && typeof descriptor !== 'function') ||
        descriptor === null
      ) {
        problems.push(`${provider.id}.${operation}: request has no Operation descriptor`)
        continue
      }
      // Rpc payloads are transport codecs and therefore service-free by contract.
      // The dynamic registry erased that phantom channel; the Schema brand check
      // above is the runtime proof available at this boundary.
      const descriptorKind = Reflect.get(descriptor, 'kind')
      requests.set(operation, {
        payloadSchema: request.payloadSchema as unknown as NoServicePayloadSchema,
        kind:
          descriptorKind === 'subscription'
            ? 'subscription'
            : descriptorKind === 'command'
              ? 'command'
              : 'unary',
      })
    }
    normalized.push({ id: provider.id, group: { requests }, ops: provider.ops })
  }

  const consequences = unique(problems)
  return consequences.length === 0
    ? { _tag: 'ready', providers: normalized }
    : {
        _tag: 'failed',
        diagnostic: {
          code: 'data',
          message: `${consequences.length} malformed provider request${consequences.length === 1 ? '' : 's'}`,
          consequences,
        },
      }
}

/** Validate internal DataBindings against the Provider RpcGroup schema spine. */
export const validateVistaDataBindings = (
  bindings: readonly SemanticCaptureBinding[],
  providers: Iterable<DynamicPreflightProvider>,
): VistaCheckDiagnostic | undefined => {
  const normalized = normalizePreflightProviders(providers)
  if (normalized._tag === 'failed') return normalized.diagnostic
  const contracts = new Map(normalized.providers.map((provider) => [provider.id, provider]))
  const problems: string[] = []

  for (const binding of bindings) {
    const provider = contracts.get(binding.provider)
    if (provider === undefined) {
      problems.push(`${binding.semanticId}: provider "${binding.provider}" is not defined`)
      continue
    }
    const requests = provider.group.requests
    const rpc = requests.get(binding.operation)
    if (rpc === undefined) {
      problems.push(
        `${binding.semanticId}: provider "${binding.provider}" has no operation "${binding.operation}"`,
      )
      continue
    }
    if (rpc.kind === 'command') {
      problems.push(
        `${binding.semanticId}: command operation ${binding.provider}.${binding.operation} is live-only and cannot be bound or captured`,
      )
      continue
    }
    if (binding.policy.mode === 'subscription' && rpc.kind !== 'subscription') {
      problems.push(
        `${binding.semanticId}: mode "subscription" requires a subscription operation; ${binding.provider}.${binding.operation} is unary`,
      )
      continue
    }
    if (rpc.kind === 'subscription' && binding.policy.mode !== 'subscription') {
      problems.push(
        `${binding.semanticId}: subscription operation ${binding.provider}.${binding.operation} requires mode "subscription", not "${binding.policy.mode}"`,
      )
      continue
    }
    const decoded = Schema.decodeUnknownResult(rpc.payloadSchema)(binding.args)
    if (Result.isFailure(decoded)) {
      problems.push(
        `${binding.semanticId}: invalid payload for ${binding.provider}.${binding.operation} — ${String(decoded.failure)}`,
      )
    }
  }

  const consequences = unique(problems)
  return consequences.length === 0
    ? undefined
    : {
        code: 'data',
        message: `${consequences.length} invalid data request${consequences.length === 1 ? '' : 's'}`,
        consequences,
      }
}

const readyReport = (
  appPath: string,
  semantics: SemanticManifest,
  bindings: readonly SemanticCaptureBinding[],
  slots: readonly string[],
): VistaCheckReady => ({
  _tag: 'ready',
  path: appPath,
  title: semantics.app.title,
  semanticNodes: semantics.nodes.length,
  dataRequests: bindings.length,
  warnings:
    slots.length === 0
      ? []
      : [
          {
            code: 'scaffold-slots',
            message: `Unfilled scaffold slots: ${slots.join(', ')}. Replace the slot comments with real context, a reader ask, and one primary visual before sharing.`,
          },
        ],
})

/**
 * Evaluate authored source and apply the import, semantic, and provider-contract
 * checks shared by `vista check`, publish preview, and durable publication.
 */
export const preflightVistaApp = async (inputPath: string): Promise<VistaPreflightResult> => {
  const { appSource, appPath } = authoredSource(inputPath)
  if (!existsSync(appSource)) {
    return sourceFailure(appPath, 'Vista AppSource directory does not exist')
  }
  if (!statSync(appSource).isDirectory()) {
    return sourceFailure(appSource, 'Vista AppSource path must be a directory')
  }
  if (!existsSync(appPath) || !statSync(appPath).isFile()) {
    return sourceFailure(appPath, 'Vista app source must contain app.tsx')
  }
  for (const legacy of ['app.json', 'index.html', 'main.tsx', '.vista-main.tsx']) {
    if (existsSync(join(appSource, legacy))) {
      return sourceFailure(
        appPath,
        'authored Vista apps contain app.tsx plus local imports/assets',
        [`remove legacy ${legacy} from ${appSource}`],
      )
    }
  }

  try {
    validateVistaAppSource(appSource)
  } catch (cause) {
    if (isRuntimePolicyError(cause)) {
      return {
        _tag: 'failed',
        report: {
          _tag: 'failed',
          path: appPath,
          diagnostic: {
            code: 'import',
            message: 'Vista app imports are outside the runtime policy',
            consequences: unique(cause.problems),
          },
        },
      }
    }
    return sourceFailure(appPath, cause instanceof Error ? cause.message : String(cause))
  }

  const workspace = mkdtempSync(join(tmpdir(), 'vista-check-'))
  const evaluationRoot = join(workspace, 'app')
  cpSync(appSource, evaluationRoot, {
    recursive: true,
    filter: (source) =>
      source === appSource || (basename(source) !== 'node_modules' && basename(source) !== '.vite'),
  })
  symlinkSync(depsNodeModules(), join(evaluationRoot, 'node_modules'), 'dir')
  const cache = join(workspace, 'cache')
  const policy = vistaRuntimePolicy()
  const runtimeResolve = vistaViteResolveConfig()
  // Packed StyleX libraries live under node_modules: Vite must SSR-transform
  // their source rather than hand them to Node or its dependency optimizer.
  const stylexLibraries = [
    '@vista/blocks',
    '@vista/ui',
    '@overeng/agent-timeline',
    '@overeng/devbar',
    '@overeng/effect-rpc-explorer-react',
    '@overeng/stylex-tokens',
  ]
  let vite: ViteDevServer | undefined
  try {
    const typeErrors = await typecheckVistaSource(evaluationRoot, appSource)
    if (typeErrors.length > 0) {
      return sourceFailure(appPath, 'Vista app source does not typecheck', typeErrors)
    }
    vite = await createViteServer({
      root: evaluationRoot,
      configFile: false,
      appType: 'custom',
      logLevel: 'silent',
      cacheDir: cache,
      optimizeDeps: {
        noDiscovery: true,
      },
      plugins: [
        ...createStylexVitePlugins({
          externalPackages: stylexLibraries,
          entries: [join(evaluationRoot, 'app.tsx')],
        }).map((plugin) => Object.assign(plugin, { configureServer: undefined })),
        semanticExtractor(),
        react(),
      ],
      // Resolve like the runtime servers (realpath ids). The evaluation copy
      // reaches deps through a `node_modules` symlink; with `preserveSymlinks`
      // Vite would externalize `effect` under that path for the app and under
      // the workspace root for `@vista/blocks`, and under devenv's
      // `NODE_PRESERVE_SYMLINKS=1` Node loads those as two `effect` realms whose
      // Schemas cannot decode each other's payloads.
      resolve: { dedupe: [...runtimeResolve.dedupe], alias: runtimeResolve.alias },
      ssr: {
        external: [...policy.ssrExternal],
        noExternal: stylexLibraries,
      },
      // Finite SSR evaluation needs StyleX transforms, not its development CSS
      // middleware/update interval. As in vitest.config.ts, omit configureServer
      // and avoid an HTTP listener or process/stdin shutdown handlers altogether.
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
        fs: { allow: [evaluationRoot, depsNodeModules()], strict: false },
      },
    })
    const projection = await deriveProjection(vite, '/app.tsx')
    const bindings = bindingsFromManifest(projection.semantics)
    const providers = await admitVistaProviders(vite, evaluationRoot)
    const diagnostic = validateVistaDataBindings(bindings, providers)
    if (diagnostic !== undefined) {
      return { _tag: 'failed', report: { _tag: 'failed', path: appPath, diagnostic } }
    }
    return {
      _tag: 'ready',
      report: readyReport(
        appPath,
        projection.semantics,
        bindings,
        unfilledScaffoldSlots(readFileSync(join(evaluationRoot, 'app.tsx'), 'utf8')),
      ),
      projection,
    }
  } catch (cause) {
    return evaluationFailure(appPath, cause, join(evaluationRoot, 'app.tsx'))
  } finally {
    await vite?.close()
    rmSync(workspace, { recursive: true, force: true })
  }
}

/**
 * Asynchronously runs preflight on the app rooted at inputPath (defaulting to the current working
 * directory) and returns just the check report, discarding any derived projection.
 */
export const checkVistaApp = async (inputPath = process.cwd()): Promise<VistaCheckResult> => {
  const result = await preflightVistaApp(inputPath)
  return result.report
}

/**
 * Error type that carries the failing VistaCheckFailed report, with its message assembled from the
 * diagnostic message, path, and consequences.
 */
export class VistaPreflightError extends Error {
  readonly report: VistaCheckFailed

  constructor(report: VistaCheckFailed) {
    super(
      [report.diagnostic.message, `at ${report.path}`, ...report.diagnostic.consequences].join(
        '\n',
      ),
    )
    this.name = 'VistaPreflightError'
    this.report = report
  }
}
