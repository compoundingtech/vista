import {
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

import { Snapshot, snapshotKey } from '@vista/blocks/query'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as RpcClient from 'effect/rpc/RpcClient'
import { layerJson } from 'effect/rpc/RpcSerialization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NoteApi, note } from '../samples/query-app/providers/note.query.ts'
import { resolveVistaBuildInfo } from './build-info.ts'
import { VISTA_CHANGELOG_FILE, VISTA_CHANGELOG_PATH_ENV } from './changelog-companion.ts'
import { encodeRouteOwner, PublishInput, PublishOk, VistaControlApi } from './control.ts'
import { callLive } from './data/client/provider.ts'
import { appSourcePath } from './paths.ts'
import { versionDir } from './registry.ts'
import type { StartedService } from './server.ts'
import { freePort } from './test-support.ts'
import { wireCall } from './wire.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'agent/vista/query-tests'
const SLUG = 'query-app'
const ORIGINAL_LOCAL_VIEWER_IDENTITIES = process.env.VISTA_LOCAL_VIEWER_IDENTITIES
const ORIGINAL_CHANGELOG_PATH = process.env[VISTA_CHANGELOG_PATH_ENV]

let service: StartedService
let dir: string
let port: number
const appSource = (): string =>
  appSourcePath(join(dir, 'sources'), OWNER, SLUG)

beforeAll(async () => {
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-query-publish-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  process.env.VISTA_LOCAL_VIEWER_IDENTITIES = '1'
  const changelogPath = join(dir, VISTA_CHANGELOG_FILE)
  writeFileSync(
    changelogPath,
    JSON.stringify({
      schemaVersion: 1,
      product: 'vista',
      build: { machineVersion: resolveVistaBuildInfo().machineVersion },
      entries: [],
    }),
  )
  process.env[VISTA_CHANGELOG_PATH_ENV] = changelogPath
  cpSync(join(HERE, '..', 'samples', 'query-app'), appSource(), { recursive: true })

  const { startService } = await import('./server.ts')
  port = await freePort()
  service = await startService(port)

  await Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* RpcClient.make(VistaControlApi)
      return yield* wireCall('vista.publish', PublishInput, PublishOk)(
        (envelope) => client['vista.publish'](envelope),
        {
          owner: OWNER,
          slug: SLUG,
          author: 'integration-test',
          changeSummary: 'query data foundation',
        },
      )
    }).pipe(
      Effect.scoped,
      Effect.provide(
        RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}/_rpc/control` }).pipe(
          Layer.provide(layerJson),
          Layer.provide(FetchHttpClient.layer),
        ),
      ),
    ),
  )
}, 360_000)

afterAll(async () => {
  await service.close()
  if (ORIGINAL_LOCAL_VIEWER_IDENTITIES === undefined) {
    delete process.env.VISTA_LOCAL_VIEWER_IDENTITIES
  } else {
    process.env.VISTA_LOCAL_VIEWER_IDENTITIES = ORIGINAL_LOCAL_VIEWER_IDENTITIES
  }
  if (ORIGINAL_CHANGELOG_PATH === undefined) delete process.env[VISTA_CHANGELOG_PATH_ENV]
  else process.env[VISTA_CHANGELOG_PATH_ENV] = ORIGINAL_CHANGELOG_PATH
  if (dir) rmSync(dir, { recursive: true, force: true })
}, 60_000)

describe('query publication', () => {
  it('captures a seed and serves the version-scoped app provider', async () => {
    const snapshot = Schema.decodeUnknownSync(Snapshot, { onExcessProperty: 'error' })(
      JSON.parse(readFileSync(join(versionDir(OWNER, SLUG, 1), 'snapshot.json'), 'utf8')),
    )
    const args = { message: 'frozen first, live on demand' }
    const key = await Effect.runPromise(snapshotKey(note.ops.read, args))
    expect(snapshot.entries[key]?.encodedValue).toEqual({
      message: 'frozen first, live on demand',
      revision: 1,
    })
    const assets = join(versionDir(OWNER, SLUG, 1), 'site', 'assets')
    const css = readdirSync(assets)
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(join(assets, file), 'utf8'))
      .join('\n')
    expect(css).toMatch(/grid-template-columns:\s*minmax\(24rem,\s*3fr\)/)

    const direct = await Effect.runPromise(
      callLive(
        `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/${SLUG}/v1/_data/sample-note/`,
        NoteApi,
        (client) => client.read({ message: 'direct live proof' }),
      ),
    )
    expect(direct).toEqual({ message: 'direct live proof', revision: 2 })
  }, 120_000)

  it('establishes one viewer before parallel initial data requests', async () => {
    const base = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/${SLUG}/v1/`
    const bootstrap = await fetch(base)
    const setCookie = bootstrap.headers.get('set-cookie')
    expect(setCookie).toMatch(
      /^vista_livepty_viewer=[0-9a-f-]+; Path=\/; HttpOnly; SameSite=Lax$/,
    )
    const cookie = setCookie!.split(';', 1)[0]!
    await bootstrap.arrayBuffer()

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        fetch(`${base}_data/sample-note/`, { headers: { cookie } }),
      ),
    )
    expect(responses.every((response) => response.headers.get('set-cookie') === null)).toBe(true)
    await Promise.all(responses.map((response) => response.arrayBuffer()))

    const sameViewerBootstrap = await fetch(base, { headers: { cookie } })
    expect(sameViewerBootstrap.headers.get('set-cookie')).toBeNull()
    await sameViewerBootstrap.arrayBuffer()
  })

  it('rejects tampered provider entries and local dependencies before evaluation', async () => {
    const base = `http://127.0.0.1:${port}/r/${encodeRouteOwner(OWNER)}/${SLUG}/v1/`
    expect((await fetch(base)).status).toBe(200)

    const providers = join(versionDir(OWNER, SLUG, 1), 'providers')
    for (const file of ['note.provider.ts', 'note.query.ts', 'note.store.ts']) {
      const path = join(providers, file)
      const original = readFileSync(path, 'utf8')
      const marker = `__vista_unverified_${file.replaceAll('.', '_')}`
      Reflect.deleteProperty(globalThis, marker)
      await service.state.providers.closeVersion({ owner: OWNER, slug: SLUG, version: 1 })
      service.state.published.moduleGraph.invalidateAll()
      writeFileSync(path, `Reflect.set(globalThis, ${JSON.stringify(marker)}, true)\n${original}`)
      try {
        const response = await fetch(`${base}_data/sample-note/`)
        expect(response.status, await response.text()).toBe(409)
        expect(Reflect.get(globalThis, marker)).toBeUndefined()
      } finally {
        writeFileSync(path, original)
        Reflect.deleteProperty(globalThis, marker)
      }
    }
  }, 120_000)
})
