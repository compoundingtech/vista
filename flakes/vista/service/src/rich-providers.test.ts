import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SemanticManifestSchema } from '@vista/blocks/internal/authoring'
import {
  CheckEvent,
  GhApi,
  OmpUsageApi,
  decodeSpendByProjectRow,
} from '@vista/blocks/internal/provider-contracts'
import { Snapshot } from '@vista/blocks/query'
import { Effect, Layer, Option, Result, Schema, Stream } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as RpcClient from 'effect/rpc/RpcClient'
import { layerJson, layerNdjson } from 'effect/rpc/RpcSerialization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { encodeRouteOwner, PublishInput, PublishOk, VistaControlApi } from './control.ts'
import { appSourcePath } from './paths.ts'
import { versionDir } from './registry.ts'
import type { StartedService } from './server.ts'
import { freePort, installTestChangelog } from './test-support.ts'
import { wireCall } from './wire.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ISLAND_DIR = join(HERE, '..', '..', 'island')
const OWNER = 'agent/dotfiles/vista'
const SLUG = 'review-app'
const fixtureCounters = [
  Symbol.for('vista.samples.review.ghFixtureCalls'),
  Symbol.for('vista.samples.review.metricCalls'),
  Symbol.for('vista.samples.review.usageCalls'),
  Symbol.for('vista.samples.review.diskCalls'),
]

let close: (() => Promise<void>) | undefined
let dir: string
let port: number
let previousEnvironment: Record<string, string | undefined>
let restoreChangelog: (() => void) | undefined
const source = (): string => appSourcePath(join(dir, 'sources'), OWNER, SLUG)
const route = () => `/r/${encodeRouteOwner(OWNER)}/${SLUG}/v1`

beforeAll(async () => {
  const viteBin = join(
    dirname(createRequire(join(ISLAND_DIR, 'package.json')).resolve('vite/package.json')),
    'bin',
    'vite.js',
  )
  execFileSync(process.execPath, [viteBin, 'build'], { cwd: ISLAND_DIR, stdio: 'inherit' })
  if (!existsSync(join(ISLAND_DIR, 'dist', 'island.js'))) {
    throw new Error('telemetry island build produced no dist/island.js')
  }

  previousEnvironment = {
    VISTA_APPS: process.env.VISTA_APPS,
    VISTA_CACHE: process.env.VISTA_CACHE,
    VISTA_SOURCES: process.env.VISTA_SOURCES,
    VISTA_LIVE_STATE: process.env.VISTA_LIVE_STATE,
  }
  mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-rich-providers-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, 'cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  process.env.VISTA_LIVE_STATE = join(dir, 'live-state')
  restoreChangelog = await installTestChangelog(dir)
  cpSync(join(HERE, '..', 'samples', SLUG), source(), { recursive: true })
  for (const key of fixtureCounters) Reflect.set(globalThis, key, 0)

  // paths.ts memoizes environment roots, so this test must import the server after isolation.
  const { startService } = await import('./server.ts')
  port = await freePort()
  const started: StartedService = await startService(port)
  close = started.close

  await Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* RpcClient.make(VistaControlApi)
      return yield* wireCall(
        'vista.publish',
        PublishInput,
        PublishOk,
      )((envelope) => client['vista.publish'](envelope), {
        owner: OWNER,
        slug: SLUG,
        author: 'rich-provider-integration',
        changeSummary: 'exercise all rich data providers',
      })
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
  await close?.()
  restoreChangelog?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}, 60_000)

