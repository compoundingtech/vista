import type { Cursor, Operation, SubscriptionOperation } from '@vista/blocks/internal/data-contract'
import { snapshotKey } from '@vista/blocks/internal/data-contract'
import { Context, Effect, Exit, Layer, Metric, Schema, Stream, type Scope } from 'effect'
import { HttpRouter } from 'effect/http'
import type * as Rpc from 'effect/rpc/Rpc'
import type * as RpcGroup from 'effect/rpc/RpcGroup'
import { layerJson, layerNdjson } from 'effect/rpc/RpcSerialization'
import * as RpcServer from 'effect/rpc/RpcServer'

import { dataCallDuration, dataCalls, trackDuration } from '../metrics.ts'
import {
  VistaExplorerMiddleware,
  explorerServerLayer,
  type ProviderExplorer,
} from '../rpc-explorer.ts'
import type { LiveDriver, ProviderBudget, SubscriptionHubService } from './live-hub.ts'

/**
 * Classifies a provider as pure (deterministic and safely replayable) or effectful (dependent on
 * live side effects), which drives whether calls may be captured or must hit the live path.
 */
export type Purity = 'pure' | 'effectful'
/**
 * Selects whether a provider call executes against the real upstream or is served through the
 * capture/replay machinery.
 */
export type ProviderCallPath = 'live' | 'capture'
/**
 * Tagged error surfaced when invoking a provider operation fails, carrying the provider id,
 * operation name, and human-readable message for upstream reporting.
 */
