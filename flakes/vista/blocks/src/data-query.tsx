'use client'

import {
  HydrationBoundary,
  RegistryContext,
  RegistryProvider,
  scheduleTask,
  useAtomRefresh,
  useAtomSuspense,
  useAtomValue,
} from '@effect/atom-react'
import type { Context } from 'effect'
import {
  Cause,
  Effect,
  Exit,
  Layer,
  Metric,
  Option,
  Result,
  Schema,
  SchemaIssue,
  Stream,
  SubscriptionRef,
} from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as AsyncResult from 'effect/reactivity/AsyncResult'
import { Atom } from 'effect/reactivity'
import * as AtomRegistry from 'effect/reactivity/AtomRegistry'
import * as AtomRpc from 'effect/reactivity/AtomRpc'
import type * as Hydration from 'effect/reactivity/Hydration'
import * as Reactivity from 'effect/reactivity/Reactivity'
import type * as Rpc from 'effect/rpc/Rpc'
import * as RpcClient from 'effect/rpc/RpcClient'
import { RpcClientError } from 'effect/rpc/RpcClientError'
import { layerJson, layerNdjson } from 'effect/rpc/RpcSerialization'
import * as React from 'react'

import { useDataBinding, useDataExtraction } from './authoring.tsx'
import { DataCommandTransportProvider } from './data-command.tsx'
import {
  bind,
  type BindingPolicy,
  type DataBinding,
  readSnapshotBinding,
  type FlatMappedOperation,
  FrozenEntryMissing,
  isFlatMappedOperation,
  isMappedOperation,
  type MappedOperation,
  mappedAtomKey,
  projectMappedSourceValue,
  SchemaMismatch,
  SNAPSHOT_API_VERSION,
  type Snapshot,
  type SnapshotKey,
  Snapshot as SnapshotSchema,
  sourceBinding,
  type SubscriptionOperation,
  SubscriptionError,
} from './data-contract.ts'
import type { ActorSource } from './provider-contracts.ts'

const LazySnapshotModeView = React.lazy(async () => {
  const { SnapshotModeView } = await import('./blocks/SnapshotModeView.tsx')
  return { default: SnapshotModeView }
})
export {
  bind,
  BindingPolicy,
  CanonicalJsonError,
  canonicalJson,
  captureArgs,
  contract,
  Cursor,
  encodeBinding,
  encodeCaptureArgsEffect,
  encodeCaptureArgsSync,
  FlatMapManifestEdge,
  flatMapEdge,
  FrozenEntryMissing,
  isFlatMappedOperation,
  isMappedOperation,
  mappedAtomKey,
  Operation,
  SchemaMismatch,
  Snapshot,
  SnapshotEntry,
  SnapshotKey,
  sourceBinding,
  subscription,
  SubscriptionError,
  snapshotKey,
  type CapturePlan,
  type CommandOp,
  type DataBinding,
  type DerivedOperation,
  type FlatMappedOperation,
  type FlatMapSelector,
  type MappedOperation,
  type OperationsOf,
  type ProviderContract,
  type SubscriptionOperation,
  type Synced,
  type UnknownBinding,
} from './data-contract.ts'

/**
 * Discriminated union describing how a successfully obtained value was sourced: frozen snapshot
 * data, frozen data still catching up with live state, or a fresh live observation.
 */
export type Resolved<TValue> =
  | { readonly _tag: 'Frozen'; readonly value: TValue; readonly frozenAt: string }
  | { readonly _tag: 'CatchingUp'; readonly value: TValue; readonly frozenAt: string }
  | { readonly _tag: 'Live'; readonly value: TValue; readonly observedAt: string }

/**
 * Union of every failure mode a binding can produce, combining the operation's own error with RPC
 * client failures, snapshot schema mismatches, missing frozen entries, and subscription failures.
 */
export type DataError<TError> =
  | TError
  | RpcClientError
  | SchemaMismatch
  | FrozenEntryMissing
  | SubscriptionError
/**
 * Asynchronous result type that eventually settles to a Resolved value or fails with any DataError
 * variant.
 */
export type BindingResult<TValue, TError> = AsyncResult.AsyncResult<
  Resolved<TValue>,
  DataError<TError>
>
/**
 * Atom type exposing a binding's asynchronous result so reactive consumers can track loading,
 * success, and failure states.
 */
export type BindingAtom<TValue, TError> = Atom.Atom<BindingResult<TValue, TError>>

type AnyBinding = DataBinding<unknown, unknown, unknown, BindingPolicy>
type DynamicClient<TArgs, TError> = (
  tag: string,
  payload: TArgs,
) => Effect.Effect<unknown, TError | RpcClientError>
type DynamicSubscriptionClient<TArgs, TEvent, TError> = (
  tag: string,
  payload: TArgs,
) => Stream.Stream<TEvent, TError | RpcClientError>

const strict = { onExcessProperty: 'error', reportInput: true } as const
/**
 * Classification of a published HTTP snapshot body as a usable frozen snapshot, as unsupported due
 * to version skew or malformed structure, or as unavailable.
 */
