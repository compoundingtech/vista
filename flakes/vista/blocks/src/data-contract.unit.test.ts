import { Context, Effect, Exit, Layer, Schema } from 'effect'
import { FetchHttpClient, HttpRouter } from 'effect/http'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcClient from 'effect/rpc/RpcClient'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { layerJson } from 'effect/rpc/RpcSerialization'
import * as RpcServer from 'effect/rpc/RpcServer'
import { describe, expect, it } from 'vitest'

import {
  bind,
  contract,
  Cursor,
  encodeBinding,
  flatMapEdge,
  mappedAtomKey,
  Operation,
  projectMappedSourceValue,
  readSnapshotBinding,
  snapshotKey,
  type Snapshot,
  subscription,
} from './data-contract.ts'
import { classifyPublishedSnapshot } from './data-query.tsx'
import { agentTimeline } from './provider-contracts.ts'

const ItemId = Schema.String.pipe(Schema.brand('ItemId'))
const Args = Schema.Struct({
  id: ItemId,
  at: Schema.DateFromString,
  nested: Schema.Struct({ second: Schema.Finite, first: Schema.Finite }),
})
const TestApi = RpcGroup.make(Rpc.make('read', {
  payload: Args,
  success: Schema.String,
}))
const testProvider = contract({ id: 'test', group: TestApi })
const CommandApi = RpcGroup.make(Rpc.make('mutate', {
  payload: Schema.Struct({ value: Schema.String }),
  success: Schema.Void,
}))
const commandProvider = contract({
  id: 'command-test',
  group: CommandApi,
  commands: ['mutate'] as const,
})

const SubscriptionState = Schema.Struct({
  cursor: Schema.String,
  count: Schema.Finite,
})
const SubscriptionEvent = Schema.Union([
  Schema.TaggedStruct('Synced', {
    state: SubscriptionState,
  }),
  Schema.TaggedStruct('Incremented', {
    cursor: Schema.String,
    by: Schema.Finite,
  }),
])
const SubscriptionApi = RpcGroup.make(Rpc.make('watch', {
  payload: {
    id: Schema.String,
    since: Schema.optionalKey(Cursor),
  },
  success: SubscriptionEvent,
  error: Schema.String,
  stream: true,
}))
const subscriptionProvider = contract({ id: 'subscription-test', group: SubscriptionApi })
const watch = subscription(subscriptionProvider.ops.watch, {
  stateSchema: SubscriptionState,
  eventSchema: SubscriptionEvent,
  fold: (state, event) => event._tag === 'Synced'
    ? event.state
    : { cursor: event.cursor, count: state.count + event.by },
  cursor: (state) => state.cursor,
})

const at = new Date('2026-09-19T12:00:00.000Z')

const ProjectionArgs = Schema.Struct({
  id: ItemId,
  at: Schema.DateFromString,
  nested: Schema.Struct({ second: Schema.Finite, first: Schema.Finite }),
  suffix: Schema.String,
})
const projectedRead = Operation.map(testProvider.ops.read, {
  id: 'test.projected-read',
  payloadSchema: ProjectionArgs,
  successSchema: Schema.String,
  mapArgs: ({ suffix: _suffix, ...args }) => args,
  map: (source, args) => `${source}${args.suffix}`,
})
const dependentProjectedRead = Operation.flatMap(
  projectedRead,
  () => bind(testProvider.ops.read, {
    id: ItemId.make('child'),
    at,
    nested: { first: 1, second: 2 },
  }),
  { id: 'test.dependent-projected-read/v1', successSchema: Schema.String },
)
const dependentRead = Operation.flatMap(
  testProvider.ops.read,
  () => bind(testProvider.ops.read, {
    id: ItemId.make('child'),
    at,
    nested: { first: 1, second: 2 },
  }),
  { id: 'test.dependent-read/v1', successSchema: Schema.String },
)

