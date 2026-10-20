import type { ChangelogEntrySource } from '../changelog/contract.ts'

export const entry = {
  title: 'Agent Trace is now Agent Timeline',
  summary:
    'The session-span viewer is named Agent Timeline, reserving Agent Trace for provenance records. Its shared package is @overeng/agent-timeline, with AgentTimeline model types and projectAgentTimeline. The canonical data contract is agentTimeline with the agent-timeline identifier. Deprecated AgentTrace and projectAgentTrace block exports remain aliases. Retained publications keep working: the service answers agent-trace queries and live-hub lookups with the previous failure encoding, and reads frozen agent-trace snapshots. Session data, fixture content and historical changelog entries are unchanged.',
  contributors: [
    {
      agentId: 'dev3.dotfiles.vista',
      worktree: 'dotfiles/2026-10-11-vista-agent-timeline-rename',
    },
  ],
} satisfies ChangelogEntrySource
