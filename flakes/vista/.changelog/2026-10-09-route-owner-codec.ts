import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Make exact owner URLs safe through the published surface',
  summary:
    'All Vista HTTP owners now use o- followed by lowercase UTF-8 hex, independent of unchanged source, storage and resource-URI encodings. Safe historical dotted literal owners redirect to the canonical URL, including o- prefixed dotted owners; percent-encoded owner routes remain rejected. Retained verified v1 publications are presented at the canonical URL without re-publishing or rewriting immutable receipts, inventories or trust roots. Only verified legacy HTML, JS and CSS responses receive the scoped route and shell navigation projection. New publishes emit canonical receipt bases. Structured interview polling and answers decode the HTTP owner back to its unchanged logical identity; the service also maps canonical scopes sent by immutable pre-codec interview bundles to their existing store keys, preserving retained questions and answers without rebuilding or rewriting those bundles. Draft StyleX CSS and runtime refresh requests remain scoped to the draft base rather than global asset paths. Published-surface delimiter rejection and principal authorization remain unchanged.',
} satisfies ChangelogEntrySource
