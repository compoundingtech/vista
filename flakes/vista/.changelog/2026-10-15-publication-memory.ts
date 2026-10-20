import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Publication releases native build resources',
  summary:
    'Repeated publications release native resolver callback owners, keep preflight evaluation free of HTTP and hot-reload lifecycles, and acquire only filesystem and subprocess services rather than per-version terminals. Service builds use a bounded native worker pool to avoid host-sized allocator overhead.',
} satisfies ChangelogEntrySource
