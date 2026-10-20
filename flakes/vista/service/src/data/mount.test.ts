import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { contract, Cursor, subscription } from '@vista/blocks/internal/data-contract'
import { Deferred, Effect, Exit, Fiber, Layer, Schema, Stream } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import type { ViteDevServer } from 'vite'
import { describe, expect, it } from 'vitest'

import { createProviderRegistry, type ProviderRegistry } from './mount.ts'
import { implement, mountProvider } from './provider.ts'
import { AgentTimelineCommandRunnerLive } from './providers/agent-timeline-tmux.ts'

const ReadApi = RpcGroup.make(
  Rpc.make('read', { payload: Schema.Struct({}), success: Schema.String }),
)
const readContract = contract({ id: 'probe', group: ReadApi })
const readProvider = (value: string) =>
  mountProvider(
    implement(readContract, {
      purity: 'pure',
      handlers: { read: () => Effect.succeed(value) },
    }),
    Layer.empty,
  )

const StreamState = Schema.Struct({ cursor: Cursor, value: Schema.String })
const StreamEvent = Schema.Union([
  Schema.TaggedStruct('Synced', { state: StreamState }),
  Schema.TaggedStruct('Changed', { cursor: Cursor, value: Schema.String }),
])
type StreamEvent = typeof StreamEvent.Type
const StreamApi = RpcGroup.make(
  Rpc.make('watch', {
    payload: { id: Schema.String, since: Schema.optionalKey(Cursor) },
    success: StreamEvent,
    error: Schema.String,
    stream: true,
  }),
)
const streamBase = contract({ id: 'stream-probe', group: StreamApi })
const watch = subscription(streamBase.ops.watch, {
  stateSchema: StreamState,
  eventSchema: StreamEvent,
  fold: (_state, event) =>
    event._tag === 'Synced' ? event.state : { cursor: event.cursor, value: event.value },
  cursor: (state) => state.cursor,
})
const streamContract = { ...streamBase, ops: { ...streamBase.ops, watch } }
const streamProvider = (
  value: string,
  nextEvent?: Promise<StreamEvent>,
  lifecycle?: {
    readonly onLiveStreamClose?: () => void
    readonly onProviderScopeClose?: () => void
  },
) => {
  const onProviderScopeClose = lifecycle?.onProviderScopeClose
  const layer =
    onProviderScopeClose === undefined
      ? Layer.empty
      : Layer.effectDiscard(
          Effect.acquireRelease(Effect.void, () => Effect.sync(onProviderScopeClose)),
        )
  return mountProvider(
    implement(streamContract, {
      purity: 'pure',
      handlers: { watch: () => Stream.never },
      live: {
        watch: {
          _tag: 'subscribable',
          initial: () => Effect.succeed({ cursor: `cursor-${value}`, value }),
          stream: () => {
            const events =
              nextEvent === undefined
                ? Stream.never
                : Stream.fromEffect(Effect.promise(() => nextEvent))
            return lifecycle?.onLiveStreamClose === undefined
              ? events
              : events.pipe(Stream.ensuring(Effect.sync(lifecycle.onLiveStreamClose)))
          },
        },
      },
    }),
    layer,
  )
}
class StreamProbeError extends Schema.TaggedError<StreamProbeError>()('StreamProbeError', {
  cause: Schema.Defect(),
  message: Schema.String,
}) {}

class FakeWatcher {
  readonly listeners = new Set<(file: string) => void>()

  on(event: string, listener: (file: string) => void): this {
    if (event === 'change') this.listeners.add(listener)
    return this
  }

  off(event: string, listener: (file: string) => void): this {
    if (event === 'change') this.listeners.delete(listener)
    return this
  }

  change(file: string): void {
    for (const listener of this.listeners) listener(file)
  }
}

const makeHarness = (
  load: (id: string) => Promise<{ readonly default: unknown }> | { readonly default: unknown },
) => {
  const root = mkdtempSync(join(tmpdir(), 'vista-registry-'))
  const providersDir = join(root, 'providers')
  mkdirSync(providersDir)
  const providerPath = join(providersDir, 'probe.provider.ts')
  writeFileSync(providerPath, 'export default undefined\n')
  const watcher = new FakeWatcher()
  const vite = {
    watcher,
    ssrLoadModule: load,
  } as unknown as ViteDevServer
  return { root, providersDir, providerPath, watcher, vite }
}