export class ProviderCallFailed extends Schema.TaggedError<ProviderCallFailed>()(
  'ProviderCallFailed',
  {
    provider: Schema.String,
    operation: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Static shape every provider contract satisfies: a stable id, the RPC group clients call, and the
 * complete record of query, command, and subscription operation descriptors.
 */
export interface ProviderContractShape<TRpcs extends Rpc.AnyWithProps> {
  readonly id: string
  readonly group: RpcGroup.RpcGroup<TRpcs>
  readonly ops: Readonly<Record<string, unknown>>
}

/**
 * Maps each subscription operation of a contract to an optional LiveDriver whose argument, state,
 * event, and error types are inferred to match that operation, so mismatched drivers fail to
 * typecheck.
 */
export type LiveDrivers<TContract extends { readonly ops: object }, TRequirements> = {
  readonly [TKey in keyof TContract['ops']]?: TContract['ops'][TKey] extends SubscriptionOperation<
    string,
    infer TArgs,
    infer TState,
    infer TEvent,
    infer TError
  >
    ? LiveDriver<TArgs, TState, TEvent, TError, TRequirements>
    : never
}

/**
 * A complete provider implementation combining its contract, purity, RPC handlers, optional
 * per-operation live drivers, and optional authorization gate applied on the live path.
 */
export interface ProviderImplementation<
  TRpcs extends Rpc.AnyWithProps,
  THandlers extends RpcGroup.HandlersFrom<TRpcs>,
  TContract extends ProviderContractShape<TRpcs> = ProviderContractShape<TRpcs>,
> {
  readonly _tag: 'ProviderImplementation'
  readonly contract: TContract
  readonly purity: Purity
  readonly handlers: THandlers
  readonly live?: LiveDrivers<TContract, RpcGroup.HandlersServices<TRpcs, THandlers>>
  readonly authorizeLive?: (
    tag: string,
    payload: unknown,
    requestOptions: unknown,
  ) => Effect.Effect<void, Rpc.ErrorExit<TRpcs>>
}

/**
 * The runtime-mounted form of a provider, exposing its id, purity, RPC group, core handlers, full
 * implementation, and the layer that supplies the services those handlers require.
 */
export interface ProviderMount<
  TRpcs extends Rpc.AnyWithProps = Rpc.AnyWithProps,
  THandlers extends RpcGroup.HandlersFrom<TRpcs> = RpcGroup.HandlersFrom<TRpcs>,
  TContract extends ProviderContractShape<TRpcs> = ProviderContractShape<TRpcs>,
> {
  readonly _tag: 'ProviderMount'
  readonly id: string
  readonly purity: Purity
  readonly group: RpcGroup.RpcGroup<TRpcs>
  readonly core: THandlers
  readonly implementation: ProviderImplementation<TRpcs, THandlers, TContract>
  readonly layer: Layer.Layer<RpcGroup.HandlersServices<TRpcs, THandlers>>
}

/**
 * Dispatch table mapping each RPC operation name to its handler, which receives an opaque payload
 * and returns either a one-shot Effect or a streaming Stream failing with the group's
 * Rpc.ErrorExit.
 */
export type ProviderCore<TRpcs extends Rpc.AnyWithProps = Rpc.AnyWithProps> = Record<
  string,
  (
    payload: unknown,
    options?: unknown,
  ) => Effect.Effect<unknown, Rpc.ErrorExit<TRpcs>> | Stream.Stream<unknown, Rpc.ErrorExit<TRpcs>>
>

/**
 * Fully assembled provider exposing its identity, purity class, RPC group and contract, its
 * operation core, a direct call entry point that resolves an operation by tag and call path into
 * an Effect failing with ProviderCallFailed, and a low-level Request-to-Response handler for
 * serving the provider over HTTP.
 */
export interface MountedProvider<TRpcs extends Rpc.AnyWithProps = Rpc.AnyWithProps> {
  readonly id: string
  readonly purity: Purity
  readonly group: RpcGroup.RpcGroup<TRpcs>
  readonly contract: ProviderContractShape<TRpcs>
  readonly core: ProviderCore<TRpcs>
  readonly call: (
    tag: string,
    payload: unknown,
    path: ProviderCallPath,
  ) => Effect.Effect<unknown, ProviderCallFailed>
  readonly handler: (request: Request) => Promise<Response>
}

/**
 * Builds a provider implementation by pairing the provider contract with a purity classification
 * and typed handlers, wrapping them into a dispatchable core so the group's operations can be
 * served.
 */
export const implement = <
  TRpcs extends Rpc.AnyWithProps,
  THandlers extends RpcGroup.HandlersFrom<TRpcs>,
  TContract extends {
    readonly id: string
    readonly ops: Readonly<Record<string, unknown>>
  },
>(
  providerContract: TContract & { readonly group: RpcGroup.RpcGroup<TRpcs> },
  options: {
    readonly purity: Purity
    readonly handlers: THandlers
    readonly live?: LiveDrivers<TContract, RpcGroup.HandlersServices<TRpcs, THandlers>>
    readonly authorizeLive?: (
      tag: string,
      payload: unknown,
      requestOptions: unknown,
    ) => Effect.Effect<void, Rpc.ErrorExit<TRpcs>>
  },
): ProviderImplementation<
  TRpcs,
  THandlers,
  TContract & { readonly group: RpcGroup.RpcGroup<TRpcs> }
> => ({
  _tag: 'ProviderImplementation',
  contract: providerContract,
  purity: options.purity,
  handlers: options.handlers,
  ...(options.live === undefined ? {} : { live: options.live }),
  ...(options.authorizeLive === undefined ? {} : { authorizeLive: options.authorizeLive }),
})

/**
 * Combines a provider implementation with a Layer supplying its handlers' service dependencies,
 * returning a ProviderMount tagged value carrying the provider's id, purity, group, and wiring for
 * later mounting.
 */
export const mountProvider = <
  TRpcs extends Rpc.AnyWithProps,
  THandlers extends RpcGroup.HandlersFrom<TRpcs>,
  TContract extends ProviderContractShape<TRpcs>,
>(
  implementation: ProviderImplementation<TRpcs, THandlers, TContract>,
  layer: Layer.Layer<RpcGroup.HandlersServices<TRpcs, THandlers>>,
): ProviderMount<TRpcs, THandlers, TContract> => ({
  _tag: 'ProviderMount',
  id: implementation.contract.id,
  purity: implementation.purity,
  group: implementation.contract.group,
  core: implementation.handlers,
  implementation,
  layer,
})

/**
 * Type guard that narrows an unknown value to ProviderMount by checking it is a non-null object
 * whose _tag field equals 'ProviderMount'.
 */
export const isProviderMount = (value: unknown): value is ProviderMount =>
  typeof value === 'object' && value !== null && Reflect.get(value, '_tag') === 'ProviderMount'

type DynamicOperation = Operation<string, unknown, unknown, unknown>
type DynamicSubscriptionOperation = SubscriptionOperation<
  string,
  unknown,
  unknown,
  unknown,
  unknown
>

const isSubscriptionOperation = (
  operation: DynamicOperation,
): operation is DynamicSubscriptionOperation => Reflect.get(operation, 'kind') === 'subscription'

const operationFor = <TRpcs extends Rpc.AnyWithProps>(
  implementation: ProviderImplementation<TRpcs, RpcGroup.HandlersFrom<TRpcs>>,
  tag: string,
): DynamicOperation => {
  const operations = implementation.contract.ops as Readonly<Record<string, DynamicOperation>>
  const operation = operations[tag]
  if (operation === undefined) {
    throw new TypeError(`unknown provider operation ${implementation.contract.id}.${tag}`)
  }
  return operation
}

const instrumentUnary = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  providerId: string,
  operation: DynamicOperation,
  payload: unknown,
  path: ProviderCallPath,
): Effect.Effect<A, E, R> =>
  (Reflect.get(operation, 'kind') === 'command'
    ? Effect.succeed('command-redacted')
    : Schema.encodeUnknownEffect(operation.payloadSchema)(payload).pipe(
        Effect.flatMap((encodedPayload) => snapshotKey(operation, encodedPayload)),
        Effect.orDie,
      )
  ).pipe(
    Effect.flatMap((hash) =>
      effect.pipe(
        trackDuration(
          Metric.withAttributes(dataCallDuration, {
            provider: providerId,
            rpc: operation.tag,
            path,
          }),
        ),
        Effect.onExit((exit) =>
          Metric.update(
            Metric.withAttributes(dataCalls, {
              provider: providerId,
              rpc: operation.tag,
              path,
              outcome: Exit.isSuccess(exit) ? 'ok' : 'error',
            }),
            1,
          ),
        ),
        Effect.withSpan(`vista.provider.${providerId}.${operation.tag}`, {
          attributes: {
            'span.label': `${providerId}.${operation.tag}`,
            'provider.id': providerId,
            'rpc.tag': operation.tag,
            'args.hash': hash,
          },
        }),
      ),
    ),
  )

const instrumentStream = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
  providerId: string,
  operation: DynamicOperation,
  payload: unknown,
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Schema.encodeUnknownEffect(operation.payloadSchema)(payload).pipe(
      Effect.flatMap((encodedPayload) => snapshotKey(operation, encodedPayload)),
      Effect.orDie,
      Effect.map((hash) =>
        stream.pipe(
          Stream.withSpan(`vista.provider.${providerId}.${operation.tag}`, {
            attributes: {
              'span.label': `${providerId}.${operation.tag}`,
              'provider.id': providerId,
              'rpc.tag': operation.tag,
              'args.hash': hash,
            },
          }),
        ),
      ),
    ),
  )

