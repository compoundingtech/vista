import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Keep Vista ownership independent of service hosts',
  summary:
    'Vista accepts exact native Smalltalk agent subjects as app owners while retaining historical dotted owners without aliases or reassignment. Every AppSource uses VISTA_SOURCES/_owned.v1/<encoded-owner>/<slug>/app.tsx. The guarded source migration handles both the old catalog and already-relocated sources, refuses collisions before moving any app, and preserves authored bytes, modes and symlinks. Existing published versions, receipts and dotted-owner URLs remain unchanged. A managed activation is forward-only; reverting a generation does not move sources back.',
} satisfies ChangelogEntrySource
