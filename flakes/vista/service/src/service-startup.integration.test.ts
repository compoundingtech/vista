import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, it } from 'vitest'

import { freePort } from './test-support.ts'

it('starts the publication runtime without browser dependency optimization', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vista-startup-'))
  const original = {
    VISTA_APPS: process.env.VISTA_APPS,
    VISTA_SOURCES: process.env.VISTA_SOURCES,
    VISTA_CACHE: process.env.VISTA_CACHE,
  }
  process.env.VISTA_APPS = join(root, 'apps')
  process.env.VISTA_SOURCES = join(root, 'sources')
  process.env.VISTA_CACHE = join(root, 'cache')
  let close: (() => Promise<void>) | undefined
  try {
    const importedAt = performance.now()
    // paths.ts captures roots at import: load the server after isolating state.
    const { startService } = await import('./server.ts')
    console.info('Publication startup server import ms:', performance.now() - importedAt)
    const startedAt = performance.now()
    const started = await startService(await freePort())
    close = started.close
    console.info('Publication startup service ms:', performance.now() - startedAt)
    expect(started.state.published.environments.client.depsOptimizer).toBeUndefined()
    expect(started.state.providers).toBeDefined()
  } finally {
    await close?.()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(root, { recursive: true, force: true })
  }
})
