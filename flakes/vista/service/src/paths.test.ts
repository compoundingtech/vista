import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as PathsModule from './paths.ts'

let dir: string | undefined

const savedEnv = {
  VISTA_ROOT: process.env.VISTA_ROOT,
  VISTA_APPS: process.env.VISTA_APPS,
  VISTA_CACHE: process.env.VISTA_CACHE,
  VISTA_SOURCES: process.env.VISTA_SOURCES,
  VISTA_LIVE_STATE: process.env.VISTA_LIVE_STATE,
  XDG_STATE_HOME: process.env.XDG_STATE_HOME,
  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
  HOME: process.env.HOME,
}

const restoreEnv = (): void => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

const freshPaths = async (): Promise<typeof PathsModule> => {
  vi.resetModules()
  return import('./paths.ts')
}

afterEach(() => {
  restoreEnv()
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

describe('vista runtime paths', () => {
  it('derives one canonical AppSource from sources root, owner, and slug', async () => {
    const paths = await freshPaths()
    expect(paths.appSourcePath('/sources', 'dev3.worker.alpha', 'review')).toBe(
      '/sources/_owned.v1/dev3.worker.alpha/review',
    )
  })

  it('isolates exact native and historical owner × slug namespaces', async () => {
    const paths = await freshPaths()
    expect(paths.appSourcePath('/sources', 'agent/vista/author', 'review')).toBe(
      '/sources/_owned.v1/agent%2Fvista%2Fauthor/review',
    )
    expect(paths.appSourcePath('/sources', 'dev3.agent%2Fvista%2Fauthor', 'review')).toBe(
      '/sources/_owned.v1/dev3.agent%252Fvista%252Fauthor/review',
    )
    expect(paths.appSourcePath('/sources', 'dev3.ü owner!', 'review')).toBe(
      '/sources/_owned.v1/dev3.%C3%BC%20owner%21/review',
    )
    const owners = ['agent/vista/author', 'agent/vista/reviewer', 'dev3.author', 'dev4.author']
    const pathsByIdentity = owners.flatMap((owner) =>
      ['review', 'other-review'].map((slug) => paths.appSourcePath('/sources', owner, slug)),
    )
    expect(new Set(pathsByIdentity).size).toBe(8)
    expect(pathsByIdentity.every((path) => path.startsWith('/sources/_owned.v1/'))).toBe(true)
  })

  it('rejects malformed identities and slug traversal at the resolver boundary', async () => {
    const paths = await freshPaths()
    for (const owner of ['..', 'dev/3.owner', 'agent', 'agent/', 'agent/../owner', 'agent/a//b', 'agent/A/b', 'dev3..', 'dev3.owner\\seat', ' dev3.owner', 'agent/a/b\n']) {
      expect(() => paths.appSourcePath('/sources', owner, 'review')).toThrow()
    }
    for (const slug of ['..', '../review', '/review', 'review/other', 'review%2Fother']) {
      expect(() => paths.appSourcePath('/sources', 'agent/vista/author', slug)).toThrow()
    }
  })

  it.each([undefined, '', ' \t '])('requires a nonblank source root (%j)', async (sources) => {
    if (sources === undefined) delete process.env.VISTA_SOURCES
    else process.env.VISTA_SOURCES = sources
    const paths = await freshPaths()
    expect(() => paths.resolveAppSource('dev3.worker.alpha', 'review')).toThrow(
      'VISTA_SOURCES is required for owner-scoped Vista AppSource resolution',
    )
  })

  it('resolves the configured root without memoizing owner-scoped sources', async () => {
    const paths = await freshPaths()
    process.env.VISTA_SOURCES = '/sources'
    expect(paths.resolveAppSource('dev3.worker.alpha', 'review')).toBe(
      '/sources/_owned.v1/dev3.worker.alpha/review',
    )
    process.env.VISTA_SOURCES = '/other-sources'
    expect(paths.resolveAppSource('mbp2025.worker.alpha', 'review')).toBe(
      '/other-sources/_owned.v1/mbp2025.worker.alpha/review',
    )
  })

  it('keeps local checkout defaults under the workspace tmp dir', async () => {
    dir = mkdtempSync(join(tmpdir(), 'vista-paths-'))
    process.env.VISTA_ROOT = join(dir, 'workspace')
    delete process.env.VISTA_APPS
    delete process.env.VISTA_CACHE

    const paths = await freshPaths()

    expect(paths.appsDir()).toBe(join(process.env.VISTA_ROOT!, 'tmp', 'vista'))
    expect(paths.cacheDir()).toBe(join(process.env.VISTA_ROOT!, 'tmp', 'vista-cache'))
    expect(paths.liveStateDir()).toBe(join(process.env.VISTA_ROOT!, 'tmp', 'vista-cache', 'live-state'))
  })

  it('requires VISTA_APPS under a Nix store packaged root and keeps the XDG cache default', async () => {
    dir = mkdtempSync(join(tmpdir(), 'vista-paths-'))
    process.env.VISTA_ROOT = '/nix/store/abc-vista/libexec/workspace'
    process.env.XDG_STATE_HOME = join(dir, 'state')
    process.env.XDG_CACHE_HOME = join(dir, 'cache')
    delete process.env.VISTA_APPS
    delete process.env.VISTA_CACHE

    const paths = await freshPaths()

    expect(() => paths.appsDir()).toThrow(/VISTA_APPS must be set/)
    expect(paths.cacheDir()).toBe(join(dir, 'cache', 'vista'))
  })

  it('lets explicit mutable overrides win even with a Nix store root', async () => {
    dir = mkdtempSync(join(tmpdir(), 'vista-paths-'))
    process.env.VISTA_ROOT = '/nix/store/abc-vista/libexec/workspace'
    process.env.VISTA_APPS = join(dir, 'apps')
    process.env.VISTA_CACHE = join(dir, 'cache')
    process.env.VISTA_LIVE_STATE = join(dir, 'live-state')

    const paths = await freshPaths()

    expect(paths.appsDir()).toBe(join(dir, 'apps'))
    expect(paths.cacheDir()).toBe(join(dir, 'cache'))
    expect(paths.liveStateDir()).toBe(join(dir, 'live-state'))
  })
})
