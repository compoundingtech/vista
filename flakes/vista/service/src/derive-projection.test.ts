import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { deriveProjection } from './derive-projection.ts'
import { appSourcePath } from './paths.ts'
import type { ServiceState } from './server.ts'
import { freePort, installTestChangelog } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLES = join(HERE, '..', 'samples')
const OWNER = 'agent/vista/tests'

let dir: string
let close: (() => Promise<void>) | undefined
let state: ServiceState
let restoreChangelog: (() => void) | undefined

const appSource = (slug: string): string =>
  appSourcePath(join(dir, 'sources'), OWNER, slug)

const writeApp = (slug: string, title: string): void => {
  const source = appSource(slug)
  mkdirSync(source, { recursive: true })
  writeFileSync(
    join(source, 'app.tsx'),
    `import { AppRoot, Decision, Section } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title=${JSON.stringify(title)} template="architecture-review" scope="test"><Section id="s"><Decision id="d" status="locked" /></Section></AppRoot>
}
`,
  )
}

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-derive-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  restoreChangelog = await installTestChangelog(dir)
  const { startService } = await import('./server.ts')
  const started = await startService(await freePort())
  close = started.close
  state = started.state
}, 60_000)

afterAll(async () => {
  await close?.()
  restoreChangelog?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('single-source semantic projection', () => {
  it('extracts the default zero-prop component and derived data binding', async () => {
    const { extractSemanticManifestWithVite } = await import('./semantic-extractor.ts')
    const source = appSource('data-panel-extract')
    mkdirSync(dirname(source), { recursive: true })
    cpSync(join(SAMPLES, 'data-panel-app'), source, { recursive: true })

    const manifest = await extractSemanticManifestWithVite(state.published, join(source, 'app.tsx'))

    expect(manifest.app.title).toBe('Request rate — frozen telemetry panel')
    expect(manifest.nodes.map(({ id }) => id)).toEqual(['app', 'otel-rate', 'set-freeze'])
    expect(manifest.nodes.flatMap(({ bindings }) => bindings ?? [])).toContainEqual({
      provider: 'otel',
      operation: 'query',
      args: {
        promql: 'rate(http_requests_total[5m])',
        range: { kind: 'relative', last: '1h' },
        stepSeconds: 60,
        points: 30,
      },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    })
  })

  it('keeps pure helpers and visual blocks available during semantic extraction', async () => {
    const { extractSemanticManifestWithVite } = await import('./semantic-extractor.ts')
    const source = appSource('treemap-helper-extract')
    mkdirSync(source, { recursive: true })
    writeFileSync(
      join(source, 'app.tsx'),
      `import { AppRoot, Callout, StatusLine, fromGitDiff } from '@vista/blocks'
export default function VistaApp() {
  const model = fromGitDiff('10\\t2\\tsrc/app.ts')
  return (
    <AppRoot title="Treemap helper" template="architecture-review" scope={model.root.label}>
      <StatusLine locked={1} open={0} awaiting={0} />
      <Callout kind="finding" title="Finding" body="Visual-only block" />
    </AppRoot>
  )
}
`,
    )

    const manifest = await extractSemanticManifestWithVite(state.published, join(source, 'app.tsx'))

    expect(manifest.app).toMatchObject({ title: 'Treemap helper', scope: 'diff' })
  })

  it('isolates concurrent app projections and an edited draft refresh on the shared runtime', async () => {
    const writeProjectionApp = (slug: string, title: string, status: 'locked' | 'open') => {
      const source = appSource(slug)
      mkdirSync(source, { recursive: true })
      writeFileSync(
        join(source, 'app.tsx'),
        `import { AppRoot, Decision, Section } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title=${JSON.stringify(title)} template="architecture-review" scope="test"><Section id="${slug}-section"><Decision id="${slug}-decision" status="${status}" /></Section></AppRoot>
}
`,
      )
      return join(source, 'app.tsx')
    }
    const draftPath = writeProjectionApp('concurrent-draft', 'Draft before edit', 'locked')
    const otherPath = writeProjectionApp('concurrent-other', 'Independent app', 'open')
    const [draft, other] = await Promise.all([
      deriveProjection(state.published, draftPath, { invalidate: true }),
      deriveProjection(state.published, otherPath, { invalidate: true }),
    ])

    expect(draft.title).toBe('Draft before edit')
    expect(draft.semantics.app.title).toBe('Draft before edit')
    expect(draft.semantics.nodes.map(({ id }) => id)).toEqual([
      'app',
      'concurrent-draft-section',
      'concurrent-draft-decision',
    ])
    expect(draft.status).toEqual({ locked: 1, open: 0, awaiting: 0 })
    expect(other.title).toBe('Independent app')
    expect(other.semantics.app.title).toBe('Independent app')
    expect(other.semantics.nodes.map(({ id }) => id)).toEqual([
      'app',
      'concurrent-other-section',
      'concurrent-other-decision',
    ])
    expect(other.status).toEqual({ locked: 0, open: 1, awaiting: 0 })

    writeProjectionApp('concurrent-draft', 'Draft after edit', 'open')
    const [refreshedDraft, concurrentOther] = await Promise.all([
      deriveProjection(state.published, draftPath, { invalidate: true }),
      deriveProjection(state.published, otherPath, { invalidate: true }),
    ])

    expect(refreshedDraft.title).toBe('Draft after edit')
    expect(refreshedDraft.semantics.app.title).toBe('Draft after edit')
    expect(refreshedDraft.semantics.nodes.map(({ id }) => id)).toEqual([
      'app',
      'concurrent-draft-section',
      'concurrent-draft-decision',
    ])
    expect(refreshedDraft.status).toEqual({ locked: 0, open: 1, awaiting: 0 })
    expect(concurrentOther).toEqual(other)
  })

  it('publishes metadata from the same semantic component', async () => {
    const { publish } = await import('./publish.ts')
    const { latestMeta, scanApp, versionDir } = await import('./registry.ts')
    writeApp('derived', 'The real derived title')

    const result = await publish(
      { owner: OWNER, slug: 'derived', author: 't', changeSummary: 'v1' },
      state.providers,
    )

    expect(result.version).toBe(1)
    expect(latestMeta(scanApp(OWNER, 'derived')!)!).toMatchObject({
      title: 'The real derived title',
      template: 'architecture-review',
      status: { locked: 1, open: 0, awaiting: 0 },
    })
    const manifest = JSON.parse(
      readFileSync(join(versionDir(OWNER, 'derived', 1), 'vista-semantics.json'), 'utf8'),
    ) as { readonly app: { readonly title: string } }
    expect(manifest.app.title).toBe('The real derived title')
  }, 120_000)

  it('republish evaluates the edited component rather than a stale module', async () => {
    const { publish } = await import('./publish.ts')
    const { latestMeta, scanApp } = await import('./registry.ts')
    writeApp('republish', 'First title')
    await publish(
      { owner: OWNER, slug: 'republish', author: 't', changeSummary: 'v1' },
      state.providers,
    )
    writeApp('republish', 'Second title')
    await publish(
      { owner: OWNER, slug: 'republish', author: 't', changeSummary: 'v2' },
      state.providers,
    )

    const scanned = scanApp(OWNER, 'republish')!
    expect(scanned.latest).toBe(2)
    expect(latestMeta(scanned)!.title).toBe('Second title')
  }, 120_000)

  it('keeps lazy browser-only modules below Island out of semantic evaluation', async () => {
    const { extractSemanticManifestWithVite } = await import('./semantic-extractor.ts')
    const source = appSource('esm-lazy')
    mkdirSync(dirname(source), { recursive: true })
    cpSync(join(SAMPLES, 'esm-lazy-app'), source, { recursive: true })

    const manifest = await extractSemanticManifestWithVite(state.published, join(source, 'app.tsx'))
    expect(manifest.app.title).toBe('Heavy component via pinned esm.sh + lazy boundary')
    expect(manifest.nodes.map(({ id }) => id)).toEqual([
      'app',
      'confetti',
      'confetti-runtime',
      'set-esm-lazy',
    ])
  })
})
