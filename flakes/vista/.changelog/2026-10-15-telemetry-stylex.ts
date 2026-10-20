import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Restore telemetry draft rendering',
  summary:
    'Drafts keep the shared agent-trace compact component barrel in the StyleX compiler pipeline instead of prebundling its uncompiled styles, restoring metric, flamegraph, and trace panels.',
  contributors: [
    {
      agentId: 'agent/dotfiles/vista',
      worktree: 'dotfiles/2026-10-15-vista-telemetry-stylex',
    },
  ],
} satisfies ChangelogEntrySource
