import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as RpcClient from 'effect/rpc/RpcClient'
import type { RpcClientError } from 'effect/rpc/RpcClientError'
import { layerJson } from 'effect/rpc/RpcSerialization'

import {
  AskInput,
  AskResult,
  AwaitInterviewInput,
  AwaitResult,
  PublishInput,
  PublishOk,
  ServiceInfo,
  VistaControlApi,
} from './control.ts'
import { NoPayload, wireCall } from './wire.ts'

type ControlClient = RpcClient.FromGroup<typeof VistaControlApi, RpcClientError>

// Each helper's error channel is INFERRED from the RPC's declared `error` plus the
// `VersionSkew`/`RpcClientError` the wire seam adds — never widened to `unknown`,
// so a caller can still narrow by tag.

const withControl = <A, E>(
  port: number,
  f: (client: ControlClient) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const client = yield* RpcClient.make(VistaControlApi)
    return yield* f(client)
  }).pipe(
    Effect.scoped,
    Effect.provide(
      RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${port}/_rpc/control` }).pipe(
        Layer.provide(layerJson),
        Layer.provide(FetchHttpClient.layer),
      ),
    ),
  )

/**
 * Invokes the vista.publish RPC on the control server listening at the given port, validating the
 * request against PublishInput and the reply against PublishOk.
 */
export const publishViaControl = (port: number, input: PublishInput) =>
  withControl(port, (client) =>
    wireCall(
      'vista.publish',
      PublishInput,
      PublishOk,
    )((env) => client['vista.publish'](env), input),
  )

/**
 * Fetches the control server's runtime description by issuing the payload-less vista.service.info
 * RPC on the given port.
 */
export const serviceInfoViaControl = (port: number) =>
  withControl(port, (client) =>
    wireCall(
      'vista.service.info',
      NoPayload,
      ServiceInfo,
    )((env) => client['vista.service.info'](env), null),
  )

/**
 * Submits an interview question to the control server via the vista.interview.ask RPC and returns
 * its validated result.
 */
export const askViaControl = (port: number, input: AskInput) =>
  withControl(port, (client) =>
    wireCall(
      'vista.interview.ask',
      AskInput,
      AskResult,
    )((env) => client['vista.interview.ask'](env), input),
  )

/**
 * Waits for the resolution of a single owner/app/question triple by calling the
 * vista.interview.await RPC on the control server.
 */
export const awaitOnceViaControl = (
  port: number,
  input: { readonly owner: string; readonly appId: string; readonly questionId: string },
) =>
  withControl(port, (client) =>
    wireCall(
      'vista.interview.await',
      AwaitInterviewInput,
      AwaitResult,
    )((env) => client['vista.interview.await'](env), input),
  )
