import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { Effect } from 'effect'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { publishViaControl } from './control-test-client.ts'
import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import { freePort, installTestChangelog } from './test-support.ts'

const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH
const OWNER = 'agent/dotfiles/vista'
const SLUG = 'missiongraph-collisions'
const HERE = dirname(fileURLToPath(import.meta.url))
const APP = `import { AppRoot, MissionGraph } from '@vista/blocks'
const steps = [
  { id: 'a', assignedTo: 'agent/x', label: 'Parallel alpha', detail: 'Alpha details' },
  { id: 'b', assignedTo: 'agent/x', label: 'Parallel beta', detail: 'Beta details' },
  ...['c', 'd', 'e', 'f', 'g'].map((id, i) => ({ id, assignedTo: 'agent/x', dependsOn: { step: i === 0 ? 'a' : ['c', 'd', 'e', 'f'][i - 1], state: 'completed' } })),
]
const overlay = { gates: [
  { id: 'gate-a', lane: 'agent/x', at: 'a', label: 'Gate alpha', detail: 'Gate alpha details' },
  { id: 'gate-b', lane: 'agent/x', at: 'a', label: 'Gate beta', detail: 'Gate beta details' },
] }
export default function App() {
  return <AppRoot title="Parallel mission" template="architecture-review" scope="collision regression"><MissionGraph steps={steps} overlay={overlay} /></AppRoot>
}
`
let directory: string
let port: number
let close: (() => Promise<void>) | undefined
let restoreChangelog: (() => void) | undefined
const original = {
  apps: process.env.VISTA_APPS,
  cache: process.env.VISTA_CACHE,
  sources: process.env.VISTA_SOURCES,
}

beforeAll(async () => {
  if (!HAS_BROWSER) {
    if (process.env.VISTA_REQUIRE_BROWSER === '1')
      throw new Error('MissionGraph publication proof requires PLAYWRIGHT_BROWSERS_PATH')
    return
  }
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  directory = mkdtempSync(join(HERE, '..', 'tmp', 'vista-mission-'))
  process.env.VISTA_APPS = join(directory, 'apps')
  process.env.VISTA_CACHE = join(directory, 'cache')
  process.env.VISTA_SOURCES = join(directory, 'sources')
  restoreChangelog = await installTestChangelog(directory)
  const source = appSourcePath(process.env.VISTA_SOURCES, OWNER, SLUG)
  mkdirSync(source, { recursive: true })
  writeFileSync(join(source, 'app.tsx'), APP)
  // paths.ts must capture these isolated roots before server.ts loads its state.
  const { startService } = await import('./server.ts')
  port = await freePort()
  close = (await startService(port)).close
  await Effect.runPromise(
    publishViaControl(port, {
      owner: OWNER,
      slug: SLUG,
      author: 'guard',
      changeSummary: 'parallel mission regression',
    }),
  )
}, 120_000)

afterAll(async () => {
  await close?.()
  restoreChangelog?.()
  for (const [name, value] of Object.entries({
    VISTA_APPS: original.apps,
    VISTA_CACHE: original.cache,
    VISTA_SOURCES: original.sources,
  })) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  if (directory) rmSync(directory, { recursive: true, force: true })
})

it.skipIf(!HAS_BROWSER)(
  'pointer-selects all same-lane, same-rank steps and gates in wide and narrow published layouts',
  async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 1600, height: 1000 })
      await page.goto(`http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/${SLUG}/v1/`, {
        waitUntil: 'networkidle',
      })
      await page.reload({ waitUntil: 'networkidle' })
      for (const [width, direction] of [
        [1600, 'LR'],
        [560, 'TB'],
      ] as const) {
        await page.setViewportSize({ width, height: 1000 })
        await page.locator(`[data-vista-mission-graph] [data-direction="${direction}"]`).waitFor()
        for (const [name, detail] of [
          ['Step 1: Parallel alpha', 'Alpha details'],
          ['Step 2: Parallel beta', 'Beta details'],
          ['Gate: Gate alpha', 'Gate alpha details'],
          ['Gate: Gate beta', 'Gate beta details'],
        ] as const) {
          // A normal pointer click (not force) proves no sibling obscures the target.
          await page.getByRole('button', { name, exact: true }).click()
          const panel = page.getByRole('region', { name: 'Selected node' })
          await panel.waitFor()
          expect(await panel.textContent()).toContain(detail)
        }
        if (process.env.VISTA_MISSION_SCREENSHOTS) {
          await page.screenshot({
            path: join(process.env.VISTA_MISSION_SCREENSHOTS, `parallel-mission-${direction}.png`),
            fullPage: true,
          })
        }
      }
    } finally {
      await browser.close()
    }
  },
  120_000,
)
