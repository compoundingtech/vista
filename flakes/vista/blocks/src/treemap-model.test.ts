/**
 * Tests for the treemap MODEL BUILDERS (`treemap-model.ts`, decision 0055): the
 * generic `buildTreemapModel` core and the `fromGitDiff` / `fromDu` adapters.
 * Pure functions, so the tests are direct value assertions (plain vitest, matching
 * `authoring.test.ts`).
 */
import { Result } from 'effect'
import { expect, test } from 'vitest'

import { decodeTreemapModel } from './blocks/treemap/schema.ts'
import type { TreemapNode } from './model.ts'
import { buildTreemapModel, type FileChange, fromDu, fromGitDiff } from './treemap-model.ts'

/** Find a node by label in a breadth-first walk (labels are unique in these fixtures). */
const findByLabel = (root: TreemapNode, label: string): TreemapNode | undefined => {
  const queue: TreemapNode[] = [root]
  while (queue.length > 0) {
    const n = queue.shift()!
    if (n.label === label) return n
    for (const c of n.children ?? []) queue.push(c)
  }
  return undefined
}

/** Sum of every LEAF value in the tree (leaves = nodes with no children). */
const leafSum = (node: TreemapNode): number => {
  if (node.children === undefined || node.children.length === 0) return node.value ?? 0
  return node.children.reduce((s, c) => s + leafSum(c), 0)
}

// --- buildTreemapModel ------------------------------------------------------

test('buildTreemapModel nests entries and keeps leaves value-carrying', () => {
  const model = buildTreemapModel([
    { path: 'src/a.ts', value: 10 },
    { path: 'src/b.ts', value: 5 },
    { path: 'docs/x.md', value: 3 },
  ])
  const src = findByLabel(model.root, 'src')!
  expect(src.children).toHaveLength(2)
  const a = findByLabel(model.root, 'a.ts')!
  expect(a.value).toBe(10)
  expect(a.children).toBeUndefined()
})

test('buildTreemapModel accepts structured paths without parsing separators inside labels', () => {
  const model = buildTreemapModel([
    { path: ['tool/with/slash', 'artifact × role', 'leaf'], value: 10 },
  ])
  const tool = model.root.children?.[0]
  expect(tool).toMatchObject({ id: 'root/tool%2Fwith%2Fslash', label: 'tool/with/slash' })
  expect(tool?.children?.[0]).toMatchObject({ label: 'artifact × role' })
  expect(tool?.children?.[0]?.children?.[0]).toMatchObject({ label: 'leaf', value: 10 })
})

test('buildTreemapModel containers carry NO own value (summed via d3, not pre-summed)', () => {
  const model = buildTreemapModel([
    { path: 'src/a.ts', value: 10 },
    { path: 'src/b.ts', value: 5 },
  ])
  const src = findByLabel(model.root, 'src')!
  // The key is not present at all — not merely `undefined` (which toEqual would ignore).
  expect('value' in src).toBe(false)
  expect('value' in model.root).toBe(false)
})

test('buildTreemapModel sums duplicate-path entries (value + additive metrics)', () => {
  const model = buildTreemapModel([
    { path: 'src/a.ts', value: 10, metrics: { hits: 2 } },
    { path: 'src/a.ts', value: 4, metrics: { hits: 3 } },
  ])
  const a = findByLabel(model.root, 'a.ts')!
  expect(a.value).toBe(14)
  expect(a.metrics).toEqual({ hits: 5 })
})

test('buildTreemapModel preserves a legitimate zero-value leaf (not truthiness-dropped)', () => {
  const model = buildTreemapModel([{ path: 'a', value: 0 }])
  const a = findByLabel(model.root, 'a')!
  expect('value' in a).toBe(true)
  expect(a.value).toBe(0)
})

test('buildTreemapModel orders children by aggregate value desc, then label', () => {
  const model = buildTreemapModel([
    { path: 'small.ts', value: 1 },
    { path: 'big.ts', value: 100 },
    { path: 'mid.ts', value: 50 },
  ])
  expect(model.root.children?.map((c) => c.label)).toEqual(['big.ts', 'mid.ts', 'small.ts'])
})

