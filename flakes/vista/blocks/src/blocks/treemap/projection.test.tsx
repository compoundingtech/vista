import { Result, Schema } from 'effect'
/**
 * Pure projection tests for the treemap block (decision 0055). DOM-free: d3-hierarchy
 * geometry is pure math, so the whole `project` runs in Node. These pin the analytical
 * core the spike claimed — fold completeness (MED.KIT-R61), depth-cap bounds, "+N more"
 * aggregate correctness, and the structural-vs-restyle `layoutSignature` split.
 */
import { expect, test } from 'vitest'

import type { TreemapModel } from '../../model.ts'
import {
  derivedValueDomain,
  project,
  resolveHiddenFacetLeafIds,
  type DerivedNode,
  type ProjectedScene,
  type TreemapProjectionLens,
  TREEMAP_HEADER_HEIGHT,
} from './projection.ts'
import { decodeTreemapModel, TreemapModelSchema } from './schema.ts'

const size = { width: 800, height: 600 } as const

// A big container (two leaves) plus four tiny siblings that fold under threshold.
const model: TreemapModel = {
  unit: 'bytes',
  valueNoun: 'size',
  root: {
    id: 'root',
    label: 'root',
    children: [
      {
        id: 'big',
        label: 'big',
        children: [
          { id: 'big1', label: 'big1', value: 900 },
          { id: 'big2', label: 'big2', value: 100 },
        ],
      },
      { id: 'a', label: 'a', value: 3 },
      { id: 'b', label: 'b', value: 2 },
      { id: 'c', label: 'c', value: 1 },
      { id: 'd', label: 'd', value: 1 },
    ],
  },
}

const baseLens = (over: Partial<TreemapProjectionLens> = {}): TreemapProjectionLens => ({
  layout: 'treemap',
  rootId: undefined,
  maxDepth: 3,
  minAreaPct: 0.05, // cut = 0.05 * 1007 ≈ 50 → a,b,c,d (3,2,1,1) all fold
  colorBy: 'group',
  ...over,
})

/** Sum values of true leaves (childless derived nodes) — the completeness oracle. */
const leafSum = (d: DerivedNode): number =>
  !d.children || d.children.length === 0 ? d.value : d.children.reduce((s, c) => s + leafSum(c), 0)

const maxRectDepth = (rects: ProjectedScene['rects']): number =>
  rects.reduce((m, r) => Math.max(m, r.depth), 0)

const findByKind = (d: DerivedNode, kind: DerivedNode['kind']): DerivedNode | undefined => {
  if (d.kind === kind) return d
  for (const c of d.children ?? []) {
    const hit = findByKind(c, kind)
    if (hit) return hit
  }
  return undefined
}

test('total value is preserved under fold (leaf-sum === root sum)', () => {
  const scene = project({ model, lens: baseLens(), size })
  expect(scene.total).toBe(1007)
  // Every folded/summarized node stays represented — Σ tiles === source value.
  expect(leafSum(scene.derived)).toBe(scene.total)
})

test('"+N more" aggregate folds the sub-threshold siblings with exact count + value', () => {
  const scene = project({ model, lens: baseLens(), size })
  const agg = findByKind(scene.derived, 'aggregate')
  expect(agg).toBeDefined()
  expect(agg!.childCount).toBe(4) // a, b, c, d
  expect(agg!.value).toBe(7) // 3 + 2 + 1 + 1
  expect(agg!.children).toHaveLength(4)
  // The big container is NOT folded (above the cut).
  expect(findByKind(scene.derived, 'container')?.id).toBe('root')
})

test('depth cap bounds the rendered depth (deeper subtrees summarize)', () => {
  const deep = project({ model, lens: baseLens({ maxDepth: 3 }), size })
  const shallow = project({ model, lens: baseLens({ maxDepth: 1 }), size })
  // Rendered depth = laid-out rect depth from the display root; the cap bounds it.
  expect(maxRectDepth(shallow.rects)).toBeLessThanOrEqual(1)
  for (const r of shallow.rects) expect(r.depth).toBeLessThanOrEqual(1)
  // A deeper cap renders strictly deeper (big1/big2 become their own tiles).
  expect(maxRectDepth(deep.rects)).toBeGreaterThan(maxRectDepth(shallow.rects))
  // At maxDepth 1 the `big` container summarizes into a drillable single tile.
  const summ = findByKind(shallow.derived, 'summarized')
  expect(summ?.id).toBe('big')
  expect(summ?.value).toBe(1000)
})

