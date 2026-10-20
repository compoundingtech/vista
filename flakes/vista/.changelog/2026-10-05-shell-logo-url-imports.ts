import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Load shell logos in published apps',
  summary:
    'Both shell logo variants are emitted as static publication assets with build-resolved URLs, so light and dark themes load their logos without duplicate assets/assets paths.',
} satisfies ChangelogEntrySource