export type PublishedSnapshotResolution =
  | { readonly _tag: 'frozen'; readonly snapshot: Snapshot }
  | { readonly _tag: 'unsupported'; readonly reason: 'skew' | 'malformed'; readonly found?: number }
  | { readonly _tag: 'unavailable' }

/** Classify an HTTP snapshot body without ever treating malformed published data as live. */
export const classifyPublishedSnapshot = (input: unknown): PublishedSnapshotResolution => {
  if (typeof input !== 'object' || input === null) {
    return { _tag: 'unsupported', reason: 'malformed' }
  }
  const apiVersion = Reflect.get(input, 'apiVersion')
  if (typeof apiVersion !== 'number') {
    return { _tag: 'unsupported', reason: 'malformed' }
  }
  if (apiVersion !== SNAPSHOT_API_VERSION) {
    return { _tag: 'unsupported', reason: 'skew', found: apiVersion }
  }
  const decoded = Schema.decodeUnknownResult(SnapshotSchema)(input, strict)
  return Result.isSuccess(decoded)
    ? { _tag: 'frozen', snapshot: decoded.success }
    : { _tag: 'unsupported', reason: 'malformed' }
}

const loadPublishedSnapshot = (snapshotUrl: string): Effect.Effect<PublishedSnapshotResolution> =>
  Effect.promise(async () => {
    let response: Response
    try {
      response = await globalThis.fetch(snapshotUrl)
    } catch {
      return { _tag: 'unavailable' }
    }
    if (!response.ok) return { _tag: 'unavailable' }
    try {
      return classifyPublishedSnapshot(await response.json())
    } catch {
      return { _tag: 'unsupported', reason: 'malformed' }
    }
  })

const publishedSnapshotRuntime = Atom.runtime(Layer.empty)
const publishedSnapshotAtom = Atom.family((snapshotUrl: string) =>
  publishedSnapshotRuntime.atom(loadPublishedSnapshot(snapshotUrl)).pipe(Atom.autoDispose),
)
const dataHydrations = Metric.counter('vista_data_hydrations', {
  description: 'vista snapshot hydration attempts',
})
const dataRefreshes = Metric.counter('vista_data_refreshes', {
  description: 'vista data refresh attempts',
})

type RunTelemetry = <A>(effect: Effect.Effect<A>) => A

const instrumentDataAction = <A,>(
  metric: Metric.Counter<number>,
  span: 'vista.data.hydrate' | 'vista.data.refresh',
  attributes: Readonly<Record<string, string>>,
  action: () => A,
): Effect.Effect<A> =>
  Effect.sync(action).pipe(
    Effect.onExit((exit) =>
      Metric.update(
        Metric.withAttributes(metric, {
          ...attributes,
          outcome: Exit.isSuccess(exit) ? 'success' : 'error',
        }),
        1,
      ),
    ),
    Effect.withSpan(span, {
      attributes: {
        ...attributes,
        'span.label': span === 'vista.data.hydrate' ? 'data.hydrate' : 'data.refresh',
      },
    }),
  )


/**
 * Tests whether a path or app-version identifier targets a draft route, accepting both
 * leading-slash and bare route forms.
 */
export const isVistaDraftRoute = (pathOrAppVersionId: string): boolean =>
  /^(?:\/r\/[^/]+\/[^/]+\/draft(?:\/|$)|[^/]+\/[^/]+\/draft(?:\/|$))/.test(pathOrAppVersionId)

const withFrozenFallback = <TValue, TError>(
  primary: BindingAtom<TValue, TError>,
  fallback: BindingAtom<TValue, TError>,
): BindingAtom<TValue, TError> =>
  Atom.readable(
    (get) => {
      const primaryResult = get(primary)
      const fallbackResult = get(fallback)
      if (primaryResult._tag === 'Initial') return AsyncResult.waiting(fallbackResult)
      if (primaryResult._tag !== 'Failure') return primaryResult
      if (Option.isSome(AsyncResult.value(primaryResult))) return primaryResult
      const previous = Option.map(AsyncResult.value(fallbackResult), (value) =>
        AsyncResult.success(value),
      )
      return AsyncResult.replacePrevious(primaryResult, previous)
    },
    (refresh) => refresh(primary),
  )

const PROVIDER_SAFE_REFRESH_MS: Readonly<Record<string, number>> = {
  'agent-timeline': 60_000,
  gh: 30_000,
  otel: 10_000,
  'omp-usage': 60_000,
}

/**
 * Clamps a requested refresh interval to at least the provider-specific minimum safe cadence,
 * returning whichever bound is larger.
 */
export const effectiveRefreshEvery = (provider: string, requested: number): number =>
  Math.max(requested, PROVIDER_SAFE_REFRESH_MS[provider] ?? 0)

