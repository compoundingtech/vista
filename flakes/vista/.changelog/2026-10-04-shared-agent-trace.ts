import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Agent Trace has shared compact and detail renderers',
  summary:
    'Vista uses the shared agent trace core without changing its timeline or details. Compact consumers load spans, cursor evidence and session/descendant spend independently of the detail pane. The runtime policy prebundles the agent trace TypeScript subpaths alongside the other system explorer dependencies; raw TSX renderer exports remain source-transformed.',
} satisfies ChangelogEntrySource
