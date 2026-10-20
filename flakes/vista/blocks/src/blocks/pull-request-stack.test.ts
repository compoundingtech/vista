import { expect, test } from 'vitest'

import { canaryStack } from '../stories/_canary-fixtures.ts'
import { pullRequest as synthetic } from '../stories/_pull-request-fixtures.ts'
import {
  effectiveScopePath,
  orderPullRequestStack,
  pullRequestStackOverlap,
  summarizePullRequestStack,
} from './pull-request-stack.ts'
import type { PullRequestData } from './pull-request.ts'
import {
  pathForTreemapId,
  provenanceFor,
  projectPullRequest,
  pullRequestTreemapModel,
  treemapIdForPath,
  topLevelGroupIndex,
} from './pull-request.ts'

const numbers = (prs: readonly PullRequestData[]) => prs.map((pr) => pr.number)

// Fetched from effect-utils at schickling/2026-09-10-buck2-authority-transfer.
const effectUtilsGitattributes = `
package.json linguist-generated=true
**/package.json linguist-generated=true
tsconfig.json linguist-generated=true
**/tsconfig.json linguist-generated=true
.github/workflows/*.yml linguist-generated=true
*.gen.* linguist-generated=true
*.lock linguist-generated=true
**/*.lock linguist-generated=true
rust/Cargo.lock -linguist-generated
`

test('provenanceFor follows effect-utils gitattributes globs and overrides', () => {
  expect(provenanceFor('packages/@overeng/utils/package.json', effectUtilsGitattributes)).toBe(
    'generated',
  )
  expect(provenanceFor('packages/@overeng/utils/tsconfig.json', effectUtilsGitattributes)).toBe(
    'generated',
  )
  expect(provenanceFor('.github/workflows/x.yml', effectUtilsGitattributes)).toBe('generated')
  expect(provenanceFor('packages/client.gen.ts', effectUtilsGitattributes)).toBe('generated')
  expect(provenanceFor('rust/Cargo.lock', effectUtilsGitattributes)).toBeUndefined()
  expect(provenanceFor('packages/client.ts', effectUtilsGitattributes)).toBeUndefined()
})

test('provenanceFor recognizes vendored files and ignores forbidden negative patterns', () => {
  const attributes = `
vendor/** linguist-vendored=true
!src/** linguist-generated=true
`
  expect(provenanceFor('vendor/runtime/index.js', attributes)).toBe('vendored')
  expect(provenanceFor('src/index.ts', attributes)).toBeUndefined()
})

test('nested gitattributes apply only beneath their containing directory', () => {
  const attributes = [{ dir: 'sub', text: '*.lock linguist-generated=true' }]
  expect(provenanceFor('sub/a.lock', attributes)).toBe('generated')
  expect(provenanceFor('a.lock', attributes)).toBeUndefined()
})

test('deeper gitattributes override shallower rules regardless of input order', () => {
  const attributes = [
    { dir: 'sub', text: '*.lock -linguist-generated' },
    { dir: '', text: '*.lock linguist-generated=true' },
  ]
  expect(provenanceFor('sub/a.lock', attributes)).toBeUndefined()
  expect(provenanceFor('a.lock', attributes)).toBe('generated')
})

test('effectiveScopePath clears a scope with no visible descendants', () => {
  expect(effectiveScopePath('packages/@overeng', ['packages/other/a.ts'])).toBeUndefined()
  expect(effectiveScopePath('packages/@overeng', ['packages/@overeng/utils/a.ts'])).toBe(
    'packages/@overeng',
  )
})

test('a stack is ordered base→top from base↔head refs regardless of authored order', () => {
  const shuffled = [canaryStack[2]!, canaryStack[0]!, canaryStack[1]!]
  expect(numbers(orderPullRequestStack(shuffled))).toEqual([1260, 1261, 1262])
})

test('requests without refs, or with an unknown base, keep their authored order after the chain', () => {
  const orphan: PullRequestData = { ...synthetic, number: 9, baseRef: 'elsewhere', headRef: 'x' }
  const ordered = orderPullRequestStack([orphan, canaryStack[1]!, canaryStack[0]!, synthetic])
  // Two chain roots (#1260 and the orphan) plus the ref-less synthetic request.
  expect(numbers(ordered)).toEqual([9, 1260, 1261, synthetic.number])
})

