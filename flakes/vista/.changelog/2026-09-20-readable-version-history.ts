import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Version history carries the publication story',
  summary:
    'Version choices now retain and present each publication’s title, timestamp, publisher, and change summary instead of reducing history to an opaque version number.',
} satisfies ChangelogEntrySource
