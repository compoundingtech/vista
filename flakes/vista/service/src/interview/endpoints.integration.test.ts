import { createServer } from 'node:http'

import { encodeOwner, encodeRouteOwner } from '@vista/blocks/internal/owner-identity'
import { expect, it } from 'vitest'

import { handleInterview } from './endpoints.ts'
import { createInterviewStore } from './store.ts'

it.each([
  'dev3.retained-interview',
  'agent/compoundingtech/st-ios',
  'o-6162.owner',
  'o-6162.owner!',
])(
  'maps the retained browser route scope to the unchanged interview store for %s',
  async (owner) => {
    const store = createInterviewStore()
    const appId = 'interview-demo'
    const storedScope = `${encodeOwner(owner)}/${appId}`
    const routeScope = `${encodeRouteOwner(owner)}/${appId}`
    const question = store.ask(storedScope, {
      question: 'Keep the original scope?',
      options: [{ id: 'retain', label: 'Retain', tradeoff: 'Preserve exact owner identity' }],
      multiSelect: false,
    })
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      void handleInterview(store, request, response, url.pathname, url.searchParams).then(
        (handled) => {
          if (!handled) response.writeHead(404).end()
        },
        (error) => response.destroy(error),
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (address === null || typeof address === 'string')
        throw new Error('Missing interview server address')
      const base = `http://127.0.0.1:${address.port}`
      for (const scope of [storedScope, routeScope]) {
        const pending = await fetch(`${base}/_interview/pending?appId=${encodeURIComponent(scope)}`)
        expect(pending.status).toBe(200)
        expect(await pending.json()).toEqual({ questions: [question] })
      }
      const unknown = await fetch(`${base}/_answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appId: routeScope,
          questionId: 'unknown-question',
          answer: { chosenOptionIds: ['retain'] },
        }),
      })
      expect(unknown.status).toBe(404)
      const answer = { chosenOptionIds: ['retain'] }
      const answerRequest = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId: routeScope, questionId: question.questionId, answer }),
      }
      const accepted = await fetch(`${base}/_answer`, answerRequest)
      expect(accepted.status).toBe(200)
      expect(await accepted.json()).toEqual(
        expect.objectContaining({
          _tag: 'ok',
          stored: expect.objectContaining({ appId: storedScope, answer }),
        }),
      )
      expect(await store.awaitAnswer(storedScope, question.questionId, 100)).toEqual({
        _tag: 'answered',
        answer,
      })
      expect(store.get(routeScope, question.questionId)).toBeUndefined()
      expect((await fetch(`${base}/_answer`, answerRequest)).status).toBe(409)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  },
)
