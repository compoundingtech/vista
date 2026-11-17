import type { ChangelogEntrySource } from '../service/src/changelog/contract.ts'

export const entry = {
  title: 'Accept canonical usage producer build provenance',
  summary:
    'Read both producer_build_version and the legacy omp_version provenance field, preferring producer_build_version when both are present. Usage evidence retains one required producer build identity and strict validation of unrelated fields; this identity is not the native OMP version.',
  contributors: [
    {
      agentId: 'agent/compoundingtech/vista',
      worktree: 'vista/schickling-assistant-2026-11-17-tolerant-omp-provenance',
    },
  ],
} satisfies ChangelogEntrySource
