import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Keep trusted immutable publications readable across semantic schema changes',
  summary:
    'The publication reader validates retained schema-1 frozen bindings alongside the current semantic manifest without rewriting immutable files, receipts, or trust roots. All receipt, semantic hash, and inventory checks remain enforced. Publication verification failures now include their reason in service logs while retaining the generic HTTP 409 response.',
} satisfies ChangelogEntrySource
