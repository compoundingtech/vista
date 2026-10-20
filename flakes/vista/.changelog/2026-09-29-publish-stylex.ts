import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Vista publishes apps with responsive styles again',
  summary:
    'The imported Vista service compiles packaged StyleX libraries at runtime and shares one Effect instance with Vite-loaded providers, restoring responsive styles and frozen data capture during publication.',
  contributors: [
    {
      agentId: 'mbp2025.direct.omp.c5k46z35',
      worktree: 'dotfiles/2026-09-29-vista-3606',
    },
  ],
} satisfies ChangelogEntrySource