test('treemap containers reserve a full-height parent hit row above child tiles', () => {
  const scene = project({ model, lens: baseLens(), size })
  const parent = scene.rects.find(({ node }) => node.id === 'big')
  const child = scene.rects.find(({ node }) => node.id === 'big1')

  expect(parent).toBeDefined()
  expect(child).toBeDefined()
  expect(child!.y0 - parent!.y0).toBeGreaterThanOrEqual(TREEMAP_HEADER_HEIGHT)
})

test('valueDomain spans the DRAWN layout leaves only (aggregate counts, folded children do not)', () => {
  const scene = project({ model, lens: baseLens(), size })
  // Layout leaves under baseLens: big1=900, big2=100, and the aggregate(=7) folding a/b/c/d.
  // The walk must STOP at the aggregate — not descend into the folded 3/2/1/1 leaves — so
  // the min is the drawn aggregate (7), never the invisible folded 1. This pins that the
  // legend endpoints (min→max) correspond exactly to the faintest/brightest drawn tiles.
  expect(scene.valueDomain.min).toBe(7)
  expect(scene.valueDomain.max).toBe(900)
  expect(scene.valueDomain.logMin).toBe(Math.log1p(7))
  expect(scene.valueDomain.logMax).toBe(Math.log1p(900))
  // min < max ⇒ a non-degenerate ramp (the min leaf maps to ramp start, the max to the end).
  expect(scene.valueDomain.logMax).toBeGreaterThan(scene.valueDomain.logMin)
})

test('derivedValueDomain degrades to {0,0} on an empty derived tree', () => {
  const empty: DerivedNode = { id: 'x', label: 'x', value: 0, kind: 'leaf', realId: 'x' }
  const domain = derivedValueDomain(empty)
  expect(domain).toEqual({ min: 0, max: 0, logMin: 0, logMax: 0 })
})

test('layoutSignature is identical under a pure recolor restyle', () => {
  const grouped = project({ model, lens: baseLens({ colorBy: 'group' }), size })
  const valued = project({ model, lens: baseLens({ colorBy: 'value' }), size })
  expect(valued.layoutSignature).toBe(grouped.layoutSignature)
})

test('layoutSignature changes under a structural change (zoom root / depth / layout)', () => {
  const base = project({ model, lens: baseLens(), size })
  const zoomed = project({ model, lens: baseLens({ rootId: 'big' }), size })
  const capped = project({ model, lens: baseLens({ maxDepth: 1 }), size })
  const icicle = project({ model, lens: baseLens({ layout: 'icicle' }), size })
  expect(zoomed.layoutSignature).not.toBe(base.layoutSignature)
  expect(capped.layoutSignature).not.toBe(base.layoutSignature)
  expect(icicle.layoutSignature).not.toBe(base.layoutSignature)
})

test('TreemapModel codec preserves the wire shape and rejects malformed payloads', () => {
  const decoded = decodeTreemapModel(model)
  expect(Result.isSuccess(decoded)).toBe(true)
  if (Result.isSuccess(decoded)) {
    expect(Schema.encodeSync(TreemapModelSchema)(decoded.success)).toEqual(model)
  }
  expect(Result.isFailure(decodeTreemapModel({ root: 'nope' }))).toBe(true)
})

// --- facet-scoped default-hide seeding (decision 0068, MED.BLK.TREE-R73) -----

const facetModel: TreemapModel = {
  root: {
    id: 'r',
    label: 'r',
    children: [
      { id: 'r/gen.yml', label: 'gen.yml', value: 100, facets: { provenance: 'generated' } },
      { id: 'r/src.ts', label: 'src.ts', value: 40, facets: { provenance: 'authored' } },
      { id: 'r/vend.js', label: 'vend.js', value: 20, facets: { provenance: 'vendored' } },
      { id: 'r/plain.ts', label: 'plain.ts', value: 5 },
    ],
  },
}

test('resolveHiddenFacetLeafIds selects exactly the leaves whose facet matches', () => {
  const hidden = resolveHiddenFacetLeafIds(facetModel, { provenance: ['generated'] })
  expect([...hidden]).toEqual(['r/gen.yml'])
})

test('resolveHiddenFacetLeafIds matches ANY listed value across keys', () => {
  const hidden = resolveHiddenFacetLeafIds(facetModel, { provenance: ['generated', 'vendored'] })
  expect(new Set(hidden)).toEqual(new Set(['r/gen.yml', 'r/vend.js']))
})

test('resolveHiddenFacetLeafIds returns empty for an undefined or empty policy', () => {
  expect(resolveHiddenFacetLeafIds(facetModel, undefined).size).toBe(0)
  expect(resolveHiddenFacetLeafIds(facetModel, {}).size).toBe(0)
  // A facetless leaf (plain.ts) never matches.
  expect(
    resolveHiddenFacetLeafIds(facetModel, { provenance: ['authored'] }).has('r/plain.ts'),
  ).toBe(false)
})