test('buildTreemapModel builds the FULL tree by default (no folding)', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ path: `dir/f${i}.ts`, value: i + 1 }))
  const model = buildTreemapModel(entries)
  const dir = findByLabel(model.root, 'dir')!
  expect(dir.children).toHaveLength(20)
  expect(findByLabel(model.root, '20 more')).toBeUndefined()
})

test('buildTreemapModel opt-in foldBelowFraction folds tiny siblings, preserving the exact total (MED.KIT-R61)', () => {
  const entries = [
    { path: 'big.ts', value: 900, metrics: { m: 9 } },
    { path: 'tiny1.ts', value: 1, metrics: { m: 1 } },
    { path: 'tiny2.ts', value: 2, metrics: { m: 2 } },
    { path: 'tiny3.ts', value: 3, metrics: { m: 3 } },
  ]
  const full = buildTreemapModel(entries)
  const folded = buildTreemapModel(entries, { foldBelowFraction: 0.05 })
  // tiny1/2/3 (< 5% of 906) collapse into one "3 more" leaf; big stays.
  expect(folded.root.children?.map((c) => c.label)).toEqual(['big.ts', '3 more'])
  const more = findByLabel(folded.root, '3 more')!
  expect(more.value).toBe(6)
  expect(more.metrics).toEqual({ m: 6 })
  // Totals identical to the unfolded tree (nothing dropped).
  expect(leafSum(folded.root)).toBe(leafSum(full.root))
  expect(leafSum(folded.root)).toBe(906)
})

test('buildTreemapModel opt-in maxDepth collapses deep containers to aggregate leaves (keeps label, exact total)', () => {
  const entries = [
    { path: 'a/b/c/d.ts', value: 10, metrics: { m: 1 } },
    { path: 'a/b/c/e.ts', value: 20, metrics: { m: 2 } },
    { path: 'a/x.ts', value: 5, metrics: { m: 5 } },
  ]
  const model = buildTreemapModel(entries, { maxDepth: 2 })
  // depth: root=0, a=1, {b, x.ts}=2. `b` at depth 2 collapses to an aggregate leaf.
  const b = findByLabel(model.root, 'b')!
  expect(b.children).toBeUndefined()
  expect(b.value).toBe(30)
  expect(b.metrics).toEqual({ m: 3 })
  // No node deeper than `b` survives.
  expect(findByLabel(model.root, 'c')).toBeUndefined()
  expect(leafSum(model.root)).toBe(35)
})

test('buildTreemapModel passes unit / valueNoun / rootLabel through', () => {
  const model = buildTreemapModel([{ path: 'a', value: 1 }], {
    rootLabel: 'my-root',
    unit: 'bytes',
    valueNoun: 'size',
  })
  expect(model.root.label).toBe('my-root')
  expect(model.unit).toBe('bytes')
  expect(model.valueNoun).toBe('size')
})

// --- fromGitDiff ------------------------------------------------------------

const NUMSTAT = `10\t2\tsrc/app.ts
3\t0\tsrc/util.ts
0\t7\tREADME.md
-\t-\tassets/logo.png
`

test('fromGitDiff parses numstat into per-file leaves with insertions/deletions metrics', () => {
  const model = fromGitDiff(NUMSTAT)
  const app = findByLabel(model.root, 'app.ts')!
  expect(app.metrics).toEqual({ insertions: 10, deletions: 2 })
  // Binary file (`-`) is skipped.
  expect(findByLabel(model.root, 'logo.png')).toBeUndefined()
  expect(model.unit).toBe('lines')
  expect(model.valueNoun).toBe('lines changed')
})

test('fromGitDiff default valueField is total (insertions + deletions)', () => {
  const model = fromGitDiff(NUMSTAT)
  expect(findByLabel(model.root, 'app.ts')!.value).toBe(12)
  expect(findByLabel(model.root, 'README.md')!.value).toBe(7)
})

