import type { Meta } from '@storybook/react'

import { AppShell } from '../AppShell.tsx'
import * as fixtures from './AppShellSelector.fixtures.tsx'

const meta = {
  title: 'Vista/Shell/AppShell/Navigation',
  component: AppShell,
  args: fixtures.baseArgs,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

/**
 * Re-exports the prebuilt AppShell story whose navigation pins to the current release,
 * demonstrating the default pinned-version behavior.
 */
export const PinnedCurrent = fixtures.PinnedCurrent
/**
 * Re-exports the prebuilt AppShell story pinning navigation to an older version so the stale-pin
 * presentation can be inspected.
 */
export const PinnedStale = fixtures.PinnedStale
/**
 * Re-exports the prebuilt AppShell story where navigation follows the latest version alias instead
 * of a pinned release.
 */
export const FollowLatest = fixtures.FollowLatest