describe('rich provider publication', () => {
  it('freezes all bindings with their authored policies and resolved values', () => {
    const published = versionDir(OWNER, SLUG, 1)
    const manifest = Schema.decodeUnknownSync(SemanticManifestSchema, {
      onExcessProperty: 'error',
    })(JSON.parse(readFileSync(join(published, 'vista-semantics.json'), 'utf8')))
    const bindings = manifest.nodes
      .flatMap((node) => node.bindings)
      .map((binding) => ({
        provider: binding.provider,
        operation: binding.operation,
        policy: binding.policy,
      }))
      .sort((left, right) =>
        `${left.provider}.${left.operation}`.localeCompare(`${right.provider}.${right.operation}`),
      )

    expect(bindings).toEqual([
      {
        provider: 'disk-index',
        operation: 'treemap',
        policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
      },
      {
        provider: 'gh',
        operation: 'checksStream',
        policy: { mode: 'subscription', effectfulCapture: 'acknowledged' },
      },
      {
        provider: 'gh',
        operation: 'pullRequest',
        policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
      },
      {
        provider: 'omp-usage',
        operation: 'lensChecked',
        policy: { mode: 'live', refreshEvery: 10_000, effectfulCapture: 'acknowledged' },
      },
      {
        provider: 'omp-usage',
        operation: 'projectDrilldown',
        policy: { mode: 'live', effectfulCapture: 'acknowledged' },
      },
      {
        provider: 'otel',
        operation: 'query',
        policy: { mode: 'live', refreshEvery: 10_000, effectfulCapture: 'acknowledged' },
      },
    ])

    const snapshot = Schema.decodeUnknownSync(Snapshot, { onExcessProperty: 'error' })(
      JSON.parse(readFileSync(join(published, 'snapshot.json'), 'utf8')),
    )
    const entries = Object.values(snapshot.entries)
    const entry = (provider: string, operation: string) => {
      const found = entries.find(
        (candidate) => candidate.provider === provider && candidate.operation === operation,
      )
      expect(found, `${provider}.${operation} snapshot entry`).toBeDefined()
      return found!
    }

    const pullRequest = entry('gh', 'pullRequest').encodedValue as {
      readonly files: readonly unknown[]
      readonly commits?: readonly unknown[]
    }
    expect(pullRequest.files).toHaveLength(4)
    expect(pullRequest.commits).toHaveLength(2)

    const checks = entry('gh', 'checksStream').encodedValue as {
      readonly checks: Readonly<Record<string, unknown>>
      readonly cursor: string
    }
    expect(Object.keys(checks.checks)).toEqual(['fixture/check'])
    expect(checks.cursor).toMatch(/^gh-checks:/)

    const metric = entry('otel', 'query').encodedValue as {
      readonly requestedRange: { readonly kind: string; readonly last?: string }
      readonly resolvedRange: { readonly start: number; readonly end: number }
      readonly result: {
        readonly series: readonly [{ readonly samples: readonly { readonly t: number }[] }]
      }
    }
    expect(metric.requestedRange).toEqual({ kind: 'relative', last: '1h' })
    expect(metric.resolvedRange.end - metric.resolvedRange.start).toBe(60 * 60)
    expect(metric.result.series[0].samples.map((sample) => sample.t)).toEqual([
      metric.resolvedRange.start,
      metric.resolvedRange.end,
    ])
  })

  it('serves static bytes without executing providers, then refreshes usage live', async () => {
    for (const key of fixtureCounters) Reflect.set(globalThis, key, 0)
    const staticPage = await fetch(`http://127.0.0.1:${port}${route()}/`)
    expect(staticPage.status).toBe(200)
    expect(fixtureCounters.map((key) => Reflect.get(globalThis, key))).toEqual([0, 0, 0, 0])

    const protocol = RpcClient.layerProtocolHttp({
      url: `http://127.0.0.1:${port}${route()}/_data/omp-usage/`,
    }).pipe(Layer.provide(layerJson), Layer.provide(FetchHttpClient.layer))
    const readUsage = () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(OmpUsageApi)
          return yield* client.lensChecked({ lens: 'spend_by_project', window: '7d' })
        }).pipe(Effect.scoped, Effect.provide(protocol)),
      )
    const first = await readUsage()
    const second = await readUsage()
    expect(first._tag).toBe('ok')
    expect(second._tag).toBe('ok')
    if (first._tag !== 'ok' || second._tag !== 'ok') return
    const firstRow = Result.getOrThrow(decodeSpendByProjectRow(first.envelope.rows[0]))
    const secondRow = Result.getOrThrow(decodeSpendByProjectRow(second.envelope.rows[0]))
    expect(secondRow.usd).toBe(firstRow.usd + 1)
  })

  it('catches a checks subscription up from the frozen cursor over NDJSON', async () => {
    const published = versionDir(OWNER, SLUG, 1)
    const snapshot = Schema.decodeUnknownSync(Snapshot)(
      JSON.parse(readFileSync(join(published, 'snapshot.json'), 'utf8')),
    )
    const checksEntry = Object.values(snapshot.entries).find(
      (candidate) => candidate.provider === 'gh' && candidate.operation === 'checksStream',
    )
    const frozenChecks = checksEntry?.encodedValue as
      | { readonly checks: Readonly<Record<string, unknown>>; readonly cursor?: string }
      | undefined
    const since = frozenChecks?.cursor
    expect(since).toBeTypeOf('string')

    const event = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RpcClient.make(GhApi)
        return yield* client
          .checksStream({
            repo: 'schickling/dotfiles',
            pr: 2935,
            since: since!,
          })
          .pipe(Stream.take(1), Stream.runHead)
      }).pipe(
        Effect.scoped,
        Effect.provide(
          RpcClient.layerProtocolHttp({
            url: `http://127.0.0.1:${port}${route()}/_data/gh`,
          }).pipe(Layer.provide(layerNdjson), Layer.provide(FetchHttpClient.layer)),
        ),
      ),
    )
    const decoded = Schema.decodeSync(CheckEvent)(Option.getOrThrow(event))
    expect(decoded._tag).toBe('Synced')
    if (decoded._tag === 'Synced') {
      expect(Object.keys(decoded.state.checks)).toEqual(Object.keys(frozenChecks!.checks))
    }
  }, 120_000)
})
