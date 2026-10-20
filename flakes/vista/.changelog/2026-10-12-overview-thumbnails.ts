import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Preview published apps in the overview',
  summary:
    'The app overview now shows compact, lazy-loaded 8:5 thumbnails of each latest publication, with neutral placeholders for versions without a preview. Successful publish smoke derives a 480×300 light-theme PNG without adding another browser or dependency. Capture has one five-second deadline across screenshot and downscale; expiry closes the capture page without failing publication. Previews live outside signed executable inventories and have stable version-pinned image URLs. Operators can manually backfill existing versions through the loopback-only vista-service backfill-thumbnails command without rewriting publication receipts.',
} satisfies ChangelogEntrySource
