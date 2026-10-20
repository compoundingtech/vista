import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Make heavy-block publication proofs independent of live GitHub',
  summary:
    'The heavy-block sample captures its recorded pull-request provider through the real publication pipeline instead of waiting on live GitHub commands, keeping its existing setup deadline reliable.',
  contributors: [
    {
      agentId: 'agent/dotfiles/vista',
      worktree: 'dotfiles/2026-10-16-vista-heavy-cold-publish',
    },
  ],
} satisfies ChangelogEntrySource
