/**
 * Telemetry-island real-pipeline render proof (decision 0046). Mirrors
 * `heavy-blocks.browser.test.ts`, but proves the PRE-BUILT, self-contained
 * island chunk renders the metric viz inside the React-19 host through the REAL
 * Vista service pipeline (`resolve.dedupe:['react']`, `optimizeDeps.noDiscovery`
 * on the published server, and BOTH the published and draft Vite servers) — NOT a
 * standalone `vite build`, and NOT the superseded dev-server dual-React router.
 *
 * The island is built once in `beforeAll` (reproducible: the island's own
 * `vite build`), then served by the service via the runtime-policy alias as ONE
 * provided artifact. Asserts, in a real browser, for BOTH published and draft:
 *  - the island canvas actually paints (proves the chunk loaded + its island
 *    root mounted + hooks ran against the island's one bundled React);
 *  - the console is clean of cross-React / missing-export / resolve signatures;
 *  - the host React and the island's bundled React (both 19) coexist on the one page.
 *
 * Runs only when the Nix-provisioned browser is on PATH (PLAYWRIGHT_BROWSERS_PATH);
 * skips otherwise so a bare `vitest run` stays green.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', 'samples', 'telemetry-island-app')
const ISLAND_DIR = join(HERE, '..', '..', 'island')
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let mimir: ReturnType<typeof createServer> | undefined
let prevMimir: string | undefined

const OWNER = 'agent/vista/tests'
beforeAll(async () => {
  if (!HAS_BROWSER) return

  // Build the island chunk (reproducible). The service serves the built
  // `dist/island.js` via the `@vista/telemetry-island` runtime-policy alias.
  const viteBin = join(
    dirname(createRequire(join(ISLAND_DIR, 'package.json')).resolve('vite/package.json')),
    'bin',
    'vite.js',
  )
  execFileSync(process.execPath, [viteBin, 'build'], { cwd: ISLAND_DIR, stdio: 'inherit' })
  if (!existsSync(join(ISLAND_DIR, 'dist', 'island.js')))
    throw new Error('island build produced no dist/island.js')

  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-island-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'telemetry-island')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  // Serve a deterministic metric fixture so publication captures a non-empty
  // frozen series without depending on an ambient Mimir backend.
  prevMimir = process.env.VISTA_MIMIR_URL
  const promMatrix = readFileSync(
    join(HERE, 'data', 'providers', '__fixtures__', 'prom-matrix.json'),
    'utf8',
  )
  mimir = createServer((mreq, mres) => {
    if (mreq.url?.startsWith('/prometheus/api/v1/query_range')) {
      mres.writeHead(200, { 'content-type': 'application/json' }).end(promMatrix)
    } else {
      mres.writeHead(404).end('not found')
    }
  })
  await new Promise<void>((resolve) => mimir!.listen(0, '127.0.0.1', () => resolve()))
  process.env.VISTA_MIMIR_URL = `http://127.0.0.1:${(mimir!.address() as { port: number }).port}`

  const { startService } = await import('./server.ts')
  port = 5600 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  // Publish v1 while retaining the canonical AppSource for the live draft.
  const { publish } = await import('./publish.ts')
  const out = await publish(
    { owner: OWNER, slug: 'telemetry-island', author: 'island-proof', changeSummary: '0046' },
    started.state.providers,
  )
  if (out.version !== 1) throw new Error(`telemetry-island publish failed: ${JSON.stringify(out)}`)
}, 180_000)

afterAll(async () => {
  await close?.()
  if (mimir) await new Promise<void>((resolve) => mimir!.close(() => resolve()))
  if (prevMimir === undefined) delete process.env.VISTA_MIMIR_URL
  else process.env.VISTA_MIMIR_URL = prevMimir
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const REACT_SIG =
  /Unexpected ['"]?stylex\.\w+['"]? call at runtime|Invalid hook call|does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported|Cannot read properties of null \(reading 'use|dispatcher is null|Should have a queue/

const assertIslandPaints = async (
  label: 'published' | 'draft',
  url: string,
  expectMode: 'frozen' | 'live',
) => {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    const liveDataRequests: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' && REACT_SIG.test(m.text())) errors.push(`[console] ${m.text()}`)
    })
    page.on('pageerror', (e) => {
      if (REACT_SIG.test(String(e))) errors.push(`[pageerror] ${String(e)}`)
    })
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.includes('/_data/')) {
        liveDataRequests.push(request.url())
      }
    })

    // Cold first load prebundles the host closure — warm once, then assert on reload.
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
    await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })

    // Render-proof: the island canvas paints only if the chunk loaded and its
    // island root mounted (hooks ran against the island's one bundled React).
    await page.waitForSelector('[data-testid="telemetry-island"] canvas', { timeout: 45_000 })
    const canvases = await page.locator('[data-testid="telemetry-island"] canvas').count()
    expect(canvases, `${label}: island canvas count`).toBeGreaterThan(0)

    // Mode proof: an AppVersion renders its captured Snapshot; a draft resolves
    // the live Provider. The badge reflects the resolved DataBinding mode.
    // Asserting the badge catches a published route that silently falls back to
    // live data while the canvas continues to paint.
    const frozenBadges = await page.locator('[data-vista-badge="frozen"]').count()
    const liveBadges = await page.locator('[data-vista-badge="live"]').count()
    if (expectMode === 'frozen') {
      expect(frozenBadges, `${label}: FROZEN badge`).toBeGreaterThan(0)
      expect(liveBadges, `${label}: must NOT render live`).toBe(0)
    } else {
      expect(liveBadges, `${label}: LIVE badge`).toBeGreaterThan(0)
      expect(frozenBadges, `${label}: must NOT render frozen`).toBe(0)
    }
    expect(
      liveDataRequests.length,
      `${label}: one provider request per page load, never a refresh loop`,
    ).toBe(expectMode === 'live' ? 2 : 0)

    // React-version coexistence: host root and island root (both 19) on the same page.
    const versions = await page.evaluate(() => ({
      host: (globalThis as Record<string, unknown>).__VISTA_HOST_REACT__,
      island: (globalThis as Record<string, unknown>).__VISTA_ISLAND_REACT__,
    }))
    expect(String(versions.host), `${label}: host React`).toMatch(/^19\./)
    expect(String(versions.island), `${label}: island React`).toMatch(/^19\./)

    expect(errors, `${label}: cross-React / missing-export console errors`).toEqual([])

    await page.screenshot({ path: join(HERE, '..', 'tmp', `island-${label}.png`), fullPage: true })
  } finally {
    await browser.close()
  }
}

describe('Pre-built telemetry island chunk renders in the real pipeline (0046)', () => {
  it.skipIf(!HAS_BROWSER)(
    'published: canvas paints, console clean, host and island React coexist',
    async () => {
      await assertIslandPaints(
        'published',
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-island/v1/`,
        'frozen',
      )
    },
    120_000,
  )

  it.skipIf(!HAS_BROWSER)(
    'draft (live): canvas paints, console clean, host and island React coexist',
    async () => {
      await assertIslandPaints(
        'draft',
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-island/draft/`,
        'live',
      )
    },
    120_000,
  )
})
