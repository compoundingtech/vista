import type { AgentTimelineSession } from './model.ts'

/** Display-ready session identity fields derived from normalized trace metadata. */
export interface AgentSessionLabel {
  /** Compact row identity: the chosen name, or the last agent ID segment for roots. */
  readonly primary: string
  /** Unabbreviated identity for titles, accessible labels, and details. */
  readonly full: string
  readonly type: string | null
  readonly task: string | null
  readonly model: string
}

/** Last dot-separated segment of an agent ID, e.g. `gen.vista.vzprdp4a` → `vzprdp4a`. */
export const shortAgentId = (actorId: string): string => {
  const segment = actorId.slice(actorId.lastIndexOf('.') + 1)
  return segment === '' ? actorId : segment
}

/** Resolve the OMP identity fields; root sessions have no chosen name, so the current agent ID stands in. */
export const sessionLabel = (session: AgentTimelineSession): AgentSessionLabel => ({
  primary: session.name ?? shortAgentId(session.actorId),
  full: session.name ?? session.actorId,
  type: session.agentType ?? session.role,
  task: session.task,
  model: session.model,
})
