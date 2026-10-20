/**
 * Publish-time render smoke — real browser detection (decision 0058). Complements
 * the hermetic gating/teardown proof in `render-smoke.test.ts` by exercising the
 * actual {@link makeBrowserMountSmoke} against a running service: a genuinely-good
 * review passes, and a blank `#root` page fails. Runs only when the Nix browser is
 * on PATH (PLAYWRIGHT_BROWSERS_PATH); a bare `vitest run` skips it, and in
 * `check:all` it runs via the `test:vista-service-browser` devenv task.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { appSourcePath } from './paths.ts'
import { makeBrowserMountSmoke } from './render-smoke.ts'
import type { ServiceState } from './server.ts'
import { freePort } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH
const OWNER = 'agent/vista/tests'
/** The CI browser lane sets this so a missing browser is a hard FAIL, not a skip. */
const REQUIRE_BROWSER = process.env.VISTA_REQUIRE_BROWSER === '1'

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let state: ServiceState

beforeAll(async () => {
  if (REQUIRE_BROWSER && !HAS_BROWSER) {
    throw new Error(
      'VISTA_REQUIRE_BROWSER=1 but PLAYWRIGHT_BROWSERS_PATH is unset — the 0058 render-smoke ' +
        'proof must run with the Nix/devenv Playwright browser (via the ' +
        '`test:vista-service-browser` devenv task), never a bare vitest.',
    )
  }
  if (!HAS_BROWSER) return
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-smoke-browser-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')

  const { startService } = await import('./server.ts')
  const { publish } = await import('./publish.ts')
  port = await freePort()
  const started = await startService(port)
  close = started.close
  state = started.state

  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'smoke-green')
  mkdirSync(appSource, { recursive: true })
  cpSync(join(HERE, '..', 'samples', 'doctrine-app'), appSource, { recursive: true })
  await publish(
    { owner: OWNER, slug: 'smoke-green', author: 't', changeSummary: 'v1' },
    state.providers,
  )

  // Publish two valid, receipt-covered probes through the normal pipeline. The
  // blank probe returns semantic JSX during node extraction but throws before the
  // browser commit. The erroring probe mounts while emitting the eager-graph signature.
  const probes: ReadonlyArray<readonly [string, string]> = [
    [
      'smoke-blank',
      `import { AppRoot, Section } from '@vista/blocks'
export default function App() {
  if (typeof window !== 'undefined') throw new Error('blank smoke probe')
  return <AppRoot title="blank" template="architecture-review" scope="smoke"><Section>node projection</Section></AppRoot>
}`,
    ],
    [
      'smoke-erroring',
      `import { AppRoot, Section } from '@vista/blocks'
export default function App() {
  console.error("SyntaxError: The requested module './x.js' does not provide an export named 'default'")
  return <AppRoot title="erroring" template="architecture-review" scope="smoke"><Section>shell painted</Section></AppRoot>
}`,
    ],
  ]
  for (const [slug, source] of probes) {
    const sourceDir = appSourcePath(join(dir, 'sources'), OWNER, slug)
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, 'app.tsx'), source)
    await publish({ owner: OWNER, slug, author: 't', changeSummary: slug }, state.providers)
  }
}, 120_000)

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('makeBrowserMountSmoke detects mount vs blank (decision 0058)', () => {
  it.skipIf(!HAS_BROWSER)(
    'passes a genuinely-rendered review (#root non-empty)',
    async () => {
      const smoke = makeBrowserMountSmoke(`http://127.0.0.1:${port}`)
      const result = await smoke(OWNER, 'smoke-green', 1)
      expect(result._tag).toBe('ok')
      if (result._tag === 'ok') {
        expect(result.thumbnail).toBeDefined()
        const png = Buffer.from(result.thumbnail!)
        expect(png.readUInt32BE(16)).toBe(480)
        expect(png.readUInt32BE(20)).toBe(300)
      }
    },
    120_000,
  )

  it.skipIf(!HAS_BROWSER)(
    'fails a blank page (#root stays empty)',
    async () => {
      const smoke = makeBrowserMountSmoke(`http://127.0.0.1:${port}`)
      const result = await smoke(OWNER, 'smoke-blank', 1)
      expect(result._tag).toBe('failed')
      if (result._tag === 'failed') expect(result.reason).toMatch(/#root did not mount/)
    },
    120_000,
  )

  it.skipIf(!HAS_BROWSER)(
    'fails a mounted page that logs a module-resolution error (console arm)',
    async () => {
      const smoke = makeBrowserMountSmoke(`http://127.0.0.1:${port}`)
      const result = await smoke(OWNER, 'smoke-erroring', 1)
      expect(result._tag).toBe('failed')
      if (result._tag === 'failed')
        expect(result.reason).toMatch(/module-resolution\/mount console errors/)
    },
    120_000,
  )
})
