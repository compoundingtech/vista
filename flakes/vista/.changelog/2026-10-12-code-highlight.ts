import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Code snippets highlight by default',
  summary:
    'CodeBlock and Markdown fences now share lazy syntax highlighting, Geist light/dark themes, icon-only copying, optional line numbers, and wrapping or horizontal scrolling. Loading snippets preserve the highlighted layout without shifting surrounding content.',
} satisfies ChangelogEntrySource
