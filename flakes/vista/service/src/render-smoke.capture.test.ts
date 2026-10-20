import { chromium } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { afterEach, expect, it, vi } from 'vitest'

import { makeBrowserMountSmoke } from './render-smoke.ts'

vi.mock('@playwright/test', () => ({ chromium: { launch: vi.fn() } }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('keeps a proven mount successful and closes capture work when evaluation never settles', async () => {
  vi.useFakeTimers()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  const captureStarted = Promise.withResolvers<void>()
  const page = {
    on: vi.fn(),
    goto: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(true),
    screenshot: vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71])),
    close: vi.fn().mockResolvedValue(undefined),
    evaluate: vi
      .fn<() => Promise<string[] | string>>(() => {
        captureStarted.resolve()
        return Promise.withResolvers<never>().promise
      })
      // The eager-image proof must finish before thumbnail capture can start.
      .mockResolvedValueOnce([]),
  }
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  }
  // A protocol-shaped browser mock tests orchestration without launching Chromium.
  vi.mocked(chromium.launch).mockResolvedValue(browser as unknown as Browser)
  const smoke = makeBrowserMountSmoke('http://127.0.0.1:4178')
  const outcome = smoke('vista.tests', 'capture-deadline', 1)
  let settled = false
  void outcome.then(() => {
    settled = true
  })
  await captureStarted.promise
  expect(page.evaluate).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(4_999)
  expect(settled).toBe(false)
  expect(page.close).not.toHaveBeenCalled()
  expect(browser.close).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(await outcome).toEqual({ _tag: 'ok' })
  expect(page.close).toHaveBeenCalledOnce()
  expect(browser.close).toHaveBeenCalledOnce()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('5000 ms deadline'))
})
