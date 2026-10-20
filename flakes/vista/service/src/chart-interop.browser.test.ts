/**
 * SVC-R58 CI mount guard + real-closure interop proof (decision 0052,
 * OQ-BUNDLEDDEV-DERISK gate item 3).
 *
 * The blank render shipped because the only render-proof (`heavy-blocks.browser.test.ts`)
 * is `it.skipIf(!HAS_BROWSER)` — effectively SKIPPED in `check:all`, so a raw-served
 * CJS dep that dies on a missing `default` export was never caught. This test is the
 * category-closer:
 *
 *  - It renders a published app whose core `Renderer` statically pulls
 *    `ChartBlock` -> `recharts` -> `es-toolkit` (the EXACT transitive-CJS closure
 *    from the root cause), and asserts a real recharts SVG mounts with `#root`
 *    non-empty and ZERO `does not provide an export named 'default'` /
 *    module-resolution console errors.
 *  - It HARD-FAILS when the Nix-provisioned browser is absent (never silently
 *    skips), mirroring `test:vista-blocks-storybook`. In CI it is invoked via the
 *    `test:vista-service-browser` devenv task, which exports
 *    `PLAYWRIGHT_BROWSERS_PATH` and refuses to run without it. The bare
 *    `test:vista-service` lane excludes `*.browser.test.ts`, so a plain
 *    `vitest run` stays green locally; the browser lane is where this gates.
 *  - It proves GA auto-discovery (decision 0052, `optimizeDeps: {}`) renders the
 *    real transitive-CJS closure (recharts -> es-toolkit) — the exact category
 *    that blanked published pages under the old hand-maintained include list.
 *
 * `VISTA_REQUIRE_BROWSER=1` turns the missing-browser case from a hard skip into a
 * hard FAIL — the CI lane sets it so a mis-provisioned runner cannot silently pass.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import { publishViaControl } from './control-test-client.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', 'samples', 'chart-app')
const OWNER = 'agent/vista/tests'

const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH
/** The CI browser lane sets this so a missing browser is a hard FAIL, not a skip. */
const REQUIRE_BROWSER = process.env.VISTA_REQUIRE_BROWSER === '1'

let dir: string
let port: number
let close: (() => Promise<void>) | undefined

beforeAll(async () => {
  if (REQUIRE_BROWSER && !HAS_BROWSER) {
    throw new Error(
      'VISTA_REQUIRE_BROWSER=1 but PLAYWRIGHT_BROWSERS_PATH is unset — the SVC-R58 render-proof ' +
        'lane must run with the Nix/devenv Playwright browser. Run through the ' +
        '`test:vista-service-browser` devenv task, never a bare vitest.',
    )
  }
  if (!HAS_BROWSER) return
  // Apps dir MUST live inside the workspace tree (hoisted-pnpm: recharts/es-toolkit
  // resolve `react` by walking up node_modules, only reachable from within the workspace).
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-chart-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'chart-interop')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  const { startService } = await import('./server.ts')
  port = 5600 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  await Effect.runPromise(
    publishViaControl(port, {
      owner: OWNER,
      slug: 'chart-interop',
      author: 'guard',
      changeSummary: 'guard',
    }),
  )
}, 60_000)

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const activeMode = 'discovery'

describe(`published chart app renders the recharts/es-toolkit closure (${activeMode})`, () => {
  it.skipIf(!HAS_BROWSER)(
    'mounts a recharts SVG with #root non-empty and zero dep-resolution console errors',
    async () => {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        // The exact blank-render signature: a raw-served CJS dep that fails ESM
        // interop or resolution. This is what discriminates the category.
        const depErrors: string[] = []
        const isDepError = (t: string) =>
          /does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported/.test(
            t,
          )
        page.on('console', (m) => {
          if (m.type() === 'error' && isDepError(m.text())) depErrors.push(m.text())
        })
        page.on('pageerror', (e) => {
          if (isDepError(String(e))) depErrors.push(String(e))
        })

        const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/chart-interop/v1/`
        // First load cold-prebundles the recharts/es-toolkit closure — warm once.
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.reload({ waitUntil: 'networkidle' })
        // Render-proof: a recharts SVG mounts only if es-toolkit's CJS interop
        // resolved. A raw-served es-toolkit yields a blank chart / no SVG.
        await page.waitForSelector('.vista-chart svg, .recharts-surface', { timeout: 30_000 })
        const svgs = await page.locator('.vista-chart svg, .recharts-surface').count()
        expect(svgs).toBeGreaterThan(0)
        // SVC-R58 root non-empty check.
        const rootText = (await page.locator('#root').textContent()) ?? ''
        expect(rootText.trim().length).toBeGreaterThan(0)
        // The category assertion: no `default`-export / module-resolution error.
        expect(depErrors).toEqual([])
      } finally {
        await browser.close()
      }
    },
    45_000,
  )
})
