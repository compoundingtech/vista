import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { request as nodeRequest } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encodeBinding, Snapshot } from '@vista/blocks/query'
import {
  Context,
  Deferred,
  type Duration,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Queue,
  Ref,
  Schema,
  Scope,
  Stream,
} from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as KeyValueStore from 'effect/persistence/KeyValueStore'
import * as RpcClient from 'effect/rpc/RpcClient'
import { layerJson, layerNdjson } from 'effect/rpc/RpcSerialization'
import { afterAll, describe, expect, it } from 'vitest'

import type { ClockEvent, ClockState } from '../samples/checks-app/providers/clock.query.ts'
import type { LiveDriver } from './data/live-hub.ts'
import { appSourcePath } from './paths.ts'

// Isolate every Vista root BEFORE the service modules load: `paths.ts` memoizes
// them on first use, and the devenv shell presets `VISTA_APPS` to the real state
// directory. Setting the environment inside a test would be too late for a
// worker that already evaluated those modules, and would publish into real state.
// The value imports below are therefore deliberately dynamic and ordered after
// this block (type imports are erased and carry no evaluation).
const HERE = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
const isolatedRoot = mkdtempSync(join(HERE, '..', 'tmp', 'vista-live-service-'))
process.env.VISTA_APPS = join(isolatedRoot, 'apps')
process.env.VISTA_CACHE = join(isolatedRoot, 'cache')
process.env.VISTA_SOURCES = join(isolatedRoot, 'sources')
process.env.VISTA_LIVE_STATE = join(isolatedRoot, 'live-state')
const changelogPath = join(isolatedRoot, 'changelog.v1.json')
writeFileSync(
  changelogPath,
  JSON.stringify({
    schemaVersion: 1,
    product: 'vista',
    build: { machineVersion: 'live-runtime-test' },
    entries: [],
  }),
)
process.env.VISTA_CHANGELOG_MANIFEST = changelogPath

const { ClockApi, clockStream } = await import('../samples/checks-app/providers/clock.query.ts')
const { encodeRouteOwner, PublishInput, PublishOk, VistaControlApi } = await import('./control.ts')
const { makeProviderBudget, makeSubscriptionHub } = await import('./data/live-hub.ts')
const { versionDir } = await import('./registry.ts')
const { freePort } = await import('./test-support.ts')
const { wireCall } = await import('./wire.ts')

afterAll(() => {
  rmSync(isolatedRoot, { recursive: true, force: true })
})

const memoryStore = Effect.gen(function* () {
  const context = yield* Layer.build(KeyValueStore.layerMemory)
  return Context.get(context, KeyValueStore.KeyValueStore)
}).pipe(Effect.scoped)

const appScopeHub = (
  store: KeyValueStore.KeyValueStore,
  appVersionId: string,
  idleTimeToLive: Duration.Input = '15 millis',
) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const budget = yield* makeProviderBudget({
      localProviders: new Set(['clock']),
    })
    const hub = yield* makeSubscriptionHub({
      appVersionId,
      store,
      budget,
      idleTimeToLive,
    }).pipe(Effect.provideService(Scope.Scope, scope))
    return { hub, scope }
  })

const driver = (
  starts: Ref.Ref<number>,
  initialCalls: Ref.Ref<number>,
): Extract<
  LiveDriver<{ readonly lane: string; readonly since?: string }, ClockState, ClockEvent, never>,
  { readonly _tag: 'subscribable' }
> => ({
  _tag: 'subscribable',
  initial: () =>
    Ref.update(initialCalls, (count) => count + 1).pipe(Effect.as({ cursor: 'tick-0', ticks: 0 })),
  stream: (_args, since) => {
    const next = Number(since.replace('tick-', '')) + 1
    return Stream.fromEffect(
      Ref.update(starts, (count) => count + 1).pipe(
        Effect.andThen(Effect.sleep('20 millis')),
        Effect.as<ClockEvent>({ _tag: 'Tick', cursor: `tick-${next}`, ticks: next }),
      ),
    ).pipe(Stream.concat(Stream.never))
  },
})

const collectTwo = <E>(stream: Stream.Stream<ClockEvent, E>) =>
  stream.pipe(
    Stream.take(2),
    Stream.runCollect,
    Effect.map((chunk) => [...chunk]),
  )

