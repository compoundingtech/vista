import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import type { RenderSmoke } from './render-smoke.ts'
import { captureThumbnail } from './render-smoke.ts'
import type { ServiceState } from './server.ts'
import { freePort, installTestChangelog } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'agent/vista/tests'
const fail: RenderSmoke = async () => ({ _tag: 'failed', reason: 'blank #root (test)' })
let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let state: ServiceState
let restoreChangelog: (() => void) | undefined

const seed = async (slug: string): Promise<void> => {
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, slug)
  mkdirSync(appSource, { recursive: true })
  writeFileSync(
    join(appSource, 'app.tsx'),
    `import { AppRoot } from '@vista/blocks'
export default function VistaApp() { return <AppRoot title="Smoke ${slug}" template="architecture-review" scope="test" /> }
`,
  )
}

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-smoke-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  restoreChangelog = await installTestChangelog(dir)
  const { startService } = await import('./server.ts')
  port = await freePort()
  const started = await startService(port)
  close = started.close
  state = started.state
}, 60_000)

afterAll(async () => {
  await close?.()
  restoreChangelog?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('render smoke gates the publication transaction', () => {
  it('publishes and moves latest after a passing proof', async () => {
    const { publish, verifyStaticPublication } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await seed('smoke-ok')
    await publish(
      { owner: OWNER, slug: 'smoke-ok', author: 't', changeSummary: 'v1' },
      state.providers,
      async () => ({ _tag: 'ok', thumbnail: new Uint8Array([137, 80, 78, 71]) }),
    )
    expect(scanApp(OWNER, 'smoke-ok')!.latest).toBe(1)
    expect(existsSync(join(versionDir(OWNER, 'smoke-ok', 1), 'thumbnail.png'))).toBe(true)
    const receipt = verifyStaticPublication(OWNER, 'smoke-ok', 1)!
    expect(receipt.inventory.some((entry) => entry.path === 'thumbnail.png')).toBe(false)
    // A backfilled derived thumbnail never changes signed executable trust.
    writeFileSync(join(versionDir(OWNER, 'smoke-ok', 1), 'thumbnail.png'), 'replacement')
    expect(verifyStaticPublication(OWNER, 'smoke-ok', 1)).toEqual(receipt)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    )
    writeFileSync(join(versionDir(OWNER, 'smoke-ok', 1), 'thumbnail.png'), png)
    const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/smoke-ok/v1/_thumbnail.png`
    const response = await fetch(url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
    expect((await fetch(url, { method: 'HEAD' })).status).toBe(200)
    rmSync(join(versionDir(OWNER, 'smoke-ok', 1), 'thumbnail.png'))
    expect((await fetch(url)).status).toBe(404)
  })

  it('removes the claim and leaves latest unset after a failing proof', async () => {
    const { publish } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await seed('smoke-blank')
    await expect(
      publish(
        { owner: OWNER, slug: 'smoke-blank', author: 't', changeSummary: 'v1' },
        state.providers,
        fail,
      ),
    ).rejects.toThrow('blank #root (test)')
    expect(existsSync(versionDir(OWNER, 'smoke-blank', 1))).toBe(false)
    expect(scanApp(OWNER, 'smoke-blank')?.latest ?? null).toBeNull()
  })
})

describe('thumbnail capture is best effort', () => {
  it('logs capture failure and preserves successful mount semantics', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      const page = {
        screenshot: async (): Promise<Uint8Array> => {
          throw new Error('capture unavailable')
        },
        evaluate: async <T>(): Promise<T> => {
          throw new Error('must not evaluate')
        },
        close: async () => {},
      }
      expect(await captureThumbnail(page)).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('capture unavailable'))
      expect(info).toHaveBeenCalledWith(expect.stringMatching(/thumbnail capture: [\d.]+ ms/))
    } finally {
      warn.mockRestore()
      info.mockRestore()
    }
  })
})
