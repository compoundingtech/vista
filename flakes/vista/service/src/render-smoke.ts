/**
 * Publish-time per-review browser mount smoke (decision 0058, strengthens SVC-R58).
 *
 * The publish-time node projection (`derive-projection.ts`) proves a review
 * EVALUATES under node, but not that it MOUNTS in a browser — a review can pass
 * node eval and still blank on a client-side dep-resolution failure (FB-100). This
 * smoke closes that gap PER REVIEW: after the version is frozen but before it
 * acquires the `latest` pointer, headless-load its canonical URL and confirm the
 * page actually mounts.
 *
 * Scope (decision 0058): the smoke's job is the EAGER graph — the shell, the
 * bootstrap, and eagerly-imported blocks — and whole-page mount. A LAZY heavy
 * block that fails to load is already contained by its thin-shell error boundary
 * (decision 0054) and is NOT this gate's concern, so the smoke asserts `#root`
 * is non-empty and that no module-resolution / import-interop console error fired.
 * It also decodes eagerly-rendered AnnotatedImage assets before publication can
 * acquire `latest`; it does not wait for lazy chunks. Fail-closed: any smoke error (including an
 * unlaunchable browser) is a failure, because SVC-R58 is a render GUARANTEE — an
 * unproven render must not acquire `latest`.
 *
 * This module owns the browser; `publish.ts` stays browser-free and receives a
 * {@link RenderSmoke} by injection (wired in `server.ts`, which knows the port),
 * so the publish pipeline remains unit-testable without a browser.
 */

import { encodeRouteOwner } from './control.ts'

/** The eager-graph failure signatures a blank/broken mount emits (mirrors the
 * SVC-R58 CI guard `chart-interop.browser.test.ts`): unresolved/failed module
 * imports, bad ESM interop, and the multi-React null-dispatcher class (0052). */
const MOUNT_FAILURE =
  /does not provide an export named|Failed to resolve import|Failed to fetch dynamically imported|Invalid hook call|Cannot read properties of null \(reading 'use|dispatcher is null|Should have a queue/

/** Await a navigation best-effort: a live-mode review may never reach the wait's
 * `networkidle`, and that is not a smoke failure — the `#root` mount check is the
 * gate, so a nav wait that times out (or errors) falls through instead of throwing. */
const settle = (nav: Promise<unknown>): Promise<void> =>
  nav.then(() => undefined).catch(() => undefined)

/**
 * Outcome of a render smoke test: either ok, or failed with a human-readable reason for what went
 * wrong.
 */
export type RenderSmokeResult =
  | { readonly _tag: 'ok'; readonly thumbnail?: Uint8Array }
  | { readonly _tag: 'failed'; readonly reason: string }

/** Thrown by the plain {@link publish} path when the render smoke fails (the
 * freeze path returns a `{_tag:'aborted'}` outcome instead — each matches its
 * caller's existing failure idiom). The claimed version is torn down first. */
export class RenderSmokeError extends Error {
  readonly _tag = 'Vista.RenderSmokeError'
  // Explicit fields, NOT TS parameter properties: the service runs under node
  // `--experimental-strip-types` (strip-only mode), which rejects parameter
  // properties at runtime (mirrors ProjectionEvalError in derive-projection.ts).
  readonly slug: string
  readonly version: number
  readonly reason: string
  constructor(slug: string, version: number, reason: string) {
    super(`render smoke failed for ${slug} v${version}: ${reason}`)
    this.name = 'RenderSmokeError'
    this.slug = slug
    this.version = version
    this.reason = reason
  }
}

/**
 * Prove that a freshly built owner-scoped AppVersion mounts. The publish
 * pipeline injects this seam so `publish.ts` never imports a browser.
 */
export type RenderSmoke = (
  owner: string,
  slug: string,
  version: number,
) => Promise<RenderSmokeResult>

/** Capture is display-only and must never turn a proven mount into a failed publish. */
export const captureThumbnail = async (page: {
  screenshot: (options: { type: 'png'; fullPage: boolean; timeout: number }) => Promise<Uint8Array>
  evaluate: <T>(fn: (data: string) => Promise<T>, data: string) => Promise<T>
  close: () => Promise<void>
}): Promise<Uint8Array | undefined> => {
  const started = performance.now()
  let deadline: NodeJS.Timeout | undefined
  try {
    const work = async (): Promise<Uint8Array> => {
      const screenshot = await page.screenshot({ type: 'png', fullPage: false, timeout: 5_000 })
      const encoded = await page.evaluate(async (data) => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = 480
        canvas.height = 300
        const context = canvas.getContext('2d')
        if (!context) throw new Error('thumbnail canvas unavailable')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/png').split(',')[1]!
      }, Buffer.from(screenshot).toString('base64'))
      return Buffer.from(encoded, 'base64')
    }
    const timeout = Promise.withResolvers<never>()
    deadline = setTimeout(() => {
      // Closing the page interrupts pending browser evaluation/screenshot work.
      // Do not await cleanup here: capture must return even if closing fails.
      void page
        .close()
        .catch((cause) => console.warn(`Vista thumbnail cleanup skipped: ${String(cause)}`))
      timeout.reject(new Error('thumbnail capture exceeded 5000 ms deadline'))
    }, 5_000)
    return await Promise.race([work(), timeout.promise])
  } catch (cause) {
    console.warn(`Vista thumbnail capture skipped: ${String(cause)}`)
    return undefined
  } finally {
    clearTimeout(deadline)
    console.info(`Vista thumbnail capture: ${(performance.now() - started).toFixed(1)} ms`)
  }
}