const refreshEvery = <TValue, TError>(
  source: BindingAtom<TValue, TError>,
  milliseconds: number,
  refresh: (action: () => void) => void,
): BindingAtom<TValue, TError> =>
  Atom.readable(
    (get) => {
      const result = get(source)
      if (!AsyncResult.isWaiting(result)) {
        // A cadence is delay-after-completion, not a deadline. In particular, a
        // slow provider must be allowed to finish before another refresh starts.
        const delay = result._tag === 'Failure' ? Math.min(milliseconds * 4, 60_000) : milliseconds
        const timeout = globalThis.setTimeout(() => refresh(() => get.refresh(source)), delay)
        get.addFinalizer(() => globalThis.clearTimeout(timeout))
      }
      return result
    },
    (refreshSource) => refreshSource(source),
  )

const snapshotState = (snapshot: Snapshot): ReadonlyArray<Hydration.DehydratedAtomValue> =>
  Object.entries(snapshot.entries).map(([key, entry]) => ({
    '~effect/reactivity/Hydration/DehydratedAtom': true,
    key,
    value: {
      _tag: 'Success',
      value: entry.encodedValue,
      waiting: false,
      timestamp: Date.parse(entry.capturedAt),
    },
    dehydratedAt: Date.parse(snapshot.frozenAt),
  }))

/**
 * Runtime context for data bindings, holding the atom registry, hydrated snapshot, binding-atom
 * resolution, and disposal/refresh controls shared across components.
 */
export interface DataRuntime {
  readonly appVersionId: string
  readonly registry: AtomRegistry.AtomRegistry
  readonly snapshot: Snapshot
  readonly hydrationState: ReadonlyArray<Hydration.DehydratedAtomValue>
  readonly atomFor: <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
    binding: DataBinding<TArgs, TValue, TError, TPolicy>,
  ) => BindingAtom<TValue, TError>
  readonly dispose: () => void
  readonly refresh: (provider: string, rpc: string, action: () => void) => void
}

/**
 * Configuration accepted by makeDataRuntime, including the app version, untrusted snapshot
 * payload, data base URL, and optional registry, visibility, fetch, and telemetry overrides.
 */
export interface DataRuntimeOptions {
  readonly appVersionId: string
  readonly snapshot: unknown
  readonly dataBaseUrl: string | URL
  readonly registry?: AtomRegistry.AtomRegistry
  readonly visibility?: DataVisibility
  readonly fetch?: typeof globalThis.fetch
  readonly telemetryContext?: Context.Context<never>
}
const schemaMismatch = (binding: AnyBinding, key: SnapshotKey, message: string): SchemaMismatch =>
  new SchemaMismatch({
    provider: binding.operation.providerId,
    operation: binding.operation.tag,
    key,
    message,
  })

const formatSchemaIssue = SchemaIssue.makeFormatterDefault()
const formatSchemaMismatch = (error: Schema.SchemaError): string =>
  formatSchemaIssue(error.issue)
    .replaceAll('Missing key', 'Expected required property, actual property is missing')
    .replaceAll(
      'Expected no excess property',
      'Expected no excess property, actual property is present',
    )

