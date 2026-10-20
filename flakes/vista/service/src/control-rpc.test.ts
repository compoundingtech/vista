import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Effect, Layer, Metric, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as RpcClient from 'effect/rpc/RpcClient'
import type { RpcClientError } from 'effect/rpc/RpcClientError'
import { layerJson } from 'effect/rpc/RpcSerialization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  VersionSummary,
  AppVersionIdentity,
  AppRow,
  AskInput,
  AskResult,
  AwaitInterviewInput,
  AwaitResult,
  ImportDiagnosticInfo,
  ImportDiagnosticInput,
  NewAppInput,
  NewAppOk,
  PublishInput,
  PublishOk,
  PublishPreviewInput,
  PublishPreviewOk,
  PublishPlan,
  PublishPlanInput,
  RehydrateInput,
  RehydrateOk,
  RetireOk,
  SlugInput,
  VistaControlApi,
} from './control.ts'
import { publishOperations } from './metrics.ts'
import { appSourcePath } from './paths.ts'
import { VistaReadApi } from './read.ts'
import { encodeRouteOwner } from './read.ts'
import { encodeOwner, versionDir } from './registry.ts'
import { freePort, installTestChangelog } from './test-support.ts'
import { NoPayload, wireCall } from './wire.ts'

// `wireCall` erases the RPC error channel to `unknown` (its `E` is not inferrable
// from the outer call); the flipped failure is a tagged error at runtime, so the
// tag/message assertions read through this structural view.
type FlipError = { readonly _tag: string; readonly message: string }

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'agent/vista/control-rpc'
const appSource = (owner: string, slug: string): string =>
  appSourcePath(join(dir, 'sources'), owner, slug)

let dir: string
let port: number
let close: (() => Promise<void>) | undefined
let restoreChangelog: (() => void) | undefined

const withControl = <A, E>(
  f: (client: RpcClient.FromGroup<typeof VistaControlApi, RpcClientError>) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    const client = yield* RpcClient.make(VistaControlApi)
    return yield* f(client)
  }).pipe(
    Effect.scoped,
    Effect.provide(
      RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}/_rpc/control` }).pipe(
        Layer.provide(layerJson),
        Layer.provide(FetchHttpClient.layer),
      ),
    ),
  )

const withRead = <A, E>(
  f: (client: RpcClient.FromGroup<typeof VistaReadApi, RpcClientError>) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    const client = yield* RpcClient.make(VistaReadApi)
    return yield* f(client)
  }).pipe(
    Effect.scoped,
    Effect.provide(
      RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}/_rpc/read` }).pipe(
        Layer.provide(layerJson),
        Layer.provide(FetchHttpClient.layer),
      ),
    ),
  )

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-control-rpc-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  process.env.VISTA_PUBLIC_URL = 'https://vista-test.tailnet.example'
  restoreChangelog = await installTestChangelog(dir)

  // Seed a real owner-canonical source so its derived title reaches `vista list`.
  const source = appSource(OWNER, 'rpc-probe')
  mkdirSync(source, { recursive: true })
  writeFileSync(
    join(source, 'app.tsx'),
    `import { AppRoot, Section } from '@vista/blocks'
export default function RpcProbe() {
  return (
    <AppRoot title="RPC Probe" template="architecture-review" scope="control-rpc probe">
      <Section id="rpc-probe" provenance="app.tsx">
        <main>RPC Probe</main>
      </Section>
    </AppRoot>
  )
}
`,
  )

  const { startService } = await import('./server.ts')
  port = await freePort()
  const started = await startService(port)
  close = started.close
}, 60_000)

