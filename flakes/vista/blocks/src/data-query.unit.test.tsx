import { Cause, Context, Effect, Layer, Metric, Option, Schema, Stream } from 'effect'
import { HttpRouter } from 'effect/http'
import * as AsyncResult from 'effect/reactivity/AsyncResult'
import * as Hydration from 'effect/reactivity/Hydration'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { layerJson, layerNdjson } from 'effect/rpc/RpcSerialization'
import * as RpcServer from 'effect/rpc/RpcServer'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppRoot, Evidence, extractSemanticManifest } from './authoring.tsx'
import {
  bind,
  type BindingPolicy,
  contract,
  type DataBinding,
  encodeBinding,
  Operation,
  type Snapshot,
  SchemaMismatch,
  subscription,
} from './data-contract.ts'
import {
  availableValue,
  bindingFailureMessage,
  classifyPublishedSnapshot,
  effectiveRefreshEvery,
  BindingFailureDiagnostic,
  makeDataRuntime,
  type BindingAtom,
  type BindingResult,
  type DataRuntime,
  type DataRuntimeOptions,
  type DataVisibility,
  type Resolved,
  useBinding,
  useBindingSuspense,
  useRefresh,
} from './data-query.tsx'

describe('provider-safe refresh cadence', () => {
  it('clamps author cadence at each provider safety floor', () => {
    expect(effectiveRefreshEvery('agent-timeline', 1_000)).toBe(60_000)
    expect(effectiveRefreshEvery('gh', 1_000)).toBe(30_000)
    expect(effectiveRefreshEvery('otel', 1_000)).toBe(10_000)
    expect(effectiveRefreshEvery('omp-usage', 10_000)).toBe(60_000)
    expect(effectiveRefreshEvery('test', 10)).toBe(10)
  })
})

const Value = Schema.Struct({ label: Schema.String, count: Schema.Finite })
const ServerValue = Schema.Struct({
  label: Schema.String,
  count: Schema.Finite,
  extra: Schema.Boolean,
})
const ClientApi = RpcGroup.make(
  Rpc.make('read', {
    payload: { id: Schema.String },
    success: Value,
  }),
)
const MismatchServerApi = RpcGroup.make(
  Rpc.make('read', {
    payload: { id: Schema.String },
    success: ServerValue,
  }),
)
const client = contract({ id: 'test', group: ClientApi })
const MappedArgs = Schema.Struct({ id: Schema.String, suffix: Schema.String })
const mappedRead = Operation.map(client.ops.read, {
  id: 'test.mapped-read',
  payloadSchema: MappedArgs,
  successSchema: Value,
  mapArgs: ({ id }) => ({ id }),
  map: (value, { suffix }) => ({ ...value, label: `${value.label}${suffix}` }),
})
const dependentRead = Operation.flatMap(
  client.ops.read,
  (value) => bind(client.ops.read, { id: value.label }),
  { id: 'test.dependent-read/v1', successSchema: Value },
)
const dependentMappedRead = Operation.flatMap(
  mappedRead,
  (value) => bind(client.ops.read, { id: value.label }),
  { id: 'test.dependent-mapped-read/v1', successSchema: Value },
)

const SubscriptionState = Schema.Struct({
  cursor: Schema.String,
  count: Schema.Finite,
  label: Schema.String,
})
const SubscriptionEvent = Schema.Union([
  Schema.TaggedStruct('Synced', {
    state: SubscriptionState,
  }),
  Schema.TaggedStruct('Incremented', {
    cursor: Schema.String,
    label: Schema.String,
  }),
])
const SubscriptionApi = RpcGroup.make(
  Rpc.make('watch', {
    payload: {
      id: Schema.String,
      since: Schema.optionalKey(Schema.String),
    },
    success: SubscriptionEvent,
    error: Schema.String,
    stream: true,
  }),
)
const subscriptionBase = contract({ id: 'subscription-test', group: SubscriptionApi })
const watch = subscription(subscriptionBase.ops.watch, {
  stateSchema: SubscriptionState,
  eventSchema: SubscriptionEvent,
  fold: (state, event) =>
    event._tag === 'Synced'
      ? event.state
      : { cursor: event.cursor, count: state.count + 1, label: event.label },
  cursor: (state) => state.cursor,
})
type SubscriptionState = typeof SubscriptionState.Type

