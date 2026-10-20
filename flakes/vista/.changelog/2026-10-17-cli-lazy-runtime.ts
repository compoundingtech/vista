import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Load the CLI runtime only when needed',
  summary:
    'Version queries use a separate metadata entry instead of loading the command runtime. Local app validation loads its compiler and provider dependencies only when check runs; help and operational commands retain the canonical command definitions and build identity.',
} satisfies ChangelogEntrySource
