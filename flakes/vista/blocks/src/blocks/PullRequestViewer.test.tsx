import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import {
  brokenPullRequest,
  emptyPullRequest,
  partiallyBrokenPullRequest,
  provenancePullRequest,
  pullRequest,
} from '../stories/_pull-request-fixtures.ts'
import { fileItemId, projectPullRequest } from './pull-request.ts'
import { PullRequestReview, usePullRequestReview } from './pull-request/review.tsx'
import { PullRequestViewer } from './PullRequestViewer.tsx'

test('a patch is projected onto the authored path, status, and +/- counts', () => {
  const { entries, items } = projectPullRequest('pr', pullRequest)

  expect(entries.map((entry) => entry.path)).toEqual(pullRequest.files.map((file) => file.path))
  expect(items.map((item) => item.id)).toEqual(
    pullRequest.files.map((file) => fileItemId('pr', file.path)),
  )

  const supervisor = entries[0]!
  expect(supervisor.item?.fileDiff.name).toBe('src/supervisor.ts')
  // 3 additions in the first hunk, 1 in the second; 2 deletions overall.
  expect([supervisor.additions, supervisor.deletions]).toEqual([4, 2])
  expect(supervisor.problem).toBeUndefined()
})

test('a patch without git framing still resolves to the authored path', () => {
  // `--- a/x` / `+++ b/x` alone is ambiguous: parsed as a plain unified diff it
  // reads as the rename `a/x -> b/x`. The projection must not show `b/src/x.ts`.
  const { entries } = projectPullRequest('pr', {
    ...pullRequest,
    files: [
      {
        path: 'src/plain.ts',
        status: 'modified',
        patch: `--- a/src/plain.ts
+++ b/src/plain.ts
@@ -1,2 +1,2 @@
 const a = 1
-const b = 2
+const b = 3
`,
      },
    ],
  })

  expect(entries[0]?.item?.fileDiff.name).toBe('src/plain.ts')
  expect(entries[0]?.item?.fileDiff.type).toBe('change')
  expect([entries[0]?.additions, entries[0]?.deletions]).toEqual([1, 1])
})

test('a GitHub hunk-only patch is framed before parsing', () => {
  const { entries } = projectPullRequest('pr', {
    ...pullRequest,
    files: [
      {
        path: 'src/github.ts',
        status: 'modified',
        patch: `@@ -1,2 +1,2 @@
 const a = 1
-const b = 2
+const b = 3
`,
      },
    ],
  })

  expect(entries[0]?.problem).toBeUndefined()
  expect(entries[0]?.item?.fileDiff.name).toBe('src/github.ts')
  expect([entries[0]?.additions, entries[0]?.deletions]).toEqual([1, 1])
})

test('the authored status decides the change type a deletion renders with', () => {
  // @pierre suppresses the additions column in split mode for `deleted`, so
  // this is the observable difference between a deletion and an edit.
  const { entries } = projectPullRequest('pr', pullRequest)
  const deleted = entries.find((entry) => entry.path === 'src/viewer/legacy.ts')
  const renamed = entries.find((entry) => entry.path === 'src/projection/tmux.ts')

  expect(deleted?.item?.fileDiff.type).toBe('deleted')
  expect(entries.find((entry) => entry.path === 'src/reap.ts')?.item?.fileDiff.type).toBe('new')
  expect(renamed?.item?.fileDiff.type).toBe('rename-changed')
  expect(renamed?.item?.fileDiff.prevName).toBe('src/projection/tmux-legacy.ts')
})

test('an old/new content pair yields whole-file (expandable) diff metadata', () => {
  const { entries } = projectPullRequest('pr', pullRequest)
  const fromContents = entries.find((entry) => entry.path === 'src/kill.ts')

  expect(fromContents?.item?.fileDiff.isPartial).toBe(false)
  expect(fromContents?.additions).toBeGreaterThan(0)
  expect(fromContents?.deletions).toBeGreaterThan(0)
})

test('an unusable file is reported instead of thrown, and never reaches the viewer', () => {
  const { entries, items, problemCount, additions } = projectPullRequest(
    'pr',
    partiallyBrokenPullRequest,
  )

  expect(problemCount).toBe(2)
  expect(items.map((item) => item.id)).toEqual([fileItemId('pr', 'src/supervisor.ts')])
  expect(entries.find((entry) => entry.path === 'assets/provider-snapshot.bin')?.problem).toBe(
    'no patch or file contents supplied',
  )
  expect(entries.find((entry) => entry.path === 'src/corrupt.ts')?.problem).toBeDefined()
  // Totals count only what the reviewer can actually see.
  expect(additions).toBe(4)
})

const ReviewStateProbe = () => {
  const { hiddenCount, scopedEntries } = usePullRequestReview()
  return (
    <output data-hidden-count={hiddenCount}>
      {scopedEntries.map((entry) => (
        <span key={entry.path} data-visible-path={entry.path} />
      ))}
    </output>
  )
}

test('generated provenance seeds the shared hidden set without hiding authored or vendored files', () => {
  const html = renderToStaticMarkup(
    <PullRequestReview id="provenance" pullRequests={[provenancePullRequest]}>
      <ReviewStateProbe />
    </PullRequestReview>,
  )
  const generated = provenancePullRequest.files.filter((file) => file.provenance === 'generated')
  const included = provenancePullRequest.files.filter((file) => file.provenance !== 'generated')

  expect(generated.length).toBeGreaterThan(0)
  expect(included.some((file) => file.provenance === 'vendored')).toBe(true)
  expect(
    included.some((file) => file.provenance === undefined || file.provenance === 'authored'),
  ).toBe(true)

  expect(html).toContain(`data-hidden-count="${generated.length}"`)
  for (const file of generated) {
    expect(html).not.toContain(`data-visible-path="${file.path}"`)
  }
  for (const file of included) {
    expect(html).toContain(`data-visible-path="${file.path}"`)
  }
})

test('the review chrome renders the pull-request identity and roll-up', () => {
  const html = renderToStaticMarkup(<PullRequestViewer id="pr" pullRequest={pullRequest} />)

  expect(html).toContain('aria-label="Pull request #482"')
  expect(html).toContain('href="https://github.com/schickling/axe/pull/482"')
  expect(html).toContain('Reap the provider process group on shutdown')
  expect(html).toContain('5 files')
  expect(html).toContain('aria-pressed="true"')
})

test('authored request totals override counts from a partial patch capture', () => {
  const html = renderToStaticMarkup(
    <PullRequestViewer id="pr" pullRequest={{ ...pullRequest, additions: 100, deletions: 40 }} />,
  )

  expect(html).toContain('+100')
  expect(html).toContain('−40')
})

test('a pull request with no changed files renders bounded empty chrome', () => {
  const html = renderToStaticMarkup(<PullRequestViewer id="pr" pullRequest={emptyPullRequest} />)

  expect(html).toContain('This pull request changes no files.')
  expect(html).not.toContain('Changed files')
})

test('a pull request with nothing renderable states so instead of an empty pane', () => {
  const html = renderToStaticMarkup(<PullRequestViewer id="pr" pullRequest={brokenPullRequest} />)

  expect(html).toContain('No file in this pull request could be rendered.')
  expect(html).toContain('Files that could not be rendered')
})
