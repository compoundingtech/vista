import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Keep authored Vista sources in service-owned state',
  summary:
    'Vista resolves canonical AppSources beneath VISTA_SOURCES as host/seat/slug, with the managed default at XDG_STATE_HOME/vista/sources. Source ownership still derives from ST_AGENT. The managed activation preserves existing authored sources through a guarded one-time relocation before restarting Vista; published versions and other service state are unchanged.',
} satisfies ChangelogEntrySource
