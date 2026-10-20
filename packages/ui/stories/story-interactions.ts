import { expect, userEvent as storybookUserEvent } from 'storybook/test'

const isVitestBrowser = (): boolean => '__vitest_browser__' in globalThis

const loadBrowserUserEvent = async () => {
  // A static import would execute vitest/browser when regular Storybook loads this story module.
  const { userEvent } = await import('vitest/browser')
  return userEvent
}

/**
 * Move the provider pointer away from the deepest currently hovered element.
 * The destination may remain inside one of that element's ancestors, so only
 * story-specific targets assert their native hover precondition.
 */
export const resetStoryCapturePointer = async (): Promise<void> => {
  if (isVitestBrowser() === false) return

  const hovered = [...document.querySelectorAll(':hover')].at(-1)
  if (hovered === undefined || hovered === document.documentElement || hovered === document.body) {
    return
  }

  const userEvent = await loadBrowserUserEvent()
  await userEvent.unhover(hovered)
}

/** Prove the previous story did not leave its real pointer on this target. */
export const expectStoryCapturePointerAwayFrom = async (element: Element): Promise<void> => {
  if (isVitestBrowser() === false) return
  await expect(element.matches(':hover')).toBe(false)
  await expect(element).not.toHaveAttribute('data-hovered')
}

/**
 * Hover with the real browser pointer under Vitest Browser Mode so screenshots
 * observe the same CSS and React Aria state as a user. Storybook's interaction
 * runner has no browser provider, so its documented user-event fallback remains
 * available in the UI.
 */
export const hoverForStoryCapture = async (element: Element): Promise<void> => {
  if (isVitestBrowser()) {
    await resetStoryCapturePointer()
    await expectStoryCapturePointerAwayFrom(element)
    const userEvent = await loadBrowserUserEvent()
    await userEvent.hover(element)
    await expect(element.matches(':hover')).toBe(true)
    return
  }

  await storybookUserEvent.hover(element)
}
