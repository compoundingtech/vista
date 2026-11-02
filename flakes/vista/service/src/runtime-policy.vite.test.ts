import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { createIdResolver, createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { appSourcePath, depsNodeModules } from './paths.ts'
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

  it('allows the generated HTML runtime import but rejects it in authored modules', async () => {
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
    // Inspect source resolution rather than an optimizer output that may still
    // be bundling after this now-successful cold request.
    const react = await draft!.pluginContainer.resolveId('react', importer, { scan: true })
    const subpath = await draft!.pluginContainer.resolveId('@pierre/diffs/react', importer, {
      scan: true,
    })
    expect(react).not.toBeNull()
    expect(subpath).not.toBeNull()

    const reactId = react!.id.split('?', 1)[0]!
    expect(realpathSync(reactId)).toBe(realpathSync(join(depsNodeModules(), 'react', 'index.js')))
    expect(subpath!.id).not.toContain(allowedSource)
  })

  it('resolves every declared seed through Vite’s alias-only manual include path', async () => {
    const response = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/allowed-imports/draft/app.tsx`,
    )
    expect(response.status).toBe(200)
    const draft = state.drafts.get(`${encodeRouteOwner(OWNER)}/allowed-imports`)!
    // Load after beforeAll sets the isolated source/cache environment.
    const { vistaRuntimePolicy } = await import('./runtime-policy/index.ts')
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
    for (const seed of draft.config.optimizeDeps.include!) {
      const alias = draft.config.resolve.alias.find(
        (entry) => entry.find instanceof RegExp && entry.find.test(seed),
      )
      expect(alias, seed).toBeDefined()
      expect(alias!.find instanceof RegExp && alias!.find.test(`${seed}/unseeded`)).toBe(false)
      const resolved = await resolveSeed(draft.environments.client!, seed)
      expect(resolved, seed).toBeDefined()
      expect(resolved, seed).not.toContain(dir)
    }
  })

  it('enforces the same policy even when a blocked import has a seed alias', async () => {
    // Load after beforeAll sets the isolated source/cache environment.
    const { vistaDependencyAnchorResolver } = await import('./runtime-policy/vite-plugin.ts')
    const vite = await createServer({
      configFile: false,
      root: appSource,
      appType: 'custom',
      plugins: [
        vistaDependencyAnchorResolver(dirname(depsNodeModules()), {
          root: appSource,
          include: ['lodash', '@overeng/meters'],
        }),
      ],
      optimizeDeps: { noDiscovery: true },
      server: { middlewareMode: true, watch: null },
    })
    const htmlImporter = join(appSource, 'index.html')
    try {
      // Only the trusted internal scan resolver may resolve private seeds.
      const resolveSeed = createIdResolver(vite.config, { asSrc: false, scan: true })
      expect(
        await resolveSeed(vite.environments.client!, '@overeng/meters'),
      ).toBeDefined()
      await expect(
        vite.pluginContainer.resolveId('@overeng/meters'),
      ).rejects.toMatchObject({ _tag: 'Vista.RuntimePolicyError' })
      for (const source of ['lodash', '@overeng/meters']) {
        await expect(
          vite.pluginContainer.resolveId(source, join(appSource, 'app.tsx')),
        ).rejects.toMatchObject({
          _tag: 'Vista.RuntimePolicyError',
          importProblems: [expect.objectContaining({ source })],
        })
      }
      // A real authored HTML document is not the service-generated importer.
      writeFileSync(htmlImporter, '<!doctype html>')
      await expect(
        vite.pluginContainer.resolveId('@overeng/meters', htmlImporter),
      ).rejects.toMatchObject({
        _tag: 'Vista.RuntimePolicyError',
        importProblems: [expect.objectContaining({ source: '@overeng/meters' })],
      })
    } finally {
      rmSync(htmlImporter, { force: true })
      await vite.close()
    }
  })

  it('rejects browser requests for private seeds even without an importer or with a forged scan query', async () => {
    const base = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/allowed-imports/draft`
    // Initialize the real draft/optimizer before probing the request boundary.
    expect((await fetch(`${base}/app.tsx`)).status).toBe(200)
    for (const query of ['?import', '?import&scan=true']) {
      const response = await fetch(`${base}/@id/@overeng/meters${query}`)
      expect(response.status).toBe(400)
      expect(await response.text()).toContain('index.html imports @overeng/meters')
    }
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
