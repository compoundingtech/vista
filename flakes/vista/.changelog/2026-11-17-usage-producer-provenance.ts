import type { ChangelogEntrySource } from '../service/src/changelog/contract.ts'

export const entry = {
  title: 'Accept canonical usage producer build provenance',
  summary:
    'Read both producer_build_version and the legacy omp_version provenance field, preferring producer_build_version when both are present. Internally retain one required producer build identity, distinct from the native OMP version, while preserving legacy-only omp_version on RPC and snapshot output for retained published clients. Strict validation of unrelated fields is unchanged.',
  contributors: [
    {
      agentId: 'agent/compoundingtech/vista',
      worktree: 'vista/schickling-assistant-2026-11-17-tolerant-omp-provenance',
    },
  ],
} satisfies ChangelogEntrySource
