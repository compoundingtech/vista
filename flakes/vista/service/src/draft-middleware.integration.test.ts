import { once } from 'node:events'
import http from 'node:http'

import { NodeHttpServer } from '@effect/platform-node'
import { Effect, Exit, Scope } from 'effect'
import * as HttpServerRequest from 'effect/http/HttpServerRequest'
import * as HttpServerResponse from 'effect/http/HttpServerResponse'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { nodeRoute, serveDraftMiddleware } from './server.ts'

type Middleware = Parameters<typeof serveDraftMiddleware>[0]

const serve = async (middleware: Middleware) => {
  const routeDone = Promise.withResolvers<void>()
  const scope = await Effect.runPromise(Scope.make())
  const handler = await Effect.runPromise(
    NodeHttpServer.makeHandler(
      nodeRoute('vista.test.draft', (req, res) => serveDraftMiddleware(middleware, req, res)).pipe(
        Effect.ensuring(Effect.sync(() => routeDone.resolve())),
      ),
      { scope },
    ),
  )
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing TCP address')
  return {
    url: `http://127.0.0.1:${address.port}/draft/`,
    routeDone: routeDone.promise,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)))
    },
  }
}

// Deferred next() is the Connect boundary that previously escaped nodeRoute.
describe('draft middleware response ownership', () => {
  afterEach(() => vi.restoreAllMocks())

  it('rejects a non-HTTP1 platform request before invoking the node handler', async () => {
    let invoked = false
    const result = await Effect.runPromise(
      nodeRoute('vista.test.protocol', () => {
        invoked = true
      }).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(new Request('http://localhost/draft/')),
        ),
      ),
    )
    expect(invoked).toBe(false)
    expect(result.status).toBe(505)
    expect(await HttpServerResponse.toWeb(result).text()).toBe('HTTP version not supported')
  })

  it.each(['error', 'fallthrough'] as const)(
    'finishes a committed response after deferred next: %s',
    async (outcome) => {
      const error = new Error('late transform failure')
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const service = await serve((_req, res, next) => {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.write('already committed')
        setImmediate(() => next(outcome === 'error' ? error : undefined))
      })
      try {
        const response = await fetch(service.url)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('already committed')
        await service.routeDone
        if (outcome === 'error') expect(errors).toHaveBeenCalledWith('request error', error)
        else expect(warnings).toHaveBeenCalledWith(
          'draft middleware fell through after response committed or closed',
          '/draft/',
        )
      } finally {
        await service.close()
      }
    },
  )

  it('keeps an uncommitted middleware error request-local', async () => {
    const error = new Error('transform failure')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = await serve((_req, _res, next) => {
      setImmediate(() => next(error))
    })
    try {
      const response = await fetch(service.url)
      expect(response.status).toBe(500)
      expect(await response.text()).toBe('internal error: transform failure')
      await service.routeDone
      expect(errors).toHaveBeenCalledWith('request error', error)
    } finally {
      await service.close()
    }
  })

  it('returns 404 only on uncommitted fallthrough', async () => {
    const service = await serve((_req, _res, next) => setImmediate(next))
    try {
      const response = await fetch(service.url)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('not found (draft)')
      await service.routeDone
    } finally {
      await service.close()
    }
  })

  it.each(['error', 'fallthrough'] as const)(
    'does not write after a disconnected response and deferred next: %s',
    async (outcome) => {
      const callbackDone = Promise.withResolvers<void>()
      const service = await serve((_req, res, next) => {
        res.writeHead(200)
        res.flushHeaders()
        res.destroy()
        setImmediate(() => {
          next(outcome === 'error' ? new Error('aborted transform') : undefined)
          callbackDone.resolve()
        })
      })
      try {
        // Either fetch or body consumption rejects when the socket closes.
        await expect(fetch(service.url).then((response) => response.text())).rejects.toThrow()
        await callbackDone.promise
        await service.routeDone
      } finally {
        await service.close()
      }
    },
  )

  it('releases a handled response without requiring next()', async () => {
    const service = await serve((_req, res) => res.end('handled'))
    try {
      const response = await fetch(service.url)
      expect(await response.text()).toBe('handled')
      await service.routeDone
    } finally {
      await service.close()
    }
  })
})
