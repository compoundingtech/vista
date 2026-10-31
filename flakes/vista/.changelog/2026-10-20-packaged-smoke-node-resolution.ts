import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Packaged smoke resolves browser dependencies',
  summary:
    'All packaged smoke tasks clear NODE_PRESERVE_SYMLINKS before starting Node so the browser proof resolves Playwright and its transitive dependencies. Direct harness invocations reject the incompatible environment immediately with a corrective command.',
} satisfies ChangelogEntrySource
