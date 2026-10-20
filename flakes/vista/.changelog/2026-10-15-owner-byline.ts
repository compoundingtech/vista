import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Show a quiet owner byline in the app shell',
  summary:
    'The shell shows a compact owner label beneath the document title, with the exact subject in a tooltip on hover or keyboard focus and an accessible owner label. Native seat labels come from the subject’s last segment with hyphens replaced by spaces; historical dotted owners read “legacy session”. Apps without an owner show no byline. New publications embed the owner losslessly as a JSON-backed browser-bootstrap expression without a runtime lookup.',
} satisfies ChangelogEntrySource