const formatRpcDefect = (message: string): string =>
  message
    .replace(/^Error:\s*/, '')
    .split('\n')
    .filter((line) => !/^\s+at (?!\[)/.test(line))
    .join('\n')

const rpcSchemaMismatch = (
  binding: AnyBinding,
  key: SnapshotKey,
  cause: Cause.Cause<unknown>,
): SchemaMismatch => {
  const defect = Result.getOrUndefined(Cause.findDefect(cause))
  const message = Schema.isSchemaError(defect)
    ? formatSchemaMismatch(defect)
    : formatRpcDefect(Cause.pretty(cause))
  return schemaMismatch(binding, key, message)
}

const normalizeRpcError = <TError,>(
  binding: AnyBinding,
  key: SnapshotKey,
  error: TError | RpcClientError,
): TError | RpcClientError | SchemaMismatch =>
  error instanceof RpcClientError && error.reason._tag === 'RpcClientDefect'
    ? schemaMismatch(binding, key, formatRpcDefect(error.reason.message))
    : error

const normalizeSubscriptionError = (
  binding: AnyBinding,
  key: SnapshotKey,
  error: unknown,
): unknown =>
  error instanceof RpcClientError
    ? error.reason._tag === 'RpcClientDefect'
      ? schemaMismatch(binding, key, formatRpcDefect(error.reason.message))
      : new SubscriptionError({
          provider: binding.operation.providerId,
          operation: binding.operation.tag,
          key,
          message: error.message,
        })
    : error

/** Bundles an event target with a predicate for gating data queries on element visibility. */
export interface DataVisibility {
  readonly target: Stream.EventListener<Event>
  readonly isVisible: () => boolean
}

/**
 * Builds a DataRuntime from the given options, validating the snapshot, wiring the atom registry
 * and visibility-aware fetching, and returning an object that can be disposed and refreshed.
 */
export const makeDataRuntime = ({
  appVersionId,
  snapshot: untrustedSnapshot,
  dataBaseUrl,
  registry: suppliedRegistry,
  visibility: suppliedVisibility,
  fetch: suppliedFetch,
  telemetryContext,
}: DataRuntimeOptions): DataRuntime => {
  const runTelemetry: RunTelemetry =
    telemetryContext === undefined ? Effect.runSync : Effect.runSyncWith(telemetryContext)
  const snapshot = runTelemetry(
    instrumentDataAction(
      dataHydrations,
      'vista.data.hydrate',
      { 'app.version.id': appVersionId },
      () => Schema.decodeUnknownSync(SnapshotSchema)(untrustedSnapshot, strict),
    ),
  )
  const registry = suppliedRegistry ?? AtomRegistry.make({ scheduleTask })
  const atoms = new WeakMap<object, Atom.Atom<unknown>>()
  const derivedAtoms = new Map<string, Atom.Atom<unknown>>()
  const draft = isVistaDraftRoute(appVersionId)
  const baseUrl = new URL(
    dataBaseUrl,
    typeof document === 'undefined' ? 'http://localhost/' : document.baseURI,
  )
  const fetchHttpLayer =
    suppliedFetch === undefined
      ? FetchHttpClient.layer
      : FetchHttpClient.layer.pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, suppliedFetch)),
        )

  const visibility =
    suppliedVisibility ??
    (typeof document === 'undefined'
      ? undefined
      : {
          target: document,
          isVisible: () => document.visibilityState === 'visible',
        })
  const visibilityChanges =
    visibility === undefined
      ? Stream.concat(Stream.succeed(true), Stream.never)
      : Stream.concat(
          Stream.succeed(visibility.isVisible()),
          Stream.fromEventListener(visibility.target, 'visibilitychange').pipe(
            Stream.map(() => visibility.isVisible()),
            Stream.changes,
          ),
        )

  const atomFor = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
    binding: DataBinding<TArgs, TValue, TError, TPolicy>,
  ): BindingAtom<TValue, TError> => {
    const cached = atoms.get(binding)
    if (cached !== undefined) return cached as BindingAtom<TValue, TError>

    if (isMappedOperation(binding.operation)) {
      const operation = binding.operation as unknown as MappedOperation<
        TArgs,
        unknown,
        unknown,
        TValue,
        TError
      >
      const cacheKey = Effect.runSync(mappedAtomKey(binding))
      const cachedProjection = derivedAtoms.get(cacheKey)
      if (cachedProjection !== undefined) return cachedProjection as BindingAtom<TValue, TError>
      const source = bind(operation.source, operation.mapArgs(binding.args), binding.policy)
      const projected = Atom.mapResult(
        atomFor(source),
        (resolved): Resolved<TValue> => ({
          ...resolved,
          value: operation.map(resolved.value, binding.args),
        }),
      ) as BindingAtom<TValue, TError>
      derivedAtoms.set(cacheKey, projected)
      atoms.set(binding, projected)
      return projected
    }

    if (isFlatMappedOperation(binding.operation)) {
      const operation = binding.operation as unknown as FlatMappedOperation<
        TArgs,
        unknown,
        unknown,
        TValue,
        TError,
        unknown
      >
      const parent = bind(operation.source, binding.args)
      const rawParent = sourceBinding(parent)
      const { key: parentKey, entry: parentEntry } = Effect.runSync(
        readSnapshotBinding(snapshot, parent),
      )
      if (parentEntry === undefined) {
        const missing = new FrozenEntryMissing({ key: parentKey }).pipe(
          AsyncResult.fail,
          Atom.make,
        ) as BindingAtom<TValue, TError>
        atoms.set(binding, missing)
        return missing
      }
      const decoded = Schema.decodeUnknownResult(
        rawParent.operation.successSchema,
        strict,
      )(parentEntry.encodedValue)
      if (Result.isFailure(decoded)) {
        const mismatch = schemaMismatch(
          binding as AnyBinding,
          parentKey,
          formatSchemaMismatch(decoded.failure),
        ).pipe(AsyncResult.fail, Atom.make) as BindingAtom<TValue, TError>
        atoms.set(binding, mismatch)
        return mismatch
      }
      const selected = operation.select(
        projectMappedSourceValue(operation.source, binding.args, decoded.success),
      )
      const child = atomFor(bind(selected.operation, selected.args, binding.policy)) as BindingAtom<
        TValue,
        TError
      >
      atoms.set(binding, child)
      return child
    }

    const { encodedArgs, key, entry } = Effect.runSync(readSnapshotBinding(snapshot, binding))
    const successSchema = binding.operation.successSchema
    const snapshotResultSchema = AsyncResult.Schema({
      success: successSchema,
      error: Schema.Union([FrozenEntryMissing, SchemaMismatch]),
    })
    const snapshotWireSchema = Schema.toCodecJson(snapshotResultSchema)
    let snapshotResult: AsyncResult.AsyncResult<TValue, FrozenEntryMissing | SchemaMismatch>
    if (entry === undefined) {
      snapshotResult = AsyncResult.fail(new FrozenEntryMissing({ key }))
    } else {
      const decoded = Schema.decodeUnknownResult(successSchema)(entry.encodedValue, strict)
      snapshotResult = Result.isSuccess(decoded)
        ? AsyncResult.success(decoded.success, { timestamp: Date.parse(entry.capturedAt) })
        : AsyncResult.fail(
            schemaMismatch(binding as AnyBinding, key, formatSchemaMismatch(decoded.failure)),
          )
    }
    registry.setSerializable(key, Schema.encodeSync(snapshotWireSchema)(snapshotResult))
    // Hydration preloads are consumed; evicted atoms must recreate the immutable seed.
    const snapshotAtom = Atom.make<AsyncResult.AsyncResult<TValue, FrozenEntryMissing | SchemaMismatch>>(
      snapshotResult,
    ).pipe(Atom.serializable({ key, schema: snapshotResultSchema }))
    const frozen = Atom.mapResult(
      snapshotAtom,
      (value): Resolved<TValue> => ({
        _tag: 'Frozen',
        value,
        frozenAt: snapshot.frozenAt,
      }),
    ) as BindingAtom<TValue, TError>

    const effectiveMode = draft && binding.policy.mode === 'frozen' ? 'live' : binding.policy.mode
    if (effectiveMode === 'frozen') {
      atoms.set(binding, frozen)
      return frozen
    }
    if (effectiveMode === 'subscription') {
      if (!('kind' in binding.operation) || binding.operation.kind !== 'subscription') {
        throw new Error('subscription bindings require subscription() operation descriptors')
      }
      const seed = Option.getOrUndefined(AsyncResult.value(snapshotResult))
      if (seed === undefined) {
        atoms.set(binding, frozen)
        return frozen
      }
      const operation = binding.operation as SubscriptionOperation<
        string,
        TArgs,
        TValue,
        unknown,
        TError
      >
      const stateRef = Effect.runSync(SubscriptionRef.make<TValue>(seed))
      const reactivityKeys = [operation.providerId, operation.tag, key] as const
      class SubscriptionClient extends AtomRpc.Service<SubscriptionClient>()(
        `Vista/Data/Subscription/${appVersionId}/${operation.providerId}`,
        {
          group: operation.group,
          protocol: RpcClient.layerProtocolHttp({
            url: new URL(encodeURIComponent(operation.providerId), baseUrl).href,
          }).pipe(Layer.provide(layerNdjson), Layer.provide(fetchHttpLayer)),
          spanPrefix: `vista.data.subscription.${operation.providerId}`,
        },
      ) {}
      const withSubscriptionClient = SubscriptionClient.use.bind(SubscriptionClient)
      const connect = (state: TValue) => {
        const payload = {
          ...(binding.args as object),
          since: operation.cursor(state),
        } as TArgs
        const events = Stream.unwrap(
          withSubscriptionClient((client) =>
            Effect.succeed(
              (client as unknown as DynamicSubscriptionClient<TArgs, unknown, TError>)(
                operation.tag,
                payload,
              ),
            ),
          ),
        ).pipe(
          Stream.mapError(
            (error) =>
              normalizeSubscriptionError(binding as AnyBinding, key, error) as
                | TError
                | SubscriptionError,
          ),
          Stream.mapEffect((event) =>
            Schema.decodeUnknownEffect(
              operation.eventSchema,
              strict,
            )(event).pipe(
              Effect.mapError((error) =>
                schemaMismatch(binding as AnyBinding, key, formatSchemaMismatch(error)),
              ),
              Effect.flatMap((decoded) =>
                SubscriptionRef.updateAndGet(stateRef, (current) =>
                  operation.fold(current, decoded),
                ),
              ),
              Effect.tap(() => Reactivity.invalidate(reactivityKeys)),
            ),
          ),
          Stream.map(
            (value): Resolved<TValue> => ({
              _tag: 'Live',
              value,
              observedAt: new Date().toISOString(),
            }),
          ),
          Stream.catchCauseIf(Cause.hasDies, (cause) =>
            Stream.fail(rpcSchemaMismatch(binding as AnyBinding, key, cause)),
          ),
          Stream.withSpan(`vista.data.subscription.${operation.providerId}.${operation.tag}`, {
            attributes: { 'snapshot.key': key },
          }),
        )
        return Stream.concat(
          Stream.succeed<Resolved<TValue>>({
            _tag: 'CatchingUp',
            value: state,
            frozenAt: snapshot.frozenAt,
          }),
          events,
        )
      }
      const subscriptionStream = visibilityChanges.pipe(
        Stream.switchMap((visible) =>
          visible
            ? Stream.unwrap(SubscriptionRef.get(stateRef).pipe(Effect.map(connect)))
            : Stream.never,
        ),
      )
      const live = SubscriptionClient.runtime
        .atom(subscriptionStream)
        .pipe(Atom.autoDispose) as BindingAtom<TValue, TError>
      const resolved = withFrozenFallback(live, frozen)
      atoms.set(binding, resolved)
      return resolved
    }

    class ProviderClient extends AtomRpc.Service<ProviderClient>()(
      `Vista/Data/${appVersionId}/${binding.operation.providerId}`,
      {
        group: binding.operation.group,
        protocol: RpcClient.layerProtocolHttp({
          url: new URL(encodeURIComponent(binding.operation.providerId), baseUrl).href,
        }).pipe(Layer.provide(layerJson), Layer.provide(fetchHttpLayer)),
        spanPrefix: `vista.data.live.${binding.operation.providerId}`,
      },
    ) {}
    const withProviderClient = ProviderClient.use.bind(ProviderClient)

    let live: BindingAtom<TValue, TError> = ProviderClient.runtime
      .atom<TValue, DataError<TError>>(
        withProviderClient((client) => {
          const call = client as unknown as DynamicClient<TArgs, TError>
          return call(binding.operation.tag, binding.args).pipe(
            Effect.mapError((error) => normalizeRpcError(binding as AnyBinding, key, error)),
            Effect.flatMap((value) =>
              Schema.decodeUnknownEffect(
                successSchema,
                strict,
              )(value).pipe(
                Effect.mapError((error) =>
                  schemaMismatch(binding as AnyBinding, key, formatSchemaMismatch(error)),
                ),
              ),
            ),
            Effect.catchCauseIf(Cause.hasDies, (cause) =>
              Effect.fail(rpcSchemaMismatch(binding as AnyBinding, key, cause)),
            ),
            Effect.withSpan(
              `vista.data.live.${binding.operation.providerId}.${binding.operation.tag}`,
              {
                attributes: { 'snapshot.key': key },
              },
            ),
          )
        }),
      )
      .pipe(
        Atom.mapResult(
          (value): Resolved<TValue> => ({
            _tag: 'Live',
            value,
            observedAt: new Date().toISOString(),
          }),
        ),
        Atom.autoDispose,
      ) as BindingAtom<TValue, TError>
    live = ProviderClient.runtime.factory.withReactivity([
      binding.operation.providerId,
      binding.operation.tag,
      key,
    ])(live)
    if (binding.policy.mode === 'live' && binding.policy.refreshEvery !== undefined) {
      const cadence = effectiveRefreshEvery(
        binding.operation.providerId,
        binding.policy.refreshEvery,
      )
      live = refreshEvery(live, cadence, (action) =>
        runTelemetry(
          instrumentDataAction(
            dataRefreshes,
            'vista.data.refresh',
            {
              'app.version.id': appVersionId,
              'provider.id': binding.operation.providerId,
              'rpc.tag': binding.operation.tag,
              'refresh.cadence.ms': String(cadence),
              trigger: 'cadence',
            },
            action,
          ),
        ),
      )
    }
    const resolved = draft ? live : withFrozenFallback(live, frozen)
    atoms.set(binding, resolved)
    void encodedArgs
    return resolved
  }

  return {
    appVersionId,
    registry,
    snapshot,
    hydrationState: snapshotState(snapshot),
    atomFor,
    refresh: (provider, rpc, action) =>
      runTelemetry(
        instrumentDataAction(
          dataRefreshes,
          'vista.data.refresh',
          {
            'app.version.id': appVersionId,
            'provider.id': provider,
            'rpc.tag': rpc,
            trigger: 'explicit',
          },
          action,
        ),
      ),
    dispose: suppliedRegistry === undefined ? () => registry.dispose() : () => undefined,
  }
}

