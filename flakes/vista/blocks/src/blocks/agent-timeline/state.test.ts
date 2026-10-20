import { Schema } from 'effect'
import * as AtomRegistry from 'effect/reactivity/AtomRegistry'
import { expect, test } from 'vitest'

import { AgentTimelineModelSchema } from '@overeng/agent-timeline/model'
import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import oneHourJson from '../../stories/agent-timeline/1h.json' with { type: 'json' }
import { expandedSessionIds, makeTraceState, nextExpansion } from './state.ts'

const scene = projectAgentTimeline(Schema.decodeSync(AgentTimelineModelSchema)(oneHourJson))

test('collapsed descendants roll up to their nearest visible collapsed ancestor without reducing totals', () => {
  const state = makeTraceState(scene)
  const registry = AtomRegistry.make()
  const first = registry.get(state.visible)
  const totals = registry.get(state.totals)
  expect(first.every((item) => item.lane.session.parentId === null)).toBe(true)
  expect(first.some((item) => item.rolledUpChildren.length > 0)).toBe(true)
  expect(totals.shown.agents).toBe(scene.lanes.length)
  expect(totals.shown.usd).toBeCloseTo(scene.totals.usd)

  const root = first.find((item) => item.rolledUpChildren.length > 0)!
  registry.set(state.expansion, new Set([root.lane.session.id]))
  const expanded = registry.get(state.visible)
  expect(expanded.length).toBeGreaterThan(first.length)
  expect(registry.get(state.totals)).toEqual(totals)
  const nested = expanded.find((item) => item.lane.session.parentId === root.lane.session.id)
  if (nested !== undefined) {
    expect(root.rolledUpChildren).toContain(nested.lane)
    expect(
      expanded.find((item) => item.lane.session.id === nested.lane.session.id)?.rolledUpChildren,
    ).not.toContain(nested.lane)
  }
})

test('filter totals and cap denominators are independent of expansion', () => {
  const capped = projectAgentTimeline({
    ...scene.model,
    coverage: { ...scene.model.coverage, matchingSessions: scene.lanes.length + 309 },
  })
  const state = makeTraceState(capped)
  const registry = AtomRegistry.make()
  expect(registry.get(state.totals).matching).toBe(scene.lanes.length + 309)
  const filter = capped.lanes.find((lane) => lane.session.role !== 'main')!
  registry.set(state.filterText, filter.session.id)
  const filtered = registry.get(state.totals)
  expect(filtered.shown.agents).toBeLessThan(filtered.all.agents)
  registry.set(state.expansion, 'all')
  expect(registry.get(state.totals)).toEqual(filtered)
})

test('expansion defaults collapsed, all converts to a set, and new sessions remain collapsed', () => {
  const state = makeTraceState(scene)
  const registry = AtomRegistry.make()
  expect(registry.get(state.expansion)).toEqual(new Set())
  const all = expandedSessionIds('all', scene)
  expect(all.size).toBe(scene.lanes.length)
  const withoutFirst = new Set(Array.from(all).slice(1))
  const converted = nextExpansion('all', withoutFirst, scene)
  expect(converted).toEqual(withoutFirst)
  const extra = {
    ...scene,
    lanes: [
      ...scene.lanes,
      { ...scene.lanes[0]!, session: { ...scene.lanes[0]!.session, id: 'new-live-session' } },
    ],
  }
  expect(expandedSessionIds(converted, extra).has('new-live-session')).toBe(false)
  expect(expandedSessionIds('all', extra).has('new-live-session')).toBe(true)
})
