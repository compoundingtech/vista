import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { GhApi, OmpUsageApi, PtyApi } from '@vista/blocks/internal/provider-contracts'
import { Effect, Exit, Layer, Option, Schema, Stream } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcClient from 'effect/rpc/RpcClient'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { layerJson, layerNdjson } from 'effect/rpc/RpcSerialization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { InspectorRpcGroup, type InspectorSnapshotFrame } from '@overeng/effect-rpc-explorer'

import type { ServiceState } from './server.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'vista.rpc-explorer-test'
const SLUG = 'review-app'
mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
const dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-rpc-explorer-'))
const previous = {
  VISTA_APPS: process.env.VISTA_APPS,
  VISTA_CACHE: process.env.VISTA_CACHE,
  VISTA_SOURCES: process.env.VISTA_SOURCES,
  VISTA_LIVE_STATE: process.env.VISTA_LIVE_STATE,
}
process.env.VISTA_APPS = join(dir, 'apps')
process.env.VISTA_CACHE = join(dir, 'cache')
process.env.VISTA_SOURCES = join(dir, 'sources')
process.env.VISTA_LIVE_STATE = join(dir, 'live-state')

// paths.ts memoizes environment roots; import only after the isolation above.
const { encodeRouteOwner, VistaControlApi, AppRow } = await import('./control.ts')
const { freePort } = await import('./test-support.ts')
const { NoPayload, wireCall } = await import('./wire.ts')
const { appSourcePath } = await import('./paths.ts')

let port: number
let close: (() => Promise<void>) | undefined
let serviceState: ServiceState | undefined
const baseUrl = () => `http://127.0.0.1:${port}`
const appPath = () => `/r/${encodeRouteOwner(OWNER)}/${SLUG}/draft`
const providersDir = join(appSourcePath(join(dir, 'sources'), OWNER, SLUG), 'providers')
/** An app-local contract whose tag no built-in Vista group declares. */
const AppLocalEchoApi = RpcGroup.make(
  Rpc.make('appLocalEcho', {
    payload: { message: Schema.String },
    success: Schema.String,
  }),
)
/** The app's own provider module, mounted from its providers directory. */
const appLocalProvider = `import { contract } from '@vista/blocks/query'
import { implement, mountProvider } from '@vista/data/provider'
import { Effect, Layer, Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'

const AppLocalEchoApi = RpcGroup.make(
  Rpc.make('appLocalEcho', {
    payload: { message: Schema.String },
    success: Schema.String,
  }),
)
const echo = contract({ id: 'app-local-echo', group: AppLocalEchoApi })
export default mountProvider(
  implement(echo, {
    purity: 'pure',
    handlers: {
      appLocalEcho: ({ message }) => Effect.succeed(\`echo:\${message}\`),
    },
  }),
  Layer.empty,
)
`
const callRpc = <TGroup extends RpcGroup.Any, A, E>(
  group: TGroup,
  path: string,
  serialization: typeof layerJson,
  run: (client: RpcClient.FromGroup<TGroup>) => Effect.Effect<A, E>,
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = (yield* RpcClient.make(
        group as never,
      )) as unknown as RpcClient.FromGroup<TGroup>
      return yield* run(client)
    }).pipe(
      Effect.scoped,
      Effect.provide(
        RpcClient.layerProtocolHttp({ url: `${baseUrl()}${path}` }).pipe(
          Layer.provide(serialization),
          Layer.provide(FetchHttpClient.layer),
        ),
      ),
    ),
  )

