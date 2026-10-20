'use client'

import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import type * as HttpClient from 'effect/http/HttpClient'
import type { RpcClientError } from 'effect/rpc/RpcClientError'
import * as RpcClient from 'effect/rpc/RpcClient'
import { layerJson } from 'effect/rpc/RpcSerialization'
import * as React from 'react'

import type { CommandOp } from './data-contract.ts'
import type { ActorSource } from './provider-contracts.ts'

interface CommandTransport {
  readonly baseUrl: URL
  readonly actorSource: ActorSource
  readonly fetchLayer: Layer.Layer<HttpClient.HttpClient>
}

const CommandTransportContext = React.createContext<CommandTransport | undefined>(undefined)

/**
 * Context provider that constructs the command transport from an actor source, a data base URL,
 * and an optional fetch override, and exposes it to descendant components through useCommand.
 */
export const DataCommandTransportProvider = ({
  actorSource,
  dataBaseUrl,
  fetch: suppliedFetch,
  children,
}: {
  readonly actorSource: ActorSource
  readonly dataBaseUrl: string | URL
  readonly fetch?: typeof globalThis.fetch
  readonly children: React.ReactNode
}): React.ReactNode => {
  const transport = React.useMemo(() => {
    const baseUrl = new URL(
      dataBaseUrl,
      typeof document === 'undefined' ? 'http://localhost/' : document.baseURI,
    )
    const fetchLayer = suppliedFetch === undefined
      ? FetchHttpClient.layer
      : FetchHttpClient.layer.pipe(
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, suppliedFetch)),
      )
    return { actorSource, baseUrl, fetchLayer }
  }, [actorSource, dataBaseUrl, suppliedFetch])
  return (
    <CommandTransportContext.Provider value={transport}>
      {children}
    </CommandTransportContext.Provider>
  )
}
/**
 * Returns the actor source from the nearest command transport context, falling back to 'none' when
 * no provider is mounted.
 */
export const useActorSource = (): ActorSource =>
  React.useContext(CommandTransportContext)?.actorSource ?? 'none'

/** Internal typed command hook; only domain Blocks import this module. */
export const useCommand = <TTag extends string, TArgs, TValue, TError>(
  operation: CommandOp<TTag, TArgs, TValue, TError>,
): ((args: TArgs) => Promise<TValue>) => {
  const transport = React.useContext(CommandTransportContext)
  return React.useCallback(
    (args: TArgs) => {
      if (transport === undefined) {
        return Promise.reject(new Error('LivePty commands require DataRuntimeProvider'))
      }
      return Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(operation.group)
          const call = (client as unknown as Record<
            string,
            (payload: TArgs) => Effect.Effect<unknown, TError | RpcClientError>
          >)[operation.tag]!
          const value = yield* call(args)
          return yield* Schema.decodeUnknownEffect(operation.successSchema, {
            onExcessProperty: 'error',
          })(value)
        }).pipe(
          Effect.provide(
            RpcClient.layerProtocolHttp({
              url: new URL(encodeURIComponent(operation.providerId), transport.baseUrl).href,
            }).pipe(
              Layer.provide(layerJson),
              Layer.provide(transport.fetchLayer),
            ),
          ),
          Effect.scoped,
        ),
      )
    },
    [operation, transport],
  )
}
