/**
 * data-panel render-proof (Track 6a of epic #1234). The `data-panel` sample is
 * the ONE sample whose bespoke custom-block component (`MetricPanel`, mounted via
 * the kit `custom` escape hatch, decision 0016) imports `react` DIRECTLY
 * (`import { useEffect, useState } from 'react'`) instead of getting react only
 * through the kit. It never had a `*.browser.test.ts`, so two failure classes
 * could regress silently on a real published page:
 *
 *  1. MULTI-REACT (the class of decision 0052 / FB-100): if the sample's bare
 *     `react` import resolves to a DIFFERENT physical copy than the kit's, hooks
 *     fire against a null dispatcher → "Invalid hook call" / `useState of null` →
 *     blank render. `resolve.dedupe:['react']` on both Vista servers is what keeps
 *     react a singleton; this proof asserts the hook/cross-react console signature
 *     stays empty so a dedupe regression is caught.
 *  2. FREEZE CAPTURE (decision 0031): a published version must inline an immutable
 *     `snapshot.json` and render FROZEN (❄ badge, zero `/_data/`), NOT fall back
 *     to a LIVE fetch. This proof asserts the ❄ FROZEN badge actually paints, so a
 *     freeze-capture regression (e.g. the descriptor file not being found) can no
 *     longer pass unnoticed behind a still-painting LIVE page.
 *
 * Runs only when the Nix-provisioned browser is on PATH (PLAYWRIGHT_BROWSERS_PATH);
 * a bare `vitest run` skips it. The apps dir MUST live INSIDE the workspace tree
 * (`service/tmp/**`, gitignored) so a raw-served react walk-up reaches the shared
 * closure — the same constraint documented in `heavy-blocks.browser.test.ts`.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', 'samples', 'data-panel-app')
const OWNER = 'agent/vista/tests'
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let mimir: ReturnType<typeof createServer> | undefined
let prevMimir: string | undefined

beforeAll(async () => {
  if (!HAS_BROWSER) return
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-datapanel-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'data-panel')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  // Hermetic Mimir stub (decision 0026: the `otel` provider makes a REAL
  // `query_range` HttpClient call, so the freeze-capture is not offline-
  // reproducible). Serve the captured prom-matrix fixture so the `partial`
  // freeze pass captures a NON-EMPTY series → the published version ships a
  // `snapshot.json` and renders FROZEN, without depending on an ambient Mimir
  // (the default `VISTA_MIMIR_URL` points at `127.0.0.1:42030`, which is a dead
  // port / a state-dependent ambient backend in CI — either way non-hermetic).
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
  const { publish } = await import('./publish.ts')
  port = 5800 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  const out = await publish(
    { owner: OWNER, slug: 'data-panel', author: 'render-proof', changeSummary: '6a' },
    started.state.providers,
  )
  if (out.bindings.every((binding) => binding.policy.mode !== 'frozen')) {
    throw new Error(`data-panel publish did not derive frozen binding: ${JSON.stringify(out)}`)
  }
}, 120_000)

afterAll(async () => {
  await close?.()
  if (mimir) await new Promise<void>((resolve) => mimir!.close(() => resolve()))
  if (prevMimir === undefined) delete process.env.VISTA_MIMIR_URL
  else process.env.VISTA_MIMIR_URL = prevMimir
  if (dir) rmSync(dir, { recursive: true, force: true })
})

// The multi-React / dispatcher-null signature — mirrors telemetry-island's set.
const REACT_SIG =
  /Invalid hook call|does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported|Cannot read properties of null \(reading 'use|dispatcher is null|Should have a queue/

describe('data-panel bespoke react-importing custom block renders on a real page (Track 6a)', () => {
  it.skipIf(!HAS_BROWSER)(
    'published: MetricPanel mounts, ❄ FROZEN badge paints, console clean of cross-React errors',
    async () => {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        const reactErrors: string[] = []
        const snapshotRequests: string[] = []
        const liveDataRequests: string[] = []
        page.on('request', (request) => {
          const requestUrl = request.url()
          if (requestUrl.includes('snapshot.json')) snapshotRequests.push(requestUrl)
          if (requestUrl.includes('/_data/')) liveDataRequests.push(requestUrl)
        })
        page.on('console', (m) => {
          if (m.type() === 'error' && REACT_SIG.test(m.text()))
            reactErrors.push(`[console] ${m.text()}`)
        })
        page.on('pageerror', (e) => {
          if (REACT_SIG.test(String(e))) reactErrors.push(`[pageerror] ${String(e)}`)
        })

        const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/data-panel/v1/`
        // Cold first load prebundles the closure — warm once, then assert on reload.
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
        await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })

        // Render-proof: the bespoke panel mounts only if its direct `react` import
        // resolved to the SAME react as the kit (hooks ran, not a null dispatcher).
        // The promql `<code>` is rendered by MetricPanel itself.
        const panel = page.locator('code').filter({ hasText: 'rate(http_requests_total[5m])' })
        await panel.waitFor({ timeout: 45_000 })
        expect(await panel.count(), 'MetricPanel promql code').toBe(1)
        expect(snapshotRequests, 'published snapshot request').toEqual([
          `${url}snapshot.json`,
          `${url}snapshot.json`,
        ])
        expect(liveDataRequests, 'published page must not request live data').toEqual([])

        // Freeze-proof: a PUBLISHED version renders FROZEN (immutable snapshot),
        // never a LIVE fallback. The ❄ badge paints only if freeze captured the
        // block and `readFrozen` decoded it.
        const frozen = page.getByText(/❄ FROZEN/)
        await frozen.waitFor({ timeout: 45_000 })
        expect(await frozen.count(), 'FROZEN badge').toBeGreaterThan(0)
        expect(await page.getByText('● LIVE').count(), 'must NOT render live').toBe(0)

        // AppShell owns the browser chrome around direct semantic JSX while the
        // document keeps the sole `h1`.
        const header = page.locator('[data-vista-shell-header]')
        await header.waitFor()
        expect(await page.getByRole('button', { name: /^Theme:/ }).count()).toBe(1)
        expect(await page.getByRole('heading', { level: 1 }).count(), 'sole h1').toBe(1)

        // No cross-React / hook-dispatcher console error fired (dedupe's job).
        expect(reactErrors, 'cross-React / Invalid-hook console errors').toEqual([])

        await page.screenshot({
          path: join(HERE, '..', 'tmp', 'data-panel-render.png'),
          fullPage: true,
        })
      } finally {
        await browser.close()
      }
    },
    120_000,
  )
})
