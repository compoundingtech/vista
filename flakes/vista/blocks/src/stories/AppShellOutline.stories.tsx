import type { Meta } from '@storybook/react'

import { AppShell } from '../AppShell.tsx'
import * as fixtures from './AppShellSelector.fixtures.tsx'

const meta = {
  title: 'Vista/Shell/AppShell/Outline',
  component: AppShell,
  args: fixtures.baseArgs,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

/**
 * Re-exports the prebuilt AppShell story rendering a deeply nested section outline to exercise
 * hierarchical outline display.
 */
export const NestedOutline = fixtures.NestedOutline
/**
 * Re-exports the prebuilt AppShell story in which the document supplies no outline, verifying how
 * the shell handles its absence.
 */
export const WithoutOutline = fixtures.WithoutOutline
/**
 * Re-exports the prebuilt AppShell story constraining the viewport to 1280px to check outline
 * visibility at that breakpoint.
 */
export const OutlineAt1280 = fixtures.OutlineAt1280
/**
 * Re-exports the prebuilt AppShell story pairing lengthy content with a persistent outline to
 * verify sticky behavior across a long scroll.
 */
export const LongPersistentOutline = fixtures.LongPersistentOutline
/**
 * Re-exports the prebuilt AppShell story that renders the persistent outline at a 1920px viewport
 * to confirm wide-screen layout.
 */
export const PersistentOutlineAt1920 = fixtures.PersistentOutlineAt1920
/**
 * Re-exports the prebuilt AppShell story exercising the outline's keyboard navigation path for
 * accessibility testing.
 */
export const KeyboardOutline = fixtures.KeyboardOutline

/** The ask counter and priority ticks follow answer markers as they change. */
export const AskAnswers = fixtures.AskAnswers