test('overlap lists, per request, the other requests touching each path', () => {
  const overlap = pullRequestStackOverlap(canaryStack)
  const shared1260 = overlap.get(1260)!
  const shared1262 = overlap.get(1262)!
  // Both #1260 and #1262 rewrite the CI workflow; the entries point at each other.
  expect(shared1260.get('.github/workflows/ci.yml')).toContain(1262)
  expect(shared1262.get('.github/workflows/ci.yml')).toContain(1260)
  // A path only one request touches is absent rather than mapped to an empty list.
  for (const others of shared1260.values()) expect(others.length).toBeGreaterThan(0)
  expect(summarizePullRequestStack(canaryStack)).toMatchInlineSnapshot(`
    {
      "additions": 19186,
      "count": 3,
      "deletions": 5421,
      "files": 488,
      "sharedPaths": 114,
    }
  `)
})

test('sharedPaths counts one path shared by three requests once', () => {
  const sharedFile = synthetic.files[0]!
  const requestWith = (number: number): PullRequestData => ({
    ...synthetic,
    number,
    files: [sharedFile],
  })
  const requests = [requestWith(1), requestWith(2), requestWith(3)]
  expect(summarizePullRequestStack(requests).sharedPaths).toBe(1)
})

test('a patch-less pure rename renders as a rename, and forge churn per file wins', () => {
  const pr = canaryStack[0]!
  const { entries, additions, deletions, problemCount } = projectPullRequest('t', pr)
  const renamedPatch = entries.find((e) => e.path === 'patches/@myobie__pty@0.10.0.patch')!
  expect(problemCount).toBe(0)
  expect(renamedPatch.item?.fileDiff.type).toBe('rename-pure')
  expect(renamedPatch.item?.fileDiff.prevName).toBe(
    pr.files.find((f) => f.path === renamedPatch.path)!.previousPath,
  )
  const authored = pr.files.find((f) => f.path === renamedPatch.path)!
  expect([renamedPatch.additions, renamedPatch.deletions]).toEqual([
    authored.additions,
    authored.deletions,
  ])
  // Summing authored per-file churn reproduces the request total GitHub reports.
  expect([additions, deletions]).toEqual([pr.additions, pr.deletions])
})

test('the treemap leaf ids round-trip and carry status, provenance, and stack facets', () => {
  const pr = canaryStack[2]!
  const projection = projectPullRequest('t', pr)
  const model = pullRequestTreemapModel(pr, projection, {
    sharedWith: pullRequestStackOverlap(canaryStack).get(pr.number),
  })
  const leaves: { id: string; facets?: Readonly<Record<string, string>>; value?: number }[] = []
  const walk = (node: typeof model.root) => {
    if (node.children === undefined || node.children.length === 0) leaves.push(node)
    else for (const child of node.children) walk(child)
  }
  walk(model.root)

  expect(leaves).toHaveLength(pr.files.length)
  expect(pathForTreemapId(treemapIdForPath('a/b.ts'))).toBe('a/b.ts')
  expect(pathForTreemapId('root')).toBeUndefined()
  expect(pathForTreemapId('root/a::more')).toBeUndefined()

  const ci = leaves.find((leaf) => pathForTreemapId(leaf.id) === '.github/workflows/ci.yml')!
  expect(ci.facets).toEqual({ status: 'modified', provenance: 'generated', stack: 'shared' })
  const total = leaves.reduce((n, leaf) => n + (leaf.value ?? 0), 0)
  expect(total).toBe(pr.additions! + pr.deletions!)
})

test('top-level group indices follow root child order and reject unknown paths', () => {
  const model = {
    root: {
      id: 'root',
      label: 'root',
      children: [
        {
          id: 'root/src',
          label: 'src',
          children: [{ id: 'root/src/index.ts', label: 'index.ts', value: 4 }],
        },
        { id: 'root/README.md', label: 'README.md', value: 2 },
      ],
    },
  }

  expect(topLevelGroupIndex(model, 'src/index.ts')).toBe(0)
  expect(topLevelGroupIndex(model, 'src')).toBe(0)
  expect(topLevelGroupIndex(model, 'README.md')).toBe(1)
  expect(topLevelGroupIndex(model, 'src/missing.ts')).toBeUndefined()
  expect(topLevelGroupIndex(model, 'missing/file.ts')).toBeUndefined()
})
