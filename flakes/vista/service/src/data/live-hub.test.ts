import { describe, expect, it } from '@effect/vitest'
import { contract, Cursor, subscription } from '@vista/blocks/internal/data-contract'
import { Context, Deferred, Effect, Exit, Fiber, Layer, Option, Schema, Stream } from 'effect'
import * as KeyValueStore from 'effect/persistence/KeyValueStore'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { TestClock } from 'effect/testing'

import { makeSubscriptionHub, type LiveDriver } from './live-hub.ts'

const State = Schema.Struct({ cursor: Cursor, value: Schema.String })
type State = typeof State.Type
const Event = Schema.Union([
  Schema.TaggedStruct('Synced', { state: State }),
  Schema.TaggedStruct('Changed', { cursor: Cursor, value: Schema.String }),
])
type Event = typeof Event.Type
const Api = RpcGroup.make(
  Rpc.make('watch', {
    payload: { id: Schema.String, since: Schema.optionalKey(Cursor) },
    success: Event,
    error: Schema.String,
    stream: true,
  }),
)
const base = contract({ id: 'lifecycle-test', group: Api })
const watch = subscription(base.ops.watch, {
  stateSchema: State,
  eventSchema: Event,
  fold: (_state, event) =>
    event._tag === 'Synced' ? event.state : { cursor: event.cursor, value: event.value },
  cursor: (state) => state.cursor,
})
const args = { id: 'shared' }

const state = (value: string): State => ({ cursor: `cursor-${value}`, value })
const changed = (value: string): Event => ({
  _tag: 'Changed',
  cursor: `cursor-${value}`,
  value,
})
const driver = (
  value: string,
  stream: Stream.Stream<Event, string> = Stream.never,
): LiveDriver<typeof args, State, Event, string> => ({
  _tag: 'subscribable',
  initial: () => Effect.succeed(state(value)),
  stream: () => stream,
})

const ArrayState = Schema.Array(Schema.String)
type ArrayState = typeof ArrayState.Type
const ArrayEvent = Schema.TaggedStruct('Synced', { state: ArrayState })
type ArrayEvent = typeof ArrayEvent.Type
const ArrayApi = RpcGroup.make(
  Rpc.make('watchArray', {
    payload: { id: Schema.String, since: Schema.optionalKey(Cursor) },
    success: ArrayEvent,
    error: Schema.String,
    stream: true,
  }),
)
const arrayBase = contract({ id: 'otel', group: ArrayApi })
const watchArray = subscription(arrayBase.ops.watchArray, {
  stateSchema: ArrayState,
  eventSchema: ArrayEvent,
  fold: (_state, event) => event.state,
  cursor: (value) => value.at(-1) ?? '',
})

const makeHub = Effect.gen(function* () {
  const storeContext = yield* Layer.build(KeyValueStore.layerMemory)
  const store = Context.get(storeContext, KeyValueStore.KeyValueStore)
  return yield* makeSubscriptionHub({
    appVersionId: 'test/live-hub/lifecycle',
    store,
    idleTimeToLive: 0,
  })
})

