/**
 * Frozen-skew render proof (decision 0068 / OQ-FROZEN-SKEW-VISIBLE). The
 * regression: after a global-`apiVersion` bump, a PUBLISHED (immutable) version
 * whose frozen `snapshot.json` is skewed used to unwrap to `null` and render
 * **live** under a `● LIVE` badge — silently misrepresenting a point-in-time
 * review as current data. The fix ({@link resolveSnapshotMode}) makes a
 * present-but-skewed snapshot a distinct `unsupported` outcome that STOPS,
 * visibly, and never falls through to live.
 *
 * Proven end-to-end on the browser-verified `telemetry-island` sample. The
 * browser intercepts its receipt-covered `snapshot.json` request and supplies a
 * direct Snapshot with `apiVersion` != current. This preserves publication trust
 * while exercising the client boundary. The version must show a visible
 * unsupported state and paint no telemetry.
 *
 * The env-independent guard for the discriminant itself is
 * `data/client/frozen.test.ts`. Runs only when the Nix-provisioned browser is on
 * PATH (PLAYWRIGHT_BROWSERS_PATH); skips otherwise so a bare `vitest run` stays
 * green. In `check:all` it runs via the `test:vista-service-browser` devenv task
 * (which builds the island + supplies the browser).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { VISTA_API_VERSION } from './api-version.ts'
import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import type { ServiceState } from './server.ts'
import { freePort } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', 'samples', 'telemetry-island-app')
const ISLAND_DIR = join(HERE, '..', '..', 'island')
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH
const REQUIRE_BROWSER = process.env.VISTA_REQUIRE_BROWSER === '1'
const OWNER = 'agent/vista/tests'

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let state: ServiceState
let mimir: ReturnType<typeof createHttpServer> | undefined
let prevMimir: string | undefined

beforeAll(async () => {
  if (REQUIRE_BROWSER && !HAS_BROWSER) {
    throw new Error(
      'VISTA_REQUIRE_BROWSER=1 but PLAYWRIGHT_BROWSERS_PATH is unset — the frozen snapshot ' +
        'fail-closed proof must run through the test:vista-service-browser devenv task.',
    )
  }
  if (!HAS_BROWSER) return

  // Build the island chunk the metric block lazy-loads (reproducible; the same
  // build `telemetry-island.browser.test.ts` uses).
  const viteBin = join(
    dirname(createRequire(join(ISLAND_DIR, 'package.json')).resolve('vite/package.json')),
    'bin',
    'vite.js',
  )
  execFileSync(process.execPath, [viteBin, 'build'], { cwd: ISLAND_DIR, stdio: 'inherit' })

  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-frozen-skew-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')

  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'telemetry-island')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  // Hermetic Mimir stub (decision 0026). The sample's frozen semantic binding
  // runs the real `otel` `query_range` capture before the snapshot is overwritten,
  // so serve a deterministic fixture rather than depending on ambient Mimir.
  prevMimir = process.env.VISTA_MIMIR_URL
  const promMatrix = readFileSync(
    join(HERE, 'data', 'providers', '__fixtures__', 'prom-matrix.json'),
    'utf8',
  )
  mimir = createHttpServer((mreq, mres) => {
    if (mreq.url?.startsWith('/prometheus/api/v1/query_range')) {
      mres.writeHead(200, { 'content-type': 'application/json' }).end(promMatrix)
    } else {
      mres.writeHead(404).end('not found')
    }
  })
  await new Promise<void>((resolve) => mimir!.listen(0, '127.0.0.1', () => resolve()))
  process.env.VISTA_MIMIR_URL = `http://127.0.0.1:${(mimir!.address() as { port: number }).port}`

  const { startService } = await import('./server.ts')
  port = await freePort()
  const started = await startService(port)
  close = started.close
  state = started.state

  // Publish v1 through the all-or-nothing transaction.
  const { publish } = await import('./publish.ts')
  await publish(
    { owner: OWNER, slug: 'telemetry-island', author: 'skew-proof', changeSummary: 'v1' },
    state.providers,
  )
}, 180_000)

afterAll(async () => {
  await close?.()
  if (mimir) await new Promise<void>((resolve) => mimir!.close(() => resolve()))
  if (prevMimir === undefined) delete process.env.VISTA_MIMIR_URL
  else process.env.VISTA_MIMIR_URL = prevMimir
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('an unreadable published snapshot fails closed, never live (0068)', () => {
  it.skipIf(!HAS_BROWSER)(
    'published + skewed: shows the unsupported notice and paints NO data (never live)',
    async () => {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        await page.route('**/snapshot.json', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              apiVersion: VISTA_API_VERSION + 1,
            }),
          }),
        )
        const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-island/v1/`
        // Cold first load prebundles the closure — warm once, then assert on reload.
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
        await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })

        // The present-but-skewed snapshot surfaces the visible unsupported notice
        // (the block's fetch fails closed to a typed error — decision 0068).
        await expect
          .poll(() => page.locator('body').innerText(), { timeout: 45_000 })
          .toContain('published snapshot is skew')

        // The key invariant: a skewed PUBLISHED version paints NO telemetry — it is
        // NOT rendered live-with-data, the silent misrepresentation the fix prevents.
        const canvases = await page.locator('[data-testid="telemetry-island"] canvas').count()
        expect(canvases, 'a skewed published version must not paint telemetry').toBe(0)

        await page.screenshot({ path: join(HERE, '..', 'tmp', 'frozen-skew.png'), fullPage: true })
      } finally {
        await browser.close()
      }
    },
    120_000,
  )

  it.skipIf(!HAS_BROWSER)(
    'snapshot HTTP 500 shows unavailable and makes no live data request',
    async () => {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        let liveRequests = 0
        page.on('request', (request) => {
          if (new URL(request.url()).pathname.includes('/_data/')) liveRequests += 1
        })
        await page.route('**/snapshot.json', (route) =>
          route.fulfill({ status: 500, contentType: 'text/plain', body: 'failed' }),
        )

        const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-island/v1/`
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
        await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })

        await expect
          .poll(() => page.locator('body').innerText(), { timeout: 45_000 })
          .toContain('published snapshot is unavailable')
        expect(await page.locator('[data-testid="telemetry-island"] canvas').count()).toBe(0)
        expect(liveRequests, 'HTTP 500 must not enable the live data path').toBe(0)
      } finally {
        await browser.close()
      }
    },
    120_000,
  )
})
