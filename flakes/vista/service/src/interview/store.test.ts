/**
 * Store-level proof of the re-arm semantics (decision 0013). These exercise the
 * three subtle properties the browser e2e then confirms end-to-end:
 *  1. a short await window returns `pending` when no answer is present (re-arm);
 *  2. an answer that lands BETWEEN two awaits is returned by the next await
 *     (the gap race the watch pattern must not drop);
 *  3. answers are scoped to `(appId, questionId)` and first-write-wins (0009).
 */
import { describe, expect, it } from 'vitest'

import type { DecisionQuestion } from './contract.ts'
import { createInterviewStore } from './store.ts'

const q: DecisionQuestion = {
  question: 'Which transport for await?',
  options: [
    { id: 'rearm', label: 'Re-arm watch', tradeoff: 'survives idle; many short blocks' },
    { id: 'longpoll', label: 'Long-poll', tradeoff: 'simple; reset by idle timeouts' },
  ],
  multiSelect: false,
}

describe('interview store re-arm', () => {
  it('returns pending when a short window elapses with no answer', async () => {
    const store = createInterviewStore()
    const { appId, questionId } = store.ask('rev', q)
    const t0 = Date.now()
    const outcome = await store.awaitAnswer(appId, questionId, 50)
    expect(outcome._tag).toBe('pending')
    // It blocked for ~the window, not instantly — the re-arm boundary is real.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(40)
  })

  it('an answer landing BETWEEN awaits is returned by the next await (gap race)', async () => {
    const store = createInterviewStore()
    const { appId, questionId } = store.ask('rev', q)
    // First window times out unanswered.
    expect((await store.awaitAnswer(appId, questionId, 30))._tag).toBe('pending')
    // Answer lands in the gap, while NO await is parked.
    const submit = store.submitAnswer(appId, questionId, { chosenOptionIds: ['rearm'] })
    expect(submit._tag).toBe('accepted')
    // The next await returns it immediately via the stored-answer fast path.
    const outcome = await store.awaitAnswer(appId, questionId, 1000)
    expect(outcome).toEqual({ _tag: 'answered', answer: { chosenOptionIds: ['rearm'] } })
  })

  it('wakes a parked await the moment the answer arrives', async () => {
    const store = createInterviewStore()
    const { appId, questionId } = store.ask('rev', q)
    const awaiting = store.awaitAnswer(appId, questionId, 5000)
    // Submit shortly after the await parks.
    setTimeout(() => store.submitAnswer(appId, questionId, { chosenOptionIds: ['rearm'] }), 20)
    const t0 = Date.now()
    const outcome = await awaiting
    expect(outcome).toEqual({ _tag: 'answered', answer: { chosenOptionIds: ['rearm'] } })
    // Woken well before the 5s window — proves event signalling, not timeout.
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('scopes answers to (appId, questionId) and is first-write-wins', async () => {
    const store = createInterviewStore()
    const a = store.ask('rev', q)
    const b = store.ask('rev', q)
    // Wrong question id is unknown, not a silent cross-answer.
    expect(store.submitAnswer('rev', 'nope', { chosenOptionIds: ['rearm'] })._tag).toBe(
      'unknown-question',
    )
    // Answering a does not answer b.
    expect(store.submitAnswer(a.appId, a.questionId, { chosenOptionIds: ['rearm'] })._tag).toBe(
      'accepted',
    )
    expect(store.get(b.appId, b.questionId)?.answer).toBeNull()
    // A second answer to a is rejected (first-write-wins).
    expect(store.submitAnswer(a.appId, a.questionId, { chosenOptionIds: ['longpoll'] })._tag).toBe(
      'already-answered',
    )
    expect(store.get(a.appId, a.questionId)?.answer).toEqual({ chosenOptionIds: ['rearm'] })
  })

  it('pendingFor returns only unanswered questions, in ask order', () => {
    const store = createInterviewStore()
    const a = store.ask('rev', q)
    store.ask('rev', q)
    store.ask('other', q)
    store.submitAnswer(a.appId, a.questionId, { chosenOptionIds: ['rearm'] })
    const pending = store.pendingFor('rev')
    expect(pending.map((p) => p.questionId)).not.toContain(a.questionId)
    expect(pending).toHaveLength(1)
  })
})
