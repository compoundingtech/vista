import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Explain blocked publication versions',
  summary:
    'Navigation to an unverifiable publication now shows a service-owned error page with app, owner and version context, an explanation, republishing guidance, and links to latest and the app index instead of a bare trust-verification string. Asset and RPC failures remain non-HTML HTTP 409 responses.',
} satisfies ChangelogEntrySource
