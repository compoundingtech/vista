import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createIdResolver } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { appSourcePath, blocksDir, depsNodeModules } from './paths.ts'
import { encodeRouteOwner } from './control.ts'
import type { ServiceState } from './server.ts'
import { freePort } from './test-support.ts'

const OWNER = 'dev3.runtime-policy'

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let state: ServiceState
let appSource: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vista-runtime-policy-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  const sources = join(dir, 'sources')
  process.env.VISTA_SOURCES = sources

  appSource = appSourcePath(sources, OWNER, 'blocked-import')
  mkdirSync(appSource, { recursive: true })
  writeFileSync(
    join(appSource, 'app.tsx'),
    "import 'lodash'\nexport default function App() { return <div>unreachable</div> }\n",
  )
  const allowedSource = appSourcePath(sources, OWNER, 'allowed-imports')
  mkdirSync(allowedSource, { recursive: true })
  writeFileSync(
    join(allowedSource, 'app.tsx'),
    "import React from 'react'\nimport { AppRoot } from '@vista/blocks'\nimport '@pierre/diffs/react'\nexport default function App() { return <AppRoot title=\"Dependency anchor\" template=\"architecture-review\" scope={React.version} /> }\n",
  )
  const legacySource = appSourcePath(sources, OWNER, 'legacy-ui')
  mkdirSync(legacySource, { recursive: true })
  writeFileSync(
    join(legacySource, 'app.tsx'),
    `import { AppRoot } from '@vista/blocks'
import { Button } from '@overeng/geist-design-system'
import '@overeng/geist-design-system/document.css'
import { tokens } from '@overeng/geist-design-system/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
const styles = stylex.create({ text: { color: tokens['--ds-foreground'] } })
export default function App() {
  return <AppRoot title="Legacy UI" template="architecture-review" scope="compatibility">
    <Button><span {...stylex.props(styles.text)}>Ready</span></Button>
  </AppRoot>
}
`,
  )
  const canonicalSource = appSourcePath(sources, OWNER, 'canonical-ui')
  mkdirSync(canonicalSource, { recursive: true })
  writeFileSync(
    join(canonicalSource, 'helper.ts'),
    `import { tokens } from '@vista/ui/tokens.stylex'
type Config = { enabled: boolean }
const v = <Config>{ enabled: true }
export const label = <string>'/tokens.stylex'
export const foreground = v.enabled ? tokens['--ds-foreground'] : undefined
`,
  )
  writeFileSync(
    join(canonicalSource, 'app.tsx'),
    `import { AppRoot } from '@vista/blocks'
import { Button } from '@vista/ui'
import { foreground, label } from './helper.ts'
export default function App() {
  return <AppRoot title="Canonical UI" template="architecture-review" scope={label}>
    <Button><span style={{ color: foreground }}>Ready</span></Button>
  </AppRoot>
}
`,
  )

  const { startService } = await import('./server.ts')
  port = await freePort()
  const started = await startService(port)
  close = started.close
  state = started.state
}, 60_000)

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('Vista runtime import policy Vite enforcement', () => {
  it('preserves TypeScript angle assertions containing token-path payload strings', async () => {
    // Runtime-policy modules capture the isolated roots configured by beforeAll.
    const { vistaDependencyAnchorResolver } = await import('./runtime-policy/vite-plugin.ts')
    const transform = vistaDependencyAnchorResolver(join(depsNodeModules(), '..')).transform
    if (typeof transform !== 'function') throw new Error('expected transform hook')
    expect(
      await transform.call(
        {} as never,
        "export const label = <string>'/tokens.stylex'",
        join(appSource, 'helper.ts'),
      ),
    ).toBeNull()
  })

  it('serves canonical UI with a token-importing TypeScript angle-assertion helper', async () => {
    const response = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/canonical-ui/draft/app.tsx`,
    )
    expect(response.status).toBe(200)
    const helper = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/canonical-ui/draft/helper.ts`,
    )
    expect(helper.status).toBe(200)
  })

  it('serves legacy UI imports and resolves every supported export to its canonical file', async () => {
    const response = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/legacy-ui/draft/app.tsx`,
    )
    expect(response.status).toBe(200)
    const draft = state.drafts.get(`${encodeRouteOwner(OWNER)}/legacy-ui`)
    expect(draft).toBeDefined()
    const importer = join(
      appSourcePath(process.env.VISTA_SOURCES!, OWNER, 'legacy-ui'),
      'app.tsx',
    )
    for (const suffix of [
      '',
      '/components',
      '/foundations',
      '/document.css',
      '/styles.css',
      '/tokens.stylex',
    ]) {
      const legacy = `@overeng/geist-design-system${suffix}`
      const canonical = `@vista/ui${suffix}`
      const legacyResolved = await draft!.pluginContainer.resolveId(legacy, importer)
      const canonicalResolved = await draft!.pluginContainer.resolveId(canonical, importer)
      expect(legacyResolved, legacy).not.toBeNull()
      expect(canonicalResolved, canonical).not.toBeNull()
      expect(legacyResolved!.id, legacy).toBe(canonicalResolved!.id)
    }
    // Providers execute in the standing SSR realm, not the draft client realm.
    const legacyUi = await state.published.ssrLoadModule('@overeng/geist-design-system')
    const canonicalUi = await state.published.ssrLoadModule('@vista/ui')
    expect(legacyUi.Button).toBe(canonicalUi.Button)
    const legacyTokens = await state.published.ssrLoadModule(
      '@overeng/geist-design-system/tokens.stylex',
    )
    const canonicalTokens = await state.published.ssrLoadModule('@vista/ui/tokens.stylex')
    expect(legacyTokens.tokens).toBe(canonicalTokens.tokens)
  })

  it('throws a typed runtime-policy error from the resolver boundary', async () => {
    const { vistaRuntimeImportPolicy } = await import('./runtime-policy/vite-plugin.ts')
    const plugin = vistaRuntimeImportPolicy(appSource)
    const resolveId = plugin.resolveId
    if (typeof resolveId !== 'function') throw new Error('expected resolveId hook')

    const importer = join(appSource, 'app.tsx')

    try {
      await resolveId.call({} as never, 'lodash', importer, {} as never)
      throw new Error('expected resolver to reject lodash')
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          _tag: 'Vista.RuntimePolicyError',
          importProblems: [
            expect.objectContaining({
              source: 'lodash',
              relativeImporter: 'app.tsx',
            }),
          ],
        }),
      )
    }
  })

  it('allows only the service-generated StyleX runtime import', async () => {
    const { vistaRuntimeImportPolicy } = await import('./runtime-policy/vite-plugin.ts')
    const plugin = vistaRuntimeImportPolicy(appSource)
    const resolveId = plugin.resolveId
    if (typeof resolveId !== 'function') throw new Error('expected resolveId hook')

    expect(
      resolveId.call(
        {} as never,
        'virtual:stylex:runtime',
        join(appSource, 'index.html'),
        {} as never,
      ),
    ).toBeNull()

    expect(() =>
      resolveId.call(
        {} as never,
        'virtual:stylex:runtime',
        join(appSource, 'app.tsx'),
        {} as never,
      ),
    ).toThrow('virtual:stylex:runtime')

    expect(
      resolveId.call(
        {} as never,
        './local.ts',
        join(appSource, 'app.tsx'),
        {} as never,
      ),
    ).toBeNull()
  })

  it('resolves provided packages from the service dependency anchor outside workspace ancestry', async () => {
    const allowedSource = appSourcePath(
      process.env.VISTA_SOURCES!,
      OWNER,
      'allowed-imports',
    )
    const response = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/allowed-imports/draft/app.tsx`,
    )
    expect(response.status).toBe(200)

    const draft = state.drafts.get(`${encodeRouteOwner(OWNER)}/allowed-imports`)
    expect(draft).toBeDefined()
    const importer = join(allowedSource, 'app.tsx')
    const react = await draft!.pluginContainer.resolveId('react', importer)
    const subpath = await draft!.pluginContainer.resolveId('@pierre/diffs/react', importer)
    expect(react).not.toBeNull()
    expect(subpath).not.toBeNull()

    // The public resolver API can inspect the source entry without depending on
    // an optimizer output that may still be bundling after the cold request.
    const resolveSource = createIdResolver(draft!.config, { asSrc: false, scan: true })
    const reactSource = await resolveSource(draft!.environments.client!, 'react', importer)
    expect(reactSource).toBeDefined()
    const reactId = reactSource!.split('?', 1)[0]!
    expect(realpathSync(reactId)).toBe(realpathSync(join(depsNodeModules(), 'react', 'index.js')))
    expect(subpath!.id).not.toContain(allowedSource)
  })

  it('anchors only public seeds while preserving all declared includes and successful draft initialization', async () => {
    const response = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/allowed-imports/draft/app.tsx`,
    )
    expect(response.status).toBe(200)
    const draft = state.drafts.get(`${encodeRouteOwner(OWNER)}/allowed-imports`)!
    // Load after beforeAll sets the isolated source/cache environment.
    const { classifyVistaClientImport, vistaRuntimePolicy } = await import('./runtime-policy/index.ts')
    expect(draft.config.root).toBe(
      appSourcePath(process.env.VISTA_SOURCES!, OWNER, 'allowed-imports'),
    )
    // Vite and the React plugin append duplicate includes during startup.
    expect(new Set(draft.config.optimizeDeps.include)).toEqual(
      new Set(vistaRuntimePolicy().optimizeInclude),
    )
    // This is the same built-in resolver Vite uses for manual seeds: it does
    // not run the draft's runtime-policy/dependency-anchor resolveId plugins.
    const resolveSeed = createIdResolver(draft.config, { asSrc: false, scan: true })
    const seeds = [...new Set(draft.config.optimizeDeps.include)]
    const publicSeeds = seeds.filter((seed) => classifyVistaClientImport(seed)._tag === 'provided')
    const seedAliases = draft.config.resolve.alias.filter(
      (entry) => entry.customResolver !== undefined,
    )
    expect(seedAliases).toHaveLength(publicSeeds.length)
    for (const seed of seeds) {
      const matchingAliases = draft.config.resolve.alias.filter((entry) =>
        entry.find instanceof RegExp
          ? entry.find.test(seed)
          : entry.find === seed || seed.startsWith(`${entry.find}/`),
      )
      if (!publicSeeds.includes(seed)) {
        expect(matchingAliases, seed).toEqual([])
        continue
      }
      const alias = matchingAliases.find((entry) => entry.find instanceof RegExp)
      expect(alias, seed).toBeDefined()
      expect(alias!.find instanceof RegExp && alias!.find.test(`${seed}/unseeded`)).toBe(false)
      const resolved = await resolveSeed(draft.environments.client!, seed)
      expect(resolved, seed).toBeDefined()
      expect(resolved, seed).not.toContain(dir)
    }
  })

  it('rejects an authored private import after kit-origin optimizer discovery', async () => {
    const draft = state.drafts.get(`${encodeRouteOwner(OWNER)}/allowed-imports`)!
    const source = '@overeng/meters'
    // The kit may discover private dependencies without making them public.
    const kitImporter = join(blocksDir(), 'src/RpcExplorerPanel.tsx')
    expect(await draft.pluginContainer.resolveId(source, kitImporter)).not.toBeNull()
    const importer = join(
      appSourcePath(process.env.VISTA_SOURCES!, OWNER, 'allowed-imports'),
      'app.tsx',
    )
    await expect(draft.pluginContainer.resolveId(source, importer)).rejects.toMatchObject({
      _tag: 'Vista.RuntimePolicyError',
      importProblems: [expect.objectContaining({ source })],
    })
  })

  it('rejects app-authored imports outside the projected runtime policy', async () => {
    const res = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/blocked-import/draft/`,
    )
    const body = await res.text()

    expect(res.status).toBe(400)
    expect(body).toContain('Vista app source imports are outside the runtime policy')
    expect(body).toContain('app.tsx imports lodash')
    expect(body).toContain('Use a Vista-provided runtime package or a pinned esm.sh URL')
  })
})
