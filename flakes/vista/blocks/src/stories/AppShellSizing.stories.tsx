import type { Meta } from '@storybook/react'

import { AppShell } from '../AppShell.tsx'
import * as fixtures from './AppShellSelector.fixtures.tsx'

const meta = {
  title: 'Vista/Shell/AppShell/Sizing',
  component: AppShell,
  args: fixtures.baseArgs,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

/**
 * Publishes the ResizePreferencePinned fixture as a story so the pinned resize preference scenario
 * appears in the sizing story file.
 */
export const ResizePreferencePinned = fixtures.ResizePreferencePinned
/**
 * Publishes the ResizePreferenceLatestAlias fixture as a story, covering resize preference
 * restoration under the latest alias.
 */
export const ResizePreferenceLatestAlias = fixtures.ResizePreferenceLatestAlias
/**
 * Publishes the ResizePreferencePreviousVersion fixture as a story, covering preferences persisted
 * by a previous app version.
 */
export const ResizePreferencePreviousVersion = fixtures.ResizePreferencePreviousVersion
/**
 * Publishes the ResizePreferenceOtherApp fixture as a story, verifying stored preferences from
 * other applications are ignored.
 */
export const ResizePreferenceOtherApp = fixtures.ResizePreferenceOtherApp
/**
 * Publishes the ContentWidthToggle fixture as a story so the centered-versus-full-width toggle
 * interaction is reachable from the sizing stories.
 */
export const ContentWidthToggle = fixtures.ContentWidthToggle
/** Publishes the LongTitle fixture as a story to exercise the AppShell with an oversized title. */
export const LongTitle = fixtures.LongTitle
