import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import react from '@vitejs/plugin-react'
import { Schema } from 'effect'
import { build, type Plugin } from 'vite'

const runtimeGlobals = {
  react: '__vistaReact',
  'react/jsx-runtime': '__vistaJsxRuntime',
  '@vista/blocks': '__vistaBlocks',
} as const

export class NativeAppBuildError extends Schema.TaggedError<NativeAppBuildError>()(
  'Vista.NativeAppBuildFailed',
  {
    appSource: Schema.String,
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {}

export interface NativeAppBuild {
  readonly modulePath: string
  readonly stylePath?: string
}

/**
 * Compile an AppSource to the vista.native@1 factory consumed by the host.
 *
 * Local modules are bundled, including local lazy imports. Package imports are
 * deliberately limited to injected host namespaces: bundling another copy of
 * React or the blocks' contexts would break hooks and data/host providers.
 * App-owned CSS is emitted separately; host-owned blocks CSS stays with the host.
 * StyleX-authored apps require the publication StyleX compiler before this step.
 *
 * This builder does not modify published versions. Production must invoke it
 * before inventoryTree/receipt hashing, advertise the native contract and host
 * API compatibility, and serve every emitted asset through verified inventory.
 * Tailnet authors are trusted; the receipt proves byte integrity only, and
 * there is no code-execution permission system (VRS decision 0012).
 */
export const buildNativeApp = async (options: {
  readonly appSource: string
  readonly outDir: string
}): Promise<NativeAppBuild> => {
  const entry = resolve(options.appSource, 'app.tsx')
  const sourceRoot = realpathSync(options.appSource)
  const fail = (message: string, cause?: unknown): never => {
    throw new NativeAppBuildError({
      appSource: options.appSource,
      message,
      ...(cause === undefined ? {} : { cause }),
    })
  }
  const boundary: Plugin = {
    name: 'vista-native-runtime-boundary',
    enforce: 'pre',
    resolveId(id) {
      if (id === entry || id.startsWith('.')) return undefined
      if (Object.hasOwn(runtimeGlobals, id)) return { id, external: true }
      // Vite-generated absolute/virtual module ids are internal to this build.
      if (id.startsWith('/') || id.startsWith('\0')) return undefined
      return fail(`Native AppSource import ${JSON.stringify(id)} is not a host runtime namespace`)
    },
    load(id) {
      const path = id.split('?')[0] ?? id
      if (!isAbsolute(path) || !existsSync(path)) return undefined
      const localPath = relative(sourceRoot, realpathSync(path))
      if (
        localPath.startsWith(`..${sep}`) ||
        localPath === '..' ||
        isAbsolute(localPath) ||
        localPath.split(sep).includes('node_modules')
      ) {
        return fail(`Native AppSource cannot bundle code outside its local source: ${path}`)
      }
      return undefined
    },
  }

  // Build in memory: callers can place assets inside their own immutable commit
  // boundary rather than letting Vite empty an already-published directory.
  const result = await build({
    root: dirname(entry),
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [boundary, react()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: false,
      sourcemap: false,
      cssCodeSplit: false,
      lib: {
        entry,
        name: '__vistaApp',
        formats: ['iife'],
        fileName: () => 'app.js',
        cssFileName: 'app',
      },
      rolldownOptions: {
        output: {
          exports: 'named',
          globals: runtimeGlobals,
          codeSplitting: false,
        },
      },
    },
  }).catch((cause: unknown) =>
    fail(`Native AppSource compilation failed: ${cause instanceof Error ? cause.message : String(cause)}`, cause),
  )
  const outputs = Array.isArray(result) ? result : [result]
  const output = outputs[0]
  if (outputs.length !== 1 || output === undefined || !('output' in output)) {
    return fail('Native AppSource build must produce one in-memory output')
  }
  const chunks = output.output.filter((item) => item.type === 'chunk')
  const assets = output.output.filter((item) => item.type === 'asset')
  const chunk = chunks[0]
  if (
    chunks.length !== 1 ||
    chunk === undefined ||
    !chunk.exports.includes('default') ||
    chunk.imports.some((id) => !Object.hasOwn(runtimeGlobals, id)) ||
    chunk.dynamicImports.some((id) => id !== chunk.fileName)
  ) {
    return fail('Native AppSource must export a default component in a single module without unresolved imports')
  }
  const unsupportedAsset = assets.find((asset) => !asset.fileName.endsWith('.css'))
  if (unsupportedAsset !== undefined || assets.length > 1) {
    return fail('Native AppSource supports one stylesheet and inline assets only')
  }
  const modulePath = join(resolve(options.outDir), 'app.mjs')
  const moduleSource = [
    '// vista.native@1: trusted code, runtime namespaces supplied by the host.',
    'export const createVistaApp = (runtime) => {',
    'const __vistaReact = runtime.react;',
    'const __vistaJsxRuntime = runtime["react/jsx-runtime"];',
    'const __vistaBlocks = runtime["@vista/blocks"];',
    chunk.code,
    'return __vistaApp.default;',
    '};',
    '',
  ].join('\n')
  mkdirSync(dirname(modulePath), { recursive: true })
  writeFileSync(modulePath, moduleSource)
  const style = assets[0]
  if (style === undefined) return { modulePath }
  const stylePath = join(dirname(modulePath), 'app.css')
  writeFileSync(stylePath, style.source)
  return { modulePath, stylePath }
}
