import { expect, test, type Page } from '@playwright/test'

/** A cold Vite optimizer or Storybook iframe can take far longer than the default 5 s. */
const READY_TIMEOUT_MS = 60_000

/** Storybook iframe URL for an Agent Timeline story id suffix. */
export const agentTimelineStoryUrl = (story: string): string =>
  `/iframe.html?viewMode=story&globals=theme:dark&id=vista-blocks-agents-agent-timeline--${story}`

/**
 * Open an Agent Timeline story and wait until the trace root has rendered, so assertions keep their
 * own timeouts instead of absorbing cold-start latency. The test budget grows by the readiness
 * bound because the configured test timeout is shorter than a cold start.
 */
export const openAgentTimelineStory = async (page: Page, story: string): Promise<void> => {
  test.info().setTimeout(test.info().timeout + READY_TIMEOUT_MS)
  await page.goto(agentTimelineStoryUrl(story))
  await expect(page.locator('[data-navigation="default"]')).toBeVisible({
    timeout: READY_TIMEOUT_MS,
  })
}
