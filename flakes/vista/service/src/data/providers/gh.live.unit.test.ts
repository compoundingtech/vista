import { describe, expect, it } from '@effect/vitest'
import { GhError, type CheckEvent } from '@vista/blocks/internal/provider-contracts'
import { Context, Effect, Layer, Stream } from 'effect'
import * as KeyValueStore from 'effect/persistence/KeyValueStore'

import { makeProviderBudget, makeSubscriptionHub } from '../live-hub.ts'
import { materializeProvider } from '../provider.ts'
import { GhCommandFixture, ghFixtureCalls } from './gh.fixture.ts'
import { makeGhProvider } from './gh.provider.ts'

const makeLiveProvider = Effect.gen(function* () {
  const storeContext = yield* Layer.build(KeyValueStore.layerMemory)
  const store = Context.get(storeContext, KeyValueStore.KeyValueStore)
  const budget = yield* makeProviderBudget()
  const hub = yield* makeSubscriptionHub({
    appVersionId: 'test/gh/live',
    store,
    budget,
    idleTimeToLive: '10 millis',
  })
  return yield* materializeProvider(makeGhProvider(GhCommandFixture), hub, budget)
})
const typedGhError = (cause: unknown): GhError =>
  cause instanceof GhError ? cause : new GhError({ message: String(cause) })

const checksStream = (
  provider: Effect.Success<typeof makeLiveProvider>,
  args: { readonly repo: string; readonly pr: number },
) =>
  (
    provider.core.checksStream as unknown as (args: {
      readonly repo: string
      readonly pr: number
    }) => Stream.Stream<CheckEvent, unknown>
  )(args).pipe(Stream.mapError(typedGhError))

describe('GitHub checks live polling', () => {
  it.effect('deduplicates identical repo/PR subscriptions through the hub key', () =>
    Effect.gen(function* () {
      Reflect.set(globalThis, ghFixtureCalls, 0)
      const provider = yield* makeLiveProvider
      const results = yield* Effect.all(
        Array.from({ length: 6 }, () =>
          checksStream(provider, { repo: 'schickling/dotfiles', pr: 2935 }).pipe(
            Stream.take(1),
            Stream.runCollect,
          ),
        ),
        { concurrency: 'unbounded' },
      )

      expect(results.every((events) => events[0]?._tag === 'Synced')).toBe(true)
      expect(Reflect.get(globalThis, ghFixtureCalls)).toBe(5)
    }).pipe(Effect.scoped),
  )

  it.effect('admits six checks subscribers without exceeding the shared 20-call minute', () =>
    Effect.gen(function* () {
      Reflect.set(globalThis, ghFixtureCalls, 0)
      const provider = yield* makeLiveProvider
      const results = yield* Effect.all(
        Array.from({ length: 6 }, (_, index) =>
          checksStream(provider, { repo: 'schickling/dotfiles', pr: 3_000 + (index % 4) }).pipe(
            Stream.take(1),
            Stream.runCollect,
          ),
        ),
        { concurrency: 'unbounded' },
      )

      expect(results.every((events) => events[0]?._tag === 'Synced')).toBe(true)
      expect(Reflect.get(globalThis, ghFixtureCalls)).toBe(20)
    }).pipe(Effect.scoped),
  )
})
