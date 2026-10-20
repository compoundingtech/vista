import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Agent Trace uses live OMP Usage data',
  summary: 'Agent Trace loads server-backed OMP Usage data instead of a static dogfood fixture.',
  contributors: [
    {
      agentId: 'dev3.direct.omp.pnfr87q8',
      worktree: 'dotfiles/2026-09-20-vista-agent-graph',
    },
    {
      agentId: 'dev3.direct.omp.vzprdp4a',
    },
    {
      agentId: 'dev3.direct.omp.d8eb8287',
      worktree: 'dotfiles/2026-09-20-vista-agent-graph',
    },
  ],
} satisfies ChangelogEntrySource
