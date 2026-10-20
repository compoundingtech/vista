import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { freePort } from './test-support.ts'

const OWNER = 'dev3.direct.omp.publication-test'
const HERE = dirname(fileURLToPath(import.meta.url))
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
let dir: string
let port: number
let close: (() => Promise<void>) | undefined

const seedPublication = async (slug: string, schemaVersion: number) => {
  const { publicationTrustRoot } = await import('./publish.ts')
  const { appDir, versionDir } = await import('./registry.ts')
  const version = versionDir(OWNER, slug, 1)
  mkdirSync(join(version, 'site'), { recursive: true })
  const semantics = JSON.stringify({
    schemaVersion,
    app: {
      id: 'app',
      title: slug,
      template: 'architecture-review',
      scope: 'test',
      status: { locked: 0, open: 0, awaiting: 0 },
    },
    nodes: [{ id: 'app', kind: 'app', refs: [], bindings: [] }],
  })
  const files = {
    'app.tsx': 'throw new Error("immutable source must never execute")',
    'index.html': '<div>authored source</div>',
    'meta.json': JSON.stringify({ owner: OWNER, slug, version: 1 }),
    'site/index.html': '<main>retained immutable publication</main>',
    'vista-semantics.json': semantics,
  }
  for (const [name, content] of Object.entries(files)) writeFileSync(join(version, name), content)
  const receipt = JSON.stringify({
    schemaVersion: 1,
    owner: OWNER,
    slug,
    version: 1,
    basePath: `/r/${OWNER}/${slug}/v1/`,
    toolchain: { vite: '7.1.5' },
    semantics: { path: 'vista-semantics.json', sha256: hash(semantics) },
    inventory: Object.entries(files)
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, content]) => ({
        path,
        sha256: hash(content),
        size: Buffer.byteLength(content),
      })),
  })
  writeFileSync(join(version, 'publication.json'), receipt)
  const root = publicationTrustRoot(OWNER, slug, 1)
  mkdirSync(dirname(root), { recursive: true })
  writeFileSync(root, JSON.stringify({ schemaVersion: 1, receiptSha256: hash(receipt) }))
  symlinkSync('v1', join(appDir(OWNER, slug), 'latest'))
  return { version, root, receipt }
}

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-publication-compat-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, 'cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  process.env.VISTA_LIVE_STATE = join(dir, 'live-state')
  port = await freePort()
  const { startService } = await import('./server.ts')
  const started = await startService(port)
  close = started.close
})

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('retained immutable publication trust', () => {
  it.each([1, 2])(
    'serves cold pinned and latest schema-%i publications without rewriting them',
    async (schemaVersion) => {
      const slug = `retained-${schemaVersion}`
      const { version, root, receipt } = await seedPublication(slug, schemaVersion)
      const semantics = readFileSync(join(version, 'vista-semantics.json'))
      const trust = readFileSync(root)
      const { inspectStaticPublication } = await import('./publish.ts')
      expect(inspectStaticPublication(OWNER, slug, 1)._tag).toBe('verified')
      for (const selector of ['v1', 'latest']) {
        const response = await fetch(`http://127.0.0.1:${port}/r/${OWNER}/${slug}/${selector}/`)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('<main>retained immutable publication</main>')
      }
      expect(readFileSync(join(version, 'publication.json'), 'utf8')).toBe(receipt)
      expect(readFileSync(join(version, 'vista-semantics.json'))).toEqual(semantics)
      expect(readFileSync(root)).toEqual(trust)
    },
  )

  it.each([1, 2])(
    'keeps all root, receipt, semantic and inventory checks for schema %i',
    async (schemaVersion) => {
      const { inspectStaticPublication } = await import('./publish.ts')
      for (const defect of ['root', 'receipt', 'semantics', 'inventory', 'extra-file']) {
        const slug = `invalid-${schemaVersion}-${defect}`
        const { version, root } = await seedPublication(slug, schemaVersion)
        if (defect === 'root') rmSync(root)
        if (defect === 'receipt') writeFileSync(join(version, 'publication.json'), '{}')
        if (defect === 'semantics') writeFileSync(join(version, 'vista-semantics.json'), '{}')
        if (defect === 'inventory') writeFileSync(join(version, 'app.tsx'), 'tampered')
        if (defect === 'extra-file') writeFileSync(join(version, 'extra.txt'), 'unreceipted')
        expect(inspectStaticPublication(OWNER, slug, 1)._tag).toBe('untrusted')
        const response = await fetch(`http://127.0.0.1:${port}/r/${OWNER}/${slug}/v1/`, {
          headers: { accept: 'text/html' },
        })
        expect(response.status).toBe(409)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
        const page = await response.text()
        expect(page).toContain('This published version is unavailable')
        expect(page).toContain(
          'Vista could not verify this version against its trusted publication record.',
        )
        expect(page).not.toContain(version)
      }
    },
  )

  it('logs a cold verification reason server-side but keeps navigation guidance generic', async () => {
    const slug = 'unsupported-semantics'
    await seedPublication(slug, 3)
    const error = vi.spyOn(console, 'error')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/r/${OWNER}/${slug}/v1/`, {
        headers: { accept: 'text/html' },
      })
      expect(response.status).toBe(409)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
      const page = await response.text()
      expect(page).toContain('This published version is unavailable')
      expect(page).toContain(
        'Vista could not verify this version against its trusted publication record.',
      )
      expect(page).not.toContain('published semantic manifest is invalid')
      expect(error).toHaveBeenCalledWith('publication trust verification failed', {
        owner: OWNER,
        slug,
        version: 1,
        reason: expect.stringContaining('published semantic manifest is invalid'),
      })
    } finally {
      error.mockRestore()
    }
  })
})