const MismatchSubscriptionEvent = Schema.TaggedStruct('Incremented', {
  cursor: Schema.String,
  label: Schema.String,
  extra: Schema.Boolean,
})
const MismatchSubscriptionApi = RpcGroup.make(
  Rpc.make('watch', {
    payload: {
      id: Schema.String,
      since: Schema.optionalKey(Schema.String),
    },
    success: MismatchSubscriptionEvent,
    error: Schema.String,
    stream: true,
  }),
)

type Value = typeof Value.Type

const counters = new Map<string, number>()

const liveLayer = (namespace: string, delay = 0) =>
  ClientApi.toLayer({
    read: ({ id }) =>
      Effect.sleep(delay).pipe(
        Effect.andThen(
          Effect.sync(() => {
            const key = `${namespace}:${id}`
            const count = (counters.get(key) ?? 0) + 1
            counters.set(key, count)
            return { label: namespace, count }
          }),
        ),
      ),
  })

const buildLiveHandler = (
  namespace: string,
  path: '/a/test' | '/b/test' | '/slow/test',
  delay = 0,
) =>
  HttpRouter.toWebHandler(
    RpcServer.layerHttp({ group: ClientApi, path, protocol: 'http' }).pipe(
      Layer.provide(Layer.mergeAll(liveLayer(namespace, delay), layerJson, HttpRouter.layer)),
    ),
    { disableLogger: true },
  )

const mismatchHandler = HttpRouter.toWebHandler(
  RpcServer.layerHttp({ group: MismatchServerApi, path: '/mismatch/test', protocol: 'http' }).pipe(
    Layer.provide(
      Layer.mergeAll(
        MismatchServerApi.toLayer({
          read: () => Effect.succeed({ label: 'invalid live', count: 1, extra: true }),
        }),
        layerJson,
        HttpRouter.layer,
      ),
    ),
  ),
  { disableLogger: true },
)

const subscriptionRequests: Array<{
  readonly namespace: string
  readonly id: string
  readonly since: string | undefined
}> = []
const subscriptionCounts = new Map<string, number>()
const subscriptionCloses = new Map<string, number>()
const buildSubscriptionHandler = (
  namespace: string,
  path: '/sub-a/subscription-test' | '/sub-b/subscription-test',
) =>
  HttpRouter.toWebHandler(
    RpcServer.layerHttp({ group: SubscriptionApi, path, protocol: 'http' }).pipe(
      Layer.provide(
        Layer.mergeAll(
          SubscriptionApi.toLayer({
            watch: ({ id, since }) => {
              subscriptionRequests.push({ namespace, id, since })
              const requestKey = `${namespace}:${id}`
              const count = (subscriptionCounts.get(requestKey) ?? 0) + 1
              subscriptionCounts.set(requestKey, count)
              return Stream.concat(
                Stream.fromEffect(
                  Effect.sleep('20 millis').pipe(
                    Effect.as({
                      _tag: 'Incremented' as const,
                      cursor: `${namespace.toLowerCase()}-cursor-${count}`,
                      label: namespace,
                    }),
                  ),
                ),
                Stream.never,
              ).pipe(
                Stream.ensuring(
                  Effect.sync(() => {
                    subscriptionCloses.set(
                      requestKey,
                      (subscriptionCloses.get(requestKey) ?? 0) + 1,
                    )
                  }),
                ),
              )
            },
          }),
          layerNdjson,
          HttpRouter.layer,
        ),
      ),
    ),
    { disableLogger: true },
  )

const subscriptionMismatchHandler = HttpRouter.toWebHandler(
  RpcServer.layerHttp({
    group: MismatchSubscriptionApi,
    path: '/sub-mismatch/subscription-test',
    protocol: 'http',
  }).pipe(
    Layer.provide(
      Layer.mergeAll(
        MismatchSubscriptionApi.toLayer({
          watch: () =>
            Stream.make({
              _tag: 'Incremented' as const,
              cursor: 'invalid-cursor',
              label: 'invalid',
              extra: true,
            }),
        }),
        layerNdjson,
        HttpRouter.layer,
      ),
    ),
  ),
  { disableLogger: true },
)
const handlers = {
  a: buildLiveHandler('A', '/a/test'),
  b: buildLiveHandler('B', '/b/test'),
  slow: buildLiveHandler('Slow', '/slow/test', 50),
  mismatch: mismatchHandler,
  subA: buildSubscriptionHandler('A', '/sub-a/subscription-test'),
  subB: buildSubscriptionHandler('B', '/sub-b/subscription-test'),
  subMismatch: subscriptionMismatchHandler,
}

const originalFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const segment = new URL(request.url).pathname.split('/')[1]
    if (segment === 'down') return Promise.resolve(new Response(undefined, { status: 503 }))
    const handler =
      segment === 'a'
        ? handlers.a
        : segment === 'b'
          ? handlers.b
          : segment === 'slow'
            ? handlers.slow
            : segment === 'sub-a'
              ? handlers.subA
              : segment === 'sub-b'
                ? handlers.subB
                : segment === 'sub-mismatch'
                  ? handlers.subMismatch
                  : handlers.mismatch
    return handler.handler(request, Context.empty())
  }
})

afterAll(async () => {
  globalThis.fetch = originalFetch
  await Promise.all(Object.values(handlers).map(({ dispose }) => dispose()))
})

const frozenAt = '2026-09-19T12:00:00.000Z'

const makeSnapshot = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
  value: TValue,
): Snapshot => {
  const { encodedArgs, key } = Effect.runSync(encodeBinding(binding))
  return {
    apiVersion: 2,
    frozenAt,
    entries: {
      [key]: {
        provider: binding.operation.providerId,
        operation: binding.operation.tag,
        encodedArgs,
        encodedValue: Schema.encodeSync(binding.operation.successSchema)(value),
        capturedAt: frozenAt,
      },
    },
  }
}

class TestVisibility implements DataVisibility {
  readonly target = new EventTarget()
  private visible = true
  readonly isVisible = (): boolean => this.visible

  setVisible(visible: boolean): void {
    this.visible = visible
    this.target.dispatchEvent(new Event('visibilitychange'))
  }
}

describe('published snapshot classification', () => {
  const valid = makeSnapshot(bind(client.ops.read, { id: 'published' }), {
    label: 'frozen',
    count: 1,
  })

  it('accepts only a current strict Snapshot', () => {
    expect(classifyPublishedSnapshot(valid)).toEqual({ _tag: 'frozen', snapshot: valid })
  })

  it('distinguishes version skew from malformed bodies', () => {
    expect(classifyPublishedSnapshot({ apiVersion: 3, payload: {} })).toEqual({
      _tag: 'unsupported',
      reason: 'skew',
      found: 3,
    })
    expect(classifyPublishedSnapshot({ payload: {} })).toEqual({
      _tag: 'unsupported',
      reason: 'malformed',
    })
    expect(classifyPublishedSnapshot({ ...valid, entries: {}, extra: true })).toEqual({
      _tag: 'unsupported',
      reason: 'malformed',
    })
  })
})

const waitFor = <TValue, TError>(
  runtime: DataRuntime,
  atom: BindingAtom<TValue, TError>,
  predicate: (result: BindingResult<TValue, TError>) => boolean,
): Promise<BindingResult<TValue, TError>> => {
  const current = runtime.registry.get(atom)
  if (predicate(current)) return Promise.resolve(current)
  const { promise, reject, resolve } = Promise.withResolvers<BindingResult<TValue, TError>>()
  let unsubscribe: () => void = () => undefined
  const timeout = setTimeout(() => {
    unsubscribe()
    reject(new Error('timed out waiting for atom result'))
  }, 2_000)
  unsubscribe = runtime.registry.subscribe(
    atom,
    (result) => {
      if (!predicate(result)) return
      clearTimeout(timeout)
      unsubscribe()
      resolve(result)
    },
    { immediate: true },
  )
  return promise
}

const runtimes: DataRuntime[] = []
const runtime = (options: DataRuntimeOptions): DataRuntime => {
  const value = makeDataRuntime(options)
  Hydration.hydrate(value.registry, value.hydrationState)
  runtimes.push(value)
  return value
}

afterAll(() => {
  for (const value of runtimes) value.dispose()
})

