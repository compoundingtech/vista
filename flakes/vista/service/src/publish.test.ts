import { createHash } from 'node:crypto'
import {
  existsSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encodeRouteOwner } from '@vista/blocks/internal/owner-identity'
import { overview } from '@vista/blocks/internal/provider-contracts'
import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveVistaBuildInfo } from './build-info.ts'
import { VISTA_CHANGELOG_FILE, VISTA_CHANGELOG_PATH_ENV } from './changelog-companion.ts'
import { VISTA_FAVICON_FILE, vistaFaviconPath } from './favicon.ts'
import { appSourcePath } from './paths.ts'
import type { ServiceState } from './server.ts'
import { freePort } from './test-support.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'agent/dotfiles/vista'
const ORIGINAL_CHANGELOG_PATH = process.env[VISTA_CHANGELOG_PATH_ENV]
let dir: string
let close: (() => Promise<void>) | undefined
let state: ServiceState

const writeApp = async (slug: string, body?: string, owner = OWNER): Promise<string> => {
  const appSource = appSourcePath(join(dir, 'sources'), owner, slug)
  mkdirSync(appSource, { recursive: true })
  writeFileSync(
    join(appSource, 'app.tsx'),
    body ??
      `import { AppRoot } from '@vista/blocks'
export default function VistaApp() { return <AppRoot title=${JSON.stringify(slug)} template="architecture-review" scope="test" /> }
`,
  )
  return appSource
}

const writeFlatMapApp = async (slug: string, offset: number): Promise<string> => {
  const appSource = await writeApp(
    slug,
    `import { AppRoot, Evidence, Section } from '@vista/blocks'
import { bind, useBinding } from '@vista/blocks/query'
import { dependent } from './providers/collision.query.ts'

const binding = bind(dependent, { value: 1 })
const DependentBlock = () => {
  useBinding(binding)
  return null
}

export default function VistaApp() {
  return <AppRoot title=${JSON.stringify(slug)} template="architecture-review" scope="flatMap">
    <Section><Evidence id="dependent"><DependentBlock /></Evidence></Section>
  </AppRoot>
}
`,
  )
  const providers = join(appSource, 'providers')
  mkdirSync(providers)
  writeFileSync(
    join(providers, 'collision.query.ts'),
    `import { bind, contract, Operation } from '@vista/blocks/query'
import { Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'

export const Value = Schema.TaggedStruct('Value', { value: Schema.Finite })
const Api = RpcGroup.make(
  Rpc.make('parent', { payload: { value: Schema.Finite }, success: Value }),
  Rpc.make('child', { payload: { value: Schema.Finite }, success: Value }),
)
export const collision = contract({ id: 'collision-provider', group: Api })
export const dependent = Operation.flatMap(
  collision.ops.parent,
  (parent) => bind(collision.ops.child, { value: parent.value + ${offset} }),
  { id: 'collision/v1', successSchema: Value },
)
`,
  )
  writeFileSync(
    join(providers, 'collision.provider.ts'),
    `import { Effect, Layer } from 'effect'
import { implement, mountProvider } from '@vista/data/provider'
import { collision } from './collision.query.ts'

const implementation = implement(collision, {
  purity: 'pure',
  handlers: {
    parent: ({ value }) => Effect.succeed({ _tag: 'Value', value }),
    child: ({ value }) => Effect.succeed({ _tag: 'Value', value }),
  },
})
export default mountProvider(implementation, Layer.empty)
`,
  )
  return appSource
}

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-publish-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  const changelog = JSON.stringify({
    schemaVersion: 1,
    product: 'vista',
    build: { machineVersion: resolveVistaBuildInfo().machineVersion },
    entries: [],
  })
  const changelogPath = join(dir, VISTA_CHANGELOG_FILE)
  writeFileSync(changelogPath, changelog)
  process.env[VISTA_CHANGELOG_PATH_ENV] = changelogPath
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const { startService } = await import('./server.ts')
  const started = await startService(await freePort())
  close = started.close
  state = started.state
})

afterAll(async () => {
  await close?.()
  if (ORIGINAL_CHANGELOG_PATH === undefined) delete process.env[VISTA_CHANGELOG_PATH_ENV]
  else process.env[VISTA_CHANGELOG_PATH_ENV] = ORIGINAL_CHANGELOG_PATH
  if (dir) rmSync(dir, { recursive: true, force: true })
  const peakRssKiB = process.resourceUsage().maxRSS
  console.info(`Vista publication process peak RSS: ${peakRssKiB} KiB`)
  // The measured native RSS budget applies to the constrained task's worker
  // policy, not direct Vitest runs with an unconstrained host-sized pool.
  if (process.env.ROLLDOWN_WORKER_THREADS === '1') {
    // Allow about 20% headroom over the measured 5,190,616 KiB peak.
    expect(peakRssKiB).toBeLessThan(6 * 1024 * 1024)
  }
})

