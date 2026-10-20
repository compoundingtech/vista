/**
 * Telemetry-FLAMEGRAPH-island real-pipeline render proof (decisions 0040/0041/0046).
 * Mirrors `telemetry-island.browser.test.ts` (metric) and `-trace-island` (trace),
 * but proves `@grafana/flamegraph` — bundled into the SAME pre-built, self-contained
 * island chunk as `mountMetric`/`mountTrace` — renders the flamegraph inside
 * the React-19 host through the real Vista pipeline for published and draft
 * routes, fed by frozen synthetic profile data (no Pyroscope backend).
 *
 * Asserts, in a real browser, for BOTH published and draft:
 *  - both flamegraph island mount points paint a CANVAS (proves the chunk loaded, its
 *    island root mounted, and the flamebearer → nested-set DataFrame reconstruction
 *    produced a renderable tree that the Grafana flame canvas drew);
 *  - the console is clean of cross-React / missing-export / resolve signatures;
 *  - the host React and the island's bundled React (both 19) coexist on the one page.
 *
 * Runs only when the Nix-provisioned browser is on PATH (PLAYWRIGHT_BROWSERS_PATH);
 * skips otherwise so a bare `vitest run` stays green.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', 'samples', 'telemetry-flamegraph-app')
const ISLAND_DIR = join(HERE, '..', '..', 'island')
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let pyroscope: Server | undefined
let prevPyroscope: string | undefined

const OWNER = 'agent/vista/tests'
beforeAll(async () => {
  if (!HAS_BROWSER) return

  // Build the island chunk (reproducible). The service serves the built
  // `dist/island.js` (which now exports `mountFlamegraph` too) via the
  // `@vista/telemetry-island` runtime-policy alias.
  const viteBin = join(
    dirname(createRequire(join(ISLAND_DIR, 'package.json')).resolve('vite/package.json')),
    'bin',
    'vite.js',
  )
  execFileSync(process.execPath, [viteBin, 'build'], { cwd: ISLAND_DIR, stdio: 'inherit' })
  if (!existsSync(join(ISLAND_DIR, 'dist', 'island.js')))
    throw new Error('island build produced no dist/island.js')

  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-flamegraph-island-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'telemetry-flamegraph')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  prevPyroscope = process.env.VISTA_PYROSCOPE_URL
  const flamebearer = readFileSync(
    join(HERE, 'data', 'providers', '__fixtures__', 'pyro-flamebearer.json'),
    'utf8',
  )
  pyroscope = createServer((req, res) => {
    if (req.url === '/querier.v1.QuerierService/SelectMergeStacktraces') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(flamebearer)
    } else {
      res.writeHead(404).end('not found')
    }
  })
  await new Promise<void>((resolve) => pyroscope!.listen(0, '127.0.0.1', () => resolve()))
  const pyroscopeAddress = pyroscope.address()
  if (pyroscopeAddress === null || typeof pyroscopeAddress === 'string')
    throw new Error('Pyroscope fixture did not bind a TCP address')
  process.env.VISTA_PYROSCOPE_URL = `http://127.0.0.1:${pyroscopeAddress.port}`

  const { startService } = await import('./server.ts')
  port = 5950 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  // Publish v1 while retaining the canonical AppSource for the live draft.
  const { publish } = await import('./publish.ts')
  const out = await publish(
    {
      owner: OWNER,
      slug: 'telemetry-flamegraph',
      author: 'flamegraph-island-proof',
      changeSummary: '0040/0041/0046',
    },
    started.state.providers,
  )
  if (out.version !== 1)
    throw new Error(`telemetry-flamegraph publish failed: ${JSON.stringify(out)}`)
}, 180_000)

afterAll(async () => {
  await close?.()
  if (pyroscope) await new Promise<void>((resolve) => pyroscope!.close(() => resolve()))
  if (prevPyroscope === undefined) delete process.env.VISTA_PYROSCOPE_URL
  else process.env.VISTA_PYROSCOPE_URL = prevPyroscope
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const REACT_SIG =
  /Unexpected ['"]?stylex\.\w+['"]? call at runtime|Invalid hook call|does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported|Cannot read properties of null \(reading 'use|dispatcher is null|Should have a queue/

const assertFlamegraphPaints = async (label: 'published' | 'draft', url: string) => {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' && REACT_SIG.test(m.text())) errors.push(`[console] ${m.text()}`)
    })
    page.on('pageerror', (e) => {
      if (REACT_SIG.test(String(e))) errors.push(`[pageerror] ${String(e)}`)
    })

    // Cold first load prebundles the host closure — warm once, then assert on reload.
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
    await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })

    // Render-proof: the flamegraph island mount point exists and paints a canvas
    // (the chunk loaded, its island root mounted, and the reconstructed tree drew).
    await page.waitForSelector('[data-testid="telemetry-island-flamegraph"] canvas', {
      timeout: 45_000,
    })
    const canvases = await page
      .locator('[data-testid="telemetry-island-flamegraph"] canvas')
      .count()
    expect(canvases, `${label}: flamegraph canvas count`).toBe(1)

    // A published AppVersion reads its captured snapshot. The draft has no
    // snapshot and therefore uses the live provider route.
    const expectedMode = label === 'published' ? 'frozen' : 'live'
    const unexpectedMode = label === 'published' ? 'live' : 'frozen'
    expect(
      await page.locator(`[data-vista-badge="${expectedMode}"]`).count(),
      `${label}: ${expectedMode} badge`,
    ).toBeGreaterThan(0)
    expect(
      await page.locator(`[data-vista-badge="${unexpectedMode}"]`).count(),
      `${label}: must not render ${unexpectedMode}`,
    ).toBe(0)

    // React-version coexistence: host root and island root (both 19) on the same page.
    const versions = await page.evaluate(() => ({
      host: (globalThis as Record<string, unknown>).__VISTA_HOST_REACT__,
      island: (globalThis as Record<string, unknown>).__VISTA_ISLAND_REACT__,
    }))
    expect(String(versions.host), `${label}: host React`).toMatch(/^19\./)
    expect(String(versions.island), `${label}: island React`).toMatch(/^19\./)

    expect(errors, `${label}: cross-React / missing-export console errors`).toEqual([])

    await page.screenshot({
      path: join(HERE, '..', 'tmp', `flamegraph-island-${label}.png`),
      fullPage: true,
    })
  } finally {
    await browser.close()
  }
}

describe('Pre-built telemetry island chunk renders the flamegraph in the real pipeline (0040/0041/0046)', () => {
  it.skipIf(!HAS_BROWSER)(
    'published: flamegraph canvases paint, console clean, host and island React coexist',
    async () => {
      await assertFlamegraphPaints(
        'published',
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-flamegraph/v1/`,
      )
    },
    120_000,
  )

  it.skipIf(!HAS_BROWSER)(
    'draft (live): flamegraph canvases paint, console clean, host and island React coexist',
    async () => {
      await assertFlamegraphPaints(
        'draft',
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-flamegraph/draft/`,
      )
    },
    120_000,
  )
})
