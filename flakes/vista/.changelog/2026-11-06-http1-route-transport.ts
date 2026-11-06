import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Enforce the native route bridge HTTP/1 transport contract',
  summary:
    'Reject non-HTTP/1 platform requests as a transport invariant violation before invoking native middleware, while preserving the HTTP/1 request and response lifecycle.',
  contributors: [
    {
      agentId: 'agent/compoundingtech/vista',
      worktree: 'vista/schickling-assistant-2026-11-06-http1-route-transport',
    },
  ],
} satisfies ChangelogEntrySource
