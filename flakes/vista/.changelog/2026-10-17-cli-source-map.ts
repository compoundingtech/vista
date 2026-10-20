import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Quiet CLI startup with portable source maps',
  summary:
    'The packaged CLI carries a valid adjacent source map instead of mistaking a bundled plugin template for a map directive. Version and help invocations stay quiet on stderr, and command descriptions consistently say “an app”.',
} satisfies ChangelogEntrySource