test('fromGitDiff valueField:insertions sizes by insertions only', () => {
  const model = fromGitDiff(NUMSTAT, { valueField: 'insertions' })
  expect(findByLabel(model.root, 'app.ts')!.value).toBe(10)
  // README had 0 insertions -> a legitimate zero-value leaf, still present.
  const readme = findByLabel(model.root, 'README.md')!
  expect('value' in readme).toBe(true)
  expect(readme.value).toBe(0)
  expect(readme.metrics).toEqual({ insertions: 0, deletions: 7 })
})

test('fromGitDiff normalizes a `{old => new}` rename path', () => {
  const model = fromGitDiff('5\t1\tsrc/{old => new}/mod.ts\n')
  // Path becomes src/new/mod.ts.
  expect(findByLabel(model.root, 'new')).toBeDefined()
  expect(findByLabel(model.root, 'old')).toBeUndefined()
  const mod = findByLabel(model.root, 'mod.ts')!
  expect(mod.value).toBe(6)
})

test('fromGitDiff normalizes a whole-path `old => new` rename (no braces)', () => {
  const model = fromGitDiff('2\t2\tsrc/a.ts => lib/b.ts\n')
  expect(findByLabel(model.root, 'lib')).toBeDefined()
  expect(findByLabel(model.root, 'b.ts')).toBeDefined()
  expect(findByLabel(model.root, 'a.ts')).toBeUndefined()
})

// --- fromDu -----------------------------------------------------------------

// Cumulative `du -k`: root=100; a=60 (b=40 + own 20); b=40 (own 40); c=30 (own 30);
// root own = 100 - 60 - 30 = 10.
const DU = `100\t/base
60\t/base/a
40\t/base/a/b
30\t/base/c
`

test('fromDu emits an own-size `(files)` residual leaf per directory (cumulative → own-size)', () => {
  const model = fromDu(DU)
  // Single root -> tree roots at the du root's basename.
  expect(model.root.label).toBe('base')
  expect(model.unit).toBe('bytes')
  // a's own size = 60 - 40 = 20 KB -> a/(files) leaf.
  const a = findByLabel(model.root, 'a')!
  const aFiles = a.children!.find((c) => c.label === '(files)')!
  expect(aFiles.value).toBe(20 * 1024)
  // b is a leaf dir (no listed children) -> its (files) residual = full 40 KB.
  const b = findByLabel(model.root, 'b')!
  const bFiles = b.children!.find((c) => c.label === '(files)')!
  expect(bFiles.value).toBe(40 * 1024)
})

test('fromDu preserves the exact du total (Σ residual leaves === root cumulative × 1024)', () => {
  const model = fromDu(DU)
  // root cumulative = 100 KB.
  expect(leafSum(model.root)).toBe(100 * 1024)
})

test('fromDu unifies the residual math for the disk-fixture shape (bytes render GB-scale)', () => {
  // A deeper cumulative tree; own-size residuals must still sum to the root total.
  const du = `1000\t/r
600\t/r/x
200\t/r/x/y
400\t/r/z
`
  const model = fromDu(du, { rootLabel: '~/root' })
  expect(model.root.label).toBe('~/root')
  // r own = 1000 - 600 - 400 = 0 -> no root (files) leaf (residual not > 0).
  const rootFiles = (model.root.children ?? []).find((c) => c.label === '(files)')
  expect(rootFiles).toBeUndefined()
  // x own = 600 - 200 = 400; y own = 200; z own (leaf) = 400. Σ = 1000.
  expect(leafSum(model.root)).toBe(1000 * 1024)
})

// --- categorical facets (decision 0068, MED.BLK.TREE-R73) -------------------

test('buildTreemapModel stamps facets on leaves and never on containers', () => {
  const model = buildTreemapModel([
    { path: 'a/b/gen.ts', value: 10, facets: { provenance: 'generated' } },
    { path: 'a/b/src.ts', value: 20, facets: { provenance: 'authored' } },
  ])
  expect(findByLabel(model.root, 'gen.ts')!.facets).toEqual({ provenance: 'generated' })
  expect(findByLabel(model.root, 'src.ts')!.facets).toEqual({ provenance: 'authored' })
  const container = findByLabel(model.root, 'b')!
  expect(container.children).toBeDefined()
  expect(container.facets).toBeUndefined()
})