describe('subscription live runtime', () => {
  it('shares one upstream, hibernates after the last viewer, and wakes from the persisted cursor', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* memoryStore
        const starts = yield* Ref.make(0)
        const initialCalls = yield* Ref.make(0)
        const live = driver(starts, initialCalls)
        const first = yield* appScopeHub(store, 'owner/app/1', '1 second')
        const [left, right] = yield* Effect.all(
          [
            collectTwo(first.hub.subscribe(clockStream, { lane: 'checks' }, live)),
            collectTwo(first.hub.subscribe(clockStream, { lane: 'checks' }, live)),
          ],
          { concurrency: 'unbounded' },
        )
        const startsAfterViewers = yield* Ref.get(starts)
        yield* Effect.sleep('100 millis')
        const startsWhileIdle = yield* Ref.get(starts)
        yield* Effect.sleep('1000 millis')
        const statusAfterTtl = yield* first.hub.inspect

        const second = yield* appScopeHub(store, 'owner/app/1')
        const resumed = yield* second.hub
          .subscribe(clockStream, { lane: 'checks' }, live)
          .pipe(Stream.take(1), Stream.runHead)
        const initialAfterWake = yield* Ref.get(initialCalls)
        yield* Scope.close(first.scope, Exit.void)
        yield* Scope.close(second.scope, Exit.void)
        return {
          left,
          right,
          startsAfterViewers,
          startsWhileIdle,
          statusAfterTtl,
          resumed,
          initialAfterWake,
        }
      }),
    )

    expect(result.left.at(-1)).toEqual({ _tag: 'Tick', cursor: 'tick-1', ticks: 1 })
    expect(result.right.at(-1)).toEqual({ _tag: 'Tick', cursor: 'tick-1', ticks: 1 })
    expect(result.startsAfterViewers).toBe(1)
    expect(result.startsWhileIdle).toBe(1)
    expect(result.statusAfterTtl).toEqual([])
    expect(Option.getOrUndefined(result.resumed)).toEqual({
      _tag: 'Synced',
      state: { cursor: 'tick-1', ticks: 1 },
    })
    expect(result.initialAfterWake).toBe(1)
  })

  it('atomically hands a joining viewer the current state and subsequent events', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* memoryStore
        const version = yield* appScopeHub(store, 'owner/app/atomic-handoff', '1 second')
        const events = yield* Queue.unbounded<ClockEvent>()
        const joined = yield* Deferred.make<void>()
        const releaseJoiner = yield* Deferred.make<void>()
        const live: LiveDriver<
          { readonly lane: string; readonly since?: string },
          ClockState,
          ClockEvent,
          never
        > = {
          _tag: 'subscribable',
          initial: () => Effect.succeed({ cursor: 'tick-0', ticks: 0 }),
          stream: () => Stream.fromQueue(events),
        }

        const existing = yield* version.hub
          .subscribe(clockStream, { lane: 'handoff' }, live)
          .pipe(Stream.take(2), Stream.runCollect, Effect.forkScoped)
        const joining = yield* version.hub
          .subscribe(clockStream, { lane: 'handoff' }, live, { since: 'tick-0' })
          .pipe(
            Stream.tap((event) =>
              event._tag === 'Synced'
                ? Deferred.succeed(joined, undefined).pipe(
                    Effect.andThen(Deferred.await(releaseJoiner)),
                  )
                : Effect.void,
            ),
            Stream.take(2),
            Stream.runCollect,
            Effect.forkScoped,
          )

        yield* Deferred.await(joined)
        yield* Queue.offer(events, { _tag: 'Tick', cursor: 'tick-1', ticks: 1 })
        const existingEvents = yield* Fiber.join(existing)
        yield* Deferred.succeed(releaseJoiner, undefined)
        const joiningEvents = yield* Fiber.join(joining).pipe(
          Effect.map((chunk) => [...chunk]),
          Effect.race(Effect.sleep('200 millis').pipe(Effect.as('timeout' as const))),
        )
        yield* Scope.close(version.scope, Exit.void)
        return { existingEvents: [...existingEvents], joiningEvents }
      }).pipe(Effect.scoped),
    )

    expect(result.existingEvents).toEqual([
      { _tag: 'Synced', state: { cursor: 'tick-0', ticks: 0 } },
      { _tag: 'Tick', cursor: 'tick-1', ticks: 1 },
    ])
    expect(result.joiningEvents).toEqual([
      { _tag: 'Synced', state: { cursor: 'tick-0', ticks: 0 } },
      { _tag: 'Tick', cursor: 'tick-1', ticks: 1 },
    ])
  })

  it('discards a corrupt strict record and resynchronizes from driver.initial', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* memoryStore
        const { key } = yield* encodeBinding({
          operation: clockStream,
          args: { lane: 'checks' },
          policy: { mode: 'subscription' },
        })
        yield* store.set(
          `owner/app/2::${key}`,
          '{"state":{"cursor":"tick-9","ticks":9,"extra":true}}',
        )
        const starts = yield* Ref.make(0)
        const initialCalls = yield* Ref.make(0)
        const version = yield* appScopeHub(store, 'owner/app/2')
        const event = yield* version.hub
          .subscribe(clockStream, { lane: 'checks' }, driver(starts, initialCalls))
          .pipe(Stream.take(1), Stream.runHead)
        const calls = yield* Ref.get(initialCalls)
        yield* Scope.close(version.scope, Exit.void)
        return { event, calls }
      }),
    )

    expect(Option.getOrUndefined(result.event)).toEqual({
      _tag: 'Synced',
      state: { cursor: 'tick-0', ticks: 0 },
    })
    expect(result.calls).toBe(1)
  })

  it('polls from the folded cursor and emits the accepted event', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* memoryStore
        const cursors = yield* Ref.make<ReadonlyArray<string>>([])
        const version = yield* appScopeHub(store, 'owner/app/pollable')
        const events = yield* version.hub
          .subscribe(
            clockStream,
            { lane: 'checks' },
            {
              _tag: 'pollable',
              initial: () => Effect.succeed({ cursor: 'tick-0', ticks: 0 }),
              poll: (_args, since) =>
                Ref.update(cursors, (seen) => [...seen, since]).pipe(
                  Effect.as({
                    _tag: 'events' as const,
                    events: [{ _tag: 'Tick' as const, cursor: 'tick-1', ticks: 1 }],
                  }),
                ),
              interval: { min: '1 millis', max: '1 millis' },
            },
          )
          .pipe(Stream.take(2), Stream.runCollect)
        const seen = yield* Ref.get(cursors)
        yield* Scope.close(version.scope, Exit.void)
        return { events: [...events], seen }
      }),
    )

    expect(result.seen).toEqual(['tick-0'])
    expect(result.events.at(-1)).toEqual({ _tag: 'Tick', cursor: 'tick-1', ticks: 1 })
  })

  it('tears down an active upstream when the AppVersion scope closes', async () => {
    const stopped = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* memoryStore
        const starts = yield* Ref.make(0)
        const initialCalls = yield* Ref.make(0)
        const releases = yield* Ref.make(0)
        const version = yield* appScopeHub(store, 'owner/app/old', '1 minute')
        const live = driver(starts, initialCalls)
        yield* version.hub
          .subscribe(
            clockStream,
            { lane: 'checks' },
            {
              ...live,
              stream: (args, since) =>
                live
                  .stream(args, since)
                  .pipe(Stream.ensuring(Ref.update(releases, (count) => count + 1))),
            },
          )
          .pipe(Stream.runDrain, Effect.forkScoped)
        yield* Effect.sleep('30 millis')
        yield* Scope.close(version.scope, Exit.void)
        yield* Effect.sleep('5 millis')
        return yield* Ref.get(releases)
      }).pipe(Effect.scoped),
    )

    expect(stopped).toBe(1)
  })
})

