import { expect, test, type Page } from '@playwright/test'

import { openAgentTimelineStory } from './agent-timeline-story.ts'

const viewport = async (page: Page) => {
  const root = page.locator('[data-navigation="default"]')
  return {
    start: Number(await root.getAttribute('data-viewport-start')),
    end: Number(await root.getAttribute('data-viewport-end')),
  }
}

const refresh = (page: Page) => page.getByRole('button', { name: /Simulate live refresh/ }).click()

test.describe('Agent Timeline live refresh', () => {
  test('keeps viewer state and follows the right edge', async ({ page }) => {
    await openAgentTimelineStory(page, 'live-refresh')
    const before = await viewport(page)
    const tree = page.getByRole('complementary', { name: 'Agent session tree and filters' })
    const root = tree.locator('[data-session-id][aria-expanded]').first()
    await expect(root).toHaveAttribute('aria-expanded', 'false')

    const filter = page.getByPlaceholder('Filter sessions…')
    await filter.fill('gen')
    const row = tree.locator('[data-session-id]').first()
    const sessionId = await row.getAttribute('data-session-id')
    await row.click()
    await expect(row).toHaveAttribute('aria-selected', 'true')

    await refresh(page)
    await expect(page.getByRole('button', { name: 'Simulate live refresh (1)' })).toBeVisible()

    const after = await viewport(page)
    expect(after.start - before.start).toBe(60_000)
    expect(after.end - before.end).toBe(60_000)
    await expect(filter).toHaveValue('gen')
    await expect(tree.locator(`[data-session-id="${sessionId}"]`).first()).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('keeps a past viewport on the same absolute times', async ({ page }) => {
    await openAgentTimelineStory(page, 'live-refresh-past-viewport')
    const before = await viewport(page)
    await refresh(page)
    await expect(page.getByRole('button', { name: 'Simulate live refresh (1)' })).toBeVisible()
    expect(await viewport(page)).toEqual(before)
  })
})
