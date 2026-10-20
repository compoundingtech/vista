import { Result, Schema } from 'effect'
/**
 * Pure projection tests for the system-explorer (decision 0018). These are the
 * testable analytical core — aspect-toggle, semantic zoom, focus+context, mute —
 * with no DOM, so they pin the mechanisms the spike claimed without React Flow.
 */
import { expect, test } from 'vitest'

import type { SystemLens, SystemModel } from '../../model.ts'
import { project } from './projection.ts'
import { decodeSystemModel, SystemModelSchema } from './schema.ts'

const model: SystemModel = {
  nodes: [
    { id: 'root', label: 'Root', level: 'context' },
    { id: 'a', label: 'A', level: 'container', parent: 'root', lifecycle: 'stable' },
    { id: 'b', label: 'B', level: 'container', parent: 'root', lifecycle: 'beta' },
    { id: 'a1', label: 'A1', level: 'component', parent: 'a' },
  ],
  edges: [
    { id: 'd1', source: 'a', target: 'b', aspect: 'dataflow' },
    { id: 'o1', source: 'a', target: 'b', aspect: 'ownership' },
    { id: 'd2', source: 'a1', target: 'b', aspect: 'dataflow' },
  ],
}

const baseLens = (over: Partial<SystemLens> = {}): SystemLens => ({
  id: 'l',
  aspects: ['dataflow'],
  maxLevel: 'container',
  layout: 'layered-right',
  ...over,
})

test('aspect toggle filters edges without changing the visible node-set', () => {
  const one = project({ model, lens: baseLens({ aspects: ['dataflow'] }) })
  const both = project({ model, lens: baseLens({ aspects: ['dataflow', 'ownership'] }) })
  // Same layout signature (no relayout) but the ownership edge appears.
  expect(both.layoutSignature).toBe(one.layoutSignature)
  expect(one.edges.length).toBe(1)
  expect(both.edges.length).toBe(2)
})

test('semantic zoom: container floor hides components; drill reveals them', () => {
  const overview = project({ model, lens: baseLens({ maxLevel: 'container' }) })
  expect(overview.nodes.map((n) => n.node.id).sort()).toEqual(['a', 'b', 'root'])
  const drilled = project({ model, lens: baseLens({ maxLevel: 'container', expanded: ['a'] }) })
  expect(drilled.nodes.map((n) => n.node.id)).toContain('a1')
  // The visible-set change DOES change the layout signature (a relayout).
  expect(drilled.layoutSignature).not.toBe(overview.layoutSignature)
})

test('hidden-endpoint edges are lifted to the nearest visible ancestor', () => {
  // a1 is hidden at container floor; its dataflow edge to b lifts to a->b and
  // dedupes against the existing a->b dataflow edge.
  const overview = project({ model, lens: baseLens({ aspects: ['dataflow'] }) })
  expect(overview.edges).toHaveLength(1)
  expect(overview.edges[0]!.edge.source).toBe('a')
})

test('focus+context mutes nodes outside the focused neighborhood (render hint)', () => {
  const focused = project({ model, lens: baseLens({ aspects: ['dataflow'], focus: 'a' }) })
  const byId = new Map(focused.nodes.map((n) => [n.node.id, n]))
  expect(byId.get('a')!.muted).toBe(false) // focus
  expect(byId.get('b')!.muted).toBe(false) // neighbor via a->b
  expect(byId.get('root')!.muted).toBe(true) // outside neighborhood
  // Focus does not change the layout (it is a render hint).
  expect(focused.layoutSignature).toBe(project({ model, lens: baseLens() }).layoutSignature)
})

test('attribute-mute fades nodes whose attribute does not match keep', () => {
  const muted = project({ model, lens: baseLens({ muteBy: { key: 'lifecycle', keep: 'stable' } }) })
  const byId = new Map(muted.nodes.map((n) => [n.node.id, n]))
  expect(byId.get('a')!.muted).toBe(false) // stable
  expect(byId.get('b')!.muted).toBe(true) // beta
})

test('SystemModel codec preserves the wire shape and rejects malformed payloads', () => {
  const decoded = decodeSystemModel(model)
  expect(Result.isSuccess(decoded)).toBe(true)
  if (Result.isSuccess(decoded)) {
    expect(Schema.encodeSync(SystemModelSchema)(decoded.success)).toEqual(model)
  }
  expect(Result.isFailure(decodeSystemModel({ nodes: 'no', edges: [] }))).toBe(true)
})