test('fromGitDiff(FileChange[]) stamps facets.provenance and keeps churn metrics', () => {
  const changes: readonly FileChange[] = [
    { path: '.github/workflows/ci.yml', insertions: 10, deletions: 2000, provenance: 'generated' },
    { path: 'src/app.ts', insertions: 40, deletions: 5, provenance: 'authored' },
  ]
  const model = fromGitDiff(changes)
  const ci = findByLabel(model.root, 'ci.yml')!
  expect(ci.facets).toEqual({ provenance: 'generated' })
  expect(ci.value).toBe(2010)
  expect(ci.metrics).toEqual({ insertions: 10, deletions: 2000 })
  expect(findByLabel(model.root, 'app.ts')!.facets).toEqual({ provenance: 'authored' })
})

test('fromGitDiff(numstat string) parses churn and leaves facets unset', () => {
  const model = fromGitDiff('10\t20\tsrc/app.ts\n5\t0\tsrc/util.ts')
  const app = findByLabel(model.root, 'app.ts')!
  expect(app.value).toBe(30)
  expect(app.metrics).toEqual({ insertions: 10, deletions: 20 })
  expect(app.facets).toBeUndefined()
})

test('fromGitDiff leaves facets unset for a FileChange without provenance', () => {
  const model = fromGitDiff([{ path: 'x/y.ts', insertions: 1, deletions: 1 }])
  expect(findByLabel(model.root, 'y.ts')!.facets).toBeUndefined()
})

test('decodeTreemapModel preserves node facets through the decode boundary', () => {
  const decoded = decodeTreemapModel({
    root: {
      id: 'r',
      label: 'r',
      children: [{ id: 'r/a', label: 'a', value: 5, facets: { provenance: 'generated' } }],
    },
  })
  expect(Result.isSuccess(decoded)).toBe(true)
  if (Result.isSuccess(decoded)) {
    expect(decoded.success.root.children?.[0]?.facets).toEqual({ provenance: 'generated' })
  }
})

// --- facets survive build-time bounding (decision 0068 R73; reviewer finding #2) --

test('buildTreemapModel depth-cap aggregate keeps a unanimous facet, drops a mixed one', () => {
  const model = buildTreemapModel(
    [
      { path: 'gen/a.yml', value: 10, facets: { provenance: 'generated' } },
      { path: 'gen/b.yml', value: 20, facets: { provenance: 'generated' } },
      { path: 'mixed/x.ts', value: 5, facets: { provenance: 'authored' } },
      { path: 'mixed/y.yml', value: 5, facets: { provenance: 'generated' } },
    ],
    { maxDepth: 1 },
  )
  // `gen` collapses to an aggregate leaf; all descendants generated → facet propagates (stays hideable).
  const gen = findByLabel(model.root, 'gen')!
  expect(gen.children).toBeUndefined()
  expect(gen.facets).toEqual({ provenance: 'generated' })
  // `mixed` collapses too, but descendants disagree → no facet (correctly not hideable).
  const mixed = findByLabel(model.root, 'mixed')!
  expect(mixed.children).toBeUndefined()
  expect(mixed.facets).toBeUndefined()
})

test('buildTreemapModel tiny-fold aggregate keeps a unanimous facet, drops a mixed one', () => {
  const allGen = buildTreemapModel(
    [
      { path: 'big.ts', value: 900, facets: { provenance: 'authored' } },
      { path: 'g1.yml', value: 1, facets: { provenance: 'generated' } },
      { path: 'g2.yml', value: 2, facets: { provenance: 'generated' } },
    ],
    { foldBelowFraction: 0.05 },
  )
  const more = findByLabel(allGen.root, '2 more')!
  expect(more.value).toBe(3)
  expect(more.facets).toEqual({ provenance: 'generated' })

  const mixed = buildTreemapModel(
    [
      { path: 'big.ts', value: 900 },
      { path: 'g1.yml', value: 1, facets: { provenance: 'generated' } },
      { path: 'a1.ts', value: 2, facets: { provenance: 'authored' } },
    ],
    { foldBelowFraction: 0.05 },
  )
  expect(findByLabel(mixed.root, '2 more')!.facets).toBeUndefined()
})
