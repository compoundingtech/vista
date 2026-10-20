/**
 * The interview HTTP endpoints mounted in the standing service (decision 0013).
 * These are the browser bridge for a question whose agent-side commands cross
 * the typed VistaControlApi boundary:
 *
 *  - `GET  /_interview/pending?appId=…` — the browser fetches open questions.
 *  - `POST /_answer`           — the browser submits the human's choice.
 *
 * Every payload crosses the wire decoded/encoded through the isomorphic
 * `contract.ts` Schemas, so the agent tool, the browser component, and these
 * handlers cannot drift. `/_answer` enforces the decision-0009 scope:
 * `(appId, questionId)` must be a known, unanswered question (first-write-wins
 * lives in the store), else `404`/`409`.
 *
 * Security (decision 0009): tailnet-only is a deploy-time interface bind; the
 * always-present guarantee here is the scoped `(appId, questionId)` answer key
 * — an answer can only ever resolve the exact question it names.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

import {
  decodeRouteOwner,
  encodeOwner,
  encodeRouteOwner,
} from '@vista/blocks/internal/owner-identity'
import { Result, Schema } from 'effect'

import { AnswerInput, StoredQuestion } from './contract.ts'
import type { InterviewStore } from './store.ts'

const sendJson = (res: ServerResponse, code: number, body: unknown): void => {
  res.statusCode = code
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const decodeBody = <A, I>(schema: Schema.Codec<A, I>, raw: string): A | { error: string } => {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: 'invalid JSON body' }
  }
  const decoded = Schema.decodeUnknownResult(schema)(json)
  if (Result.isFailure(decoded)) return { error: `invalid payload: ${String(decoded.failure)}` }
  return decoded.success
}

const isErr = <A>(v: A | { error: string }): v is { error: string } =>
  typeof v === 'object' && v !== null && 'error' in v

const encodeStored = Schema.encodeSync(StoredQuestion)

/**
 * Immutable pre-codec browser bundles derive their interview scope from the
 * current HTTP owner segment. Translate only canonical route segments to the
 * unchanged store encoding; already stored scopes and literal o- owners stay exact.
 */
const interviewStoreScope = (appId: string): string => {
  if (!appId.startsWith('o-')) return appId
  const separator = appId.indexOf('/')
  if (separator < 0) return appId
  const segment = appId.slice(0, separator)
  const owner = decodeRouteOwner(segment)
  if (owner === undefined || encodeRouteOwner(owner) !== segment) return appId
  return `${encodeOwner(owner)}${appId.slice(separator)}`
}

/**
 * Try to handle an interview request. Returns `true` if it owned the path (and has
 * responded), `false` to let the caller fall through to the rest of the router.
 */
export const handleInterview = async (
  store: InterviewStore,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  query: URLSearchParams,
): Promise<boolean> => {
  // The browser fetches the open questions for a app (same-origin under the
  // service; bounded to one app's scope).
  if (path === '/_interview/pending' && (req.method === 'GET' || req.method === 'HEAD')) {
    const appId = query.get('appId')
    if (!appId) return (sendJson(res, 400, { _tag: 'error', message: 'appId is required' }), true)
    return (
      sendJson(res, 200, {
        questions: store.pendingFor(interviewStoreScope(appId)).map((q) => encodeStored(q)),
      }),
      true
    )
  }

  // The browser submits the human's choice, scoped to (appId, questionId).
  if (path === '/_answer' && req.method === 'POST') {
    const input = decodeBody(AnswerInput, await readBody(req))
    if (isErr(input)) return (sendJson(res, 400, { _tag: 'error', message: input.error }), true)
    const outcome = store.submitAnswer(
      interviewStoreScope(input.appId),
      input.questionId,
      input.answer,
    )
    if (outcome._tag === 'unknown-question') {
      return (
        sendJson(res, 404, { _tag: 'error', message: `unknown question: ${input.questionId}` }),
        true
      )
    }
    if (outcome._tag === 'already-answered') {
      return (sendJson(res, 409, { _tag: 'error', message: 'question already answered' }), true)
    }
    return (sendJson(res, 200, { _tag: 'ok', stored: encodeStored(outcome.stored) }), true)
  }

  return false
}
