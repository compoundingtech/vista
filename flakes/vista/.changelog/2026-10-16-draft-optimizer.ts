import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Avoid dependency reloads during cold draft loads',
  summary:
    'Seed the draft dependency optimizer with the host StyleX runtime and Effect reactivity/RPC subpaths so first loads do not rebuild dependencies and invalidate browser requests mid-load.',
  contributors: [
    {
      agentId: 'agent/dotfiles/vista',
      worktree: 'dotfiles/2026-10-16-vista-draft-cold-optimizer',
    },
  ],
} satisfies ChangelogEntrySource