beforeAll(async () => {
  cpSync(
    join(HERE, '..', 'samples', SLUG),
    appSourcePath(join(dir, 'sources'), OWNER, SLUG),
    { recursive: true },
  )
  writeFileSync(
    join(appSourcePath(join(dir, 'sources'), OWNER, SLUG), 'app.tsx'),
    `import { AppRoot, Section } from '@vista/blocks'
export default function ExplorerSmoke() {
  return <AppRoot title="Explorer smoke" template="architecture-review" scope="rpc">
    <Section id="smoke" provenance="app.tsx"><main>RPC diagnostics</main></Section>
  </AppRoot>
}
`,
  )
  writeFileSync(
    join(appSourcePath(join(dir, 'sources'), OWNER, SLUG), 'providers', 'pty.provider.ts'),
    `export { default } from '@vista/data/providers/pty.provider'\n`,
  )
  writeFileSync(join(providersDir, 'app-local-echo.provider.ts'), appLocalProvider)
  const { startService } = await import('./server.ts')
  port = await freePort()
  const service = await startService(port)
  close = service.close
  serviceState = service.state
}, 90_000)

afterAll(async () => {
  await close?.()
  rmSync(dir, { recursive: true, force: true })
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key as keyof typeof previous]
    else process.env[key as keyof typeof previous] = value
  }
}, 60_000)