/** Build one provider Layer in the registry-owned Scope and close handlers over it. */
export const materializeProvider = <
  TRpcs extends Rpc.AnyWithProps,
  THandlers extends RpcGroup.HandlersFrom<TRpcs>,
  TWireRpcs extends Rpc.AnyWithProps = never,
>(
  mount: ProviderMount<TRpcs, THandlers>,
  subscriptionHub?: SubscriptionHubService,
  budget?: ProviderBudget,
  providerExplorer?: ProviderExplorer,
  wireAliases: ReadonlyArray<{
    readonly id: string
    readonly group: RpcGroup.RpcGroup<TWireRpcs>
  }> = [],
): Effect.Effect<MountedProvider<TRpcs>, never, Scope.Scope> =>
  Effect.gen(function* () {
    const implementation = mount.implementation
    const context = yield* Layer.build(mount.layer)
    const providerId = implementation.contract.id
    const explorer = providerExplorer?.explorer
    // App-local groups are unknown to the explorer's construction group; a remount under the
    // same owner replaces these descriptors, and the provider Scope releases them.
    if (providerExplorer !== undefined) {
      yield* providerExplorer.explorer.registerDescriptors({
        group: implementation.contract.group,
        owner: `${providerExplorer.appVersionId}/${providerId}`,
      })
    }

    const liveDriver = (tag: string) => {
      const driver = implementation.live?.[tag as keyof typeof implementation.live] as
        | LiveDriver<
            unknown,
            unknown,
            unknown,
            Rpc.ErrorExit<TRpcs>,
            RpcGroup.HandlersServices<TRpcs, THandlers>
          >
        | undefined
      if (driver === undefined) return undefined
      return driver._tag === 'subscribable'
        ? {
            _tag: 'subscribable' as const,
            initial: (args: unknown) => Effect.provide(driver.initial(args), context),
            stream: (args: unknown, since: Cursor) =>
              Stream.provide(driver.stream(args, since), context),
          }
        : {
            _tag: 'pollable' as const,
            initial: (args: unknown) => Effect.provide(driver.initial(args), context),
            poll: (args: unknown, since: Cursor) =>
              Effect.provide(driver.poll(args, since), context),
            ...(driver.cost === undefined ? {} : { cost: driver.cost }),
            interval: driver.interval,
          }
    }

    const run = (
      tag: string,
      payload: unknown,
      path: ProviderCallPath,
      callOptions?: unknown,
    ):
      | Effect.Effect<unknown, Rpc.ErrorExit<TRpcs>>
      | Stream.Stream<unknown, Rpc.ErrorExit<TRpcs>> => {
      const operation = operationFor(
        implementation as unknown as ProviderImplementation<TRpcs, RpcGroup.HandlersFrom<TRpcs>>,
        tag,
      )
      const driver = liveDriver(tag)
      const authorize =
        path === 'live' && implementation.authorizeLive !== undefined
          ? implementation.authorizeLive(tag, payload, callOptions)
          : Effect.void
      if (isSubscriptionOperation(operation) && driver !== undefined && path === 'live') {
        if (subscriptionHub === undefined) {
          return Stream.die(`subscription hub unavailable for ${providerId}.${tag}`)
        }
        const since =
          typeof payload === 'object' && payload !== null && 'since' in payload
            ? (Reflect.get(payload, 'since') as Cursor | undefined)
            : undefined
        return Stream.unwrap(
          authorize.pipe(
            Effect.map(
              () =>
                subscriptionHub.subscribe(
                  operation,
                  payload,
                  driver,
                  since === undefined ? {} : { since },
                ) as Stream.Stream<unknown, Rpc.ErrorExit<TRpcs>>,
            ),
          ),
        )
      }

      if (isSubscriptionOperation(operation) && driver !== undefined && path === 'capture') {
        return instrumentUnary(
          driver.initial(payload),
          providerId,
          operation,
          payload,
          path,
        ) as Effect.Effect<unknown, Rpc.ErrorExit<TRpcs>>
      }

      const handler = implementation.handlers[tag as keyof THandlers] as (
        payload: unknown,
        options?: unknown,
      ) =>
        | Effect.Effect<unknown, Rpc.ErrorExit<TRpcs>, RpcGroup.HandlersServices<TRpcs, THandlers>>
        | Stream.Stream<unknown, Rpc.ErrorExit<TRpcs>, RpcGroup.HandlersServices<TRpcs, THandlers>>
      const result = handler(payload, callOptions)
      if (Stream.isStream(result)) {
        return Stream.unwrap(
          authorize.pipe(
            Effect.map(() =>
              instrumentStream(Stream.provide(result, context), providerId, operation, payload),
            ),
          ),
        )
      }
      const provided = Effect.provide(result, context)
      const admitted =
        path === 'live' && !isSubscriptionOperation(operation) && budget !== undefined
          ? budget.run(providerId, provided)
          : provided
      return authorize.pipe(
        Effect.andThen(instrumentUnary(admitted, providerId, operation, payload, path)),
      )
    }

    const core = Object.fromEntries(
      [...implementation.contract.group.requests.keys()].map((tag) => [
        tag,
        (payload: unknown, options?: unknown) => run(tag, payload, 'live', options),
      ]),
    ) as ProviderCore<TRpcs>

    const makeHandler = <THandlerRpcs extends Rpc.AnyWithProps>(
      serialization: typeof layerJson,
      group: RpcGroup.RpcGroup<THandlerRpcs>,
      rpcPath: `/${string}`,
    ) => {
      const rpcHandlers = group.toLayer(
        Effect.succeed(group.of(core as unknown as RpcGroup.HandlersFrom<THandlerRpcs>)),
      ) as Layer.Layer<Rpc.ToHandler<THandlerRpcs>>
      const options = {
        path: rpcPath,
        protocol: 'http' as const,
        spanPrefix: `vista.rpc.${providerId}`,
        spanAttributes: { 'provider.id': providerId },
      }
      if (explorer !== undefined) {
        return HttpRouter.toWebHandler(
          RpcServer.layer(group.middleware(VistaExplorerMiddleware), {
            spanPrefix: options.spanPrefix,
            spanAttributes: options.spanAttributes,
          }).pipe(
            Layer.provide(
              explorerServerLayer({ explorer, path: rpcPath, group }).pipe(
                Layer.provide(serialization),
              ),
            ),
            Layer.provide(Layer.mergeAll(rpcHandlers, serialization, HttpRouter.layer)),
          ) as unknown as Layer.Layer<HttpRouter.HttpRouter>,
        )
      }
      return HttpRouter.toWebHandler(
        Layer.provide(
          RpcServer.layerHttp({ ...options, group }),
          Layer.mergeAll(rpcHandlers, serialization, HttpRouter.layer),
        ) as unknown as Layer.Layer<HttpRouter.HttpRouter>,
      )
    }
    const rpcPath = `/_data/${providerId}` as const
    const jsonHandler = makeHandler(layerJson, implementation.contract.group, rpcPath)
    const ndjsonHandler = makeHandler(layerNdjson, implementation.contract.group, rpcPath)
    const aliasHandlers = wireAliases.map(({ id, group }) => {
      const path = `/_data/${id}` as const
      return {
        path,
        json: makeHandler(layerJson, group, path),
        ndjson: makeHandler(layerNdjson, group, path),
      }
    })
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await jsonHandler.dispose()
        await ndjsonHandler.dispose()
        for (const alias of aliasHandlers) {
          await alias.json.dispose()
          await alias.ndjson.dispose()
        }
      }),
    )

    return {
      id: providerId,
      purity: implementation.purity,
      group: implementation.contract.group,
      contract: implementation.contract,
      core,
      call: (tag, payload, path) => {
        const result = run(tag, payload, path)
        if (Stream.isStream(result)) {
          return Effect.die(
            `stream operation ${providerId}.${tag} cannot be captured as unary data`,
          )
        }
        return result.pipe(
          Effect.mapError(
            (error) =>
              new ProviderCallFailed({
                provider: providerId,
                operation: tag,
                message: String(error),
              }),
          ),
        )
      },
      // Same-path protocol negotiation: Effect's RpcClient sets the request
      // Content-Type from its serialization layer. Unary JSON and progressive
      // stream NDJSON therefore share /_data/<provider> without inspecting RPC
      // payloads or adding a second public route.
      handler: (request) => {
        const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim()
        const path = aliasHandlers.length === 0 ? undefined : new URL(request.url).pathname
        const alias = aliasHandlers.find(
          (candidate) => path === candidate.path || path === `${candidate.path}/`,
        )
        const selected =
          contentType === 'application/ndjson'
            ? (alias?.ndjson ?? ndjsonHandler)
            : (alias?.json ?? jsonHandler)
        return selected.handler(request, Context.empty())
      },
    }
  })
