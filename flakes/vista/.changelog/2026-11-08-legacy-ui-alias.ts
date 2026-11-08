import type { ChangelogEntrySource } from '../service/src/changelog/contract.ts'

export const entry = {
  title: 'Legacy UI imports remain compatible',
  summary:
    'Existing app sources can import @overeng/geist-design-system as a deprecated alias of @vista/ui across drafts, local checks, and publication. Checks warn to use @vista/ui; components, styles, and tokens retain the same implementation.',
} satisfies ChangelogEntrySource
