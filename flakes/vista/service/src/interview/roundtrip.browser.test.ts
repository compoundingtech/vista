/**
 * End-to-end proof of the interview round-trip (decision 0013): a mock agent poses
 * a structured decision-question and BLOCKS on the re-arm await; a real browser
 * renders the scenario + question; a human-sim click answers; the agent resumes
 * with the choice. This is the deliverable's load-bearing proof.
 *
 * The load-bearing assertion is the **await→resume across the idle boundary**. The
 * server await window is short (2.5s) and the human-sim click is delayed PAST it,
 * so the answer lands only AFTER at least one await window has timed out and the
 * mock agent has RE-ISSUED — proving the re-arm pattern (many short blocks), not a
 * single long-poll that would merely have to outlast the click. A long-poll would
 * be reset at the idle boundary; the re-arm survives it.
 *
 * The mock agent drives the typed control RPC path, the exact boundary `vista ask`
 * / `vista await` now use. The browser still answers through its viewer endpoint
 * because that is a product surface, not an agent command surface.
 *
 * Browser provisioning is Nix-managed (`PLAYWRIGHT_BROWSERS_PATH`); the test RUNS
 * only when that var is set and SKIPS otherwise, so a bare `vitest run` stays
 * green (same convention as `heavy-blocks.browser.test.ts`).
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { askViaControl, awaitOnceViaControl, publishViaControl } from '../control-test-client.ts'
import { encodeRouteOwner } from '../control.ts'
import { appSourcePath } from '../paths.ts'
import type { DecisionQuestion } from './contract.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE = join(HERE, '..', '..', 'samples', 'interview-app')
const HAS_BROWSER = !!process.env.PLAYWRIGHT_BROWSERS_PATH
const OWNER = 'agent/compoundingtech/st-ios'

let dir: string
let port: number
let close: (() => Promise<void>) | undefined

beforeAll(async () => {
  if (!HAS_BROWSER) return
  mkdirSync(join(HERE, '..', '..', 'tmp'), { recursive: true })
  dir = mkdtempSync(join(HERE, '..', '..', 'tmp', 'vista-interview-'))
  process.env.VISTA_APPS = join(dir, 'apps')
  process.env.VISTA_CACHE = join(dir, '.vista-cache')
  process.env.VISTA_SOURCES = join(dir, 'sources')
  const appSource = appSourcePath(join(dir, 'sources'), OWNER, 'interview-demo')
  mkdirSync(appSource, { recursive: true })
  cpSync(SAMPLE, appSource, { recursive: true })

  const { startService } = await import('../server.ts')
  port = 5500 + Math.floor(Math.random() * 300)
  const started = await startService(port)
  close = started.close
  await Effect.runPromise(
    publishViaControl(port, {
      owner: OWNER,
      slug: 'interview-demo',
      author: 'guard',
      changeSummary: 'interview e2e',
    }),
  )
}, 180_000)

afterAll(async () => {
  await close?.()
  if (dir) rmSync(dir, { recursive: true, force: true })
}, 30_000)

const question: DecisionQuestion = {
  question: 'How should the agent await the human’s answer?',
  options: [
    { id: 'rearm', label: 'Re-arm watch', tradeoff: 'survives idle; many short server blocks' },
    { id: 'longpoll', label: 'Single long-poll', tradeoff: 'simple; reset by idle timeouts' },
  ],
  multiSelect: false,
  recommendedDefault: 'rearm',
  evidenceGaps: ['no measurement of re-issue overhead under load'],
  aboutBlockIds: ['fork-transport'],
}

describe('interview round-trip survives the idle boundary (decision 0013)', () => {
  it.skipIf(!HAS_BROWSER)(
    'mock agent asks + blocks on re-arm; human answers in browser after the await window; agent resumes',
    async () => {
      const { chromium } = await import('@playwright/test')
      const baseUrl = `http://127.0.0.1:${port}`

      // 1. The mock agent registers the structured question (vista_ask).
      const { appId, questionId } = await Effect.runPromise(
        askViaControl(port, { owner: OWNER, appId: 'interview-demo', question }),
      )
      expect(questionId).toBeTruthy()

      // 2. The mock agent BLOCKS on the re-arm await (vista_await loop). It records
      //    how many bounded windows it had to re-issue — must be >= 1, proving the
      //    answer crossed the idle boundary and the await re-armed.
      let windows = 0
      let stop = false
      const agentResume = (async () => {
        const until = Date.now() + 60_000
        while (!stop && Date.now() < until) {
          windows++
          const r = await Effect.runPromise(
            awaitOnceViaControl(port, { owner: OWNER, appId, questionId }),
          )
          if (r._tag === 'answered') return r.answer
        }
        throw new Error('agent await timed out')
      })()

      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        const url = `${baseUrl}/r/${encodeRouteOwner(OWNER)}/interview-demo/v1/`
        // Cold prebundle warm-up, then reload and assert on the warm render.
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.reload({ waitUntil: 'networkidle' })

        // 3. The browser renders the scenario AND the agent's question (polled from
        //    the shared store). Wait for the question to appear.
        await page.waitForSelector('[data-testid="interview-question"]', { timeout: 30_000 })
        expect(
          await page.locator('[data-testid="interview-question"] [data-vista-answered]').count(),
        ).toBe(0)
        // The rendered scenario (the fork) is present alongside the question.
        expect(await page.locator('[data-vista-id="fork-transport"]').count()).toBeGreaterThan(0)

        // 4. Cross the idle boundary: wait PAST one full await window (2.5s) before
        //    the human-sim answers, so the agent's first await has already timed
        //    out and re-issued. THEN click the recommended option and submit.
        await page.waitForTimeout(3500)
        expect(windows).toBeGreaterThanOrEqual(1) // at least one window timed out → re-arm

        await page.locator('[data-testid="interview-option-rearm"]').click()
        await page.locator('[data-testid="interview-submit"]').click()
        await page.waitForSelector('[data-testid="interview-answered"]', { timeout: 10_000 })
        expect(
          await page
            .locator('[data-testid="interview-answered"]')
            .getAttribute('data-vista-answered'),
        ).toBe('')

        // Exercise the terminal error state as part of the same story-driven
        // surface. A second question keeps the successful round-trip above
        // authoritative while a browser route supplies a deterministic failure.
        await Effect.runPromise(askViaControl(port, { owner: OWNER, appId, question }))
        await page.reload({ waitUntil: 'networkidle' })
        await page.waitForSelector('[data-testid="interview-question"]', { timeout: 30_000 })
        await page.route('**/_answer', (route) =>
          route.fulfill({ status: 500, contentType: 'text/plain', body: 'visual proof failure' }),
        )
        await page.locator('[data-testid="interview-option-rearm"]').click()
        await page.locator('[data-testid="interview-submit"]').click()
        await page.getByRole('alert').waitFor({ state: 'visible' })
        expect(await page.locator('[data-vista-answered]').count()).toBe(0)

        // 5. The agent resumes with the human's choice (vista_await resolved).
        const answer = await agentResume
        expect(answer.chosenOptionIds).toEqual(['rearm'])
        // The await re-armed across the idle boundary: more than one window elapsed.
        expect(windows).toBeGreaterThan(1)
      } finally {
        stop = true
        await browser.close()
      }
    },
    90_000,
  )
})
