import { Effect, Layer, Scope, Stream } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { RpcClient, type RpcClientError, RpcSerialization } from 'effect/rpc'

import { InspectorRpcGroup } from '@overeng/effect-rpc-explorer'
import type { ExplorerClient } from '@overeng/effect-rpc-explorer'

import { makeAppFrameFilter } from './rpc-explorer-filter.ts'

/** The unbounded Watch response needs streaming NDJSON rather than buffered JSON. */
const protocol = RpcClient.layerProtocolHttp({ url: '/_rpc-inspector' }).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(FetchHttpClient.layer),
)

type InspectorClient = RpcClient.FromGroup<typeof InspectorRpcGroup, RpcClientError.RpcClientError>
let bridgePromise: Promise<InspectorClient> | undefined

/** Keep the connection's scope alive across the entire page, including Watch calls. */
const getBridge = (): Promise<InspectorClient> =>
  (bridgePromise ??= Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      return yield* RpcClient.make(InspectorRpcGroup).pipe(
        Effect.provideService(Scope.Scope, scope),
      )
    }).pipe(Effect.provide(protocol)),
  ))

/** A view filter, not a server filter: clearing it exposes the original full history. */
export const makeVistaExplorerClient = (appIdentity?: string): ExplorerClient => {
  const filter = appIdentity === undefined ? undefined : makeAppFrameFilter(appIdentity)
  return {
    getSnapshot: () =>
      getBridge().then(async (client) =>
        filter === undefined
          ? await Effect.runPromise(client['RpcExplorer.GetSnapshot']({}))
          : filter.snapshot(await Effect.runPromise(client['RpcExplorer.GetSnapshot']({}))),
      ),
    watch: ({ afterRevision, descriptorRevision }) => ({
      async *[Symbol.asyncIterator]() {
        const client = await getBridge()
        const payload = {
          ...(afterRevision === undefined ? {} : { afterRevision }),
          ...(descriptorRevision === undefined ? {} : { descriptorRevision }),
        }
        for await (const frame of Stream.toAsyncIterable(client['RpcExplorer.Watch'](payload))) {
          yield filter === undefined ? frame : filter.watch(frame)
        }
      },
    }),
    clearHistory: () =>
      getBridge().then((client) => Effect.runPromise(client['RpcExplorer.ClearHistory']({}))),
  }
}