const DataRuntimeContext = React.createContext<DataRuntime | undefined>(undefined)

const DataRuntimeBoundary = ({
  actorSource,
  appVersionId,
  snapshot,
  dataBaseUrl,
  fetch,
  children,
}: {
  readonly actorSource: ActorSource
  readonly appVersionId: string
  readonly snapshot: Snapshot
  readonly dataBaseUrl: string | URL
  readonly fetch?: typeof globalThis.fetch
  readonly children: React.ReactNode
}): React.ReactNode => {
  const registry = React.useContext(RegistryContext)
  const runtime = React.useMemo(
    () =>
      makeDataRuntime({
        appVersionId,
        snapshot,
        dataBaseUrl,
        registry,
        ...(fetch === undefined ? {} : { fetch }),
      }),
    [appVersionId, dataBaseUrl, fetch, registry, snapshot],
  )
  return (
    <DataRuntimeContext.Provider value={runtime}>
      <DataCommandTransportProvider
        actorSource={actorSource}
        dataBaseUrl={dataBaseUrl}
        {...(fetch === undefined ? {} : { fetch })}
      >
        <HydrationBoundary state={runtime.hydrationState}>{children}</HydrationBoundary>
      </DataCommandTransportProvider>
    </DataRuntimeContext.Provider>
  )
}

