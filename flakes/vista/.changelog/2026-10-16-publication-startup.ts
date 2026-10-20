import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Publication startup avoids unused browser prebundles',
  summary:
    'The service publication runtime loads providers without starting a browser dependency optimizer. Published pages remain self-contained static builds; live drafts retain browser dependency discovery.',
} satisfies ChangelogEntrySource
