import type {
  Cursor,
  SnapshotKey,
  SubscriptionOperation,
} from '@vista/blocks/internal/data-contract'
import {
  encodeBinding,
  strictJsonWire,
  SubscriptionError,
} from '@vista/blocks/internal/data-contract'
export { SubscriptionError } from '@vista/blocks/internal/data-contract'
import {
  Context,
  DateTime,
  Deferred,
  Duration,
  Effect,
  Layer,
  Metric,
  Option,
  Schedule,
  RcMap,
  Ref,
  Random,
  Schema,
  Semaphore,
  Stream,
  SubscriptionRef,
  type Scope,
} from 'effect'
import * as KeyValueStore from 'effect/persistence/KeyValueStore'
import * as RateLimiter from 'effect/persistence/RateLimiter'

import {
  liveHibernations,
  livePollers,
  providerRateLimitRemaining,
  providerThrottleWait,
  streamEvents,
  streamSubscriptions,
} from '../metrics.ts'

/**
 * Discriminated poll response that either delivers the driver's latest full state or the batch of
 * events accumulated since the poll cursor.
 */
export type PollResult<TState, TEvent> =
  | { readonly _tag: 'state'; readonly state: TState }
  | { readonly _tag: 'events'; readonly events: ReadonlyArray<TEvent> }

/**
 * Describes how the hub obtains data for one subscription operation, where the pollable variant
 * fetches initial state, then polls incrementally from a cursor within the given min/max interval
 * while optionally declaring its external call cost.
 */
export type LiveDriver<TArgs, TState, TEvent, TError, TRequirements = never> =
  | {
      readonly _tag: 'pollable'
      readonly initial: (args: TArgs) => Effect.Effect<TState, TError, TRequirements>
      readonly poll: (
        args: TArgs,
        since: Cursor,
      ) => Effect.Effect<PollResult<TState, TEvent>, TError, TRequirements>
      /** External calls consumed by one poll (for example checks uses two gh commands). */
      readonly cost?: number
      readonly interval: { readonly min: Duration.Input; readonly max: Duration.Input }
    }
  | {
      readonly _tag: 'subscribable'
      readonly initial: (args: TArgs) => Effect.Effect<TState, TError, TRequirements>
      readonly stream: (args: TArgs, since: Cursor) => Stream.Stream<TEvent, TError, TRequirements>
    }

interface ErasedOperation {
  readonly providerId: string
  readonly tag: string
  readonly stateSchema: Schema.Codec<unknown, unknown, never, never>
  readonly eventSchema: Schema.Codec<unknown, unknown, never, never>
  readonly fold: (state: unknown, event: unknown) => unknown
  readonly cursor: (state: unknown) => Cursor
}

interface ErasedDriver {
  readonly _tag: 'pollable' | 'subscribable'
  readonly initial: (args: unknown) => Effect.Effect<unknown, SubscriptionError>
  readonly poll?: (
    args: unknown,
    since: Cursor,
  ) => Effect.Effect<PollResult<unknown, unknown>, SubscriptionError>
  readonly stream?: (args: unknown, since: Cursor) => Stream.Stream<unknown, SubscriptionError>
  readonly cost?: number
  readonly interval?: { readonly min: Duration.Input; readonly max: Duration.Input }
}

/**
 * Runtime record that binds one shared live resource (identified by key and generation) to its
 * provider, erased operation, arguments, and driver so the hub can multiplex viewers onto a single
 * underlying stream.
 */
export interface LiveBinding {
  readonly resourceId: string
  readonly generation: number
  readonly key: SnapshotKey
  readonly providerId: string
  readonly operation: ErasedOperation
  readonly args: unknown
  readonly driver: ErasedDriver
}

interface FoldedState {
  readonly state: unknown
  readonly cursor: Cursor
}
interface LiveUpdate {
  readonly folded: FoldedState
  readonly event?: unknown
}

interface PersistedState {
  readonly state: unknown
  readonly cursor: Cursor
  readonly observedAt: DateTime.Utc
}

interface LiveResource {
  readonly binding: LiveBinding
  readonly current: SubscriptionRef.SubscriptionRef<LiveUpdate>
  readonly viewers: Ref.Ref<number>
  readonly failure: Deferred.Deferred<SubscriptionError>
}