describe('subscription hub lifecycle', () => {
  it.effect('removes a binding after failed acquisition so a retry can recover', () =>
    Effect.gen(function* () {
      const hub = yield* makeHub
      const failed = yield* hub
        .subscribe(watch, args, {
          _tag: 'subscribable',
          initial: () => Effect.fail('first acquisition failed'),
          stream: () => Stream.never,
        })
        .pipe(Stream.runHead, Effect.exit)

      expect(Exit.isFailure(failed)).toBe(true)
      const recovered = yield* hub.subscribe(watch, args, driver('recovered')).pipe(Stream.runHead)
      expect(Option.getOrUndefined(recovered)).toEqual({
        _tag: 'Synced',
        state: state('recovered'),
      })
    }).pipe(Effect.scoped),
  )

  it.effect('removes an evicted binding instead of retaining its old driver', () =>
    Effect.gen(function* () {
      const hub = yield* makeHub
      const oldEvent = yield* Deferred.make<Event>()
      yield* hub
        .subscribe(watch, args, driver('old', Stream.fromEffect(Deferred.await(oldEvent))))
        .pipe(Stream.take(1), Stream.runDrain)

      const newEvent = yield* Deferred.make<Event>()
      const subscribed = yield* Deferred.make<void>()
      const eventsFiber = yield* hub
        .subscribe(watch, args, driver('new', Stream.fromEffect(Deferred.await(newEvent))))
        .pipe(
          Stream.tap(() => Deferred.succeed(subscribed, undefined)),
          Stream.take(2),
          Stream.runCollect,
          Effect.forkScoped,
        )
      yield* Deferred.await(subscribed)
      yield* Deferred.succeed(oldEvent, changed('old-driver'))
      yield* Deferred.succeed(newEvent, changed('new-driver'))
      const events = yield* Fiber.join(eventsFiber)

      expect(events[1]).toEqual(changed('new-driver'))
    }).pipe(Effect.scoped),
  )

  it.effect('distinguishes an array-valued polled state from an event batch', () =>
    Effect.gen(function* () {
      const hub = yield* makeHub
      const eventsFiber = yield* hub
        .subscribe(watchArray, args, {
          _tag: 'pollable',
          initial: () => Effect.succeed<ArrayState>(['initial']),
          poll: () =>
            Effect.succeed({
              _tag: 'state' as const,
              state: ['next'],
            }),
          interval: { min: '1 millis', max: '1 millis' },
        })
        .pipe(Stream.take(2), Stream.runCollect, Effect.forkScoped)
      yield* TestClock.adjust('1 millis')
      const events = yield* Fiber.join(eventsFiber)

      expect(events[1]).toEqual({ _tag: 'Synced', state: ['next'] })
    }).pipe(Effect.scoped),
  )

  it.effect('retires an active provider generation and never reuses its driver', () =>
    Effect.gen(function* () {
      const hub = yield* makeHub
      const oldGeneration = hub.providerGeneration('lifecycle-test')
      const subscribed = yield* Deferred.make<void>()
      const oldFiber = yield* oldGeneration.hub.subscribe(watch, args, driver('old')).pipe(
        Stream.tap(() => Deferred.succeed(subscribed, undefined)),
        Stream.runDrain,
        Effect.forkScoped,
      )
      yield* Deferred.await(subscribed)

      yield* oldGeneration.retire
      const oldExit = yield* Fiber.await(oldFiber)
      expect(Exit.isFailure(oldExit)).toBe(true)

      const newGeneration = hub.providerGeneration('lifecycle-test')
      const newEvent = yield* Deferred.make<Event>()
      const newSubscribed = yield* Deferred.make<void>()
      const eventsFiber = yield* newGeneration.hub
        .subscribe(watch, args, driver('new', Stream.fromEffect(Deferred.await(newEvent))))
        .pipe(
          Stream.tap(() => Deferred.succeed(newSubscribed, undefined)),
          Stream.take(2),
          Stream.runCollect,
          Effect.forkScoped,
        )
      yield* Deferred.await(newSubscribed)
      yield* Deferred.succeed(newEvent, changed('new-driver'))
      const events = yield* Fiber.join(eventsFiber)
      expect(events[1]).toEqual(changed('new-driver'))
    }).pipe(Effect.scoped),
  )

  it.effect('waits for an active stream before retiring the whole version hub', () =>
    Effect.gen(function* () {
      const hub = yield* makeHub
      const subscribed = yield* Deferred.make<void>()
      const streamFiber = yield* hub.subscribe(watch, args, driver('active')).pipe(
        Stream.tap(() => Deferred.succeed(subscribed, undefined)),
        Stream.runDrain,
        Effect.forkScoped,
      )
      yield* Deferred.await(subscribed)

      const retirement = yield* hub.retire.pipe(Effect.forkScoped)
      expect(retirement.pollUnsafe()).toBeUndefined()

      yield* Fiber.interrupt(streamFiber)
      yield* Fiber.join(retirement)
    }).pipe(Effect.scoped),
  )
})
