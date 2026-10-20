/**
 * The interview question store (decision 0013): the one shared store the three
 * faces bind to. It lives INSIDE the standing service's `ServiceState` so the
 * agent (via the MCP/HTTP `ask`/`await` endpoints) and the human (via the browser
 * `custom` block POSTing `/_answer`) reach the SAME store — were it in the stdio
 * MCP process instead, the browser could not see it (the feasibility spike's core
 * topology point).
 *
 * In-memory by deliberate choice (feasibility open-question #3): an interview is a
 * live, foreground loop — a pending question does not need to survive a service
 * restart, and the no-migration discipline (decision 0008/VST-R04) prefers a fresh
 * in-memory namespace over an on-disk schema to maintain. On-disk durability is a
 * later lever if a use case demands it.
 *
 * Re-arm semantics (the load-bearing await→resume): `awaitAnswer` FIRST checks for
 * an already-stored answer and returns immediately — this catches the answer that
 * lands in the gap BETWEEN two `await` re-issues (the subtle race a pure
 * event-signal would drop). Only if still pending does it block on a waiter
 * promise for a SHORT bounded window, then resolve `pending` so the agent
 * re-issues. `submitAnswer` is first-write-wins scoped to `(appId, questionId)`
 * — the decision-0009 scope check — and wakes every parked waiter.
 */
import { randomUUID } from 'node:crypto'

import type { DecisionAnswer, DecisionQuestion, StoredQuestion } from './contract.ts'

/** Outcome of a single bounded await window. */
export type AwaitOutcome =
  | { readonly _tag: 'answered'; readonly answer: DecisionAnswer }
  | { readonly _tag: 'pending' }
  | { readonly _tag: 'unknown' }

/** Outcome of a scoped answer submission (first-write-wins). */
export type SubmitOutcome =
  | { readonly _tag: 'accepted'; readonly stored: StoredQuestion }
  | { readonly _tag: 'unknown-question' }
  | { readonly _tag: 'already-answered'; readonly stored: StoredQuestion }

/** The `(appId, questionId)` scope key, flattened for the Map. */
const scopeKey = (appId: string, questionId: string): string => `${appId} ${questionId}`

/**
 * Contract for an interview store that registers pending questions under server-assigned ids and
 * supports bounded await windows with re-arm semantics for receiving their answers.
 */
export interface InterviewStore {
  /** Register a pending question; returns its server-assigned id. */
  readonly ask: (appId: string, question: DecisionQuestion) => StoredQuestion
  /**
   * One bounded await window with re-arm semantics: resolve immediately if an
   * answer is already stored, else block up to `windowMs` for one to arrive.
   */
  readonly awaitAnswer: (
    appId: string,
    questionId: string,
    windowMs: number,
  ) => Promise<AwaitOutcome>
  /** Submit an answer scoped to `(appId, questionId)`; first-write-wins. */
  readonly submitAnswer: (
    appId: string,
    questionId: string,
    answer: DecisionAnswer,
  ) => SubmitOutcome
  /** Every pending (unanswered) question for a app — the browser's fetch. */
  readonly pendingFor: (appId: string) => ReadonlyArray<StoredQuestion>
  /** A single stored question by scope key (diagnostics / direct read). */
  readonly get: (appId: string, questionId: string) => StoredQuestion | undefined
}

/**
 * Creates an in-memory InterviewStore that parks awaitAnswer waiters per scope key and wakes them
 * all when submitAnswer resolves their question.
 */
export const createInterviewStore = (): InterviewStore => {
  const questions = new Map<string, StoredQuestion>()
  /** Parked await waiters per scope key; resolved by `submitAnswer`. */
  const waiters = new Map<string, Set<() => void>>()

  const wake = (key: string): void => {
    const set = waiters.get(key)
    if (!set) return
    for (const resolve of set) resolve()
    waiters.delete(key)
  }

  const ask: InterviewStore['ask'] = (appId, question) => {
    const questionId = randomUUID()
    const stored: StoredQuestion = {
      appId,
      questionId,
      question,
      answer: null,
      askedAt: Date.now(),
      answeredAt: null,
    }
    questions.set(scopeKey(appId, questionId), stored)
    return stored
  }

  const submitAnswer: InterviewStore['submitAnswer'] = (appId, questionId, answer) => {
    const key = scopeKey(appId, questionId)
    const existing = questions.get(key)
    if (!existing) return { _tag: 'unknown-question' }
    // First-write-wins (decision 0009 scope): a second answer for the same
    // (appId, questionId) is rejected, not silently overwritten.
    if (existing.answer !== null) return { _tag: 'already-answered', stored: existing }
    const stored: StoredQuestion = { ...existing, answer, answeredAt: Date.now() }
    questions.set(key, stored)
    wake(key)
    return { _tag: 'accepted', stored }
  }

  const awaitAnswer: InterviewStore['awaitAnswer'] = (appId, questionId, windowMs) => {
    const key = scopeKey(appId, questionId)
    const existing = questions.get(key)
    if (!existing) return Promise.resolve({ _tag: 'unknown' })
    // Re-arm step 1: an answer may have landed in the gap between this await and
    // the previous one — return it without blocking.
    if (existing.answer !== null)
      return Promise.resolve({ _tag: 'answered', answer: existing.answer })

    // Re-arm step 2: block for one short bounded window. Whichever fires first —
    // the waiter (an answer arrived) or the timeout — we re-read the store so the
    // outcome reflects the authoritative state, then deregister this waiter.
    return new Promise<AwaitOutcome>((resolve) => {
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        set.delete(onAnswer)
        if (set.size === 0) waiters.delete(key)
        const latest = questions.get(key)
        if (latest && latest.answer !== null) resolve({ _tag: 'answered', answer: latest.answer })
        else resolve({ _tag: 'pending' })
      }
      const onAnswer = (): void => finish()
      const set = waiters.get(key) ?? new Set<() => void>()
      set.add(onAnswer)
      waiters.set(key, set)
      const timer = setTimeout(finish, windowMs)
    })
  }

  const pendingFor: InterviewStore['pendingFor'] = (appId) =>
    [...questions.values()]
      .filter((q) => q.appId === appId && q.answer === null)
      .toSorted((a, b) => a.askedAt - b.askedAt)

  const get: InterviewStore['get'] = (appId, questionId) =>
    questions.get(scopeKey(appId, questionId))

  return { ask, awaitAnswer, submitAnswer, pendingFor, get }
}