/** One AtomRegistry and provider RPC runtime graph per mounted AppVersion. */
export const DataRuntimeProvider = ({
  actorSource = 'none',
  appVersionId,
  snapshot,
  dataBaseUrl,
  fetch,
  children,
}: {
  readonly actorSource?: ActorSource
  readonly appVersionId: string
  readonly snapshot: Snapshot
  readonly dataBaseUrl: string | URL
  readonly fetch?: typeof globalThis.fetch
  readonly children: React.ReactNode
}): React.ReactNode => (
  <RegistryProvider>
    <DataRuntimeBoundary
      actorSource={actorSource}
      appVersionId={appVersionId}
      snapshot={snapshot}
      dataBaseUrl={dataBaseUrl}
      {...(fetch === undefined ? {} : { fetch })}
    >
      {children}
    </DataRuntimeBoundary>
  </RegistryProvider>
)
/**
 * Props required by the published data runtime provider component, identifying the actor source,
 * snapshot and data endpoints, app version, and children to render inside the runtime context.
 */
export interface PublishedDataRuntimeProps {
  readonly actorSource: ActorSource
  readonly snapshotUrl: string
  readonly appVersionId: string
  readonly dataBaseUrl: string
  readonly children: React.ReactNode
}
const PublishedSnapshotNotice = ({
  mode,
}: {
  readonly mode: React.ComponentProps<typeof LazySnapshotModeView>['mode']
}): React.ReactNode => (
  <React.Suspense fallback={null}>
    <LazySnapshotModeView mode={mode} />
  </React.Suspense>
)

