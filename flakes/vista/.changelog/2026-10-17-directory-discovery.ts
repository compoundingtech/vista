import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Release history discovers entries without a shared registry',
  summary:
    'Adding a release-history entry requires only one new file. The changelog compiler discovers entries from their directory, validates their dates and schemas, and preserves deterministic newest-first history without shared index conflicts.',
} satisfies ChangelogEntrySource
