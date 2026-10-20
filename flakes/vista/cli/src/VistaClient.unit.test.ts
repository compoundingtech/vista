import { it } from '@effect/vitest'
import { Cause, ConfigProvider, Effect, Exit, Layer } from 'effect'
import * as HttpClientError from 'effect/http/HttpClientError'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'
import { RpcClientError } from 'effect/rpc'
import { describe, expect } from 'vitest'

import { normalizeTransport, VistaClient } from './VistaClient.ts'

const url = 'http://127.0.0.1:5192'
const request = HttpClientRequest.post(`${url}/_rpc/control`)
const rpcHttpError = (reason: HttpClientError.HttpClientError['reason']) =>
  new RpcClientError.RpcClientError({
    reason: HttpClientError.HttpClientErrorSchema.fromHttpClientError(
      new HttpClientError.HttpClientError({ reason }),
    ),
  })

const classify = (error: RpcClientError.RpcClientError) =>
  normalizeTransport(Effect.fail(error), url).pipe(Effect.result)

describe('Vista RPC transport errors', () => {
  it.effect('maps only a refused connection to ServiceUnreachable', () =>
    Effect.gen(function* () {
      for (const code of ['ECONNREFUSED', 'ConnectionRefused']) {
        const cause = rpcHttpError(
          new HttpClientError.TransportError({
            request,
            cause: new TypeError('fetch failed', {
              cause: Object.assign(new Error('connection refused'), { code }),
            }),
          }),
        )
        const result = yield* classify(cause)
        expect(result).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'Vista.ServiceUnreachable', url, cause },
        })
      }
    }),
  )

  it.effect('retains HTTP 500 and its original cause', () =>
    Effect.gen(function* () {
      const response = HttpClientResponse.fromWeb(
        request,
        new Response('server failed', { status: 500 }),
      )
      const cause = rpcHttpError(new HttpClientError.StatusCodeError({ request, response }))
      const result = yield* classify(cause)
      expect(result).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'Vista.ServiceTransportFailed',
          url,
          status: 500,
          cause,
          message: expect.stringContaining('HTTP 500'),
        },
      })
    }),
  )

  it.effect('keeps DNS and proxy failures distinct from a stopped service', () =>
    Effect.gen(function* () {
      for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ERR_PROXY_TUNNEL']) {
        const cause = rpcHttpError(
          new HttpClientError.TransportError({
            request,
            cause: Object.assign(new Error(code), { code }),
          }),
        )
        const result = yield* classify(cause)
        expect(result).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'Vista.ServiceTransportFailed', url, cause },
        })
      }
    }),
  )

  it.effect('does not mistake serialization errors for connection failures', () =>
    Effect.gen(function* () {
      const cause = rpcHttpError(
        new HttpClientError.EncodeError({
          request,
          cause: Object.assign(new Error('invalid request body'), { code: 'ECONNREFUSED' }),
        }),
      )
      expect(yield* classify(cause)).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'Vista.ServiceTransportFailed',
          cause,
          message: expect.stringContaining('invalid request body'),
        },
      })
    }),
  )

  it.effect('keeps protocol/decode errors and defects out of ServiceUnreachable', () =>
    Effect.gen(function* () {
      const cause = new RpcClientError.RpcClientError({
        reason: new RpcClientError.RpcClientDefect({
          message: 'Error decoding HTTP response',
          cause: new Error('invalid JSON'),
        }),
      })
      expect(yield* classify(cause)).toMatchObject({
        _tag: 'Failure',
        failure: {
          _tag: 'Vista.ServiceTransportFailed',
          cause,
          message: expect.stringContaining('Error decoding HTTP response'),
        },
      })
      const exit = yield* normalizeTransport(Effect.die(new Error('internal failure')), url).pipe(
        Effect.exit,
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(Cause.pretty(exit.cause)).toContain('internal failure')
        expect(Cause.pretty(exit.cause)).not.toContain('ServiceUnreachable')
      }
    }),
  )

  it.effect('rejects uppercase slugs locally with the shared service schema, before RPC', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const results = [
        yield* vista.newApp('Bad-Slug', { dryRun: true }).pipe(Effect.result),
        yield* vista.awaitOnce('Bad-Slug', 'question-1').pipe(Effect.result),
        yield* vista
          .ask({
            appId: 'Bad-Slug',
            question: {
              question: 'Proceed?',
              options: [{ id: 'yes', label: 'Yes', tradeoff: 'Proceed now' }],
              multiSelect: false,
            },
          })
          .pipe(Effect.result),
      ]
      for (const result of results) {
        expect(result).toMatchObject({
          _tag: 'Failure',
          failure: {
            _tag: 'Vista.InvalidSlug',
            owner: 'agent/vista/test',
            slug: 'Bad-Slug',
          },
        })
      }
    }).pipe(
      Effect.provide(
        VistaClient.Default.pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromEnvRecord({
                VISTA_URL: 'http://127.0.0.1:1',
                ST_AGENT: 'agent/vista/test',
              }),
            ),
          ),
        ),
      ),
    ),
  )
})
