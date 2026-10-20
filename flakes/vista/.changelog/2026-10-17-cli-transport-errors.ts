import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'CLI reports the real RPC failure',
  summary:
    'Invalid slugs are rejected locally with the shared service schema. Only refused connections suggest starting the service; HTTP status, DNS, codec, and protocol failures retain their URL and cause, while internal defects remain defects. Loopback control requests bypass environment proxies through a direct HTTP agent.',
} satisfies ChangelogEntrySource