const PublishedDataRuntimeBoundary = ({
  actorSource,
  snapshotUrl,
  appVersionId,
  dataBaseUrl,
  children,
}: PublishedDataRuntimeProps): React.ReactNode => {
  const result = useAtomValue(publishedSnapshotAtom(snapshotUrl))
  if (result._tag === 'Initial') return null
  if (result._tag === 'Failure') return <PublishedSnapshotNotice mode={{ _tag: 'unavailable' }} />

  const resolution = result.value
  switch (resolution._tag) {
    case 'frozen':
      return (
        <DataRuntimeProvider
          actorSource={actorSource}
          appVersionId={appVersionId}
          snapshot={resolution.snapshot}
          dataBaseUrl={dataBaseUrl}
        >
          {children}
        </DataRuntimeProvider>
      )
    case 'unsupported':
      return (
        <PublishedSnapshotNotice
          mode={{
            _tag: 'unsupported',
            reason: resolution.reason,
            ...(resolution.found === undefined ? {} : { found: resolution.found }),
          }}
        />
      )
    case 'unavailable':
      return <PublishedSnapshotNotice mode={{ _tag: 'unavailable' }} />
  }
}

/**
 * Published runtimes fetch and validate their immutable snapshot before authored
 * children mount. Any ambiguous or invalid response stays visibly fail-closed.
 */
export const PublishedDataRuntime = (props: PublishedDataRuntimeProps): React.ReactNode => (
  <RegistryProvider>
    <PublishedDataRuntimeBoundary {...props} />
  </RegistryProvider>
)

const extractionResult = AsyncResult.initial<Resolved<never>, never>()
const extractionAtom = Atom.make(extractionResult)

/**
 * Subscribes to a data binding and returns its current result, stable semantic identifier, and
 * whether the app is currently in extraction mode; falls back to an extraction placeholder atom
 * when no runtime is present.
 */
export const useBindingContext = <TArgs, TValue, TError, TPolicy extends BindingPolicy,>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): {
  readonly result: BindingResult<TValue, TError>
  readonly semanticId: string
  readonly extracting: boolean
} => {
  const semantic = useDataBinding(binding)
  const runtime = React.useContext(DataRuntimeContext)
  const result = useAtomValue(
    (runtime?.atomFor(binding) ?? extractionAtom) as Atom.Atom<BindingResult<TValue, TError>>,
  )
  if (semantic.extracting) return { ...semantic, result: extractionResult }
  if (runtime === undefined) throw new Error('useBinding requires DataRuntimeProvider')
  return { ...semantic, result }
}

/**
 * Read only the immutable publication seed for a binding. This registers the
 * authored binding but deliberately never mounts its live/subscription atom.
 */
export const useCapturedBindingContext = <TArgs, TValue, TError, TPolicy extends BindingPolicy>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): {
  readonly result: BindingResult<TValue, TError>
  readonly semanticId: string
  readonly extracting: boolean
} => {
  const semantic = useDataBinding(binding)
  const runtime = React.useContext(DataRuntimeContext)
  if (semantic.extracting) return { ...semantic, result: extractionResult }
  if (runtime === undefined)
    throw new Error('useCapturedBindingContext requires DataRuntimeProvider')

  const { key, entry } = Effect.runSync(readSnapshotBinding(runtime.snapshot, binding))
  if (entry === undefined) {
    return {
      ...semantic,
      result: AsyncResult.fail(new FrozenEntryMissing({ key })),
    }
  }
  const decoded = Schema.decodeUnknownResult(binding.operation.successSchema)(
    entry.encodedValue,
    strict,
  )
  if (Result.isFailure(decoded)) {
    return {
      ...semantic,
      result: AsyncResult.fail(
        schemaMismatch(binding as AnyBinding, key, formatSchemaMismatch(decoded.failure)),
      ),
    }
  }
  return {
    ...semantic,
    result: AsyncResult.success({
      _tag: 'Frozen',
      value: decoded.success,
      frozenAt: runtime.snapshot.frozenAt,
    }),
  }
}

