import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'RPC diagnostics and frame rate share the operator bar',
  summary:
    'Open Inspect RPC activity to switch between the scoped RPC explorer and a visibility-aware FPS meter. The tools follow Vista’s light and dark themes.',
  contributors: [
    {
      agentId: 'dev3.direct.omp.uw2ejhmb',
      worktree: 'dotfiles/2026-09-29-effect-rc118-devbar',
    },
  ],
} satisfies ChangelogEntrySource