describe('node stream response ownership', () => {
  it('does not write a second response when the client disconnects during provider startup', async () => {
    const owner = 'vista.abort-test'
    const slug = 'checks-app'
    const source = appSourcePath(join(isolatedRoot, 'sources'), owner, slug)
    cpSync(join(HERE, '..', 'samples', 'checks-app'), source, { recursive: true })
    const providerPath = join(source, 'providers', 'clock.provider.ts')
    const providerStartedKey = Symbol.for('vista.abort-test.provider-started')
    const providerReleaseKey = Symbol.for('vista.abort-test.provider-release')
    const providerStarted = Promise.withResolvers<void>()
    const providerRelease = Promise.withResolvers<void>()
    Reflect.set(globalThis, providerStartedKey, providerStarted.resolve)
    Reflect.set(globalThis, providerReleaseKey, providerRelease.promise)
    writeFileSync(
      providerPath,
      [
        `Reflect.get(globalThis, Symbol.for('vista.abort-test.provider-started'))()`,
        `await Reflect.get(globalThis, Symbol.for('vista.abort-test.provider-release'))`,
        readFileSync(providerPath, 'utf8'),
      ].join('\n'),
    )
    const port = await freePort()
    const { startService } = await import('./server.ts')
    const started = await startService(port)
    const errors: unknown[][] = []
    const consoleError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args)
    }

    try {
      const requestDone = Promise.withResolvers<void>()
      const req = nodeRequest({
        hostname: '127.0.0.1',
        port,
        path: `/r/${encodeRouteOwner(owner)}/${slug}/draft/_data/clock`,
        method: 'POST',
        headers: { 'content-type': 'application/ndjson' },
      })
      req.once('close', requestDone.resolve)
      req.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ECONNRESET') requestDone.resolve()
        else requestDone.reject(error)
      })
      req.end(
        `${JSON.stringify({
          _tag: 'Request',
          id: 1,
          tag: 'clockStream',
          payload: { lane: 'abort-test' },
        })}\n`,
      )
      await providerStarted.promise
      req.destroy()
      providerRelease.resolve()
      await requestDone.promise
      // The provider is deliberately resumed after the socket closes. This is a
      // real Node HTTP scheduling boundary, so fake timers cannot drive it.
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      expect(errors.flatMap((args) => args.map(String)).join('\n')).not.toContain(
        'Cannot set headers after they are sent to the client',
      )
    } finally {
      console.error = consoleError
      await started.close()
      Reflect.deleteProperty(globalThis, providerStartedKey)
      Reflect.deleteProperty(globalThis, providerReleaseKey)
    }
  }, 360_000)
})

