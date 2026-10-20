/**
 * Pure projection from Vista's own typed pull-request model to the
 * `@pierre/diffs` `CodeView` item list (decision 0024's dependency
 * encapsulation, extended to the full-PR surface).
 *
 * The document authors a `PullRequestData`; `@pierre/diffs` is an
 * implementation detail that never leaks into the authored shape. Everything
 * here is pure and DOM-free so the projection is unit-testable and so the
 * viewer can memoize on the authored value and hand `CodeView` a referentially
 * stable item array.
 *
 * Parsing rules (verified against @pierre/diffs 1.4.1):
 *  - A `patch` is parsed with `processFile(..., { isGitDiff: true })`. The git
 *    flag is required: without it a plain `--- a/x` / `+++ b/x` header is read
 *    as the *rename* `a/x -> b/x` and the displayed name keeps the `b/` prefix.
 *  - An old/new content pair is parsed with `parseDiffFromFile`, which yields
 *    `isPartial: false` metadata — the only authoring shape where @pierre can
 *    expand unchanged context beyond the patch.
 *  - The authored `status` — not the patch framing — decides the rendered
 *    change type, because the model carries it explicitly while a bare unified
 *    patch cannot express `new`/`deleted`/`renamed` at all.
 */
import { parseDiffFromFile, processFile } from '@pierre/diffs'
import type { ChangeTypes, CodeViewDiffItem, FileDiffMetadata } from '@pierre/diffs'

import type { GitStatus, TreemapLens, TreemapModel } from '../model.ts'
import type { PullRequestData, PullRequestFile } from '../provider-contracts.ts'
export type { PullRequestCommit, PullRequestData, PullRequestFile } from '../provider-contracts.ts'
import { buildTreemapModel, type TreemapEntry } from '../treemap-model.ts'

/**
 * Exposes the non-nullable provenance union of a pull-request file so callers can annotate
 * provenance-typed values without repeating the indexed-access unwrap.
 */
export type PullRequestFileProvenance = NonNullable<PullRequestFile['provenance']>

/** One repository `.gitattributes` file, rooted at its containing directory. */
export interface GitAttributesFile {
  /** Repository-relative directory, or the empty string for the repository root. */
  readonly dir: string
  readonly text: string
}

/** Convert a `.gitattributes` glob into the path-relative matcher Git uses. */
const gitattributesPattern = (pattern: string): RegExp => {
  const rooted = pattern.startsWith('/') ? pattern.slice(1) : pattern
  const source = [...rooted].reduce((regex, character, index) => {
    if (character === '*' && rooted[index + 1] === '*') {
      const followedBySlash = rooted[index + 2] === '/'
      return `${regex}${followedBySlash ? '(?:.*/)?' : '.*'}`
    }
    if (character === '*' && rooted[index - 1] === '*') return regex
    if (character === '/' && rooted[index - 1] === '*' && rooted[index - 2] === '*') return regex
    if (character === '*') return `${regex}[^/]*`
    if (character === '?') return `${regex}[^/]`
    return `${regex}${/[\\^$.[\]{}()+|]/u.test(character) ? `\\${character}` : character}`
  }, '')
  return new RegExp(`^${source}$`, 'u')
}

