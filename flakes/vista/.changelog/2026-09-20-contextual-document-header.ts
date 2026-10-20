import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Document context stays visible while you read',
  summary:
    'The compact Vista header now follows the active outline section while preserving the document title in browser metadata and as the fallback when no outline is available.',
} satisfies ChangelogEntrySource
