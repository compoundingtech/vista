import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

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

    const reactId = react!.id.split('?', 1)[0]!
    expect(realpathSync(reactId)).toBe(realpathSync(join(depsNodeModules(), 'react', 'index.js')))
    expect(subpath!.id).not.toContain(allowedSource)
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
