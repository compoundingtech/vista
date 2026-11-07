import type { ChangelogEntrySource } from '../service/src/changelog/contract.ts'

export const entry = {
  title: 'Shared Highlights rendering for code and diffs',
  summary:
    'Code snippets, diffs, and source inspection share Pierre Highlights with Geist light/dark colors and a JavaScript Shiki fallback when WebAssembly is unavailable. Complete file pairs retain expandable context; patch-only captures preserve their supplied hunks.',
  contributors: [
    {
      agentId: 'agent/compoundingtech/vista',
      worktree: 'schickling-assistant/2026-11-03-pierre-highlights',
    },
  ],
} satisfies ChangelogEntrySource