/**
 * Point-in-time snapshot of one active hub resource, exposed via inspect and reporting which
 * provider and operation the key serves, how many viewers share it, and the cursor it has reached.
 */
export interface SubscriptionHubStatus {
  readonly key: SnapshotKey
  readonly provider: string
  readonly operation: string
  readonly viewers: number
  readonly cursor: Cursor
}
/**
 * Pairs a subscription hub scoped to a specific provider registry generation with an effect that
 * retires that generation, tearing down any live resources it created.
 */
export interface ProviderSubscriptionGeneration {
  readonly hub: SubscriptionHubService
  readonly retire: Effect.Effect<void>
}

/**
 * Service that fans out a shared live event stream per operation and arguments (optionally resumed
 * from a cursor), charges polls through the provider budget, and offers generation retirement plus
 * status inspection.
 */
export interface SubscriptionHubService {
  readonly subscribe: <TArgs, TState, TEvent, TError>(
    operation: SubscriptionOperation<string, TArgs, TState, TEvent, TError>,
    args: TArgs,
    driver: LiveDriver<TArgs, TState, TEvent, TError>,
    options?: { readonly since?: Cursor },
  ) => Stream.Stream<TEvent, SubscriptionError>
  readonly providerGeneration: (providerId: string) => ProviderSubscriptionGeneration
  readonly retire: Effect.Effect<void>
  readonly inspect: Effect.Effect<ReadonlyArray<SubscriptionHubStatus>>
}

/**
 * Effect context tag that publishes SubscriptionHubService into the environment under the
 * Vista/SubscriptionHub identifier so layers can require and provide it.
 */
export class SubscriptionHub extends Context.Service<SubscriptionHub, SubscriptionHubService>()(
  'Vista/SubscriptionHub',
) {}

/**
 * Per-provider accounting API whose run executes an effect while charging its cost, and whose
 * pollInterval picks the next delay between the configured bounds based on viewer count and
 * remaining budget.
 */
export interface ProviderBudget {
  readonly run: <A, E>(
    provider: string,
    effect: Effect.Effect<A, E>,
    cost?: number,
  ) => Effect.Effect<A, E>
  readonly pollInterval: (
    provider: string,
    viewers: number,
    interval: { readonly min: Duration.Input; readonly max: Duration.Input },
    cost?: number,
  ) => Effect.Effect<Duration.Duration>
}

/**
 * Configuration for budget construction: which providers are treated as local (uncounted), the
 * default external rate limit, and optional per-provider overrides of that limit.
 */
export interface ProviderBudgetOptions {
  readonly localProviders?: ReadonlySet<string>
  readonly external?: { readonly limit: number; readonly window: Duration.Input }
  readonly externalByProvider?: Readonly<
    Record<string, { readonly limit: number; readonly window: Duration.Input }>
  >
}

/**
 * Construction options for the hub, covering the app version used to namespace persisted
 * snapshots, the key-value store for cursor persistence, and optional budget, idle expiry,
 * capacity, and external-rate settings.
 */
export interface SubscriptionHubOptions {
  readonly appVersionId: string
  readonly store: KeyValueStore.KeyValueStore
  readonly budget?: ProviderBudget
  readonly idleTimeToLive?: Duration.Input
  readonly capacity?: number
  readonly localProviders?: ReadonlySet<string>
  readonly externalBudget?: { readonly limit: number; readonly window: Duration.Input }
}

const erasedOperation = <TArgs, TState, TEvent, TError>(
  operation: SubscriptionOperation<string, TArgs, TState, TEvent, TError>,
): ErasedOperation => ({
  providerId: operation.providerId,
  tag: operation.tag,
  stateSchema: operation.stateSchema as Schema.Codec<unknown, unknown, never, never>,
  eventSchema: operation.eventSchema as Schema.Codec<unknown, unknown, never, never>,
  fold: (state, event) => operation.fold(state as TState, event as TEvent),
  cursor: (state) => operation.cursor(state as TState),
})

