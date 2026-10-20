import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { publicationTrustRoot } from './publish.ts'
import { encodeRouteOwner } from './read.ts'
import { versionDir } from './registry.ts'
import { startService, type StartedService } from './server.ts'
import { freePort } from './test-support.ts'

const OWNER = 'dev3.trust-regression'
const envKeys = ['VISTA_APPS', 'VISTA_CACHE', 'VISTA_SOURCES'] as const
const originalEnv: Record<(typeof envKeys)[number], string | undefined> = {
  VISTA_APPS: process.env.VISTA_APPS,
  VISTA_CACHE: process.env.VISTA_CACHE,
  VISTA_SOURCES: process.env.VISTA_SOURCES,
}
let scratch: string
let service: StartedService
const digest = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex')
const manifest = {
  schemaVersion: 2,
  app: {
    id: 'app',
    title: 'Retained review',
    template: 'architecture-review',
    scope: 'test',
    status: { locked: 0, open: 0, awaiting: 0 },
  },
  nodes: [{ id: 'app', kind: 'app', refs: [], bindings: [] }],
}

const seed = (slug: string, semantics = manifest): string => {
  const directory = versionDir(OWNER, slug, 1)
  mkdirSync(join(directory, 'site'), { recursive: true })
  const files = {
    'index.html': '<div id="root"></div>',
    'meta.json': JSON.stringify({ owner: OWNER, slug, version: 1 }),
    'site/index.html': '<!doctype html><html lang="en"><body>Retained publication</body></html>',
    'vista-semantics.json': JSON.stringify(semantics),
  }
  for (const [path, bytes] of Object.entries(files)) writeFileSync(join(directory, path), bytes)
  const receipt = JSON.stringify({
    schemaVersion: 1,
    owner: OWNER,
    slug,
    version: 1,
    basePath: `/r/${OWNER}/${slug}/v1/`,
    toolchain: { vite: '7.1.5' },
    semantics: { path: 'vista-semantics.json', sha256: digest(files['vista-semantics.json']) },
    inventory: Object.entries(files).map(([path, bytes]) => ({
      path,
      sha256: digest(bytes),
      size: Buffer.byteLength(bytes),
    })),
  })
  writeFileSync(join(directory, 'publication.json'), receipt)
  const trust = publicationTrustRoot(OWNER, slug, 1)
  mkdirSync(dirname(trust), { recursive: true })
  writeFileSync(trust, JSON.stringify({ schemaVersion: 1, receiptSha256: digest(receipt) }))
  symlinkSync('v1', join(directory, '..', 'latest'))
  return directory
}
const url = (slug: string, selector = 'v1', rest = ''): string =>
  `http://127.0.0.1:${service.port}/r/${encodeRouteOwner(OWNER)}/${slug}/${selector}/${rest}`

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'vista-publication-trust-'))
  process.env.VISTA_APPS = join(scratch, 'apps')
  process.env.VISTA_CACHE = join(scratch, 'cache')
  process.env.VISTA_SOURCES = join(scratch, 'sources')
  service = await startService(await freePort())
})
afterAll(async () => {
  await service?.close()
  if (scratch) rmSync(scratch, { recursive: true, force: true })
  for (const key of envKeys) {
    const original = originalEnv[key]
    if (original === undefined) delete process.env[key]
    else process.env[key] = original
  }
})

describe('publication failure tombstones', () => {
  it.each([
    'missing-root',
    'receipt-drift',
    'manifest-drift',
    'inventory-drift',
    'invalid-manifest',
  ] as const)('withholds %s with a contextual non-cacheable navigation page', async (failure) => {
    const directory = seed(
      failure,
      failure === 'invalid-manifest' ? { ...manifest, schemaVersion: 99 } : manifest,
    )
    if (failure === 'missing-root') rmSync(publicationTrustRoot(OWNER, failure, 1))
    if (failure === 'receipt-drift') writeFileSync(join(directory, 'publication.json'), '{}')
    if (failure === 'manifest-drift') writeFileSync(join(directory, 'vista-semantics.json'), '{}')
    if (failure === 'inventory-drift')
      writeFileSync(join(directory, 'site/index.html'), 'untrusted application bytes')
    for (const selector of ['v1', 'latest']) {
      const response = await fetch(url(failure, selector))
      expect(response.status).toBe(409)
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(response.headers.get('cache-control')).toBe('no-store')
      const page = await response.text()
      expect(page).toContain('This published version is unavailable')
      expect(page).toContain(OWNER)
      expect(page).toContain(failure)
      expect(page).toContain('<code>v1</code>')
      expect(page).toContain('Ask the owner to republish')
      expect(page).toContain('Back to app index')
      expect(page).not.toContain('untrusted application bytes')
      expect(page).not.toContain(scratch)
    }
    const rpc = await fetch(url(failure, 'v1', '_data/overview'))
    expect(rpc.status).toBe(409)
    expect(rpc.headers.get('content-type')).toBe('text/plain')
  })

  it('explains a missing receipt and still checks requested bytes after activation', async () => {
    const receiptless = seed('receiptless')
    rmSync(join(receiptless, 'publication.json'))
    const missing = await fetch(url('receiptless'))
    expect(missing.status).toBe(409)
    expect(await missing.text()).toContain('receipt for this version is missing')

    const directory = seed('activated')
    expect((await fetch(url('activated'))).status).toBe(200)
    writeFileSync(join(directory, 'site/index.html'), 'tampered after activation')
    const rejected = await fetch(url('activated', 'v1', 'index.html'))
    expect(rejected.status).toBe(409)
    expect(await rejected.text()).toContain('This published version is unavailable')
  })
})