/**
 * Returns the current binding result (value, loading, or failure) for the given data binding,
 * re-rendering the component as it changes.
 */
export const useBinding = <TArgs, TValue, TError, TPolicy extends BindingPolicy,>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): BindingResult<TValue, TError> => useBindingContext(binding).result

/**
 * Suspends the component until the given data binding resolves, then returns the successfully
 * loaded value; throws on binding failure.
 */
export const useBindingSuspense = <TArgs, TValue, TError, TPolicy extends BindingPolicy,>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): Resolved<TValue> => {
  useDataBinding(binding)
  const runtime = React.useContext(DataRuntimeContext)
  return useAtomSuspense(
    (runtime?.atomFor(binding) ?? extractionAtom) as Atom.Atom<BindingResult<TValue, TError>>,
  ).value
}

type RefreshablePolicy = Extract<BindingPolicy, { readonly mode: 'live' | 'subscription' }>
const extractionRefreshAtom = Atom.make(undefined)

/**
 * Returns a callback that re-executes the given live or subscription binding, requiring a
 * DataRuntimeProvider (unless extracting) and routing the refresh through the runtime's
 * instrumentation.
 */
export const useRefresh = <TArgs, TValue, TError, TPolicy extends RefreshablePolicy,>(
  binding: DataBinding<TArgs, TValue, TError, TPolicy>,
): (() => void) => {
  const extracting = useDataExtraction()
  const runtime = React.useContext(DataRuntimeContext)
  const refresh = useAtomRefresh(runtime?.atomFor(binding) ?? extractionRefreshAtom)
  const instrumentedRefresh = React.useCallback(() => {
    if (extracting) {
      refresh()
      return
    }
    if (runtime === undefined) throw new Error('useRefresh requires DataRuntimeProvider')
    runtime.refresh(binding.operation.providerId, binding.operation.tag, refresh)
  }, [binding.operation.providerId, binding.operation.tag, extracting, refresh, runtime])
  return instrumentedRefresh
}

/**
 * Extracts the successfully resolved value from a binding result, returning undefined while
 * pending, failed, or absent.
 */
export const availableValue = <TValue, TError,>(
  result: BindingResult<TValue, TError>,
): Resolved<TValue> | undefined => Option.getOrUndefined(AsyncResult.value(result))

const field = (value: unknown, name: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined

const textField = (value: unknown, name: string): string | undefined => {
  const candidate = field(value, name)
  return typeof candidate === 'string' ? candidate : undefined
}

const schemaMismatchPath = (message: string): string => {
  const path = message
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.includes('["') || line.startsWith('at '))
  return path === undefined ? 'the response root' : path.replace(/^[└├─\s]+/, '')
}

const conciseFailure = (error: unknown): string => {
  if (error instanceof SchemaMismatch) {
    return `${error.provider}.${error.operation} returned data that does not match the schema at ${schemaMismatchPath(error.message)}`
  }
  if (error instanceof RpcClientError) {
    return `Transport unavailable: ${error.reason.message}`
  }
  const tag = textField(error, '_tag')
  const message = textField(error, 'message')
  if (tag === 'ProviderCallFailed') {
    const provider = textField(error, 'provider') ?? 'provider'
    const operation = textField(error, 'operation') ?? 'operation'
    return `${provider}.${operation} failed: ${message ?? 'provider call failed'}`
  }
  if (tag === 'OmpUsageError' && textField(error, 'reason') === 'transport') {
    return `Transport unavailable: ${message ?? 'OMP Usage request failed'}`
  }
  if (message !== undefined) return message
  return 'The data provider failed.'
}

/**
 * Derives a short human-readable error message from a failed binding result, falling back to a
 * generic provider-failure string when no typed failure reason is present.
 */
export const bindingFailureMessage = <TValue, TError,>(
  result: AsyncResult.Failure<TValue, TError>,
): string => {
  const failure = result.cause.reasons.find(Cause.isFailReason)
  return failure === undefined ? 'The data provider failed.' : conciseFailure(failure.error)
}

/**
 * Renders a collapsible details element that pretty-prints the failure cause of a binding result
 * for debugging.
 */
export const BindingFailureDiagnostic = <TValue, TError,>({
  result,
}: {
  readonly result: AsyncResult.Failure<TValue, TError>
}): React.ReactNode => (
  <details>
    <summary>Diagnostic details</summary>
    <pre>{Cause.pretty(result.cause)}</pre>
  </details>
)

export type { Rpc }