describe('Vista publication transaction', () => {
  it('refuses dotted owners before accessing or claiming publication state', async () => {
    // paths.ts captures environment roots at import; load publication after the fixture setup.
    const { publish } = await import('./publish.ts')
    const { scanApp } = await import('./registry.ts')
    const owner = 'dev3.direct.omp.pnfr87q8'
    await expect(
      publish({ owner, slug: 'refused', author: 'tester', changeSummary: 'v1' }, state.providers),
    ).rejects.toMatchObject({
      _tag: 'Vista.PublishFailed',
      owner,
      message: `Vista owner "${owner}" is a legacy dotted identity; publish from a managed seat (ST_AGENT=agent/...).`,
    })
    expect(scanApp(owner, 'refused')).toBeNull()
  })

  it('refuses dotted owners in preview before accessing publication state', async () => {
    // paths.ts captures environment roots at import; load after fixture setup.
    const { previewPublish } = await import('./publish.ts')
    const owner = 'dev3.direct.omp.pnfr87q8'
    await expect(previewPublish({ owner, slug: 'refused-preview' })).rejects.toMatchObject({
      _tag: 'Vista.PublishFailed',
      owner,
      message: `Vista owner "${owner}" is a legacy dotted identity; publish from a managed seat (ST_AGENT=agent/...).`,
    })
  })

  it('publishes app.tsx alone with Vista-owned bootstrap and derived metadata', async () => {
    const { publish, verifyStaticPublication, resolveStaticPublicationFile } =
      await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await writeApp('minimal')

    const result = await publish(
      { owner: OWNER, slug: 'minimal', author: 'tester', changeSummary: 'v1' },
      state.providers,
    )

    expect(result).toMatchObject({ owner: OWNER, slug: 'minimal', version: 1, bindings: [] })
    expect(scanApp(OWNER, 'minimal')!.latest).toBe(1)
    const version = versionDir(OWNER, 'minimal', 1)
    expect(existsSync(join(version, 'index.html'))).toBe(true)
    expect(existsSync(join(version, '.vista-main.tsx'))).toBe(true)
    const bootstrap = readFileSync(join(version, '.vista-main.tsx'), 'utf8')
    expect(bootstrap).toMatch(/^import '@vista\/ui\/document\.css'\n/)
    expect(bootstrap).toContain("import AuthoredApp from './app.tsx'")
    expect(bootstrap).toContain(`owner={${JSON.stringify(OWNER)}}`)
    expect(bootstrap).toContain(
      `"machineVersion":${JSON.stringify(resolveVistaBuildInfo().machineVersion)}`,
    )
    expect(bootstrap).toContain(`changelogHref="./${VISTA_CHANGELOG_FILE}"`)
    const staticIndex = resolveStaticPublicationFile(OWNER, 'minimal', 1, '/')
    const staticFavicon = resolveStaticPublicationFile(
      OWNER,
      'minimal',
      1,
      `/${VISTA_FAVICON_FILE}`,
    )
    const receipt = verifyStaticPublication(OWNER, 'minimal', 1)
    expect(receipt).not.toBeNull()
    expect(receipt!.basePath).toBe(`/r/${encodeRouteOwner(OWNER)}/minimal/v1/`)
    expect(bootstrap).toContain(`appVersionId="${encodeRouteOwner(OWNER)}/minimal/v1"`)
    expect(receipt!.inventory).toContainEqual(
      expect.objectContaining({ path: `site/${VISTA_CHANGELOG_FILE}` }),
    )
    expect(staticIndex).not.toBeNull()
    expect(readFileSync(staticIndex!, 'utf8')).toContain(`/${VISTA_FAVICON_FILE}`)
    const staticChangelog = resolveStaticPublicationFile(
      OWNER,
      'minimal',
      1,
      `/${VISTA_CHANGELOG_FILE}`,
    )
    expect(staticChangelog).not.toBeNull()
    expect(readFileSync(staticChangelog!)).toEqual(
      readFileSync(process.env[VISTA_CHANGELOG_PATH_ENV]!),
    )
    expect(staticFavicon).not.toBeNull()
    expect(readFileSync(staticFavicon!)).toEqual(readFileSync(vistaFaviconPath()))
  })

  it('refuses new quoted Unicode legacy owners before claiming state; retained projection covers lossless bylines', async () => {
    // Managed subjects allow only lowercase ASCII label segments. Historical
    // exact-owner rendering remains covered by the retained projection test.
    // Publication paths capture environment roots; import only after beforeAll.
    const { publish } = await import('./publish.ts')
    const { appDir, scanApp, versionDir } = await import('./registry.ts')
    const owner = 'dev3.é"session&copy;'
    const slug = 'legacy-owner-byline'
    await expect(
      publish(
        { owner, slug, author: 'tester', changeSummary: 'legacy owner byline' },
        state.providers,
      ),
    ).rejects.toMatchObject({
      _tag: 'Vista.PublishFailed',
      owner,
      message: `Vista owner "${owner}" is a legacy dotted identity; publish from a managed seat (ST_AGENT=agent/...).`,
    })
    expect(scanApp(owner, slug)).toBeNull()
    expect(existsSync(appDir(owner, slug))).toBe(false)
    expect(existsSync(versionDir(owner, slug, 1))).toBe(false)
  })

  it('projects a verified legacy v1 without changing its trust or inventory bytes', async () => {
    // These modules must load after beforeAll establishes the test-owned roots.
    const {
      inspectStaticPublication,
      invalidateVerifiedPublications,
      projectVerifiedPublicationFile,
      publicationTrustRoot,
      publish,
      resolveVerifiedStaticPublicationRequest,
      verifyStaticPublication,
    } = await import('./publish.ts')
    const { encodeOwner, versionDir } = await import('./registry.ts')
    const owner = 'agent/compoundingtech/st-ios'
    const slug = 'legacy-owner-route'
    await writeApp(slug, undefined, owner)
    await publish({ owner, slug, author: 'tester', changeSummary: 'v1' }, state.providers)
    const version = versionDir(owner, slug, 1)
    const canonicalBase = `/r/${encodeRouteOwner(owner)}/${slug}/v1/`
    const legacyBase = `/r/${encodeOwner(owner)}/${slug}/v1/`
    const canonicalReceipt = verifyStaticPublication(owner, slug, 1)!
    expect(canonicalReceipt.basePath).toBe(canonicalBase)
    expect(readFileSync(join(version, '.vista-main.tsx'), 'utf8')).toContain(
      `dataBaseUrl="${canonicalBase}_data/"`,
    )
    expect(readFileSync(join(version, '.vista-main.tsx'), 'utf8')).toContain(
      `owner={${JSON.stringify(owner)}}`,
    )
    expect(publicationTrustRoot(owner, slug, 1)).toContain(`/_owned/${encodeOwner(owner)}/`)

    // Construct a pre-cutover immutable fixture, then pin its original receipt.
    // Production projection must never perform any of these filesystem writes.
    for (const entry of canonicalReceipt.inventory) {
      if (!/\.(?:css|html|js|tsx)$/.test(entry.path)) continue
      const path = join(version, entry.path)
      const content = readFileSync(path, 'utf8')
      writeFileSync(
        path,
        content
          .replaceAll(canonicalBase, legacyBase)
          .replaceAll(canonicalBase.slice(3, -1), legacyBase.slice(3, -1)),
      )
    }
    const shellPath = 'site/assets/legacy-shell.js'
    const cssPath = 'site/assets/legacy-route.css'
    // The historical shell's minified parser and navigation template, plus
    // the bootstrap key that has no /r/ prefix and its provider base URL.
    const legacyShell =
      'const route=m=>({owner:decodeURIComponent(m[1]),slug:decodeURIComponent(m[2]),version:decodeURIComponent(m[3])});' +
      'const path=a=>`${encodeOwner(a.owner)}/${encodeURIComponent(a.slug)}`;' +
      `const appVersionId=${JSON.stringify(legacyBase.slice(3, -1))};` +
      `const dataBaseUrl=${JSON.stringify(`${legacyBase}_data/`)};` +
      `const evidence=${JSON.stringify(legacyBase.slice(3, -1))};` +
      `const authoredOwner=${JSON.stringify(owner)};`
    writeFileSync(join(version, shellPath), legacyShell)
    writeFileSync(
      join(version, cssPath),
      `body{background:url("${legacyBase}${VISTA_FAVICON_FILE}")}`,
    )
    const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')
    const receipt = {
      ...canonicalReceipt,
      basePath: legacyBase,
      inventory: [...canonicalReceipt.inventory, { path: shellPath }, { path: cssPath }]
        .map(({ path }) => {
          const bytes = readFileSync(join(version, path))
          return { path, sha256: digest(bytes), size: bytes.byteLength }
        })
        .toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    }
    const receiptPath = join(version, 'publication.json')
    const rootPath = publicationTrustRoot(owner, slug, 1)
    const encodedReceipt = JSON.stringify(receipt)
    const encodedRoot = JSON.stringify({ schemaVersion: 1, receiptSha256: digest(encodedReceipt) })
    writeFileSync(receiptPath, encodedReceipt)
    writeFileSync(rootPath, encodedRoot)
    invalidateVerifiedPublications(owner, slug)
    expect(verifyStaticPublication(owner, slug, 1)).toEqual(receipt)
    const verification = inspectStaticPublication(owner, slug, 1)
    expect(verification._tag).toBe('verified')
    if (verification._tag !== 'verified') throw new Error('legacy fixture did not verify')
    const { index } = verification
    const originals = new Map(
      receipt.inventory.map(({ path }) => [path, readFileSync(join(version, path))]),
    )
    for (const { path } of receipt.inventory) {
      if (!path.startsWith('site/')) continue
      const file = resolveVerifiedStaticPublicationRequest(index, `/${path.slice(5)}`)!
      expect(file).not.toBeNull()
      const projected = projectVerifiedPublicationFile(index, file)
      if (/\.(?:css|html|js)$/.test(path)) {
        expect(projected.toString('utf8')).not.toContain(legacyBase)
      } else {
        expect(projected).toBe(file.bytes)
      }
    }
    const shell = resolveVerifiedStaticPublicationRequest(index, '/assets/legacy-shell.js')!
    const projectedShell = projectVerifiedPublicationFile(index, shell).toString('utf8')
    expect(projectedShell).toContain(`owner:${JSON.stringify(owner)}`)
    expect(projectedShell).toContain(`appVersionId=${JSON.stringify(canonicalBase.slice(3, -1))}`)
    expect(projectedShell).toContain(`dataBaseUrl=${JSON.stringify(`${canonicalBase}_data/`)}`)
    expect(projectedShell).toContain(`evidence=${JSON.stringify(legacyBase.slice(3, -1))}`)
    expect(projectedShell).toContain(`authoredOwner=${JSON.stringify(owner)}`)
    const browserRoute = new Function('m', `${projectedShell};return route(m)`)
    expect(browserRoute(['', encodeRouteOwner(owner), slug, 'v1'])).toEqual({
      owner,
      slug,
      version: 'v1',
    })
    // Execute only the projected pure navigation fixture, not a browser bundle.
    const navigationPath = new Function(
      'a',
      'encodeURIComponent',
      `${projectedShell};return path(a)`,
    )
    expect(navigationPath({ owner, slug }, encodeURIComponent)).toBe(
      `${encodeRouteOwner(owner)}/${slug}`,
    )
    const otherOwner = 'dev3.agent%2Fvista%2Fauthor'
    expect(navigationPath({ owner: otherOwner, slug }, encodeURIComponent)).toBe(
      `${encodeRouteOwner(otherOwner)}/${slug}`,
    )
    expect(readFileSync(receiptPath, 'utf8')).toBe(encodedReceipt)
    expect(readFileSync(rootPath, 'utf8')).toBe(encodedRoot)
    for (const [path, bytes] of originals) expect(readFileSync(join(version, path))).toEqual(bytes)

    // An attacker cannot extend accepted base paths, even with a pinned receipt.
    const wrongReceipt = JSON.stringify({ ...receipt, basePath: `${legacyBase}../` })
    writeFileSync(receiptPath, wrongReceipt)
    writeFileSync(
      rootPath,
      JSON.stringify({ schemaVersion: 1, receiptSha256: digest(wrongReceipt) }),
    )
    expect(() => verifyStaticPublication(owner, slug, 1)).toThrow(
      'publication receipt identity is invalid',
    )
    writeFileSync(rootPath, encodedRoot)
    expect(inspectStaticPublication(owner, slug, 1)).toMatchObject({
      _tag: 'untrusted',
      reason: 'publication receipt is untrusted',
    })
    writeFileSync(receiptPath, encodedReceipt)
    writeFileSync(join(version, shellPath), `${legacyShell}\n// tampered`)
    expect(() => resolveVerifiedStaticPublicationRequest(index, '/assets/legacy-shell.js')).toThrow(
      'published file integrity mismatch',
    )
    expect(() => verifyStaticPublication(owner, slug, 1)).toThrow(
      'published directory integrity mismatch',
    )
  }, 240_000)

  it('admits one app-local Provider identically in check, preview, and publish', async () => {
    const { checkVistaApp } = await import('./preflight.ts')
    const { previewPublish, publish } = await import('./publish.ts')
    const appSource = await writeApp(
      'local-provider-parity',
      readFileSync(join(HERE, '..', 'samples', 'query-app', 'app.tsx'), 'utf8'),
    )
    cpSync(join(HERE, '..', 'samples', 'query-app', 'providers'), join(appSource, 'providers'), {
      recursive: true,
    })

    const checked = await checkVistaApp(appSource)
    const preview = await previewPublish({ owner: OWNER, slug: 'local-provider-parity' })
    const published = await publish(
      {
        owner: OWNER,
        slug: 'local-provider-parity',
        author: 'tester',
        changeSummary: 'provider admission parity',
      },
      state.providers,
    )

    expect(checked).toEqual(expect.objectContaining({ _tag: 'ready', dataRequests: 1 }))
    expect(preview.bindings).toEqual([
      expect.objectContaining({ provider: 'sample-note', operation: 'read' }),
    ])
    expect(published.bindings).toEqual([
      expect.objectContaining({
        provider: 'sample-note',
        operation: 'read',
        capture: expect.objectContaining({ _tag: 'captured' }),
      }),
    ])
  })

  it('carries flatMap selectors across the Vite realm without cross-app collisions', async () => {
    // These modules must load only after the test-owned Vista roots are set.
    const { preflightVistaApp } = await import('./preflight.ts')
    const { publish } = await import('./publish.ts')
    const firstSource = await writeFlatMapApp('flatmap-first', 1)
    const secondSource = await writeFlatMapApp('flatmap-second', 100)

    const firstPreflight = await preflightVistaApp(firstSource)
    const secondPreflight = await preflightVistaApp(secondSource)
    expect(firstPreflight._tag).toBe('ready')
    expect(secondPreflight._tag).toBe('ready')
    if (firstPreflight._tag !== 'ready' || secondPreflight._tag !== 'ready') return

    const firstEdge = firstPreflight.projection.semantics.nodes
      .flatMap(({ bindings }) => bindings)
      .find(({ dependency }) => dependency !== undefined)?.dependency?.edge
    const secondEdge = secondPreflight.projection.semantics.nodes
      .flatMap(({ bindings }) => bindings)
      .find(({ dependency }) => dependency !== undefined)?.dependency?.edge
    expect(firstEdge).toBe(secondEdge)
    const firstSelector = firstPreflight.projection.capturePlan.flatMapSelectors.get(firstEdge!)
    const secondSelector = secondPreflight.projection.capturePlan.flatMapSelectors.get(secondEdge!)
    expect(firstSelector?.({ _tag: 'Value', value: 1 }).args).toEqual({ value: 2 })
    expect(secondSelector?.({ _tag: 'Value', value: 1 }).args).toEqual({ value: 101 })

    const first = await publish(
      { owner: OWNER, slug: 'flatmap-first', author: 'tester', changeSummary: 'first selector' },
      state.providers,
    )
    const second = await publish(
      { owner: OWNER, slug: 'flatmap-second', author: 'tester', changeSummary: 'second selector' },
      state.providers,
    )
    expect(first.bindings[0]?.capture).toEqual(
      expect.objectContaining({
        _tag: 'captured',
        call: expect.objectContaining({ args: { value: 2 } }),
      }),
    )
    expect(second.bindings[0]?.capture).toEqual(
      expect.objectContaining({
        _tag: 'captured',
        call: expect.objectContaining({ args: { value: 101 } }),
      }),
    )
  })

  it('derives frozen provider capture from semantic JSX', async () => {
    const { publish, resolveStaticPublicationFile } = await import('./publish.ts')
    const { versionDir } = await import('./registry.ts')
    const { snapshotKey } = await import('./data/snapshot.ts')
    const args = { repo: 'schickling/dotfiles', pr: 1506 }
    await writeApp(
      'frozen',
      `import { AppRoot, Evidence, PullRequestOverview, Section } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title="Frozen" template="architecture-review" scope="test"><Section><Evidence id="e"><PullRequestOverview repo="schickling/dotfiles" pr={1506} /></Evidence></Section></AppRoot>
}
`,
    )

    const result = await publish(
      { owner: OWNER, slug: 'frozen', author: 'tester', changeSummary: 'v1' },
      state.providers,
    )
    expect(result.bindings).toEqual([
      expect.objectContaining({
        semanticId: 'e',
        provider: 'overview',
        operation: 'get',
        policy: { mode: 'frozen' },
        capture: expect.objectContaining({ _tag: 'captured', blockId: 'e' }),
      }),
    ])
    const snapshotPath = join(versionDir(OWNER, 'frozen', 1), 'snapshot.json')
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
    const key = await Effect.runPromise(snapshotKey(overview.ops.get, args))
    expect(snapshot.entries[key]).toBeDefined()
    expect(resolveStaticPublicationFile(OWNER, 'frozen', 1, '/snapshot.json')).not.toBeNull()
  })

  it('preserves provider failure diagnostics and publishes nothing', async () => {
    // Load after beforeAll configures the process-global Vista paths.
    const { publish, resolveStaticPublicationFile } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    const appSource = await writeFlatMapApp('failed-provider', 0)
    writeFileSync(
      join(appSource, 'providers', 'collision.provider.ts'),
      `import { Effect, Layer } from 'effect'
import { implement, mountProvider } from '@vista/data/provider'
import { collision } from './collision.query.ts'

const implementation = implement(collision, {
  purity: 'pure',
  handlers: {
    parent: () => Effect.die('original provider capture cause'),
    child: ({ value }) => Effect.succeed({ _tag: 'Value', value }),
  },
})
export default mountProvider(implementation, Layer.empty)
`,
    )

    const failure = await publish(
      { owner: OWNER, slug: 'failed-provider', author: 'tester', changeSummary: 'v1' },
      state.providers,
    ).then(
      () => undefined,
      (cause: unknown) => cause,
    )
    expect(failure).toBeInstanceOf(Error)
    const message = failure instanceof Error ? failure.message : String(failure)
    expect(message).toContain('dependent')
    expect(message).toContain('collision-provider')
    expect(message).toContain('parent')
    expect(message).toContain('original provider capture cause')
    expect(existsSync(versionDir(OWNER, 'failed-provider', 1))).toBe(false)
    expect(scanApp(OWNER, 'failed-provider')?.versions ?? []).toEqual([])
    expect(scanApp(OWNER, 'failed-provider')?.latest ?? null).toBeNull()
    expect(resolveStaticPublicationFile(OWNER, 'failed-provider', 1, '/')).toBeNull()
  })

  it('rejects an invalid provider payload before claiming a version', async () => {
    const { publish } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await writeApp(
      'invalid-payload',
      `import { AppRoot, Evidence, MetricQuery, Section } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title="Invalid" template="telemetry-exploration" scope="test"><Section><Evidence id="e"><MetricQuery id="metric" query={42} stepSeconds={60} points={30} /></Evidence></Section></AppRoot>
}
`,
    )

    const rejected = await publish(
      { owner: OWNER, slug: 'invalid-payload', author: 'tester', changeSummary: 'v1' },
      state.providers,
    ).then(
      () => false,
      () => true,
    )
    expect(rejected).toBe(true)
    expect(existsSync(versionDir(OWNER, 'invalid-payload', 1))).toBe(false)
    expect(scanApp(OWNER, 'invalid-payload')?.versions ?? []).toEqual([])
  })

  it('fails nondeterministic semantic evaluation before latest can move', async () => {
    const { publish } = await import('./publish.ts')
    const { versionDir } = await import('./registry.ts')
    await writeApp(
      'nondeterministic',
      `import { AppRoot, Evidence } from '@vista/blocks'
let run = 0
export default function VistaApp() { return <AppRoot title="Changing" template="architecture-review" scope="test"><Evidence id={\`n-\${++run}\`} /></AppRoot> }
`,
    )
    await expect(
      publish(
        { owner: OWNER, slug: 'nondeterministic', author: 'tester', changeSummary: 'v1' },
        state.providers,
      ),
    ).rejects.toThrow('semantic evaluation is nondeterministic')
    expect(existsSync(versionDir(OWNER, 'nondeterministic', 1))).toBe(false)
  })

  it('preview reports canonical AppSource paths and one duplicate-id root', async () => {
    const { previewPublish } = await import('./publish.ts')
    const appSource = await writeApp(
      'duplicate-preview',
      `import { AppRoot, Evidence } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title="Duplicate" template="architecture-review" scope="test"><Evidence id="same" /><Evidence id="same" /></AppRoot>
}
`,
    )

    const failure = await previewPublish({
      owner: OWNER,
      slug: 'duplicate-preview',
    }).then(
      () => undefined,
      (cause: unknown) => cause,
    )
    expect(failure).toBeInstanceOf(Error)
    const message = failure instanceof Error ? failure.message : String(failure)
    expect(message).toContain(join(appSource, 'app.tsx'))
    expect(message).not.toContain('.papp-')
    expect(message.match(/duplicate semantic id "same"/g)).toHaveLength(1)
  })
  it('rejects authored bootstrap and app.json files', async () => {
    const { publish } = await import('./publish.ts')
    const appSource = await writeApp('legacy-bootstrap')
    writeFileSync(join(appSource, 'index.html'), '<!doctype html>')
    await expect(
      publish(
        { owner: OWNER, slug: 'legacy-bootstrap', author: 'tester', changeSummary: 'v1' },
        state.providers,
      ),
    ).rejects.toThrow('remove legacy index.html')
    rmSync(join(appSource, 'index.html'))
    writeFileSync(join(appSource, 'app.json'), '{}')
    await expect(
      publish(
        { owner: OWNER, slug: 'legacy-bootstrap', author: 'tester', changeSummary: 'v1' },
        state.providers,
      ),
    ).rejects.toThrow('remove legacy app.json')
  })

  it('fails publication visibly when the advertised companion is missing', async () => {
    const { publish } = await import('./publish.ts')
    const { versionDir } = await import('./registry.ts')
    await writeApp('missing-companion')
    const configured = process.env[VISTA_CHANGELOG_PATH_ENV]!
    process.env[VISTA_CHANGELOG_PATH_ENV] = join(dir, 'missing-changelog.v1.json')
    try {
      await expect(
        publish(
          {
            owner: OWNER,
            slug: 'missing-companion',
            author: 'tester',
            changeSummary: 'must fail',
          },
          state.providers,
        ),
      ).rejects.toThrow('Vista changelog companion is unavailable')
      expect(existsSync(versionDir(OWNER, 'missing-companion', 1))).toBe(false)
    } finally {
      process.env[VISTA_CHANGELOG_PATH_ENV] = configured
    }
  })

  it('holds latest until the render proof succeeds', async () => {
    const { publish } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await writeApp('render-gate')
    await expect(
      publish(
        { owner: OWNER, slug: 'render-gate', author: 'tester', changeSummary: 'v1' },
        state.providers,
        async () => ({ _tag: 'failed', reason: 'did not mount' }),
      ),
    ).rejects.toThrow('did not mount')
    expect(existsSync(versionDir(OWNER, 'render-gate', 1))).toBe(false)
    expect(scanApp(OWNER, 'render-gate')?.latest ?? null).toBeNull()
  })

  it('rehydrates only authored source', async () => {
    const { publish, rehydrateSource } = await import('./publish.ts')
    await writeApp('rehydrate')
    await publish(
      { owner: OWNER, slug: 'rehydrate', author: 'tester', changeSummary: 'v1' },
      state.providers,
    )
    const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'rehydrate')
    rmSync(appSource, { recursive: true, force: true })
    const result = rehydrateSource({ owner: OWNER, slug: 'rehydrate' })
    expect(result.appSource).toBe(appSource)
    expect(result.files).toEqual(['app.tsx'])
    expect(readdirSync(appSource)).toEqual(['app.tsx'])
  })

  it('embeds shipped journal entries and serves the capture statically', async () => {
    const { publish, rehydrateSource, resolveStaticPublicationFile } = await import('./publish.ts')
    const { versionDir } = await import('./registry.ts')
    const appSource = await writeApp('selfcap')
    writeFileSync(join(appSource, 'helper.tsx'), 'export const helper = 1\n')
    // Legacy file, if present, is ignored: the journal is the single source.
    writeFileSync(join(appSource, 'trail.json'), JSON.stringify([{ command: 'stale' }]))

    await publish(
      {
        owner: OWNER,
        slug: 'selfcap',
        author: 'tester',
        changeSummary: 'v1',
        trail: [
          {
            command: 'check',
            slug: 'selfcap',
            timestamp: '2026-09-11T10:00:00.000Z',
            exit: 0,
            durationMs: 12,
          },
          {
            command: 'publish',
            slug: 'selfcap',
            version: 1,
            timestamp: '2026-09-11T10:01:00.000Z',
            exit: 0,
            durationMs: 900,
            message: 'v1',
          },
        ],
      },
      state.providers,
    )

    const version = versionDir(OWNER, 'selfcap', 1)
    const capture = JSON.parse(readFileSync(join(version, 'vista-self.json'), 'utf8'))
    expect(capture).toMatchObject({
      owner: OWNER,
      slug: 'selfcap',
      version: 1,
      receipt: { version: 1, fileCount: 3 },
      trail: [
        { command: 'check', detail: 'check — exit 0, 12ms, 2026-09-11T10:00:00.000Z' },
        { command: 'publish', detail: 'v1' },
      ],
    })
    expect(capture.files.map((file: { path: string }) => file.path)).toEqual([
      'app.tsx',
      'helper.tsx',
      'trail.json',
    ])
    expect(capture.files[1]?.contents).toContain('export const helper = 1')
    expect(capture.receipt.basePath).toContain('selfcap/v1/')
    expect(capture.receipt.semanticsSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(capture.semantics.app.title).toBe('selfcap')
    expect(capture.sourceDir).toBe(appSource)
    expect(existsSync(join(version, 'site', 'vista-self.json'))).toBe(true)
    expect(resolveStaticPublicationFile(OWNER, 'selfcap', 1, '/vista-self.json')).not.toBeNull()

    rmSync(appSource, { recursive: true, force: true })
    const rehydrated = rehydrateSource({ owner: OWNER, slug: 'selfcap' })
    expect(rehydrated.files).toEqual(['app.tsx', 'helper.tsx', 'trail.json'])
    expect(existsSync(join(appSource, 'vista-self.json'))).toBe(false)
  })

  it('excludes dependency trees and dotfiles from the capture', async () => {
    const { publish } = await import('./publish.ts')
    const { versionDir } = await import('./registry.ts')
    const appSource = await writeApp('exclusions')
    mkdirSync(join(appSource, 'node_modules', 'dep'), { recursive: true })
    writeFileSync(join(appSource, 'node_modules', 'dep', 'index.js'), 'module.exports = 1\n')
    // Passes the secret value scan: only the capture exclusion keeps it out.
    writeFileSync(join(appSource, '.env'), 'DATABASE_PASSWORD=hunter2\n')
    await publish(
      { owner: OWNER, slug: 'exclusions', author: 'tester', changeSummary: 'v1' },
      state.providers,
    )
    const capture = JSON.parse(
      readFileSync(join(versionDir(OWNER, 'exclusions', 1), 'vista-self.json'), 'utf8'),
    )
    expect(capture.files.map((file: { path: string }) => file.path)).toEqual(['app.tsx'])
    expect(capture.receipt.fileCount).toBe(1)
  })

  it('captures no trail when nothing is shipped', async () => {
    const { publish } = await import('./publish.ts')
    const { versionDir } = await import('./registry.ts')
    await writeApp('no-trail')
    await publish(
      { owner: OWNER, slug: 'no-trail', author: 'tester', changeSummary: 'v1' },
      state.providers,
    )
    const capture = JSON.parse(
      readFileSync(join(versionDir(OWNER, 'no-trail', 1), 'vista-self.json'), 'utf8'),
    )
    expect(capture.trail).toBeUndefined()
  })

  it('rejects malformed shipped entries before latest can move', async () => {
    const { publish } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await writeApp('bad-trail')
    await expect(
      publish(
        {
          owner: OWNER,
          slug: 'bad-trail',
          author: 'tester',
          changeSummary: 'v1',
          trail: [{ command: '  ', slug: 'bad-trail', timestamp: 't', exit: 0, durationMs: 1 }],
        },
        state.providers,
      ),
    ).rejects.toThrow('trail[0].command')
    expect(existsSync(versionDir(OWNER, 'bad-trail', 1))).toBe(false)
    expect(scanApp(OWNER, 'bad-trail')?.versions ?? []).toEqual([])
  })

  it('secret scan blocks captures containing credentials', async () => {
    const { publish } = await import('./publish.ts')
    const { scanApp, versionDir } = await import('./registry.ts')
    await writeApp('secret-trail')
    await expect(
      publish(
        {
          owner: OWNER,
          slug: 'secret-trail',
          author: 'tester',
          changeSummary: 'v1',
          trail: [
            {
              command: 'publish',
              slug: 'secret-trail',
              timestamp: '2026-09-11T10:00:00.000Z',
              exit: 0,
              durationMs: 1,
              message: `token ${'ghp_' + 'a'.repeat(20)}`,
            },
          ],
        },
        state.providers,
      ),
    ).rejects.toThrow('secret scan blocked the trail')
    expect(existsSync(versionDir(OWNER, 'secret-trail', 1))).toBe(false)
    expect(scanApp(OWNER, 'secret-trail')?.versions ?? []).toEqual([])
  })
})
