import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Keep Nix packaging lazy across platforms',
  summary:
    'Evaluating Vista no longer builds its Buck CLI or pnpm archives. Source-built descriptor, module integrity, size, and runtime closure checks run when the package is realized instead, and metadata must contain exactly one JSON object.',
} satisfies ChangelogEntrySource