/**
 * Build a {@link RenderSmoke} bound to a running service's base URL (e.g.
 * `http://127.0.0.1:<port>`). Launches the Nix-provisioned Chromium
 * (`PLAYWRIGHT_BROWSERS_PATH`, wired into the service closure) via
 * `@playwright/test` — imported dynamically so the service startup path never
 * pulls Playwright; it is loaded on the first publish.
 */
export const makeBrowserMountSmoke =
  (baseUrl: string): RenderSmoke =>
  async (owner, slug, version) => {
    const url = `${baseUrl}/r/${encodeRouteOwner(owner)}/${slug}/v${version}/`
    const { chromium } = await import('@playwright/test')
    // Fail-closed, NOT throw: an unlaunchable browser is a smoke FAILURE (SVC-R58 —
    // an unproven render must not acquire `latest`), and the publish pipeline tears
    // the claimed version down on `{_tag:'failed'}`. Throwing here escaped that
    // teardown and orphaned a half-published `vN`, so it returns `failed` like every
    // other smoke error the module already funnels through its `{_tag:'failed'}` seam.
    let browser: Awaited<ReturnType<typeof chromium.launch>>
    try {
      browser = await chromium.launch({ headless: true })
    } catch (cause) {
      return {
        _tag: 'failed',
        reason: `could not launch the render-smoke browser at ${url}: ${String(cause)}`,
      }
    }
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
      })
      const errors: string[] = []
      const record = (text: string): void => {
        if (MOUNT_FAILURE.test(text)) errors.push(text)
      }
      page.on('console', (m) => {
        if (m.type() === 'error') record(m.text())
      })
      page.on('pageerror', (e) => record(String(e)))

      // The first (cold) load prebundles the version's dep closure (Vite
      // optimizeDeps); a mid-prebundle load can transiently double-resolve a dep,
      // so — exactly as the SVC-R58 guard (`chart-interop.browser.test.ts`) does —
      // warm once with a reload and assert on the warmed page. `networkidle` is
      // best-effort: a live-mode review with persistent requests may never reach it,
      // and that is NOT a failure — the `#root` mount check below is the real gate,
      // so a nav timeout falls through rather than false-failing.
      await settle(page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }))
      // Cold-load console errors (e.g. a mid-prebundle double-resolve) are transient
      // and not the review's fault; a GENUINE eager dep failure re-fires on the warm
      // reload. So clear BEFORE the reload — the warmed render's console is what we
      // assert on — not after, which would wipe the very signal this arm exists for.
      errors.length = 0
      await settle(page.reload({ waitUntil: 'networkidle', timeout: 90_000 }))

      // Wait for the eager shell + bootstrap to populate `#root` (whole-page mount,
      // SVC-R58) within a budget; a review that never mounts — the exact FB-100
      // blank-render — times out here and fails.
      const mounted = await page
        .waitForFunction(
          () => ((document.querySelector('#root')?.textContent ?? '').trim().length ?? 0) > 0,
          { timeout: 30_000 },
        )
        .then(() => true)
        .catch(() => false)
      if (errors.length > 0)
        return {
          _tag: 'failed',
          reason: `module-resolution/mount console errors: ${errors.join(' | ')}`,
        }
      if (!mounted) return { _tag: 'failed', reason: `#root did not mount within budget at ${url}` }
      const imageFailures = await page.evaluate(async () => {
        const images = document.querySelectorAll<HTMLImageElement>('img[data-vista-image-asset]')
        return Promise.all(
          Array.from(images, async (image) => {
            let timeout: number | undefined
            try {
              return await Promise.race([
                image.decode().then(
                  () =>
                    image.naturalWidth > 0 && image.naturalHeight > 0
                      ? undefined
                      : `${image.currentSrc || image.src}: decoded without intrinsic dimensions`,
                  (cause: unknown) => `${image.currentSrc || image.src}: ${String(cause)}`,
                ),
                new Promise<string>((resolve) => {
                  timeout = window.setTimeout(
                    () => resolve(`${image.currentSrc || image.src}: image decode timed out`),
                    15_000,
                  )
                }),
              ])
            } finally {
              window.clearTimeout(timeout)
            }
          }),
        )
      })
      const brokenImages = imageFailures.filter((failure) => failure !== undefined)
      if (brokenImages.length > 0) {
        return {
          _tag: 'failed',
          reason: `AnnotatedImage asset could not be loaded or decoded: ${brokenImages.join(' | ')}`,
        }
      }
      const thumbnail = await captureThumbnail(page)
      return { _tag: 'ok', ...(thumbnail === undefined ? {} : { thumbnail }) }
    } catch (cause) {
      // Fail-closed: an unproven render must not acquire `latest`.
      return { _tag: 'failed', reason: `render smoke error at ${url}: ${String(cause)}` }
    } finally {
      await browser.close()
    }
  }
