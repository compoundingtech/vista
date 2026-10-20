import type { Meta } from '@storybook/react'

import { AppShell } from '../AppShell.tsx'
import * as fixtures from './AppShellSelector.fixtures.tsx'

const meta = {
  title: 'Vista/Shell/AppShell/Metadata',
  component: AppShell,
  args: fixtures.baseArgs,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

/** Storybook story rendering the shell's metadata bar with a richly populated version-metadata fixture. */
export const RichVersionMetadata = fixtures.RichVersionMetadata
/** Storybook story rendering the metadata bar with a fixture whose title is anchored to a document. */
export const DocumentAnchoredTitle = fixtures.DocumentAnchoredTitle
/** Storybook story rendering the metadata changelog in its successfully loaded state. */
export const ChangelogReady = fixtures.ChangelogReady
/**
 * Re-exports the prebuilt AppShell story whose changelog panel is in its loading state so it
 * appears as a Storybook story in the metadata collection.
 */
export const ChangelogLoading = fixtures.ChangelogLoading
/**
 * Re-exports the prebuilt AppShell story showing the changelog panel in its failed/error state for
 * visual and interaction review.
 */
export const ChangelogFailed = fixtures.ChangelogFailed
/**
 * Re-exports the prebuilt AppShell story rendering the changelog panel with no entries, exercising
 * the empty-state presentation.
 */
export const ChangelogEmpty = fixtures.ChangelogEmpty
