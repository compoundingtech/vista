import { expect, test } from '@playwright/test'

import { openAgentTimelineStory } from './agent-timeline-story.ts'

test.describe('Agent Timeline counts', () => {
  test('keeps resident agent counts consistent between the normal header and tree', async ({
    page,
  }) => {
    await openAgentTimelineStory(page, 'default')

    const summary = page.locator('[aria-label^="Trace coverage:"]')
    const tree = page.getByRole('complementary', { name: 'Agent session tree and filters' })
    await expect(summary).toContainText(/3 roots.*91 agents/)
    await expect(tree.getByText('91', { exact: true })).toBeVisible()
  })

  test('shows filtered counts and spend against the normal unfiltered total', async ({ page }) => {
    await openAgentTimelineStory(page, 'default')

    const summary = page.locator('[aria-label^="Trace coverage:"]')
    const tree = page.getByRole('complementary', { name: 'Agent session tree and filters' })
    await expect(summary).toContainText(/3 roots.*91 agents/)
    await expect(tree.getByText('91', { exact: true })).toBeVisible()

    await page.getByPlaceholder('Filter sessions…').fill('gen')
    await expect(summary).toContainText(/9\/91 agents/)
    await expect(summary).toContainText(/\$689\/\$1,152/)
    await expect(tree.getByText('9/91', { exact: true })).toBeVisible()
  })

  test('renders the anonymized captured header and its capped tree denominator', async ({
    page,
  }) => {
    await openAgentTimelineStory(page, 'captured-live-model')
    const summary = page.locator('[aria-label^="Trace coverage:"]')
    await expect(summary).toContainText(/7 roots.*128\/437 agents/)
    await expect(
      page
        .getByRole('complementary', { name: 'Agent session tree and filters' })
        .getByText('128/437', { exact: true }),
    ).toBeVisible()
    await page.locator('[aria-label="Agent timeline controls"]').screenshot({
      path: 'test-results/agent-timeline-captured-live-header.png',
    })
  })
  test('keeps controlled expansion external until the parent applies an explicit set', async ({
    page,
  }) => {
    await openAgentTimelineStory(page, 'controlled-expansion')
    const tree = page.getByRole('complementary', { name: 'Agent session tree and filters' })
    const root = tree.locator('[data-session-id][aria-expanded]').first()
    await expect(root).toHaveAttribute('aria-expanded', 'false')

    await page.getByRole('button', { name: 'Externally expand all' }).click()
    await expect(root).toHaveAttribute('aria-expanded', 'true')

    await root.getByRole('button', { name: /^Collapse / }).click()
    await expect(page.locator('[data-pending-expansion]')).toHaveText('Pending explicit set')
    await expect(root).toHaveAttribute('aria-expanded', 'true')

    await page.getByRole('button', { name: 'Apply pending expansion' }).click()
    await expect(root).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('[data-pending-expansion]')).toHaveText('No pending expansion')
  })
})