const normalizeAttributesDir = (dir: string): string =>
  dir.replace(/^\.\//u, '').replace(/^\/|\/$/gu, '')

/**
 * Infer a changed file's provenance from every applicable `.gitattributes`.
 *
 * A string remains shorthand for the root file. Nested files apply only below
 * their directory. Rules in deeper files override shallower rules per
 * attribute, while the last matching rule within one file wins. A pattern
 * without `/` matches a basename at any depth below its attributes file;
 * slash patterns are relative to that file. Git-forbidden negative patterns
 * (`!path`) are ignored.
 */
export const provenanceFor = (
  path: string,
  gitattributes: string | readonly GitAttributesFile[],
): PullRequestFileProvenance | undefined => {
  const normalizedPath = path.replace(/^\.\//u, '').replace(/^\//u, '')
  const sources: readonly GitAttributesFile[] =
    typeof gitattributes === 'string' ? [{ dir: '', text: gitattributes }] : gitattributes
  let generated: { readonly value: boolean | undefined; readonly depth: number } | undefined
  let vendored: { readonly value: boolean | undefined; readonly depth: number } | undefined

  for (const source of sources) {
    const dir = normalizeAttributesDir(source.dir)
    const relativePath =
      dir === ''
        ? normalizedPath
        : normalizedPath.startsWith(`${dir}/`)
          ? normalizedPath.slice(dir.length + 1)
          : undefined
    if (relativePath === undefined || relativePath.length === 0) continue

    let generatedInFile: { readonly value: boolean | undefined } | undefined
    let vendoredInFile: { readonly value: boolean | undefined } | undefined
    for (const rawLine of source.text.split(/\r?\n/u)) {
      const line = rawLine.trim()
      if (line.length === 0 || line.startsWith('#')) continue
      const [pattern, ...attributes] = line.split(/\s+/u)
      if (pattern === undefined || pattern.startsWith('!')) continue
      const candidate = pattern.includes('/') ? relativePath : relativePath.split('/').at(-1)!
      if (!gitattributesPattern(pattern).test(candidate)) continue

      for (const attribute of attributes) {
        if (attribute === 'linguist-generated' || attribute === 'linguist-generated=true') {
          generatedInFile = { value: true }
        } else if (
          attribute === 'linguist-generated=false' ||
          attribute === '-linguist-generated'
        ) {
          generatedInFile = { value: false }
        } else if (attribute === '!linguist-generated') {
          generatedInFile = { value: undefined }
        } else if (attribute === 'linguist-vendored' || attribute === 'linguist-vendored=true') {
          vendoredInFile = { value: true }
        } else if (attribute === 'linguist-vendored=false' || attribute === '-linguist-vendored') {
          vendoredInFile = { value: false }
        } else if (attribute === '!linguist-vendored') {
          vendoredInFile = { value: undefined }
        }
      }
    }

    const depth = dir === '' ? 0 : dir.split('/').length
    if (generatedInFile !== undefined && (generated?.depth ?? -1) <= depth) {
      generated = { ...generatedInFile, depth }
    }
    if (vendoredInFile !== undefined && (vendored?.depth ?? -1) <= depth) {
      vendored = { ...vendoredInFile, depth }
    }
  }

  if (generated?.value === true) return 'generated'
  if (vendored?.value === true) return 'vendored'
  return undefined
}

/** A projected file: its nav-rail facts plus the `CodeView` item, if renderable. */
export interface PullRequestFileEntry {
  /** Stable `CodeView` item id; also the nav-rail ↔ code-pane join key. */
  readonly id: string
  readonly path: string
  readonly status: GitStatus
  readonly additions: number
  readonly deletions: number
  /** `undefined` exactly when `problem` is set. */
  readonly item: CodeViewDiffItem | undefined
  /** Why this file cannot be rendered, bounded to one reviewer-readable line. */
  readonly problem: string | undefined
}

/** The whole projection: nav-rail entries, `CodeView` items, and roll-up totals. */
export interface PullRequestProjection {
  readonly entries: readonly PullRequestFileEntry[]
  /** Renderable items, in authored order, ready for `CodeView`'s `items`. */
  readonly items: readonly CodeViewDiffItem[]
  readonly additions: number
  readonly deletions: number
  readonly problemCount: number
}

/** Vista's git status vocabulary mapped onto @pierre's change types. */
const changeTypeFor = (status: GitStatus): ChangeTypes => {
  switch (status) {
    case 'added':
    case 'untracked':
      return 'new'
    case 'deleted':
      return 'deleted'
    case 'renamed':
      return 'rename-changed'
    case 'modified':
    case 'ignored':
      return 'change'
  }
}

/** `CodeView` item id for a path. Paths are unique within a pull request. */
export const fileItemId = (viewerId: string, path: string): string => `${viewerId}::${path}`

/** GitHub's files API returns hunk-only patches, while @pierre requires file headers. */
const frameHunkOnlyPatch = (file: PullRequestFile, patch: string): string => {
  if (!patch.startsWith('@@ ')) return patch

  const oldPath =
    file.status === 'added' || file.status === 'untracked'
      ? '/dev/null'
      : `a/${file.previousPath ?? file.path}`
  const newPath = file.status === 'deleted' ? '/dev/null' : `b/${file.path}`
  return `--- ${oldPath}\n+++ ${newPath}\n${patch}`
}

/** Parse a single authored file into @pierre metadata, or explain why not. */
const parseFile = (
  file: PullRequestFile,
): { readonly metadata: FileDiffMetadata } | { readonly problem: string } => {
  const { oldContents, newContents, patch } = file
  if (oldContents !== undefined && newContents !== undefined) {
    try {
      return {
        metadata: parseDiffFromFile(
          { name: file.previousPath ?? file.path, contents: oldContents },
          { name: file.path, contents: newContents },
          undefined,
          true,
        ),
      }
    } catch (error) {
      return { problem: error instanceof Error ? error.message : String(error) }
    }
  }
  // A pure rename carries no hunks, so the forge omits the patch entirely; the
  // rename itself is still a reviewable fact and @pierre renders it from headers.
  const effectivePatch =
    (patch === undefined || patch.trim() === '') &&
    file.status === 'renamed' &&
    file.previousPath !== undefined
      ? `diff --git a/${file.previousPath} b/${file.path}\nsimilarity index 100%\nrename from ${file.previousPath}\nrename to ${file.path}\n`
      : patch
  if (effectivePatch !== undefined && effectivePatch.trim() !== '') {
    try {
      const metadata = processFile(frameHunkOnlyPatch(file, effectivePatch), {
        isGitDiff: true,
        throwOnError: true,
      })
      if (metadata === undefined) return { problem: 'patch contained no file diff' }
      // @pierre does not reject junk: text with no `@@` header parses into an
      // unnamed, hunkless diff. Only a pure rename may legitimately have no
      // hunks, so anything else hunkless is an unusable capture.
      if (metadata.hunks.length === 0 && file.status !== 'renamed') {
        return { problem: 'patch contained no diff hunks' }
      }
      return { metadata }
    } catch (error) {
      return { problem: error instanceof Error ? error.message : String(error) }
    }
  }
  return { problem: 'no patch or file contents supplied' }
}

/** Sum the `+`/`-` line counts @pierre parsed out of each hunk. */
const countLines = (metadata: FileDiffMetadata): { additions: number; deletions: number } => {
  let additions = 0
  let deletions = 0
  for (const hunk of metadata.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }
  return { additions, deletions }
}

/**
 * Project an authored pull request into nav entries and `CodeView` items.
 * Pure: same input object ⇒ same output, so the viewer can memoize on identity.
 */
export const projectPullRequest = (
  viewerId: string,
  pullRequest: PullRequestData,
): PullRequestProjection => {
  const entries: PullRequestFileEntry[] = []
  const items: CodeViewDiffItem[] = []
  let additions = 0
  let deletions = 0
  let problemCount = 0

  for (const file of pullRequest.files) {
    const id = fileItemId(viewerId, file.path)
    const parsed = parseFile(file)
    if ('problem' in parsed) {
      problemCount += 1
      const counts = { additions: file.additions ?? 0, deletions: file.deletions ?? 0 }
      additions += counts.additions
      deletions += counts.deletions
      entries.push({
        id,
        path: file.path,
        status: file.status,
        ...counts,
        item: undefined,
        problem: parsed.problem,
      })
      continue
    }
    const parsedCounts = countLines(parsed.metadata)
    const counts = {
      additions: file.additions ?? parsedCounts.additions,
      deletions: file.deletions ?? parsedCounts.deletions,
    }
    additions += counts.additions
    deletions += counts.deletions
    // The authored path/status wins over whatever the patch framing implied.
    const fileDiff: FileDiffMetadata = {
      ...parsed.metadata,
      name: file.path,
      // A rename without hunks is a pure rename; the authored status cannot tell.
      type:
        file.status === 'renamed' && parsed.metadata.hunks.length === 0
          ? 'rename-pure'
          : changeTypeFor(file.status),
      ...(file.previousPath === undefined ? {} : { prevName: file.previousPath }),
    }
    const item: CodeViewDiffItem = { id, type: 'diff', fileDiff }
    items.push(item)
    entries.push({
      id,
      path: file.path,
      status: file.status,
      ...counts,
      item,
      problem: undefined,
    })
  }

  return { entries, items, additions, deletions, problemCount }
}

// --- treemap projection ------------------------------------------------------

/** Treemap node id of a changed file (`buildTreemapModel` roots every path at `root`). */
export const treemapIdForPath = (path: string): string => `root/${path}`

/** Inverse of {@link treemapIdForPath}; `undefined` for the root or a synthetic node. */
export const pathForTreemapId = (id: string): string | undefined =>
  id.startsWith('root/') && !id.endsWith('::more') ? id.slice('root/'.length) : undefined

/**
 * Configures construction of the pull-request treemap model, including an optional map of paths
 * shared with sibling requests that becomes a `stack` facet for colouring or hiding doubly-touched
 * files.
 */
export interface PullRequestTreemapOptions {
  /**
   * Paths changed by other requests of the same stack, keyed to the request
   * numbers that also touch them. Stamps a `stack` facet so a lens can colour or
   * hide files that a sibling request rewrites.
   */
  readonly sharedWith?: ReadonlyMap<string, readonly number[]> | undefined
}

/**
 * leaf sized by churn, nested by directory, and faceted by `status`, file
 * `provenance` when known, and `stack` when reviewed inside a stack. Pure;
 * reuses the entries the diff projection already counted so both surfaces
 * agree on every number.
 */
export const pullRequestTreemapModel = (
  pullRequest: PullRequestData,
  projection: PullRequestProjection,
  opts: PullRequestTreemapOptions = {},
): TreemapModel => {
  const { sharedWith } = opts
  const filesByPath = new Map(pullRequest.files.map((file) => [file.path, file]))
  const entries: TreemapEntry[] = projection.entries.map((entry) => {
    const value = entry.additions + entry.deletions
    const shared = sharedWith?.get(entry.path)
    const provenance = filesByPath.get(entry.path)?.provenance
    return {
      path: entry.path,
      // A pure rename or an empty capture still deserves a visible tile.
      value: Math.max(value, 1),
      metrics: { additions: entry.additions, deletions: entry.deletions },
      facets: {
        status: entry.status,
        ...(provenance === undefined ? {} : { provenance }),
        ...(sharedWith === undefined
          ? {}
          : { stack: shared === undefined || shared.length === 0 ? 'only here' : 'shared' }),
      },
    }
  })
  return buildTreemapModel(entries, {
    // The request number already names the surface; the root crumb reads as the scope.
    rootLabel: 'All files',
    unit: 'lines',
    valueNoun: 'lines changed',
  })
}

/**
 * Root-group index for an exact path in a treemap model. The root child order
 * is the categorical colour order used by the treemap at root zoom.
 */
export const topLevelGroupIndex = (model: TreemapModel, path: string): number | undefined => {
  const targetId = treemapIdForPath(path)
  const children = model.root.children ?? []
  const groupIndex = children.findIndex(
    (child) => targetId === child.id || targetId.startsWith(`${child.id}/`),
  )
  if (groupIndex < 0) return undefined

  const containsTarget = (node: (typeof children)[number]): boolean =>
    node.id === targetId || (node.children?.some(containsTarget) ?? false)

  return containsTarget(children[groupIndex]!) ? groupIndex : undefined
}

/** Default lenses for a pull-request treemap: where churn sits, then where it is densest. */
export const PULL_REQUEST_TREEMAP_LENSES: readonly TreemapLens[] = [
  { id: 'churn', layout: 'treemap', maxDepth: 3, colorBy: 'group' },
  { id: 'hotspots', layout: 'treemap', maxDepth: 4, colorBy: 'value' },
  { id: 'icicle', layout: 'icicle', maxDepth: 5, colorBy: 'depth' },
]