const readValue = (registry: ProviderRegistry) =>
  Effect.runPromise(registry.providers.get('probe')!.call('read', {}, 'live'))

const identity = (version: number | 'draft') => ({ owner: 'owner', slug: 'app', version })

describe('provider registry lifecycle', () => {
  it('does not acquire terminals for version persistence or provider subprocesses', async () => {
    const baseline = process.stdin.listenerCount('end')
    const harness = makeHarness(() => ({
      default: { ...readProvider('shared'), layer: AgentTimelineCommandRunnerLive },
    }))
    const manager = await createProviderRegistry(harness.vite, harness.root)
    try {
      for (let version = 1; version <= 12; version++) {
        await manager.ensureVersion(identity(version), harness.providersDir)
        expect(process.stdin.listenerCount('end')).toBe(baseline)
      }
    } finally {
      await manager.close()
      rmSync(harness.root, { recursive: true, force: true })
    }
    expect(process.stdin.listenerCount('end')).toBe(baseline)
  })

  it('coalesces parallel cold creation for one version', async () => {
    const loadedIds: string[] = []
    const harness = makeHarness(async (id) => {
      loadedIds.push(id)
      await Promise.resolve()
      return { default: readProvider('shared') }
    })
    const manager = await createProviderRegistry(harness.vite, harness.root)
    try {
      const registries = await Promise.all(
        Array.from({ length: 12 }, () =>
          manager.ensureVersion(identity('draft'), harness.providersDir),
        ),
      )
      expect(new Set(registries).size).toBe(1)
      expect(loadedIds).toEqual([expect.stringMatching(/^virtual:vista-provider:/)])
      expect(harness.watcher.listeners.size).toBe(2)
    } finally {
      await manager.close()
      rmSync(harness.root, { recursive: true, force: true })
    }
  })

  it('keeps the old registry usable when a replacement fails', async () => {
    let result: 'stable' | 'replacement' | 'fail' = 'stable'
    const harness = makeHarness(() => {
      if (result === 'fail') throw new Error('candidate failed')
      return { default: readProvider(result) }
    })
    const manager = await createProviderRegistry(harness.vite, harness.root)
    try {
      const stable = await manager.ensureVersion(identity('draft'), harness.providersDir)
      result = 'fail'
      await expect(manager.replaceVersion(identity('draft'), harness.providersDir)).rejects.toThrow(
        'candidate failed',
      )
      expect(manager.getVersion(identity('draft'))).toBe(stable)
      expect(await readValue(stable)).toBe('stable')
      expect(harness.watcher.listeners.size).toBe(2)

      result = 'replacement'
      const replacement = await manager.replaceVersion(identity('draft'), harness.providersDir)
      expect(manager.getVersion(identity('draft'))).toBe(replacement)
      expect(await readValue(replacement)).toBe('replacement')
    } finally {
      await manager.close()
      rmSync(harness.root, { recursive: true, force: true })
    }
  })

  it('verifies the resolved module path before initial load and hot reload', async () => {
    let loads = 0
    const verified: string[] = []
    const harness = makeHarness(() => {
      loads += 1
      return { default: readProvider(`load-${loads}`) }
    })
    const manager = await createProviderRegistry(harness.vite, harness.root)
    try {
      await expect(
        manager.ensureVersion(identity('draft'), harness.providersDir, {
          verifyModule: (path) => {
            verified.push(path)
            throw new Error('unverified')
          },
        }),
      ).rejects.toThrow('unverified')
      expect(loads).toBe(0)
      expect(manager.getVersion(identity('draft'))).toBeUndefined()

      const registry = await manager.ensureVersion(identity('draft'), harness.providersDir, {
        verifyModule: (path) => {
          verified.push(path)
        },
      })
      expect(verified.at(-1)).toBe(harness.providerPath)
      await manager.ensureVersion(identity('draft'), harness.providersDir, {
        verifyModule: (path) => {
          verified.push(`reload:${path}`)
        },
      })
      harness.watcher.change(harness.providerPath)
      await registry.ensureFresh('probe')
      expect(verified.at(-1)).toBe(`reload:${harness.providerPath}`)
      expect(loads).toBe(2)
    } finally {
      await manager.close()
      rmSync(harness.root, { recursive: true, force: true })
    }
  })

  it('defers old-version disposal while its stream is active', async () => {
    let generation = 0
    const harness = makeHarness(() => ({ default: streamProvider(`v${++generation}`) }))
    const manager = await createProviderRegistry(harness.vite, harness.root)
    try {
      const old = await manager.ensureVersion(identity(1), harness.providersDir)
      await manager.ensureVersion(identity(2), harness.providersDir)
      const stream = old.providers.get('stream-probe')!.core.watch!({ id: 'shared' })
      if (!Stream.isStream(stream)) throw new Error('expected stream provider')
      await Effect.runPromise(
        Effect.gen(function* () {
          const firstEvent = yield* Deferred.make<void>()
          const fiber = yield* stream.pipe(
            Stream.tap(() => Deferred.succeed(firstEvent, undefined)),
            Stream.runDrain,
            Effect.forkScoped,
          )
          yield* Deferred.await(firstEvent)

          yield* Effect.promise(() => manager.retainVersion(identity(2)))
          expect(fiber.pollUnsafe()).toBeUndefined()

          yield* Fiber.interrupt(fiber)
        }).pipe(Effect.scoped),
      )
    } finally {
      await manager.close()
      rmSync(harness.root, { recursive: true, force: true })
    }
  })

  it('terminates the displaced driver when a provider reloads', async () => {
    const nextEvent = Promise.withResolvers<StreamEvent>()
    let load = 0
    let liveStreamClosed = false
    let invalidatedBeforeScopeClose = false
    const harness = makeHarness(() => {
      load += 1
      return {
        default: streamProvider(
          load === 1 ? 'old' : 'new',
          load === 1 ? undefined : nextEvent.promise,
          load === 1
            ? {
                onLiveStreamClose: () => {
                  liveStreamClosed = true
                },
                onProviderScopeClose: () => {
                  invalidatedBeforeScopeClose = liveStreamClosed
                },
              }
            : undefined,
        ),
      }
    })
    const manager = await createProviderRegistry(harness.vite, harness.root)
    try {
      const registry = await manager.ensureVersion(identity('draft'), harness.providersDir)
      const old = registry.providers.get('stream-probe')!.core.watch!({ id: 'shared' })
      if (!Stream.isStream(old)) throw new Error('expected stream provider')
      await Effect.runPromise(
        Effect.gen(function* () {
          const oldSubscribed = yield* Deferred.make<void>()
          const oldFiber = yield* old.pipe(
            Stream.tap(() => Deferred.succeed(oldSubscribed, undefined)),
            Stream.runDrain,
            Effect.forkScoped,
          )
          yield* Deferred.await(oldSubscribed)

          yield* Effect.promise(() => registry.reload(harness.providerPath))
          expect(invalidatedBeforeScopeClose).toBe(true)
          const oldExit = yield* Fiber.await(oldFiber)
          expect(Exit.isFailure(oldExit)).toBe(true)

          const fresh = registry.providers.get('stream-probe')!.core.watch!({ id: 'shared' })
          if (!Stream.isStream(fresh)) return yield* Effect.die('expected stream provider')
          const freshSubscribed = yield* Deferred.make<void>()
          const eventsFiber = yield* fresh.pipe(
            Stream.mapError(
              (cause) => new StreamProbeError({ cause, message: 'stream probe failed' }),
            ),
            Stream.tap(() => Deferred.succeed(freshSubscribed, undefined)),
            Stream.take(2),
            Stream.runCollect,
            Effect.forkScoped,
          )
          yield* Deferred.await(freshSubscribed)
          nextEvent.resolve({ _tag: 'Changed', cursor: 'cursor-new', value: 'new' })
          const events = yield* Fiber.join(eventsFiber)
          expect(events[1]).toEqual({ _tag: 'Changed', cursor: 'cursor-new', value: 'new' })
        }).pipe(Effect.scoped),
      )
    } finally {
      await manager.close()
      rmSync(harness.root, { recursive: true, force: true })
    }
  })
})
