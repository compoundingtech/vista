import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Packaged app checks resolve service-owned declarations',
  summary:
    'Fixes packaged Vista check and publish failing with TS6053 for the esm.sh ambient declaration. Preflight now resolves the declaration from the installed service source rather than assuming the service is an app dependency. Package builds check a freshly scaffolded app against the installed runtime closure.',
} satisfies ChangelogEntrySource
