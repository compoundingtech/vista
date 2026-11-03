import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Resolve public draft optimizer seeds from the service dependency closure',
  summary:
    'Anchor policy-public draft dependency seeds without changing owner-scoped sources or private-seed behavior. Private dependencies remain unaliased to preserve authored import policy.',
  contributors: [
    {
      agentId: 'agent/compoundingtech/vista',
      worktree: 'vista/schickling-assistant-2026-11-02-fix-23-optimizer-anchor',
    },
  ],
} satisfies ChangelogEntrySource