/**
 * Wraps a typed live driver into the hub's type-erased driver shape, translating every driver
 * error into a SubscriptionError annotated with the provider, operation, and snapshot key for
 * diagnosis.
 */
export const eraseLiveDriver = <TArgs, TState, TEvent, TError>(
  providerId: string,
  operation: string,
  key: SnapshotKey,
  driver: LiveDriver<TArgs, TState, TEvent, TError>,
): ErasedDriver => {
  const error = (cause: TError) =>
    new SubscriptionError({ provider: providerId, operation, key, message: String(cause) })
  if (driver._tag === 'subscribable') {
    return {
      _tag: 'subscribable',
      initial: (args) => driver.initial(args as TArgs).pipe(Effect.mapError(error)),
      stream: (args, since) => driver.stream(args as TArgs, since).pipe(Stream.mapError(error)),
    }
  }
  return {
    _tag: 'pollable',
    initial: (args) => driver.initial(args as TArgs).pipe(Effect.mapError(error)),
    poll: (args, since) => driver.poll(args as TArgs, since).pipe(Effect.mapError(error)),
    ...(driver.cost === undefined ? {} : { cost: driver.cost }),
    interval: driver.interval,
  }
}

const strictPersistedSchema = (
  stateSchema: Schema.Codec<unknown, unknown, never, never>,
): Schema.Codec<PersistedState, unknown, never, never> =>
  strictJsonWire(
    Schema.Struct({
      state: stateSchema,
      cursor: Schema.String,
      observedAt: Schema.DateTimeUtc,
    }).annotate({
      identifier: 'Vista.PersistedLiveState',
    }),
  )

const persistedKey = (appVersionId: string, key: SnapshotKey): string => `${appVersionId}::${key}`

const defaultLocalProviders: Readonly<Record<string, true>> = {
  'agent-timeline': true,
  // Retained publications can still address the local provider by its previous data id.
  'agent-trace': true,
  'disk-index': true,
  otel: true,
  overview: true,
  pyroscope: true,
  pty: true,
  trace: true,
}

/**
 * Builds a ProviderBudget backed by per-provider semaphores and an in-memory rate limiter,
 * applying the configured or default windows (for example 20/min for gh and 60/min otherwise) to
 * external work.
 */
export const makeProviderBudget = (
  options: ProviderBudgetOptions = {},
): Effect.Effect<ProviderBudget> =>
  Effect.gen(function* () {
    const semaphores = new Map<string, Semaphore.Semaphore>()
    const rateLimiter = yield* RateLimiter.make.pipe(Effect.provide(RateLimiter.layerStoreMemory))
    const remaining = new Map<string, number>()
    const external = options.external ?? { limit: 60, window: '1 minute' }
    const budgetFor = (provider: string) =>
      options.externalByProvider?.[provider] ??
      (provider === 'gh' ? { limit: 20, window: '1 minute' as const } : external)

    const semaphoreFor = (provider: string) =>
      Effect.suspend(() => {
        const existing = semaphores.get(provider)
        if (existing !== undefined) return Effect.succeed(existing)
        return Semaphore.make(4).pipe(
          Effect.tap((semaphore) => Effect.sync(() => semaphores.set(provider, semaphore))),
        )
      })

    const isLocal = (provider: string): boolean =>
      options.localProviders?.has(provider) ?? defaultLocalProviders[provider] === true

    return {
      run: <A, E>(provider: string, effect: Effect.Effect<A, E>, cost = 1) => {
        if (isLocal(provider)) {
          return semaphoreFor(provider).pipe(
            Effect.flatMap((semaphore) => Semaphore.withPermit(semaphore)(effect)),
          )
        }
        return Effect.gen(function* () {
          const providerBudget = budgetFor(provider)
          const decision = yield* rateLimiter
            .consume({
              algorithm: 'fixed-window',
              onExceeded: 'delay',
              key: provider,
              limit: providerBudget.limit,
              window: providerBudget.window,
              tokens: cost,
            })
            .pipe(Effect.orDie)
          yield* Metric.update(
            Metric.withAttributes(providerRateLimitRemaining, {
              provider,
              resource: 'live',
            }),
            decision.remaining,
          )
          remaining.set(provider, decision.remaining)
          if (!Duration.isZero(decision.delay)) {
            yield* Metric.update(
              Metric.withAttributes(providerThrottleWait, {
                provider,
                resource: 'live',
              }),
              Duration.toMillis(decision.delay),
            )
            yield* Effect.sleep(decision.delay)
          }
          return yield* effect
        })
      },
      pollInterval: (provider, viewers, interval, cost = 1) =>
        Effect.gen(function* () {
          const min = Duration.toMillis(Duration.fromInputUnsafe(interval.min))
          const max = Duration.toMillis(Duration.fromInputUnsafe(interval.max))
          const viewerCadence = Math.max(min, Math.floor(max / Math.min(Math.max(1, viewers), 4)))
          if (isLocal(provider)) return Duration.millis(viewerCadence)
          const providerBudget = budgetFor(provider)
          const budgetFloor = Math.ceil(
            (Duration.toMillis(Duration.fromInputUnsafe(providerBudget.window)) * cost) /
              providerBudget.limit,
          )
          const available = remaining.get(provider) ?? providerBudget.limit
          const ratio = Math.min(1, Math.max(0, available / providerBudget.limit))
          const quotaCadence = Math.floor(max - (max - min) * ratio)
          const cadence = Math.max(viewerCadence, quotaCadence, budgetFloor)
          if (cadence >= max) return Duration.millis(cadence)
          const jitter = yield* Random.nextBetween(0.9, 1.1)
          return Duration.millis(Math.max(budgetFloor, Math.min(max, Math.round(cadence * jitter))))
        }),
    }
  })

