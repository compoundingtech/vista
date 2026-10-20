import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Advisory taste review from the CLI',
  summary:
    'vista review accepts a published slug or preview URL, captures light and dark first viewports with Nix-managed Playwright, and reports DOM density plus up to five ranked Opus taste findings. Reviews are advisory and never block publishing.',
} satisfies ChangelogEntrySource
