import { expect, test } from 'vitest'

import { sessionLabel, shortAgentId } from '@overeng/agent-timeline/labels'
import type { AgentTimelineSession } from '@overeng/agent-timeline/model'

const session = (overrides: Partial<AgentTimelineSession>): AgentTimelineSession => ({
  id: 'session-1',
  parentId: null,
  rootId: 'session-1',
  depth: 0,
  role: 'main',
  model: 'claude-opus-5',
  actorId: 'gen.dotfiles.vzprdp4a',
  project: null,
  title: null,
  name: null,
  agentType: 'gen',
  task: null,
  modelRole: null,
  readOnly: false,
  contextCapacity: null,
  startedAt: 0,
  endedAt: null,
  ...overrides,
})

test('shortens agent IDs to their last dot segment', () => {
  expect(shortAgentId('gen.dotfiles.vzprdp4a')).toBe('vzprdp4a')
  expect(shortAgentId('seat-167')).toBe('seat-167')
  expect(shortAgentId('trailing.')).toBe('trailing.')
})

test('root rows show the short agent ID while keeping the full ID', () => {
  expect(sessionLabel(session({}))).toMatchObject({
    primary: 'vzprdp4a',
    full: 'gen.dotfiles.vzprdp4a',
  })
})

test('named sessions keep their chosen name unabbreviated', () => {
  expect(
    sessionLabel(session({ depth: 1, parentId: 'root', name: 'Vista.Review', role: 'subagent' })),
  ).toMatchObject({ primary: 'Vista.Review', full: 'Vista.Review' })
})
