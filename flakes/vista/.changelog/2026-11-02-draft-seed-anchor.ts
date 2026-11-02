import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Resolve draft optimizer seeds from the service dependency closure',
  summary:
    'Keep owner-scoped draft roots while resolving dependency seeds and client imports through the same policy-checked service anchor, without modifying authored sources.',
  contributors: [
    {
      agentId: 'agent/compoundingtech/vista',
      worktree: 'vista/schickling-assistant/2026-11-02-fix-23-optimizer-anchor',
    },
  ],
} satisfies ChangelogEntrySource
