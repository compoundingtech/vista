/**
 * Telemetry-TRACE-island real-pipeline render proof (decisions 0040/0042/0046).
 * Mirrors `telemetry-island.browser.test.ts` (the metric proof), but proves the
 * vendored Grafana Jaeger `TraceTimelineViewer` — bundled into the SAME pre-built,
 * self-contained island chunk as `mountMetric` — renders the distributed
 * trace waterfall inside the React-19 host through the real Vista pipeline for
 * published and draft routes, fed by frozen synthetic trace data (no Tempo backend).
 *
 * Asserts, in a real browser, for BOTH published and draft:
 *  - the trace island mount point paints span rows (proves the chunk loaded + its
 *    island root mounted + the vendored hooks ran against the island's one React);
 *  - the OTLP→Jaeger adapter rendered the clean tree (root operation name visible);
 *  - the rootless/partial trace was repaired in-adapter (synthesized root visible);
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
const SAMPLE = join(HERE, '..', 'samples', 'telemetry-trace-app')
const ISLAND_DIR = join(HERE, '..', '..', 'island')
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let tempo: Server | undefined
let prevTempo: string | undefined

const OWNER = 'agent/vista/tests'
beforeAll(async () => {
  if (!HAS_BROWSER) return

  // Build the island chunk (reproducible). The service serves the built
  // `dist/island.js` (which now exports `mountTrace` too) via the
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
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-trace-island-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'telemetry-trace')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  prevTempo = process.env.VISTA_TEMPO_URL
  const trace = readFileSync(
    join(HERE, 'data', 'providers', '__fixtures__', 'tempo-trace.json'),
    'utf8',
  )
  tempo = createServer((req, res) => {
    if (req.url?.startsWith('/api/traces/')) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(trace)
    } else {
      res.writeHead(404).end('not found')
    }
  })
  await new Promise<void>((resolve) => tempo!.listen(0, '127.0.0.1', () => resolve()))
  const tempoAddress = tempo.address()
  if (tempoAddress === null || typeof tempoAddress === 'string')
    throw new Error('Tempo fixture did not bind a TCP address')
  process.env.VISTA_TEMPO_URL = `http://127.0.0.1:${tempoAddress.port}`

  const { startService } = await import('./server.ts')
  port = 5900 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  // Publish v1 while retaining the canonical AppSource for the live draft.
  const { publish } = await import('./publish.ts')
  const out = await publish(
    {
      owner: OWNER,
      slug: 'telemetry-trace',
      author: 'trace-island-proof',
      changeSummary: '0040/0042/0046',
    },
    started.state.providers,
  )
  if (out.version !== 1) throw new Error(`telemetry-trace publish failed: ${JSON.stringify(out)}`)
}, 180_000)

afterAll(async () => {
  await close?.()
  if (tempo) await new Promise<void>((resolve) => tempo!.close(() => resolve()))
  if (prevTempo === undefined) delete process.env.VISTA_TEMPO_URL
  else process.env.VISTA_TEMPO_URL = prevTempo
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const REACT_SIG =
  /Unexpected ['"]?stylex\.\w+['"]? call at runtime|Invalid hook call|does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported|Cannot read properties of null \(reading 'use|dispatcher is null|Should have a queue/

const assertTracePaints = async (label: 'published' | 'draft', url: string) => {
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

    // Render-proof: the trace island mount point exists (the chunk loaded and its
    // island root mounted) and the waterfall paints span rows.
    await page.waitForSelector('[data-testid="telemetry-island-trace"]', { timeout: 45_000 })
    const mounts = await page.locator('[data-testid="telemetry-island-trace"]').count()
    expect(mounts, `${label}: trace island mount count`).toBe(1)

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

    // The deterministic OTLP fixture paints its root and child spans.
    await page.getByText('genie/command').first().waitFor({ state: 'visible', timeout: 30_000 })
    await page
      .getByText('genie/discoverAndValidate')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })

    // React-version coexistence: host root and island root (both 19) on the same page.
    const versions = await page.evaluate(() => ({
      host: (globalThis as Record<string, unknown>).__VISTA_HOST_REACT__,
      island: (globalThis as Record<string, unknown>).__VISTA_ISLAND_REACT__,
    }))
    expect(String(versions.host), `${label}: host React`).toMatch(/^19\./)
    expect(String(versions.island), `${label}: island React`).toMatch(/^19\./)

    expect(errors, `${label}: cross-React / missing-export console errors`).toEqual([])

    await page.screenshot({
      path: join(HERE, '..', 'tmp', `trace-island-${label}.png`),
      fullPage: true,
    })
  } finally {
    await browser.close()
  }
}

describe('Pre-built telemetry island chunk renders the trace waterfall in the real pipeline (0040/0042/0046)', () => {
  it.skipIf(!HAS_BROWSER)(
    'published: waterfall paints, console clean, host and island React coexist',
    async () => {
      await assertTracePaints(
        'published',
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-trace/v1/`,
      )
    },
    120_000,
  )

  it.skipIf(!HAS_BROWSER)(
    'draft (live): waterfall paints, console clean, host and island React coexist',
    async () => {
      await assertTracePaints('draft', `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/telemetry-trace/draft/`)
    },
    120_000,
  )
})
