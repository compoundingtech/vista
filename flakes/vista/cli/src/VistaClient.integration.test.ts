import { createServer } from 'node:http'

import { it } from '@effect/vitest'
import { ConfigProvider, Effect, Layer } from 'effect'
import { expect } from 'vitest'

import { VistaClient } from './VistaClient.ts'

it.effect('reaches loopback directly with a broken proxy and preserves HTTP 500', () =>
  Effect.gen(function* () {
    const server = createServer((_request, response) => {
      response.writeHead(500)
      response.end('server failure')
    })
    yield* Effect.acquireRelease(
      Effect.promise(() => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))),
      () => Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve()))),
    )
    const address = server.address()
    if (address === null || typeof address === 'string')
      return yield* Effect.die('expected TCP address')
    const url = `http://127.0.0.1:${address.port}`
    const keys = [
      'HTTP_PROXY',
      'http_proxy',
      'HTTPS_PROXY',
      'https_proxy',
      'ALL_PROXY',
      'all_proxy',
      'NO_PROXY',
      'no_proxy',
    ]
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const previous = keys.map((key) => [key, process.env[key]] as const)
        for (const key of keys)
          process.env[key] = key.toLowerCase() === 'no_proxy' ? '' : 'http://127.0.0.1:1'
        return previous
      }),
      (previous) =>
        Effect.sync(() => {
          for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
          }
        }),
    )
    const result = yield* Effect.gen(function* () {
      const vista = yield* VistaClient
      return yield* vista.list().pipe(Effect.result)
    }).pipe(
      Effect.provide(
        VistaClient.Default.pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromEnvRecord({ VISTA_URL: url, ST_AGENT: 'agent/vista/test' }),
            ),
          ),
        ),
      ),
    )
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: {
        _tag: 'Vista.ServiceTransportFailed',
        url,
        status: 500,
        message: expect.stringContaining('HTTP 500'),
      },
    })
  }).pipe(Effect.scoped),
)
