import type { Meta } from '@storybook/react'

import { AppShell } from '../AppShell.tsx'
import * as fixtures from './AppShellSelector.fixtures.tsx'

const meta = {
  title: 'Vista/Shell/AppShell/Responsive',
  component: AppShell,
  args: fixtures.baseArgs,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

/**
 * Re-exports the prebuilt AppShell story rendering the shell at narrow width to demonstrate the
 * compact responsive layout.
 */
export const NarrowLayout = fixtures.NarrowLayout
/**
 * Re-exports the prebuilt AppShell story combining a narrow viewport with the light theme to
 * verify responsive and theming behavior together.
 */
export const NarrowLayoutLight = fixtures.NarrowLayoutLight
/**
 * Re-exports the prebuilt AppShell story rendering the shell in the light color theme for contrast
 * and styling review.
 */
export const LightTheme = fixtures.LightTheme
/**
 * Re-exports the prebuilt AppShell story rendering the shell in the dark color theme for contrast
 * and styling review.
 */
export const DarkTheme = fixtures.DarkTheme
