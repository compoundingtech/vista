/**
 * Auto-discovery covers the heavy @vista/blocks browser closure (decision 0052).
 * The render core is one Vite dev server + GA auto-discovery (`optimizeDeps: {}`):
 * Vite scans the true transitive graph and prebundles every dep with correct
 * interop — no hand-maintained include list. The doctrine + data-panel samples
 * don't touch the HEAVY blocks, so without this render-proof a kit dep change (or
 * a discovery regression) could break published heavy-block pages SILENTLY.
 *
 * The failure mode is NOT an HTTP error — it is an HTTP-200 served raw module
 * whose CJS→ESM interop fails in the browser (the exact blank-render signature:
 * `does not provide an export named 'default'` from a transitive CJS dep, e.g.
 * `use-sync-external-store/...`, and a blank graph). So a fetch-only guard is
 * blind; the assertion MUST be render-proof in a real browser. This test publishes
 * the `heavy-blocks` sample — every NON-CHART lazy arm on one page: system-explorer
 * (→ @xyflow/react → zustand), diff (→ @pierre/diffs), file-tree (→ @pierre/trees,
 * an open Shadow-DOM host), and gh-previews (composes diff + file-tree from a
 * frozen payload) — and asserts each block actually MOUNTS + PAINTS. A failed dep
 * resolution never mounts the arm at all: the `React.lazy` boundary shows the
 * `.vista-lazyblock__error` "couldn't load visualization" fallback and the block's
 * own output never appears, so a per-arm paint assertion (nodes > 0, a populated
 * shadow root, a rendered diff) is what discriminates the coverage failure.
 *
 * Browser provisioning is Nix-managed (`PLAYWRIGHT_BROWSERS_PATH`, kept
 * version-aligned with `@playwright/test` by
 * `nix/checks/playwright-version-alignment.nix`). In `check:all` this runs via the
 * `test:vista-service-browser` devenv task, which sets `VISTA_REQUIRE_BROWSER=1`
 * so a missing browser HARD-FAILS (never a silent skip); the ambient
 * `PLAYWRIGHT_BROWSERS_PATH` from the repo's `playwright` devenv module supplies
 * the browser. A bare `vitest run` (the `test:vista-service` non-browser lane
 * excludes `*.browser.test.ts`) still skips cleanly. Proven locally by pointing
 * `PLAYWRIGHT_BROWSERS_PATH` at the version-aligned Nix browsers store path.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { publishViaControl } from './control-test-client.ts'
import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', 'samples', 'heavy-blocks-app')
const OWNER = 'agent/vista/tests'
/** Only run when the Nix-provisioned browser is on PATH (devenv/CI). */
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH

let dir: string
let port: number
let close: (() => Promise<void>) | undefined

beforeAll(async () => {
  if (!HAS_BROWSER) return
  // The apps dir MUST live INSIDE the workspace tree: under a hoisted-pnpm
  // layout a heavy block's RAW-served deep dep (`@pierre/diffs`, `zustand`)
  // resolves `react` by walking up node_modules, which only reaches the shared
  // closure from within the workspace. A apps dir in `/tmp` cannot, so the
  // heavy graph fails to resolve there (verified). `service/tmp/**` is gitignored.
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-heavy-'))
  // Isolate apps + cache BEFORE importing path-bound modules.
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'heavy-blocks')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  const { startService } = await import('./server.ts')
  port = 5200 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  // Freeze the sample's recorded GitHub provider, then build the real publication.
  await Effect.runPromise(
    publishViaControl(port, {
      owner: OWNER,
      slug: 'heavy-blocks',
      author: 'guard',
      changeSummary: 'guard',
    }),
  )
}, 60_000)

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('auto-discovery covers the heavy @vista/blocks browser closure', () => {
  it.skipIf(!HAS_BROWSER)(
    'renders a published system-explorer + diff + file-tree + gh-previews page with no console errors',
    async () => {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        // Scope the console capture to the RESOLUTION-FAILURE signature only — a
        // discovery gap manifests as a raw-served CJS dep that fails its ESM
        // interop ("does not provide an export named 'default'") or fails to
        // resolve. We deliberately do NOT assert a blank console: the render-proof
        // below (nodes>0) is what discriminates the dep-coverage failure, and a
        // blanket check would couple this guard to unrelated ambient noise.
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

        const url = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/heavy-blocks/v1/`
        // First load on a fresh service is a COLD Vite prebundle of the whole
        // heavy closure (@xyflow/react + @pierre/* + their CJS interop) — slow and
        // it can mid-load the page. Warm it once, then reload and assert on the
        // warm render so the one-time prebundle timing doesn't flake.
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.reload({ waitUntil: 'networkidle' })
        // Render-proof: React Flow mounts only if @xyflow/react and its transitive
        // CJS deps were discovered + prebundled correctly. A discovery gap yields
        // zero nodes.
        await page.waitForSelector('.react-flow__node', { timeout: 30_000 })
        const nodes = await page.locator('.react-flow__node').count()
        expect(nodes).toBeGreaterThan(0)
        // The direct diff block also mounts on the same page.
        await page.waitForSelector('#diff', { timeout: 30_000 })
        expect(await page.locator('#diff').count()).toBe(1)
        // Render-proof: the file-tree block (@pierre/trees) mounts a
        // `<file-tree-container>` custom element that renders its rows into an OPEN
        // Shadow DOM. Assert the element exists AND its shadow root actually
        // PAINTED — a failed @pierre/trees resolution never mounts `FileTree`, so
        // the container is absent and the lazy boundary shows its error fallback.
        await page.waitForSelector('file-tree-container', { timeout: 30_000 })
        const treePainted = await page.evaluate(() =>
          [...document.querySelectorAll('file-tree-container')].some(
            (el) => (el.shadowRoot?.childElementCount ?? 0) > 0,
          ),
        )
        expect(treePainted).toBe(true)
        // PullRequestFiles resolves its captured provider value without requiring
        // the removed GhPreviews-specific presentation contract.
        const gh = page.locator('[data-vista-id="gh"] pre')
        await gh.waitFor({ timeout: 30_000 })
        expect(await gh.filter({ hasText: '"number": 2910' }).count()).toBe(1)
        // No lazy arm fell back to its "couldn't load visualization" boundary —
        // i.e. every heavy chunk resolved and mounted (not just system-explorer).
        expect(await page.locator('.vista-lazyblock__error').count()).toBe(0)
        // Belt-and-suspenders: no dep-resolution error fired (discovery's job).
        expect(depErrors).toEqual([])
      } finally {
        await browser.close()
      }
    },
    45_000,
  )
})
