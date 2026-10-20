import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Publish from managed seats without requiring an owner for local diagnostics',
  summary:
    'New Vista publications accept only exact st v3 agent/<label>/... subjects. The service refuses legacy dotted owners with a typed error that names the owner and directs the caller to publish from a managed seat. Retained dotted publications remain readable at canonical o-hex URLs with the existing redirects and serve-time projection; no app is migrated or re-attributed. The CLI resolves ST_AGENT only for owner-scoped operations, so help, local check, and service-wide diagnostics work with ST_AGENT unset or invalid (Closes #4402).',
} satisfies ChangelogEntrySource
