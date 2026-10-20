import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { appSourcePath } from './paths.ts'
import { freePort, installTestChangelog } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'vista.tests'
const SLUG = 'telemetry-stylex'
let directory: string
let base: string
let close: (() => Promise<void>) | undefined
let restoreChangelog: (() => void) | undefined

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  directory = mkdtempSync(join(HERE, '..', 'tmp', 'vista-telemetry-stylex-'))
  process.env.VISTA_APPS = join(directory, 'apps')
  process.env.VISTA_CACHE = join(directory, '.vista-cache')
  process.env.VISTA_SOURCES = join(directory, 'sources')
  const source = appSourcePath(join(directory, 'sources'), OWNER, SLUG)
  cpSync(join(HERE, '..', 'samples', 'telemetry-trace-app'), source, { recursive: true })
  restoreChangelog = await installTestChangelog(directory)
  // paths.ts freezes roots on import; load the service only after installing them.
  const { startService } = await import('./server.ts')
  const port = await freePort()
  const started = await startService(port)
  close = started.close
  base = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/${SLUG}/draft/`
  expect((await fetch(base)).status).toBe(200)
})

afterAll(async () => {
  await close?.()
  restoreChangelog?.()
  if (directory) rmSync(directory, { recursive: true, force: true })
})

// These are host modules, NOT part of the prebuilt Grafana island. Request them
// through the actual draft server: compiling island.js cannot fix this boundary.
it.each(['telemetry-frame', 'MetricBlock', 'FlamegraphBlock', 'TraceBlock'])(
  'compiles %s before the telemetry host reaches the browser (#1390)',
  async (name) => {
    const path = join(HERE, '..', '..', 'blocks', 'src', 'blocks', `${name}.tsx`)
    expect(readFileSync(path, 'utf8')).toContain('stylex.create(')
    const response = await fetch(`${base}@fs${path}`)
    expect(response.status).toBe(200)
    const javascript = await response.text()
    expect(javascript).not.toMatch(/\bstylex\.create\(/)
    expect(javascript).toMatch(/className:\s*["']x/)
    const css = await fetch(`${base}virtual:stylex.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toContain('text/css')
    expect(await css.text()).not.toBe('')
  },
)

it('keeps the shared compact component barrel out of the dependency optimizer (#1390)', async () => {
  const importer = join(HERE, '..', '..', 'blocks', 'src', 'blocks', 'agent-timeline', 'SpanHover.tsx')
  const response = await fetch(`${base}@fs${importer}`)
  expect(response.status).toBe(200)
  const javascript = await response.text()
  expect(javascript).toContain('/agent-timeline/src/compact.ts')
  expect(javascript).not.toContain('/deps/@overeng_agent-timeline_compact.js')
})
