/** Regression guards for global Vite isolation and slug-scoped draft HMR. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import { freePort } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'dev3.hmr-probe'

let dir: string
let port: number
let close: (() => Promise<void>) | undefined

beforeAll(async () => {
  // Keep disposable service state under the package's gitignored tmp directory.
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-vite-stub-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const draft = appSourcePath(join(dir, 'sources'), OWNER, 'hmr-probe')
  mkdirSync(draft, { recursive: true })
  writeFileSync(
    join(draft, 'app.tsx'),
    `import { AppRoot } from '@vista/blocks'
export default function HmrProbe() {
  return <AppRoot title="HMR probe" template="architecture-review" scope="HMR route isolation" />
}
`,
  )

  const { startService } = await import('./server.ts')
  port = await freePort()
  const started = await startService(port)
  close = started.close
}, 60_000)

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('Vite client route isolation', () => {
  it('fails closed for the global Vite client route', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/r/@vite/client`)
    expect(res.status).toBe(404)
  })

  it('serves draft HMR on the slug-scoped same-port path, not Vite default 24678', async () => {
    const client = await fetch(`http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/hmr-probe/draft/@vite/client`)
    expect(client.status).toBe(200)
    const body = await client.text()

    expect(body).toContain('__vista_hmr__')
    expect(body).toContain('const hmrPort = null')
    expect(body).not.toContain('24678')
  })
})