const encode = (args: typeof Args.Type) => Effect.runPromise(
  encodeBinding(bind(testProvider.ops.read, args)),
)

describe('data contract', () => {
  it('marks command operations live-only and rejects binding them', () => {
    expect(commandProvider.ops.mutate).toMatchObject({ kind: 'command', capture: 'never' })
    expect(() =>
      bind(
        commandProvider.ops.mutate as unknown as Operation<'mutate', { value: string }, void, never>,
        { value: 'not-captured' },
      )).toThrow('cannot be bound')
  })

  it('rejects non-positive live refresh durations when binding', () => {
    const args = {
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    }
    expect(() => bind(testProvider.ops.read, args, {
      mode: 'live',
      refreshEvery: 0,
    })).toThrow()
    expect(() => bind(testProvider.ops.read, args, {
      mode: 'live',
      refreshEvery: -1,
    })).toThrow()
    expect(bind(testProvider.ops.read, args, {
      mode: 'live',
      refreshEvery: 1,
    }).policy).toEqual({ mode: 'live', refreshEvery: 1 })
  })

  it('keeps snapshot digests stable across object key order', async () => {
    const first = await encode({
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    })
    const second = await encode({
      nested: { second: 2, first: 1 },
      at,
      id: ItemId.make('item-1'),
    })

    expect(first.key).toBe(second.key)
    expect(first.key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses schema encoding for dates, brands, and transforms before hashing', async () => {
    const encoded = await encode({
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    })

    expect(encoded.encodedArgs).toEqual({
      id: 'item-1',
      at: '2026-09-19T12:00:00.000Z',
      nested: { first: 1, second: 2 },
    })
  })

  it('reads retained timeline seeds without changing canonical keys or immutable snapshots', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const args = { horizon: '1h' as const }
      const binding = bind(agentTimeline.ops.load, args)
      const { key } = yield* encodeBinding(binding)
      const previousKey = yield* snapshotKey(
        { ...agentTimeline.ops.load, providerId: 'agent-trace' },
        args,
      )
      const previous = {
        provider: 'agent-trace',
        operation: 'load',
        encodedArgs: args,
        encodedValue: { retained: true },
        capturedAt: '2026-10-10T00:00:00.000Z',
      }
      const snapshot: Snapshot = {
        apiVersion: 2,
        frozenAt: previous.capturedAt,
        entries: { [previousKey]: previous },
      }
      const resolved = yield* readSnapshotBinding(snapshot, binding)
      expect(resolved.key).toBe(key)
      expect(resolved.entry).toEqual({ ...previous, provider: agentTimeline.id })
      expect(snapshot.entries[previousKey]).toBe(previous)
      expect(previous.provider).toBe('agent-trace')

      const current = { ...previous, provider: agentTimeline.id, encodedValue: { current: true } }
      const both = { ...snapshot, entries: { ...snapshot.entries, [key]: current } }
      expect((yield* readSnapshotBinding(both, binding)).entry).toBe(current)
      expect((yield* readSnapshotBinding({ ...snapshot, entries: {} }, binding)).entry).toBeUndefined()
      expect(yield* encodeBinding(binding)).toEqual({ key, encodedArgs: args })
    }))
  })

  it('strictly rejects excess snapshot and entry properties', () => {
    const entry = {
      provider: 'test',
      operation: 'read',
      encodedArgs: {},
      encodedValue: 'value',
      capturedAt: '2026-09-19T12:00:00.000Z',
    }
    const key = '0'.repeat(64)
    const snapshot = {
      apiVersion: 2,
      frozenAt: '2026-09-19T12:00:00.000Z',
      entries: { [key]: entry },
    }
    const malformed = { _tag: 'unsupported', reason: 'malformed' }

    expect(classifyPublishedSnapshot(snapshot)).toMatchObject({ _tag: 'frozen' })
    expect(classifyPublishedSnapshot({ ...snapshot, extra: true })).toEqual(malformed)
    expect(classifyPublishedSnapshot({
      ...snapshot,
      entries: { [key]: { ...entry, extra: true } },
    })).toEqual(malformed)
  })

  it('rejects an excess request property at the server RPC boundary', async () => {
    const LooseApi = RpcGroup.make(Rpc.make('read', {
      payload: Schema.Unknown,
      success: Schema.String,
    }))
    let calls = 0
    const handler = HttpRouter.toWebHandler(
      RpcServer.layerHttp({
        group: testProvider.group,
        path: '/rpc',
        protocol: 'http',
      }).pipe(
        Layer.provide(Layer.mergeAll(
          testProvider.group.toLayer({
            read: ({ id }) => Effect.sync(() => {
              calls += 1
              return id
            }),
          }),
          layerJson,
          HttpRouter.layer,
        )),
      ),
      { disableLogger: true },
    )
    const originalFetch = globalThis.fetch
    globalThis.fetch = (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      return handler.handler(request, Context.empty())
    }

    try {
      const exit = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(LooseApi)
          return yield* Effect.exit(client.read({
            id: 'item-1',
            at: '2026-09-19T12:00:00.000Z',
            nested: { first: 1, second: 2 },
            excess: true,
          }))
        }).pipe(
          Effect.provide(
            RpcClient.layerProtocolHttp({ url: 'http://vista.test/rpc' }).pipe(
              Layer.provide(layerJson),
              Layer.provide(FetchHttpClient.layer),
            ),
          ),
          Effect.scoped,
        ),
      )

      expect(Exit.isFailure(exit)).toBe(true)
      expect(calls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
      await handler.dispose()
    }
  })

  it('folds the same subscription event sequence deterministically', () => {
    const initial = { cursor: 'cursor-0', count: 0 }
    const events: ReadonlyArray<typeof SubscriptionEvent.Type> = [
      { _tag: 'Incremented', cursor: 'cursor-1', by: 2 },
      { _tag: 'Incremented', cursor: 'cursor-2', by: 3 },
      { _tag: 'Synced', state: { cursor: 'cursor-3', count: 8 } },
    ]
    const fold = () => events.reduce(watch.fold, initial)

    expect(fold()).toEqual({ cursor: 'cursor-3', count: 8 })
    expect(fold()).toEqual(fold())
  })

  it('excludes the reconnect since hint from subscription keys', async () => {
    const first = await Effect.runPromise(encodeBinding(bind(
      watch,
      { id: 'item-1', since: 'cursor-1' },
      { mode: 'subscription' },
    )))
    const second = await Effect.runPromise(encodeBinding(bind(
      watch,
      { id: 'item-1', since: 'cursor-99' },
      { mode: 'subscription' },
    )))
    const undefinedSinceArgs = { id: 'item-1' }
    Reflect.set(undefinedSinceArgs, 'since', undefined)
    const undefinedSince = await Effect.runPromise(encodeBinding(bind(
      watch,
      undefinedSinceArgs,
      { mode: 'subscription' },
    )))

    expect(first.encodedArgs).toEqual({ id: 'item-1' })
    expect(undefinedSince.encodedArgs).toEqual({ id: 'item-1' })
    expect(first.key).toBe(second.key)
    expect(first.key).toBe(undefinedSince.key)
  })

  it('strictly decodes subscription events, including Synced state', () => {
    expect(() => Schema.decodeSync(watch.eventSchema)({
      _tag: 'Incremented',
      cursor: 'cursor-1',
      by: 1,
      extra: true,
    }, { onExcessProperty: 'error' })).toThrow()
    expect(() => Schema.decodeSync(watch.eventSchema)({
      _tag: 'Synced',
      state: { cursor: 'cursor-1', count: 1, extra: true },
    }, { onExcessProperty: 'error' })).toThrow()
  })

  it('inherits the source snapshot key while separating mapped atom arguments', async () => {
    const base = {
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    }
    const first = bind(projectedRead, { ...base, suffix: '-one' })
    const second = bind(projectedRead, { ...base, suffix: '-two' })
    const source = bind(testProvider.ops.read, base)

    expect((await Effect.runPromise(encodeBinding(first))).key).toBe(
      (await Effect.runPromise(encodeBinding(source))).key,
    )
    expect(await Effect.runPromise(mappedAtomKey(first))).not.toBe(
      await Effect.runPromise(mappedAtomKey(second)),
    )
  })

  it('includes canonical policy only in mapped runtime identity', async () => {
    const args = {
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
      suffix: '-projected',
    }
    const frozen = bind(projectedRead, args)
    const live = bind(projectedRead, args, {
      mode: 'live',
      refreshEvery: 1_000,
      effectfulCapture: 'acknowledged',
    })
    const reorderedLive = bind(projectedRead, args, {
      effectfulCapture: 'acknowledged',
      refreshEvery: 1_000,
      mode: 'live',
    })

    expect((await Effect.runPromise(encodeBinding(frozen))).key).toBe(
      (await Effect.runPromise(encodeBinding(live))).key,
    )
    expect(await Effect.runPromise(mappedAtomKey(frozen))).not.toBe(
      await Effect.runPromise(mappedAtomKey(live)),
    )
    expect(await Effect.runPromise(mappedAtomKey(live))).toBe(
      await Effect.runPromise(mappedAtomKey(reorderedLive)),
    )
  })

  it('keys flatMap edges only by the parent key and stable transform id', async () => {
    const args = {
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    }
    const binding = bind(dependentRead, args)
    const parent = await Effect.runPromise(encodeBinding(bind(testProvider.ops.read, args)))
    const edge = await Effect.runPromise(flatMapEdge(binding))

    expect((await Effect.runPromise(encodeBinding(binding))).key).toBe(parent.key)
    expect(edge).toBe(`${parent.key}::flatMap::test.dependent-read/v1`)
  })

  it('includes mapped parent arguments in flatMap edge identity', async () => {
    const base = {
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    }
    const first = bind(dependentProjectedRead, { ...base, suffix: '-one' })
    const second = bind(dependentProjectedRead, { ...base, suffix: '-two' })

    expect((await Effect.runPromise(encodeBinding(first))).key).toBe(
      (await Effect.runPromise(encodeBinding(second))).key,
    )
    expect(await Effect.runPromise(flatMapEdge(first))).not.toBe(
      await Effect.runPromise(flatMapEdge(second)),
    )
  })

  it('discovers flatMap beneath map and projects mapped parents before selection', async () => {
    const args = {
      id: ItemId.make('item-1'),
      at,
      nested: { first: 1, second: 2 },
    }
    const mappedDependent = Operation.map(dependentRead, {
      id: 'test.mapped-dependent/v1',
      payloadSchema: Args,
      successSchema: Schema.String,
      mapArgs: (value) => value,
      map: (value) => value,
    })
    const parent = await Effect.runPromise(encodeBinding(bind(testProvider.ops.read, args)))
    expect(await Effect.runPromise(flatMapEdge(bind(mappedDependent, args)))).toBe(
      `${parent.key}::flatMap::test.dependent-read/v1`,
    )

    const mappedParent = Operation.map(testProvider.ops.read, {
      id: 'test.mapped-parent/v1',
      payloadSchema: Args,
      successSchema: Schema.String,
      mapArgs: (value) => value,
      map: (value) => `${value}-mapped`,
    })
    expect(projectMappedSourceValue(mappedParent, args, 'parent')).toBe('parent-mapped')
    expect(() =>
      Operation.flatMap(
        dependentRead,
        () => bind(testProvider.ops.read, args),
        { id: 'test.nested-flat-map/v1', successSchema: Schema.String },
      ),
    ).toThrow(/cannot contain another flatMap dependency/u)
  })
})