describe('Vista service-wide RPC explorer', () => {
  it('observes control, JSON provider, and NDJSON stream on real transports without observing itself', async () => {
    const rows = await callRpc(VistaControlApi, '/_rpc/control', layerJson, (client) =>
      wireCall(
        'vista.apps.list',
        NoPayload,
        Schema.Array(AppRow),
      )((envelope) => client['vista.apps.list'](envelope), null),
    )
    expect(rows).toEqual([]) // A draft is not published into the control-plane app index.

    const usage = await callRpc(OmpUsageApi, `${appPath()}/_data/omp-usage`, layerJson, (client) =>
      client.lensChecked({ lens: 'spend_by_project', window: '7d' }),
    )
    expect(usage).toEqual(expect.objectContaining({ _tag: 'ok' }))

    const event = await callRpc(GhApi, `${appPath()}/_data/gh`, layerNdjson, (client) =>
      client
        .checksStream({ repo: 'schickling/dotfiles', pr: 2935 })
        .pipe(Stream.take(1), Stream.runHead),
    )
    expect(Option.isSome(event as Option.Option<unknown>)).toBe(true)
    const terminal = await callRpc(PtyApi, `${appPath()}/_data/pty`, layerJson, (client) =>
      Effect.exit(client.attach({ sessionId: 'sensitive-terminal-session' })),
    )
    expect(Exit.isFailure(terminal)).toBe(true) // This undeclared session cannot attach.

    const snapshot = await callRpc(InspectorRpcGroup, '/_rpc-inspector', layerNdjson, (client) =>
      client['RpcExplorer.GetSnapshot']({}),
    )
    const frame = snapshot
    const records = [...frame.completed, ...frame.active]
    const tags = new Map(frame.descriptors.map(({ descriptorId, tag }) => [descriptorId, tag]))
    for (const tag of ['vista.apps.list', 'lensChecked']) {
      expect(
        records.some(
          (record) => tags.get(record.descriptorId) === tag && record.state === 'succeeded',
        ),
        `${tag}: ${JSON.stringify(records.map((record) => ({ tag: tags.get(record.descriptorId), state: record.state, connection: record.key.connectionId })))}`,
      ).toBe(true)
    }
    // Taking the first NDJSON element can interrupt the server stream before its snapshot.
    expect(records.some((record) => tags.get(record.descriptorId) === 'checksStream')).toBe(true)
    expect(records.some((record) => record.key.connectionId.startsWith('control:'))).toBe(true)
    expect(
      records.some((record) => record.key.connectionId.startsWith(`${OWNER}/${SLUG}/draft:`)),
    ).toBe(true)
    const observations = frame.events.flatMap((candidate) =>
      candidate._tag === 'RequestObserved' || candidate._tag === 'TerminalObserved'
        ? candidate.observations
        : [],
    )
    expect(
      observations.find((observation) => observation.channel === 'headers')?.outcome._tag,
    ).toBe('Omitted')
    expect(
      frame.events.some(
        (candidate) =>
          candidate._tag === 'RequestObserved' &&
          tags.get(candidate.descriptorId) === 'lensChecked' &&
          candidate.observations.some(
            (observation) =>
              observation.channel === 'requestPayload' &&
              'captured' in observation &&
              observation.captured._tag === 'Object',
          ),
      ),
    ).toBe(true)
    const ptyRecord = records.find((record) => tags.get(record.descriptorId) === 'attach')
    expect(ptyRecord).toBeDefined()
    const ptyEvents = frame.events.filter(
      (candidate) =>
        (candidate._tag === 'RequestObserved' || candidate._tag === 'TerminalObserved') &&
        candidate.request.connectionId === ptyRecord?.key.connectionId &&
        JSON.stringify(candidate.request.requestId) === JSON.stringify(ptyRecord?.key.requestId),
    )
    expect(ptyEvents.some((candidate) => candidate._tag === 'RequestObserved')).toBe(true)
    expect(ptyEvents.some((candidate) => candidate._tag === 'TerminalObserved')).toBe(true)
    const ptyObservations = ptyEvents.flatMap((candidate) =>
      candidate._tag === 'RequestObserved' || candidate._tag === 'TerminalObserved'
        ? candidate.observations
        : [],
    )
    expect(ptyObservations.map(({ channel }) => channel)).toEqual(
      expect.arrayContaining(['requestPayload', 'typedFailure', 'headers']),
    )
    expect(ptyObservations.every((observation) => observation.outcome._tag === 'Omitted')).toBe(
      true,
    )
    expect(JSON.stringify(frame)).not.toContain('sensitive-terminal-session')

    const next = await callRpc(InspectorRpcGroup, '/_rpc-inspector', layerNdjson, (client) =>
      client['RpcExplorer.GetSnapshot']({}),
    )
    expect([...next.completed, ...next.active]).toHaveLength(records.length)
    expect(frame.descriptors.some((descriptor) => descriptor.tag.startsWith('RpcExplorer.'))).toBe(
      false,
    )
  }, 90_000)

  it('resolves an app-local provider RPC to its runtime descriptor and keeps one across a remount', async () => {
    const echo = (message: string) =>
      callRpc(AppLocalEchoApi, `${appPath()}/_data/app-local-echo`, layerJson, (client) =>
        client.appLocalEcho({ message }),
      )
    const inspect = () =>
      callRpc(InspectorRpcGroup, '/_rpc-inspector', layerNdjson, (client) =>
        client['RpcExplorer.GetSnapshot']({}),
      )
    const echoDescriptors = (frame: InspectorSnapshotFrame) =>
      frame.descriptors.filter((descriptor) => descriptor.tag === 'appLocalEcho')

    expect(await echo('mounted')).toBe('echo:mounted')
    const mounted = await inspect()
    const [descriptor] = echoDescriptors(mounted)
    expect(echoDescriptors(mounted)).toHaveLength(1)
    // Schema-derived inspection covers the app-local payload (UI-R18).
    expect(descriptor?.channels.requestPayload.projection).toBe('bestEffort')
    const mountedRecords = [...mounted.completed, ...mounted.active].filter(
      (record) => record.descriptorId === descriptor?.descriptorId,
    )
    expect(mountedRecords).toHaveLength(1)

    // A registry refresh mounts the replacement before retiring the displaced version.
    const identity = { owner: OWNER, slug: SLUG, version: 'draft' } as const
    await serviceState!.providers.replaceVersion(identity, providersDir)
    expect(await echo('remounted')).toBe('echo:remounted')
    await new Promise((resolve) => setTimeout(resolve, 500))

    const after = await inspect()
    expect(echoDescriptors(after)).toHaveLength(1)
    expect(after.descriptorRevision).toBeGreaterThan(mounted.descriptorRevision)
    const records = [...after.completed, ...after.active].filter(
      (record) => record.descriptorId === descriptor?.descriptorId,
    )
    expect(records.length).toBeGreaterThanOrEqual(2)
    expect(
      [...after.completed, ...after.active].some(
        (record) =>
          record.descriptorId === 'unknown:unmapped' &&
          record.key.connectionId.startsWith(`${OWNER}/${SLUG}/draft:`),
      ),
    ).toBe(false)
  }, 90_000)
})
