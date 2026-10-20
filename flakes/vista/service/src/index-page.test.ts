import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner } from './control.ts'
import { renderIndex } from './index-page.ts'
import { versionDir, type AppState } from './registry.ts'

const apps = mkdtempSync(join(tmpdir(), 'vista-index-apps-'))
const previousApps = process.env.VISTA_APPS
process.env.VISTA_APPS = apps

afterAll(() => {
  rmSync(apps, { recursive: true, force: true })
  if (previousApps === undefined) delete process.env.VISTA_APPS
  else process.env.VISTA_APPS = previousApps
})

const app = (slug: string, latest: number | null = 2): AppState => ({
  owner: 'agent/compoundingtech/st-ios',
  slug,
  latest,
  retired: false,
  versions: [],
})

const renderApp = (state: AppState): string => renderIndex(new Map([[state.slug, state]]))

const seedThumbnail = (state: AppState, version: number, nested = false): void => {
  const dir = nested
    ? join(versionDir(state.owner, state.slug, version), 'site')
    : versionDir(state.owner, state.slug, version)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'thumbnail.png'), new Uint8Array([137, 80, 78, 71]))
}

describe('overview thumbnails', () => {
  it('renders a lazy, fixed-size image pinned to the latest version and canonical owner route', () => {
    const state = app('with-preview')
    seedThumbnail(state, 2)
    const html = renderApp(state)
    expect(html).toContain(
      `src="/r/${encodeRouteOwner(state.owner)}/with-preview/v2/_thumbnail.png"`,
    )
    expect(html).toContain('width="128" height="80" loading="lazy" alt=""')
    expect(html).toContain('aspect-ratio: 8 / 5')
    expect(html).toContain('border: 1px solid color-mix(in oklab, currentColor 18%, transparent)')
    expect(html).not.toContain('aria-label="No preview available"')
    expect(html).toContain(`href="/r/${encodeRouteOwner(state.owner)}/with-preview/latest"`)
  })

  it('renders a neutral placeholder when the latest version has no root thumbnail', () => {
    const state = app('without-preview')
    seedThumbnail(state, 1)
    seedThumbnail(state, 2, true)
    const html = renderApp(state)
    expect(html).toContain('class="thumbnail thumbnail-placeholder"')
    expect(html).toContain('aria-label="No preview available">No preview</span>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('/_thumbnail.png')
  })

  it('renders a placeholder when there is no published latest version', () => {
    const html = renderApp(app('unpublished', null))
    expect(html).toContain('aria-label="No preview available"')
    expect(html).not.toContain('<img')
  })
})