const subscriptionError = (
  binding: Pick<LiveBinding, 'key' | 'providerId' | 'operation'>,
  message: string,
) =>
  new SubscriptionError({
    provider: binding.providerId,
    operation: binding.operation.tag,
    message,
    key: binding.key,
  })

/**
 * Constructs a scoped SubscriptionHubService that shares one live resource per snapshot key,
 * persists cursors through the key-value store, retires idle bindings after the TTL, and enforces
 * the provider budget on every poll.
 */
export const makeSubscriptionHub = (
  options: SubscriptionHubOptions,
): Effect.Effect<SubscriptionHubService, never, Scope.Scope> =>
  Effect.gen(function* () {
    const idleTimeToLive = options.idleTimeToLive ?? '30 seconds'
    const bindings = new Map<string, LiveBinding>()
    const resources = new Map<string, LiveResource>()
    const activeGenerations = new Set([0])
    let nextGeneration = 1
    const budget =
      options.budget ??
      (yield* makeProviderBudget({
        ...(options.localProviders === undefined ? {} : { localProviders: options.localProviders }),
        ...(options.externalBudget === undefined ? {} : { external: options.externalBudget }),
      }))
    const lifecycle = yield* Ref.make({ retiring: false, active: 0 })
    const idle = yield* Deferred.make<void>()

    const acquireSubscription = (binding: LiveBinding) =>
      Ref.modify(lifecycle, (state) =>
        state.retiring
          ? ([false, state] as const)
          : ([true, { ...state, active: state.active + 1 }] as const),
      ).pipe(
        Effect.flatMap((acquired) =>
          acquired
            ? Effect.void
            : Effect.fail(subscriptionError(binding, 'subscription hub is retired')),
        ),
      )

    const releaseSubscription = Ref.modify(lifecycle, (state) => {
      const next = { ...state, active: Math.max(0, state.active - 1) }
      return [next.retiring && next.active === 0, next] as const
    }).pipe(
      Effect.flatMap((becameIdle) =>
        becameIdle ? Deferred.succeed(idle, undefined).pipe(Effect.asVoid) : Effect.void,
      ),
    )

    const retire = Ref.modify(lifecycle, (state) => {
      const next = { ...state, retiring: true }
      return [next.active === 0, next] as const
    }).pipe(
      Effect.flatMap((alreadyIdle) =>
        alreadyIdle ? Deferred.succeed(idle, undefined).pipe(Effect.asVoid) : Effect.void,
      ),
      Effect.andThen(Deferred.await(idle)),
    )

    const acquire = (
      resourceId: string,
    ): Effect.Effect<LiveResource, SubscriptionError, Scope.Scope> =>
      Effect.gen(function* () {
        const binding = bindings.get(resourceId)
        if (binding === undefined) {
          return yield* new SubscriptionError({
            provider: 'unknown',
            operation: 'unknown',
            message: `missing binding for ${resourceId}`,
            key: resourceId as SnapshotKey,
          })
        }
        if (!activeGenerations.has(binding.generation)) {
          return yield* subscriptionError(binding, 'provider generation is retired')
        }
        const key = binding.key
        const persistedSchema = strictPersistedSchema(binding.operation.stateSchema)
        const store = KeyValueStore.toSchemaStore(options.store, persistedSchema)
        const storageKey = persistedKey(options.appVersionId, key)
        const loaded = yield* store.get(storageKey).pipe(
          Effect.matchEffect({
            onFailure: () =>
              store.remove(storageKey).pipe(
                Effect.ignore,
                Effect.as(Option.none<PersistedState>()),
                Effect.tap(() =>
                  Metric.update(
                    Metric.withAttributes(liveHibernations, { outcome: 'corrupt-discarded' }),
                    1,
                  ),
                ),
              ),
            onSuccess: Effect.succeed,
          }),
        )
        const initialState = Option.isSome(loaded)
          ? loaded.value.state
          : yield* budget.run(
              binding.providerId,
              binding.driver.initial(binding.args),
              binding.driver.cost,
            )
        if (!activeGenerations.has(binding.generation)) {
          return yield* subscriptionError(binding, 'provider generation is retired')
        }
        const initial = {
          state: initialState,
          cursor: Option.isSome(loaded)
            ? loaded.value.cursor
            : binding.operation.cursor(initialState),
        }
        const current = yield* SubscriptionRef.make<LiveUpdate>({ folded: initial })
        const viewers = yield* Ref.make(0)

        const persist = SubscriptionRef.get(current).pipe(
          Effect.flatMap(({ folded: { state, cursor } }) =>
            DateTime.now.pipe(
              Effect.flatMap((observedAt) => store.set(storageKey, { state, cursor, observedAt })),
            ),
          ),
          Effect.matchEffect({
            onFailure: () =>
              Metric.update(Metric.withAttributes(liveHibernations, { outcome: 'failed' }), 1),
            onSuccess: () =>
              Metric.update(Metric.withAttributes(liveHibernations, { outcome: 'persisted' }), 1),
          }),
          Effect.withSpan('vista.live.hibernate', {
            attributes: {
              'span.label': 'live.hibernate',
              'app.version.id': options.appVersionId,
              'provider.id': binding.providerId,
              'rpc.tag': binding.operation.tag,
              'args.hash': key,
            },
          }),
        )
        yield* Effect.addFinalizer(() => persist)

        const accept = (event: unknown) =>
          Schema.decodeUnknownEffect(binding.operation.eventSchema, {
            onExcessProperty: 'error',
          })(event).pipe(
            Effect.mapError(
              (cause) =>
                new SubscriptionError({
                  provider: binding.providerId,
                  operation: binding.operation.tag,
                  message: String(cause),
                  key,
                }),
            ),
            Effect.tap((decoded) =>
              SubscriptionRef.modify(current, ({ folded: { state } }) => {
                const nextState = binding.operation.fold(state, decoded)
                return [
                  undefined,
                  {
                    folded: {
                      state: nextState,
                      cursor: binding.operation.cursor(nextState),
                    },
                    event: decoded,
                  },
                ] as const
              }),
            ),
            Effect.tap(() =>
              Metric.update(
                Metric.withAttributes(streamEvents, {
                  provider: binding.providerId,
                  rpc: binding.operation.tag,
                }),
                1,
              ),
            ),
            Effect.tap(() =>
              SubscriptionRef.get(current).pipe(
                Effect.flatMap(({ folded: { state, cursor } }) =>
                  DateTime.now.pipe(
                    Effect.flatMap((observedAt) =>
                      store.set(storageKey, { state, cursor, observedAt }),
                    ),
                  ),
                ),
                Effect.ignore,
              ),
            ),
          )

        const pollOnce = Effect.gen(function* () {
          const { folded } = yield* SubscriptionRef.get(current)
          const result = yield* budget.run(
            binding.providerId,
            binding.driver.poll!(binding.args, folded.cursor),
            binding.driver.cost,
          )
          const events =
            result._tag === 'events' ? result.events : [{ _tag: 'Synced', state: result.state }]
          return yield* Effect.forEach(events, accept)
        })

        const pollStream = Stream.fromEffect(
          Effect.gen(function* () {
            const count = Math.max(1, yield* Ref.get(viewers))
            yield* Effect.sleep(
              yield* budget.pollInterval(
                binding.providerId,
                count,
                binding.driver.interval!,
                binding.driver.cost,
              ),
            )
            return yield* pollOnce
          }),
        ).pipe(Stream.flatMap(Stream.fromIterable), Stream.repeat(Schedule.forever))

        const subscribedStream = Stream.unwrap(
          SubscriptionRef.get(current).pipe(
            Effect.map(({ folded: { cursor } }) => binding.driver.stream!(binding.args, cursor)),
          ),
        ).pipe(Stream.mapEffect(accept))

        const upstream = binding.driver._tag === 'pollable' ? pollStream : subscribedStream
        const failure = yield* Deferred.make<SubscriptionError>()
        yield* Stream.unwrap(
          Effect.acquireRelease(
            Metric.modify(Metric.withAttributes(livePollers, { provider: binding.providerId }), 1),
            () =>
              Metric.modify(
                Metric.withAttributes(livePollers, { provider: binding.providerId }),
                -1,
              ),
          ).pipe(Effect.as(upstream)),
        ).pipe(
          Stream.runDrain,
          Effect.catch((error) => Deferred.succeed(failure, error).pipe(Effect.asVoid)),
          Effect.forkScoped,
        )
        const resource: LiveResource = { binding, current, viewers, failure }
        resources.set(resourceId, resource)
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            if (resources.get(resourceId) === resource) resources.delete(resourceId)
            if (bindings.get(resourceId) === binding) bindings.delete(resourceId)
          }),
        )
        return resource
      }).pipe(
        Effect.withSpan('vista.live.wake', {
          attributes: {
            'span.label': 'live.wake',
            'app.version.id': options.appVersionId,
            'args.hash': resourceId,
          },
        }),
      )

    const map = yield* RcMap.make({
      lookup: acquire,
      idleTimeToLive,
      capacity: options.capacity ?? 1_024,
    })

    const subscribe = <TArgs, TState, TEvent, TError>(
      generation: number,
      operation: SubscriptionOperation<string, TArgs, TState, TEvent, TError>,
      args: TArgs,
      driver: LiveDriver<TArgs, TState, TEvent, TError>,
      _callOptions?: { readonly since?: Cursor },
    ): Stream.Stream<TEvent, SubscriptionError> =>
      Stream.unwrap(
        Effect.gen(function* () {
          const { key } = yield* encodeBinding({
            operation,
            args,
            policy: { mode: 'subscription' },
          }).pipe(Effect.orDie)
          const resourceId = `${generation}\0${key}`
          const proposed: LiveBinding = {
            resourceId,
            generation,
            key,
            providerId: operation.providerId,
            operation: erasedOperation(operation),
            args,
            driver: eraseLiveDriver(operation.providerId, operation.tag, key, driver),
          }
          yield* Effect.acquireRelease(acquireSubscription(proposed), () => releaseSubscription)
          if (!activeGenerations.has(generation)) {
            return yield* subscriptionError(proposed, 'provider generation is retired')
          }
          const binding = bindings.get(resourceId) ?? proposed
          bindings.set(resourceId, binding)
          const resource = yield* RcMap.get(map, resourceId).pipe(
            Effect.tapError(() =>
              Effect.sync(() => {
                if (bindings.get(resourceId) === binding) bindings.delete(resourceId)
              }),
            ),
            Effect.mapError((cause) =>
              cause instanceof SubscriptionError
                ? cause
                : subscriptionError(binding, String(cause)),
            ),
          )
          const updates = SubscriptionRef.changes(resource.current).pipe(
            Stream.mapAccum(
              () => true,
              (first, update) => [
                false,
                [
                  first || update.event === undefined
                    ? { _tag: 'Synced', state: update.folded.state }
                    : update.event,
                ],
              ],
            ),
            Stream.mapEffect((event) =>
              Schema.decodeEffect(resource.binding.operation.eventSchema, {
                onExcessProperty: 'error',
              })(event).pipe(
                Effect.mapError(
                  (cause) =>
                    new SubscriptionError({
                      provider: operation.providerId,
                      operation: operation.tag,
                      message: String(cause),
                      key,
                    }),
                ),
              ),
            ),
          )
          const viewerStream = Stream.merge(
            updates,
            Stream.fromEffect(Deferred.await(resource.failure).pipe(Effect.flatMap(Effect.fail))),
          )
          return Stream.unwrap(
            Effect.acquireRelease(
              Ref.update(resource.viewers, (count) => count + 1).pipe(
                Effect.andThen(
                  Metric.modify(
                    Metric.withAttributes(streamSubscriptions, {
                      provider: operation.providerId,
                      rpc: operation.tag,
                    }),
                    1,
                  ),
                ),
              ),
              () =>
                Ref.update(resource.viewers, (count) => Math.max(0, count - 1)).pipe(
                  Effect.andThen(
                    Metric.modify(
                      Metric.withAttributes(streamSubscriptions, {
                        provider: operation.providerId,
                        rpc: operation.tag,
                      }),
                      -1,
                    ),
                  ),
                ),
            ).pipe(Effect.as(viewerStream)),
          ).pipe(
            Stream.withSpan(`vista.live.${operation.providerId}.${operation.tag}`, {
              attributes: {
                'span.label': `${operation.providerId}.${operation.tag}`,
                'app.version.id': options.appVersionId,
                'provider.id': operation.providerId,
                'rpc.tag': operation.tag,
                'args.hash': key,
              },
            }),
          )
        }),
      ) as Stream.Stream<TEvent, SubscriptionError>

    const inspect = Effect.suspend(() =>
      Effect.forEach([...resources.values()], (resource) =>
        Effect.all({
          viewers: Ref.get(resource.viewers),
          folded: SubscriptionRef.get(resource.current),
        }).pipe(
          Effect.map(({ viewers, folded }) => ({
            key: resource.binding.key,
            provider: resource.binding.providerId,
            operation: resource.binding.operation.tag,
            viewers,
            cursor: folded.folded.cursor,
          })),
        ),
      ),
    )

    const retireGeneration = (generation: number, providerId: string) =>
      Effect.gen(function* () {
        activeGenerations.delete(generation)
        const matches = [...bindings.entries()].filter(
          ([, binding]) => binding.generation === generation && binding.providerId === providerId,
        )
        yield* Effect.forEach(
          matches,
          ([resourceId, binding]) =>
            Effect.gen(function* () {
              if (bindings.get(resourceId) === binding) bindings.delete(resourceId)
              const resource = resources.get(resourceId)
              if (resource?.binding === binding) {
                yield* Deferred.succeed(
                  resource.failure,
                  subscriptionError(binding, 'provider generation was reloaded'),
                )
              }
              yield* RcMap.invalidate(map, resourceId)
            }),
          { discard: true },
        )
      })

    const makeService = (generation: number): SubscriptionHubService => ({
      subscribe: (operation, args, driver, callOptions) =>
        subscribe(generation, operation, args, driver, callOptions),
      providerGeneration,
      retire,
      inspect,
    })
    const providerGeneration = (providerId: string): ProviderSubscriptionGeneration => {
      const generation = nextGeneration++
      activeGenerations.add(generation)
      return {
        hub: makeService(generation),
        retire: retireGeneration(generation, providerId),
      }
    }

    return makeService(0)
  })

/**
 * Packages makeSubscriptionHub into an Effect Layer so the hub is provided as the SubscriptionHub
 * service with its lifetime tied to the layer's scope.
 */
export const subscriptionHubLayer = (options: SubscriptionHubOptions) =>
  Layer.effect(SubscriptionHub, makeSubscriptionHub(options))