afterAll(async () => {
  await close?.()
  restoreChangelog?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('Vista control RPC', () => {
  it('scaffolds new apps through the typed control plane with dry-run preview', async () => {
    const preview = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.app.new',
          NewAppInput,
          NewAppOk,
        )((env) => client['vista.app.new'](env), { owner: OWNER, slug: 'rpc-new', dryRun: true }),
      ),
    )

    expect(preview).toEqual(
      expect.objectContaining({
        owner: OWNER,
        slug: 'rpc-new',
        dryRun: true,
        files: ['app.tsx'],
      }),
    )
    expect(preview.appSource).toBe(appSource(OWNER, 'rpc-new'))
    expect(preview.writes).toContain(join(preview.appSource, 'app.tsx'))
    expect(existsSync(preview.appSource)).toBe(false)

    const created = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.app.new',
          NewAppInput,
          NewAppOk,
        )((env) => client['vista.app.new'](env), { owner: OWNER, slug: 'rpc-new' }),
      ),
    )
    expect(created.dryRun).toBe(false)
    expect(existsSync(join(created.appSource, 'app.tsx'))).toBe(true)
    const authored = readFileSync(join(created.appSource, 'app.tsx'), 'utf8')
    expect(authored).not.toContain('TODO')
    expect(authored).toContain('/* vista-scaffold:context ')
    expect(authored).toContain('<Ask id="reader-ask" refs={[\'primary-focus\']}>')
    expect(authored).toContain('<Evidence id="primary-focus">')
    expect(authored).toContain('/* vista-scaffold:reader-ask ')
    expect(authored).toContain('/* vista-scaffold:primary-focus ')
    expect(authored).toContain('MermaidDiagram, ChartBlock, a comparison, or a sequence')
    expect(authored).not.toContain('<MermaidDiagram')
    expect(authored).not.toContain('flowchart LR')

    const draftResponse = await fetch(
      `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/rpc-new/draft/`,
    )
    expect(draftResponse.status).toBe(200)
    const draftHtml = await draftResponse.text()
    expect(draftHtml).toContain('virtual:vista-draft-entry.tsx')
    expect(draftHtml).not.toContain('main.tsx')
    const entryPath = /<script type="module" src="([^"]*virtual:vista-draft-entry\.tsx[^"]*)"/.exec(
      draftHtml,
    )?.[1]
    expect(entryPath).toBeDefined()
    const entryResponse = await fetch(new URL(entryPath!, draftResponse.url))
    expect(entryResponse.status).toBe(200)
    expect(await entryResponse.text()).toContain('AppShell')

    const error = await Effect.runPromise(
      Effect.flip(
        withControl((client) =>
          wireCall(
            'vista.app.new',
            NewAppInput,
            NewAppOk,
          )((env) => client['vista.app.new'](env), { owner: OWNER, slug: 'rpc-new' }),
        ),
      ),
    )
    expect((error as FlipError)._tag).toBe('Vista.ScaffoldExists')
  })

  it('a version-skewed RPC payload fails closed as VersionSkew, NOT a payload ParseError (Track C wire)', async () => {
    // Forge a skew on the REAL RPC path: bypass `wireCall` and hand the raw client
    // an envelope stamped at a non-current apiVersion (999). The server's two-phase
    // `decodeEnveloped` must surface the version boundary FIRST — a typed
    // `VersionSkew`, never a payload `ParseError` and never a silent mis-decode.
    const error = await Effect.runPromise(
      Effect.flip(
        withControl((client) => client['vista.apps.list']({ apiVersion: 999, payload: null })),
      ),
    )
    expect((error as FlipError)._tag).toBe('Vista.VersionSkew')
    expect((error as unknown as { found: number }).found).toBe(999)
  })

  it('rejects every app identity whose owner is absent', () => {
    for (const schema of [SlugInput, AppVersionIdentity, PublishInput, PublishPlanInput]) {
      expect(() =>
        Schema.decodeUnknownSync(schema)({
          slug: 'owner-required',
          version: 1,
          author: 'tester',
          changeSummary: 'owner required',
        }),
      ).toThrow()
    }
  })

  it('publishes and lists apps through the typed control plane (+ G4 publish counter)', async () => {
    // Track G4 / OBS-R72: a publish increments `vista_publish_operations` tagged
    // outcome=published. The server increment and this read share the default
    // global Metric registry (tests boot with an empty telemetry layer).
    const publishedBefore = await Effect.runPromise(
      Metric.value(Metric.withAttributes(publishOperations, { outcome: 'published' })),
    )
    const published = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.publish',
          PublishInput,
          PublishOk,
        )((env) => client['vista.publish'](env), {
          owner: OWNER,
          slug: 'rpc-probe',
          author: 'tester',
          changeSummary: 'rpc publish',
        }),
      ),
    )

    expect(published).toEqual(
      expect.objectContaining({ owner: OWNER, slug: 'rpc-probe', version: 1, frozen: 0, live: 0 }),
    )

    const publishedAfter = await Effect.runPromise(
      Metric.value(Metric.withAttributes(publishOperations, { outcome: 'published' })),
    )
    expect(publishedAfter.count).toBe(publishedBefore.count + 1)

    const rows = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.apps.list',
          NoPayload,
          Schema.Array(AppRow),
        )((env) => client['vista.apps.list'](env), null),
      ),
    )
    expect(rows).toContainEqual(
      expect.objectContaining({
        owner: OWNER,
        slug: 'rpc-probe',
        resource: {
          _tag: 'vista-app',
          uri: `dev.schickling.vista-app://primary/${encodeOwner(OWNER)}/rpc-probe`,
        },
        latest: 1,
        title: 'RPC Probe',
      }),
    )

    const versionSummary = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.version.get',
          AppVersionIdentity,
          VersionSummary,
        )((env) => client['vista.version.get'](env), {
          owner: OWNER,
          slug: 'rpc-probe',
          version: 1,
        }),
      ),
    )
    const encodedOwner = encodeRouteOwner(OWNER)
    expect(versionSummary).toEqual({
      owner: OWNER,
      schemaVersion: 1,
      uri: `vista://${encodeOwner(OWNER)}/rpc-probe/v1`,
      slug: 'rpc-probe',
      version: 1,
      author: 'tester',
      timestamp: expect.any(String),
      changeSummary: 'rpc publish',
      parent: null,
      retired: false,
      state: 'ready',
      canonicalUrl: `https://vista-test.tailnet.example/r/${encodedOwner}/rpc-probe/v1/`,
      title: 'RPC Probe',
      template: 'architecture-review',
      status: { locked: 0, open: 0, awaiting: 0 },
    })
    expect(JSON.stringify(versionSummary)).not.toMatch(/content|source|path|html/i)
  })

  it('serves current app rows and version summaries on the separate read-only route', async () => {
    const owner = 'dev3.read-route'
    const slug = 'read-probe'
    const version = versionDir(owner, slug, 1)
    mkdirSync(version, { recursive: true })
    writeFileSync(join(version, 'index.html'), '<div>published</div>')
    writeFileSync(
      join(version, 'meta.json'),
      JSON.stringify({
        owner,
        slug,
        version: 1,
        author: 'tester',
        timestamp: '2026-09-28T00:00:00.000Z',
        changeSummary: 'read route fixture',
        parent: null,
        title: 'Read Probe',
      }),
    )
    symlinkSync('v1', join(version, '..', 'latest'))
    // This existing discovery route refreshes the AppIndex without a publish.
    expect((await fetch(`http://127.0.0.1:${port}/_vista/apps`)).status).toBe(200)

    const readRows = () =>
      Effect.runPromise(
        withRead((client) =>
          wireCall(
            'vista.read.apps.list',
            NoPayload,
            Schema.Array(AppRow),
          )((env) => client['vista.read.apps.list'](env), null),
        ),
      )
    expect(await readRows()).toContainEqual(
      expect.objectContaining({ owner, slug, latest: 1, retired: false, title: 'Read Probe' }),
    )
    const summary = await Effect.runPromise(
      withRead((client) =>
        wireCall(
          'vista.read.version.get',
          AppVersionIdentity,
          VersionSummary,
        )((env) => client['vista.read.version.get'](env), { owner, slug, version: 1 }),
      ),
    )
    expect(summary).toEqual(
      expect.objectContaining({
        owner,
        slug,
        state: 'failed',
        canonicalUrl: `https://vista-test.tailnet.example/r/${encodeRouteOwner(owner)}/${slug}/v1/`,
      }),
    )

    rmSync(join(version, '..', 'latest'))
    expect(await readRows()).toContainEqual(expect.objectContaining({ owner, slug, latest: 1 }))
    expect((await fetch(`http://127.0.0.1:${port}/_vista/apps`)).status).toBe(200)
    expect(await readRows()).toContainEqual(expect.objectContaining({ owner, slug, latest: null }))

    await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.app.retire',
          SlugInput,
          RetireOk,
        )((env) => client['vista.app.retire'](env), { owner, slug }),
      ),
    )
    expect(await readRows()).toContainEqual(expect.objectContaining({ owner, slug, retired: true }))
  })

  it('keeps every app-scoped RPC on one owner-local identity', async () => {
    const owner = 'dev3.rpc-owner.worker'
    const slug = 'shared-slug'
    const source = appSource(owner, slug)
    const version = versionDir(owner, slug, 1)
    mkdirSync(source, { recursive: true })
    mkdirSync(version, { recursive: true })
    writeFileSync(
      join(source, 'app.tsx'),
      `import { AppRoot } from '@vista/blocks'
export default function OwnedApp() { return <AppRoot title="Owned" template="architecture-review" scope="test" /> }
`,
    )
    writeFileSync(join(version, 'index.html'), '<div>published</div>')
    writeFileSync(join(version, 'app.tsx'), 'export default null\n')
    writeFileSync(
      join(version, 'meta.json'),
      JSON.stringify({
        owner,
        slug,
        version: 1,
        author: 'tester',
        timestamp: '2026-09-07T00:00:00.000Z',
        changeSummary: 'owner RPC proof',
        parent: null,
      }),
    )
    symlinkSync('v1', join(version, '..', 'latest'))

    const row = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.app.get',
          SlugInput,
          AppRow,
        )((env) => client['vista.app.get'](env), { owner, slug }),
      ),
    )
    expect(row).toEqual(expect.objectContaining({ owner, slug, latest: 1 }))

    const planError = await Effect.runPromise(
      Effect.flip(
        withControl((client) =>
          wireCall(
            'vista.publish.plan',
            PublishPlanInput,
            PublishPlan,
          )((env) => client['vista.publish.plan'](env), { owner, slug }),
        ),
      ),
    )
    expect(planError).toMatchObject({
      _tag: 'Vista.PublishFailed',
      owner,
      message: `Vista owner "${owner}" is a legacy dotted identity; publish from a managed seat (ST_AGENT=agent/...).`,
    })

    const previewError = await Effect.runPromise(
      Effect.flip(
        withControl((client) =>
          wireCall(
            'vista.publish.preview',
            PublishPreviewInput,
            PublishPreviewOk,
          )((env) => client['vista.publish.preview'](env), { owner, slug }),
        ),
      ),
    )
    expect(previewError).toMatchObject({
      _tag: 'Vista.PublishFailed',
      owner,
      message: `Vista owner "${owner}" is a legacy dotted identity; publish from a managed seat (ST_AGENT=agent/...).`,
    })

    const versionSummary = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.version.get',
          AppVersionIdentity,
          VersionSummary,
        )((env) => client['vista.version.get'](env), { owner, slug, version: 1 }),
      ),
    )
    expect(versionSummary).toEqual(
      expect.objectContaining({ owner, slug, version: 1, state: 'failed' }),
    )

    rmSync(source, { recursive: true, force: true })
    const rehydrated = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.rehydrate',
          RehydrateInput,
          RehydrateOk,
        )((env) => client['vista.rehydrate'](env), { owner, slug, version: 1 }),
      ),
    )
    expect(rehydrated).toEqual(
      expect.objectContaining({ owner, slug, version: 1, appSource: source }),
    )
    expect(existsSync(join(source, 'app.tsx'))).toBe(true)

    const asked = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.interview.ask',
          AskInput,
          AskResult,
        )((env) => client['vista.interview.ask'](env), {
          owner,
          appId: slug,
          question: {
            question: 'Keep this owner boundary?',
            options: [
              { id: 'yes', label: 'Yes', tradeoff: 'preserves local identity' },
              { id: 'no', label: 'No', tradeoff: 'shares global identity' },
            ],
            multiSelect: false,
            recommendedDefault: 'yes',
          },
        }),
      ),
    )
    expect(asked).toEqual(expect.objectContaining({ owner, appId: slug }))

    const awaited = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.interview.await',
          AwaitInterviewInput,
          AwaitResult,
        )((env) => client['vista.interview.await'](env), {
          owner,
          appId: slug,
          questionId: asked.questionId,
        }),
      ),
    )
    expect(awaited).toEqual(expect.objectContaining({ _tag: 'pending', owner, appId: slug }))

    const retired = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.app.retire',
          SlugInput,
          RetireOk,
        )((env) => client['vista.app.retire'](env), { owner, slug }),
      ),
    )
    expect(retired).toEqual({ owner, slug })
  })

  it('returns tagged publish errors over RPC', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        withControl((client) =>
          wireCall(
            'vista.publish',
            PublishInput,
            PublishOk,
          )((env) => client['vista.publish'](env), {
            owner: OWNER,
            slug: 'missing-draft',
            author: 'tester',
            changeSummary: 'probe',
          }),
        ),
      ),
    )

    expect((error as FlipError)._tag).toBe('Vista.PublishFailed')
    expect((error as FlipError).message).toContain('AppSource directory does not exist')
  })

  it('returns runtime-policy publish errors over RPC', async () => {
    const source = appSource(OWNER, 'blocked-publish')
    mkdirSync(source, { recursive: true })
    writeFileSync(
      join(source, 'app.tsx'),
      "import 'lodash'\nexport default function BlockedPublish() { return null }\n",
    )

    const error = await Effect.runPromise(
      Effect.flip(
        withControl((client) =>
          wireCall(
            'vista.publish',
            PublishInput,
            PublishOk,
          )((env) => client['vista.publish'](env), {
            owner: OWNER,
            slug: 'blocked-publish',
            author: 'tester',
            changeSummary: 'blocked',
          }),
        ),
      ),
    )

    expect((error as FlipError)._tag).toBe('Vista.PublishFailed')
    expect((error as FlipError).message).toContain(
      'Vista app imports are outside the runtime policy',
    )
    expect((error as FlipError).message).toContain('app.tsx imports lodash')
  })

  it('classifies imports over the debug control plane', async () => {
    const diagnostic = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.import.diagnose',
          ImportDiagnosticInput,
          ImportDiagnosticInfo,
        )((env) => client['vista.import.diagnose'](env), { specifier: 'lodash' }),
      ),
    )

    expect(diagnostic).toEqual(
      expect.objectContaining({
        specifier: 'lodash',
        allowed: false,
        message: expect.stringContaining('blocked'),
      }),
    )
    expect(diagnostic.classification._tag).toBe('reject')
    expect(diagnostic.guidance).toContain('pinned esm.sh URL')
  })

  it('classifies unpinned esm.sh imports with pinning guidance', async () => {
    const diagnostic = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.import.diagnose',
          ImportDiagnosticInput,
          ImportDiagnosticInfo,
        )((env) => client['vista.import.diagnose'](env), { specifier: 'https://esm.sh/zod' }),
      ),
    )

    expect(diagnostic.allowed).toBe(false)
    expect(diagnostic.classification._tag).toBe('remote-unpinned')
    expect(diagnostic.guidance).toContain('Pin the esm.sh package URL')
  })

  it('registers and awaits interview questions through the typed control plane', async () => {
    const asked = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.interview.ask',
          AskInput,
          AskResult,
        )((env) => client['vista.interview.ask'](env), {
          owner: OWNER,
          appId: 'rpc-probe',
          question: {
            question: 'Which boundary should own agent commands?',
            options: [
              { id: 'rpc', label: 'RPC', tradeoff: 'typed operations' },
              { id: 'http', label: 'HTTP', tradeoff: 'curlable commands' },
            ],
            multiSelect: false,
            recommendedDefault: 'rpc',
          },
        }),
      ),
    )

    expect(asked.appId).toBe('rpc-probe')
    expect(asked.questionId).toEqual(expect.any(String))

    const awaited = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.interview.await',
          AwaitInterviewInput,
          AwaitResult,
        )((env) => client['vista.interview.await'](env), {
          owner: OWNER,
          appId: asked.appId,
          questionId: asked.questionId,
        }),
      ),
    )
    expect(awaited).toEqual({
      _tag: 'pending',
      owner: OWNER,
      appId: asked.appId,
      questionId: asked.questionId,
    })
  })

  it('keeps browser answer routes but removes legacy agent interview HTTP commands', async () => {
    const asked = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.interview.ask',
          AskInput,
          AskResult,
        )((env) => client['vista.interview.ask'](env), {
          owner: OWNER,
          appId: 'rpc-probe',
          question: {
            question: 'Should legacy agent HTTP commands stay exposed?',
            options: [
              { id: 'no', label: 'No', tradeoff: 'one typed command boundary' },
              { id: 'yes', label: 'Yes', tradeoff: 'extra backwards-compat surface' },
            ],
            multiSelect: false,
            recommendedDefault: 'no',
          },
        }),
      ),
    )
    const scopedAppId = `${encodeOwner(OWNER)}/${asked.appId}`

    const legacyAsk = await fetch(`http://127.0.0.1:${port}/_interview/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        appId: 'rpc-probe',
        question: {
          question: 'legacy?',
          options: [{ id: 'no', label: 'No', tradeoff: 'removed' }],
          multiSelect: false,
        },
      }),
    })
    expect(legacyAsk.status).toBe(404)

    const legacyAwait = await fetch(`http://127.0.0.1:${port}/_interview/await`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appId: asked.appId, questionId: asked.questionId }),
    })
    expect(legacyAwait.status).toBe(404)

    const pending = await fetch(
      `http://127.0.0.1:${port}/_interview/pending?appId=${encodeURIComponent(scopedAppId)}`,
    )
    expect(pending.status).toBe(200)
    const pendingBody = (await pending.json()) as { questions: ReadonlyArray<unknown> }
    expect(pendingBody.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: scopedAppId, questionId: asked.questionId }),
      ]),
    )

    const answer = await fetch(`http://127.0.0.1:${port}/_answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        appId: scopedAppId,
        questionId: asked.questionId,
        answer: { chosenOptionIds: ['no'] },
      }),
    })
    expect(answer.status).toBe(200)

    const awaited = await Effect.runPromise(
      withControl((client) =>
        wireCall(
          'vista.interview.await',
          AwaitInterviewInput,
          AwaitResult,
        )((env) => client['vista.interview.await'](env), {
          owner: OWNER,
          appId: asked.appId,
          questionId: asked.questionId,
        }),
      ),
    )
    expect(awaited).toEqual({
      _tag: 'answered',
      owner: OWNER,
      appId: asked.appId,
      questionId: asked.questionId,
      answer: { chosenOptionIds: ['no'] },
    })
  })
})