describe('published subscription transport', () => {
  it('publishes a frozen seed and catches up draft and receipt-verified static routes over NDJSON', async () => {
    const owner = 'agent/dotfiles/vista'
    const slug = 'checks-app'
    const source = appSourcePath(join(isolatedRoot, 'sources'), owner, slug)
    cpSync(join(HERE, '..', 'samples', 'checks-app'), source, { recursive: true })
    const startsKey = Symbol.for('vista.samples.clock.driverStarts')
    Reflect.set(globalThis, startsKey, 0)
    const port = await freePort()
    const { startService } = await import('./server.ts')
    const started = await startService(port)

    const streamAt = (url: string, since: string) =>
      Effect.gen(function* () {
        const client = yield* RpcClient.make(ClockApi)
        return yield* client
          .clockStream({
            lane: 'publish-checks',
            since,
          })
          .pipe(Stream.take(1), Stream.runHead)
      }).pipe(
        Effect.scoped,
        Effect.provide(
          RpcClient.layerProtocolHttp({ url }).pipe(
            Layer.provide(layerNdjson),
            Layer.provide(FetchHttpClient.layer),
          ),
        ),
      )

    try {
      const route = `/r/${encodeRouteOwner(owner)}/${slug}`
      const draft = await Effect.runPromise(
        streamAt(`http://127.0.0.1:${port}${route}/draft/_data/clock`, 'tick-0'),
      )
      expect(Option.getOrUndefined(draft)).toEqual({
        _tag: 'Synced',
        state: { cursor: 'tick-0', ticks: 0 },
      })

      await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(VistaControlApi)
          yield* wireCall(
            'vista.publish',
            PublishInput,
            PublishOk,
          )((envelope) => client['vista.publish'](envelope), {
            owner,
            slug,
            author: 'live-runtime-test',
            changeSummary: 'subscription publication',
          })
        }).pipe(
          Effect.scoped,
          Effect.provide(
            RpcClient.layerProtocolHttp({
              url: `http://127.0.0.1:${port}/_rpc/control`,
            }).pipe(Layer.provide(layerJson), Layer.provide(FetchHttpClient.layer)),
          ),
        ),
      )

      const snapshot = Schema.decodeUnknownSync(Snapshot, { onExcessProperty: 'error' })(
        JSON.parse(readFileSync(join(versionDir(owner, slug, 1), 'snapshot.json'), 'utf8')),
      )
      const { key } = await Effect.runPromise(
        encodeBinding({
          operation: clockStream,
          args: { lane: 'publish-checks' },
          policy: { mode: 'subscription' },
        }),
      )
      expect(snapshot.entries[key]?.encodedValue).toEqual({ cursor: 'tick-0', ticks: 0 })

      Reflect.set(globalThis, startsKey, 0)
      const staticPage = await fetch(`http://127.0.0.1:${port}${route}/v1/`)
      expect(staticPage.status).toBe(200)
      expect(Reflect.get(globalThis, startsKey)).toBe(0)

      const publishedUrl = `http://127.0.0.1:${port}${route}/v1/_data/clock`
      const [left, right] = await Effect.runPromise(
        Effect.all([streamAt(publishedUrl, 'tick-0'), streamAt(publishedUrl, 'tick-0')], {
          concurrency: 'unbounded',
        }),
      )
      expect(Option.getOrUndefined(left)).toEqual({
        _tag: 'Synced',
        state: { cursor: 'tick-0', ticks: 0 },
      })
      expect(Option.getOrUndefined(right)).toEqual({
        _tag: 'Synced',
        state: { cursor: 'tick-0', ticks: 0 },
      })
      expect(Reflect.get(globalThis, startsKey)).toBe(1)
    } finally {
      await started.close()
    }
  }, 360_000)
})
