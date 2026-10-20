/** Legacy-free low-level RPC helper retained for service transport tests. */
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { RpcClient } from 'effect/rpc'
import type { Rpc, RpcGroup } from 'effect/rpc'
import { layerJson } from 'effect/rpc/RpcSerialization'

export { readFrozen } from './frozen.ts'

/** Call a provider's RPC live over HTTP through the standing service. */
export const callLive = <Rpcs extends Rpc.Any, A, E>(
  dataUrl: string,
  group: RpcGroup.RpcGroup<Rpcs>,
  f: (client: RpcClient.RpcClient<NoInfer<Rpcs>>) => Effect.Effect<A, E>,
): Effect.Effect<A, E> => {
  const protocol = RpcClient.layerProtocolHttp({ url: dataUrl }).pipe(
    Layer.provide(layerJson),
    Layer.provide(FetchHttpClient.layer),
  )
  return Effect.gen(function* () {
    const client = yield* RpcClient.make(group)
    return yield* f(client)
  }).pipe(
    Effect.scoped,
    Effect.provide(protocol),
    Effect.withSpan('vista.provider.callLive', {
      attributes: { 'span.label': 'provider.callLive', dataUrl },
    }),
  )
}