const extractionBinding = bind(client.ops.read, { id: 'extraction' }, { mode: 'live' })
const RefreshingExtraction = () => {
  useBinding(extractionBinding)
  useRefresh(extractionBinding)
  return null
}

const SuspenseExtraction = () => {
  const resolved: Resolved<Value> = useBindingSuspense(extractionBinding)
  return <span>{resolved._tag}</span>
}

describe('DataRuntime', () => {
  it('keeps companion refresh extraction-safe without duplicating the binding', () => {
    const manifest = extractSemanticManifest(
      <AppRoot title="Refresh extraction" template="architecture-review" scope="test">
        <Evidence id="refresh">
          <RefreshingExtraction />
        </Evidence>
      </AppRoot>,
    )
    const evidence = manifest.nodes.find(({ id }) => id === 'refresh')
    expect(evidence?.bindings).toHaveLength(1)
  })

  it('registers Suspense bindings during semantic extraction without a data runtime', () => {
    const manifest = extractSemanticManifest(
      <AppRoot title="Suspense extraction" template="architecture-review" scope="test">
        <Evidence id="suspense">
          <React.Suspense fallback={null}>
            <SuspenseExtraction />
          </React.Suspense>
        </Evidence>
      </AppRoot>,
    )
    const evidence = manifest.nodes.find(({ id }) => id === 'suspense')
    expect(evidence?.bindings).toEqual([
      expect.objectContaining({
        provider: 'test',
        operation: 'read',
      }),
    ])
  })

  it('hydrates and paints the frozen value synchronously', () => {
    const binding = bind(client.ops.read, { id: 'frozen' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/v1',
      snapshot: makeSnapshot(binding, { label: 'frozen', count: 1 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const result = dataRuntime.registry.get(dataRuntime.atomFor(binding))

    expect(result._tag).toBe('Success')
    expect(availableValue(result)).toEqual({
      _tag: 'Frozen',
      value: { label: 'frozen', count: 1 },
      frozenAt,
    })
  })

  it('preserves the frozen seed after atom cache eviction', () => {
    const binding = bind(client.ops.read, { id: 'remounted-frozen' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/remounted',
      snapshot: makeSnapshot(binding, { label: 'retained seed', count: 42 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const atom = dataRuntime.atomFor(binding)
    const expected = {
      _tag: 'Frozen',
      value: { label: 'retained seed', count: 42 },
      frozenAt,
    }

    expect(availableValue(dataRuntime.registry.get(atom))).toEqual(expected)
    dataRuntime.registry.reset()
    expect(availableValue(dataRuntime.registry.get(atom))).toEqual(expected)
  })

  it('hydrates Operation.map from only the inherited source entry', () => {
    const source = bind(client.ops.read, { id: 'mapped' })
    const binding = bind(mappedRead, { id: 'mapped', suffix: '-projected' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/map',
      snapshot: makeSnapshot(source, { label: 'source', count: 1 }),
      dataBaseUrl: 'http://vista.test/a/',
    })

    expect(availableValue(dataRuntime.registry.get(dataRuntime.atomFor(binding)))?.value).toEqual({
      label: 'source-projected',
      count: 1,
    })
  })

  it('keeps identical frozen and live mapped queries in separate runtime cache entries', async () => {
    const source = bind(client.ops.read, { id: 'mapped-policy' })
    const args = { id: 'mapped-policy', suffix: '-projected' }
    const frozenBinding = bind(mappedRead, args)
    const liveBinding = bind(mappedRead, args, { mode: 'live' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/map-policy',
      snapshot: makeSnapshot(source, { label: 'source', count: 1 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const frozenAtom = dataRuntime.atomFor(frozenBinding)
    const liveAtom = dataRuntime.atomFor(liveBinding)

    expect(frozenAtom).not.toBe(liveAtom)
    expect(availableValue(dataRuntime.registry.get(frozenAtom))?._tag).toBe('Frozen')

    const unmount = dataRuntime.registry.mount(liveAtom)
    try {
      const live = await waitFor(
        dataRuntime,
        liveAtom,
        (result) => availableValue(result)?._tag === 'Live',
      )
      expect(availableValue(live)?.value).toEqual({ label: 'A-projected', count: 1 })
      expect(availableValue(dataRuntime.registry.get(frozenAtom))?._tag).toBe('Frozen')
    } finally {
      unmount()
    }
  })

  it('reconstructs Operation.flatMap child args from frozen parent data', () => {
    const parent = bind(client.ops.read, { id: 'parent' })
    const child = bind(client.ops.read, { id: 'child-id' })
    const parentSnapshot = makeSnapshot(parent, { label: 'child-id', count: 1 })
    const childSnapshot = makeSnapshot(child, { label: 'selected child', count: 2 })
    const snapshot: Snapshot = {
      ...parentSnapshot,
      entries: { ...parentSnapshot.entries, ...childSnapshot.entries },
    }
    const binding = bind(dependentRead, { id: 'parent' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/flat-map',
      snapshot,
      dataBaseUrl: 'http://vista.test/a/',
    })

    expect(availableValue(dataRuntime.registry.get(dataRuntime.atomFor(binding)))?.value).toEqual({
      label: 'selected child',
      count: 2,
    })

    const Bound = () => {
      useBinding(binding)
      return null
    }
    const manifest = extractSemanticManifest(
      <AppRoot title="Dependent" template="architecture-review" scope="test">
        <Evidence id="dependent">
          <Bound />
        </Evidence>
      </AppRoot>,
    )
    const dependency = manifest.nodes.find(({ id }) => id === 'dependent')?.bindings[0]?.dependency
    expect(dependency).toMatchObject({ _tag: 'flatMap', id: 'test.dependent-read/v1' })
    expect(dependency?.edge).toContain('::flatMap::test.dependent-read/v1')
  })

  it('maps a flatMap parent before reconstructing child arguments', () => {
    const parent = bind(client.ops.read, { id: 'parent' })
    const child = bind(client.ops.read, { id: 'child-id-mapped' })
    const parentSnapshot = makeSnapshot(parent, { label: 'child-id', count: 1 })
    const childSnapshot = makeSnapshot(child, { label: 'selected child', count: 2 })
    const snapshot: Snapshot = {
      ...parentSnapshot,
      entries: { ...parentSnapshot.entries, ...childSnapshot.entries },
    }
    const binding = bind(dependentMappedRead, { id: 'parent', suffix: '-mapped' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/mapped-flat-map',
      snapshot,
      dataBaseUrl: 'http://vista.test/a/',
    })

    expect(availableValue(dataRuntime.registry.get(dataRuntime.atomFor(binding)))?.value).toEqual({
      label: 'selected child',
      count: 2,
    })
  })

  it('refreshes a live binding through AtomRpc and Reactivity', async () => {
    const binding = bind(client.ops.read, { id: 'refresh' }, { mode: 'live' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/v1',
      snapshot: makeSnapshot(binding, { label: 'seed', count: 0 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    const first = await waitFor(
      dataRuntime,
      atom,
      (result) =>
        availableValue(result)?._tag === 'Live' && availableValue(result)?.value.count === 1,
    )

    expect(availableValue(first)?.value).toEqual({ label: 'A', count: 1 })
    dataRuntime.registry.refresh(atom)
    const second = await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.count === 2,
    )
    expect(availableValue(second)?.value).toEqual({ label: 'A', count: 2 })
    unmount()
  })
  it('fetches a live binding on mount before its safe cadence expires', async () => {
    const binding = bind(
      client.ops.read,
      { id: 'first-live-paint' },
      { mode: 'live', refreshEvery: 60_000 },
    )
    const dataRuntime = runtime({
      appVersionId: 'owner/app/first-live-paint',
      snapshot: makeSnapshot(binding, { label: 'stale seed', count: 0 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    try {
      expect(availableValue(dataRuntime.registry.get(atom))).toMatchObject({
        _tag: 'Frozen',
        value: { label: 'stale seed', count: 0 },
      })
      const first = await waitFor(
        dataRuntime,
        atom,
        (result) => availableValue(result)?._tag === 'Live',
      )
      expect(availableValue(first)?.value).toEqual({ label: 'A', count: 1 })
      expect(counters.get('A:first-live-paint')).toBe(1)
    } finally {
      unmount()
    }
  })
  it('waits for a slow refresh to settle before scheduling the next cadence', async () => {
    const binding = bind(
      client.ops.read,
      { id: 'serial-refresh' },
      { mode: 'live', refreshEvery: 10 },
    )
    const dataRuntime = runtime({
      appVersionId: 'owner/app/v1',
      snapshot: makeSnapshot(binding, { label: 'seed', count: 0 }),
      dataBaseUrl: 'http://vista.test/slow/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)

    const second = await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.count === 2,
    )

    expect(availableValue(second)?.value).toEqual({ label: 'Slow', count: 2 })
    unmount()
  })
  it('records successful cadenced refreshes at the refresh execution seam', async () => {
    const binding = bind(
      client.ops.read,
      { id: 'cadence-metric' },
      { mode: 'live', refreshEvery: 10 },
    )
    const dataRuntime = runtime({
      appVersionId: 'owner/app/cadence-metric',
      snapshot: makeSnapshot(binding, { label: 'seed', count: 0 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    await waitFor(dataRuntime, atom, (result) => (availableValue(result)?.value.count ?? 0) >= 2)

    const refreshes = await Effect.runPromise(
      Metric.value(
        Metric.withAttributes(
          Metric.counter('vista_data_refreshes', { description: 'vista data refresh attempts' }),
          {
            'app.version.id': 'owner/app/cadence-metric',
            'provider.id': 'test',
            'rpc.tag': 'read',
            'refresh.cadence.ms': '10',
            trigger: 'cadence',
            outcome: 'success',
          },
        ),
      ),
    )
    expect(Number(refreshes.count)).toBeGreaterThanOrEqual(1)
    unmount()
  })
  it('runs frozen and live draft bindings once per mount', async () => {
    const frozenBinding = bind(client.ops.read, { id: 'draft-frozen' })
    const liveBinding = bind(client.ops.read, { id: 'draft-live' }, { mode: 'live' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/draft',
      snapshot: makeSnapshot(frozenBinding, { label: 'ignored in draft', count: 0 }),
      dataBaseUrl: 'http://vista.test/a/',
    })
    const frozenAtom = dataRuntime.atomFor(frozenBinding)
    const liveAtom = dataRuntime.atomFor(liveBinding)

    const unmountFrozen = dataRuntime.registry.mount(frozenAtom)
    const unmountLive = dataRuntime.registry.mount(liveAtom)

    await Promise.all([
      waitFor(dataRuntime, frozenAtom, (result) => availableValue(result)?._tag === 'Live'),
      waitFor(dataRuntime, liveAtom, (result) => availableValue(result)?._tag === 'Live'),
    ])
    await Effect.runPromise(Effect.sleep('50 millis'))

    expect(counters.get('A:draft-frozen')).toBe(1)
    expect(counters.get('A:draft-live')).toBe(1)
    unmountFrozen()
    unmountLive()
  })
  it('paints the subscription snapshot, catches up, then folds NDJSON events live', async () => {
    const binding = bind(watch, { id: 'catch-up' }, { mode: 'subscription' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/subscription-catch-up',
      snapshot: makeSnapshot(binding, { cursor: 'cursor-0', count: 0, label: 'snapshot' }),
      dataBaseUrl: 'http://vista.test/sub-a/',
    })
    const atom = dataRuntime.atomFor(binding)

    expect(availableValue(dataRuntime.registry.get(atom))).toEqual({
      _tag: 'Frozen',
      value: { cursor: 'cursor-0', count: 0, label: 'snapshot' },
      frozenAt,
    })
    const unmount = dataRuntime.registry.mount(atom)
    const catchingUp = await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?._tag === 'CatchingUp',
    )
    expect(availableValue(catchingUp)?.value).toEqual({
      cursor: 'cursor-0',
      count: 0,
      label: 'snapshot',
    })
    const live = await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.cursor === 'a-cursor-1',
    )
    expect(availableValue(live)?.value).toEqual({
      cursor: 'a-cursor-1',
      count: 1,
      label: 'A',
    })
    unmount()
  })

  it('retains the subscription snapshot on a strict event mismatch', async () => {
    const binding = bind(watch, { id: 'stream-mismatch' }, { mode: 'subscription' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/subscription-mismatch',
      snapshot: makeSnapshot(binding, { cursor: 'cursor-0', count: 0, label: 'safe snapshot' }),
      dataBaseUrl: 'http://vista.test/sub-mismatch/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    const result = await waitFor(dataRuntime, atom, (value) => value._tag === 'Failure')

    expect(availableValue(result)?.value).toEqual({
      cursor: 'cursor-0',
      count: 0,
      label: 'safe snapshot',
    })
    if (result._tag !== 'Failure') throw new Error('expected failure')
    expect(Option.getOrThrow(Cause.findErrorOption(result.cause))).toMatchObject({
      _tag: 'SchemaMismatch',
    })
    expect(bindingFailureMessage(result)).toContain(
      'subscription-test.watch returned data that does not match the schema',
    )
    expect(bindingFailureMessage(result)).toContain('["extra"]')
    expect(bindingFailureMessage(result)).not.toContain('data-query.tsx')
    unmount()
  })

  it('retains the subscription snapshot with SubscriptionError when the endpoint is down', async () => {
    const binding = bind(watch, { id: 'endpoint-down' }, { mode: 'subscription' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/subscription-down',
      snapshot: makeSnapshot(binding, { cursor: 'cursor-0', count: 0, label: 'safe snapshot' }),
      dataBaseUrl: 'http://vista.test/down/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    const result = await waitFor(dataRuntime, atom, (value) => value._tag === 'Failure')

    expect(availableValue(result)?.value).toEqual({
      cursor: 'cursor-0',
      count: 0,
      label: 'safe snapshot',
    })
    if (result._tag !== 'Failure') throw new Error('expected failure')
    expect(Option.getOrThrow(Cause.findErrorOption(result.cause))).toMatchObject({
      _tag: 'SubscriptionError',
    })
    unmount()
  })

  it('closes while hidden and reconnects with the last folded cursor', async () => {
    const visibility = new TestVisibility()
    const binding = bind(watch, { id: 'visibility-cycle' }, { mode: 'subscription' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/subscription-visibility',
      snapshot: makeSnapshot(binding, { cursor: 'cursor-0', count: 0, label: 'snapshot' }),
      dataBaseUrl: 'http://vista.test/sub-a/',
      visibility,
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.cursor === 'a-cursor-1',
    )

    visibility.setVisible(false)
    await Effect.runPromise(Effect.sleep('30 millis'))
    expect(subscriptionCloses.get('A:visibility-cycle')).toBe(1)
    visibility.setVisible(true)
    const reconnected = await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.cursor === 'a-cursor-2',
    )

    expect(availableValue(reconnected)?.value.count).toBe(2)
    expect(
      subscriptionRequests
        .filter(({ id, namespace }) => id === 'visibility-cycle' && namespace === 'A')
        .map(({ since }) => since),
    ).toEqual(['cursor-0', 'a-cursor-1'])
    unmount()
  })

  it('uses refresh to reconnect a subscription from its last folded cursor', async () => {
    const binding = bind(watch, { id: 'refresh-subscription' }, { mode: 'subscription' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/subscription-refresh',
      snapshot: makeSnapshot(binding, { cursor: 'cursor-0', count: 0, label: 'snapshot' }),
      dataBaseUrl: 'http://vista.test/sub-a/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.cursor === 'a-cursor-1',
    )

    dataRuntime.registry.refresh(atom)
    const refreshed = await waitFor(
      dataRuntime,
      atom,
      (result) => availableValue(result)?.value.cursor === 'a-cursor-2',
    )

    expect(availableValue(refreshed)?.value.count).toBe(2)
    expect(
      subscriptionRequests
        .filter(({ id, namespace }) => id === 'refresh-subscription' && namespace === 'A')
        .map(({ since }) => since),
    ).toEqual(['cursor-0', 'a-cursor-1'])
    unmount()
  })

  it('isolates subscription streams and cursors across AppVersion runtimes', async () => {
    const binding = bind(watch, { id: 'subscription-isolation' }, { mode: 'subscription' })
    const snapshot = makeSnapshot(binding, { cursor: 'cursor-0', count: 0, label: 'snapshot' })
    const a = runtime({
      appVersionId: 'owner/app/subscription-a',
      snapshot,
      dataBaseUrl: 'http://vista.test/sub-a/',
    })
    const b = runtime({
      appVersionId: 'owner/app/subscription-b',
      snapshot,
      dataBaseUrl: 'http://vista.test/sub-b/',
    })
    const atomA = a.atomFor(binding)
    const atomB = b.atomFor(binding)
    const unmountA = a.registry.mount(atomA)
    const unmountB = b.registry.mount(atomB)
    const [resultA, resultB] = await Promise.all([
      waitFor(a, atomA, (result) => availableValue(result)?.value.label === 'A'),
      waitFor(b, atomB, (result) => availableValue(result)?.value.label === 'B'),
    ])

    expect(availableValue(resultA)?.value.cursor).toBe('a-cursor-1')
    expect(availableValue(resultB)?.value.cursor).toBe('b-cursor-1')
    expect(a.registry).not.toBe(b.registry)
    unmountA()
    unmountB()
  })

  it('turns a strict live decode mismatch into SchemaMismatch and retains frozen', async () => {
    const binding = bind(client.ops.read, { id: 'mismatch' }, { mode: 'live' })
    const dataRuntime = runtime({
      appVersionId: 'owner/app/v1',
      snapshot: makeSnapshot(binding, { label: 'safe frozen', count: 0 }),
      dataBaseUrl: 'http://vista.test/mismatch/',
    })
    const atom = dataRuntime.atomFor(binding)
    const unmount = dataRuntime.registry.mount(atom)
    const result = await waitFor(dataRuntime, atom, (value) => value._tag === 'Failure')

    expect(availableValue(result)?.value).toEqual({ label: 'safe frozen', count: 0 })
    if (result._tag !== 'Failure') throw new Error('expected failure')
    expect(Option.getOrThrow(Cause.findErrorOption(result.cause))).toMatchObject({
      _tag: 'SchemaMismatch',
    })
    expect(bindingFailureMessage(result)).toContain(
      'test.read returned data that does not match the schema',
    )
    expect(bindingFailureMessage(result)).toContain('["extra"]')
    expect(bindingFailureMessage(result)).not.toContain('data-query.tsx')
    unmount()
  })
  it('shows concise typed failures while retaining the full cause in collapsed diagnostics', () => {
    const binding = bind(client.ops.read, { id: 'message' }, { mode: 'live' })
    const key = Effect.runSync(encodeBinding(binding)).key
    const result = AsyncResult.fail(
      new SchemaMismatch({
        provider: 'test',
        operation: 'read',
        key,
        message:
          'Value\n└─ ["extra"]\n   └─ Expected no excess property, actual property is present',
      }),
    )
    if (result._tag !== 'Failure') throw new Error('expected failure')

    expect(bindingFailureMessage(result)).toBe(
      'test.read returned data that does not match the schema at ["extra"]',
    )
    const html = renderToStaticMarkup(<BindingFailureDiagnostic result={result} />)
    expect(html).toContain('<details>')
    expect(html).toContain('Diagnostic details')
    expect(html).toContain('Expected no excess property')
  })

  it('isolates two AppVersion registries and RPC runtimes', async () => {
    const binding = bind(client.ops.read, { id: 'isolated' }, { mode: 'live' })
    const snapshot = makeSnapshot(binding, { label: 'seed', count: 0 })
    const a = runtime({
      appVersionId: 'owner/app/v1',
      snapshot,
      dataBaseUrl: 'http://vista.test/a/',
    })
    const b = runtime({
      appVersionId: 'owner/app/v2',
      snapshot,
      dataBaseUrl: 'http://vista.test/b/',
    })
    const atomA = a.atomFor(binding)
    const atomB = b.atomFor(binding)
    const unmountA = a.registry.mount(atomA)
    const unmountB = b.registry.mount(atomB)
    const [resultA, resultB] = await Promise.all([
      waitFor(a, atomA, (result) => availableValue(result)?._tag === 'Live'),
      waitFor(b, atomB, (result) => availableValue(result)?._tag === 'Live'),
    ])

    expect(availableValue(resultA)?.value.label).toBe('A')
    expect(availableValue(resultB)?.value.label).toBe('B')
    expect(a.registry).not.toBe(b.registry)
    unmountA()
    unmountB()
  })
})

const useFrozenBindingTypeTest = () => {
  const frozenBinding = bind(client.ops.read, { id: 'type-test' })
  // @ts-expect-error frozen bindings cannot be refreshed
  useRefresh(frozenBinding)
}
void useFrozenBindingTypeTest
