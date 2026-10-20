/**
 * Shared review state for the composable `pull-request` surfaces (decision 0080).
 *
 * `PullRequestReview` owns the captured data (one request or a whole stack) and
 * the presentation state every part reads: which request of the stack is active,
 * the selected file, the directory scope, and the diff layout. Parts — header,
 * body, stack rail, treemap, file rail, diff pane — are siblings under this
 * provider, so an author can arrange them freely and they stay in sync without
 * prop threading. None of this state emits a SemanticNode.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { DiffView, DiffWordLevel, TreemapModel, TreemapNode } from '../../model.ts'
import {
  effectiveScopePath,
  orderPullRequestStack,
  pullRequestStackOverlap,
} from '../pull-request-stack.ts'
import {
  projectPullRequest,
  pullRequestTreemapModel,
  topLevelGroupIndex,
  treemapIdForPath,
  type PullRequestCommit,
  type PullRequestData,
  type PullRequestFile,
  type PullRequestFileEntry,
  type PullRequestProjection,
} from '../pull-request.ts'
import { groupColor } from '../treemap/projection.ts'
const EMPTY_COMMITS: readonly PullRequestCommit[] = []
const EMPTY_IDS: ReadonlySet<string> = new Set()
const EMPTY_SHARED_WITH: ReadonlyMap<string, readonly number[]> = new Map()

/** A request to bring one file into view in the diff pane; `nonce` distinguishes repeats. */
export interface ScrollRequest {
  readonly path: string
  readonly nonce: number
}
/**
 * Holds everything needed to display one focused commit: its unfiltered whole-commit projection,
 * the entries and items surviving scope and hidden-file filters, and the paths that had to fall
 * back to the PR-level patch because the commit capture omitted it.
 */
export interface PullRequestCommitProjection {
  readonly commit: PullRequestCommit
  /** Whole-commit projection before the shared scope and hidden-file filters. */
  readonly projection: PullRequestProjection
  readonly scopedEntries: readonly PullRequestFileEntry[]
  readonly items: readonly NonNullable<PullRequestFileEntry['item']>[]
  /** Paths rendered from the PR-level patch because the commit capture omitted its patch. */
  readonly fallbackPaths: ReadonlySet<string>
}

/**
 * The review context value: the requests ordered base to top, the current one, whole-PR and
 * commit-focused projections, the commit list, and the commit-focus selection together with its
 * setter where `undefined` means PR-level scope.
 */
export interface PullRequestReviewState {
  readonly id: string
  /** Requests ordered base→top; length 1 when reviewing a single request. */
  readonly stack: readonly PullRequestData[]
  readonly pullRequest: PullRequestData
  readonly projection: PullRequestProjection
  /** Captured whole-PR projection, unaffected by commit focus. */
  readonly baseProjection: PullRequestProjection
  readonly commits: readonly PullRequestCommit[]
  /** `undefined` is the PR-level projection; a set (including empty) is explicit commit focus. */
  readonly selectedCommitShas: ReadonlySet<string> | undefined
  readonly setSelectedCommits: (shas: ReadonlySet<string> | undefined) => void
  /** Selected commits in capture order; undefined while showing the PR-level projection. */
  readonly commitProjections: readonly PullRequestCommitProjection[] | undefined
  /** Per-path numbers of the *other* stack requests that also change the path. */
  readonly sharedWith: ReadonlyMap<string, readonly number[]>
  readonly treemapModel: TreemapModel
  /** Stroke colour of the path's root treemap group; undefined for unknown paths. */
  readonly groupColorForPath: (path: string) => string | undefined
  /** Pull-request churn cell shared by every filter-panel placement. */
  readonly filterRenderValue: (node: TreemapNode, leafCount: number) => ReactNode
  readonly activeNumber: number
  readonly setActiveNumber: (number: number) => void
  readonly selectedPath: string | undefined
  readonly selectedEntry: PullRequestFileEntry | undefined
  /** Select a file and ask the diff pane to scroll to it. */
  readonly selectPath: (path: string | undefined) => void
  /** Directory prefix (no trailing slash) the rail and pane are narrowed to. */
  readonly scopePath: string | undefined
  readonly setScopePath: (path: string | undefined) => void
  /** Entries within the current scope, in authored order. */
  readonly scopedEntries: readonly PullRequestFileEntry[]
  /** Treemap leaf ids hidden across the map, rail, and diff. */
  readonly hiddenIds: ReadonlySet<string>
  readonly setHiddenIds: (ids: ReadonlySet<string>) => void
  readonly hidePaths: (paths: readonly string[]) => void
  readonly soloPaths: (paths: readonly string[]) => void
  readonly hiddenCount: number
  readonly scrollRequest: ScrollRequest | undefined
  readonly view: DiffView
  readonly setView: (view: DiffView) => void
  readonly wordLevel: DiffWordLevel
}

const ReviewContext = createContext<PullRequestReviewState | undefined>(undefined)

/**
 * Returns the ambient review context, throwing when pull-request parts are rendered outside a
 * wrapping review provider.
 */
export const usePullRequestReview = (): PullRequestReviewState => {
  const state = useContext(ReviewContext)
  if (state === undefined) {
    throw new Error('pull-request parts must render inside <PullRequestReview>')
  }
  return state
}

const inScope = (path: string, scope: string | undefined): boolean =>
  scope === undefined || path === scope || path.startsWith(`${scope}/`)
const hasDiffSource = (file: PullRequestFile): boolean =>
  file.patch !== undefined || (file.oldContents !== undefined && file.newContents !== undefined)

const projectCommit = (
  viewerId: string,
  pullRequest: PullRequestData,
  commit: PullRequestCommit,
): {
  readonly commit: PullRequestCommit
  readonly projection: PullRequestProjection
  readonly fallbackPaths: ReadonlySet<string>
} => {
  const pullRequestFiles = new Map(pullRequest.files.map((file) => [file.path, file]))
  const fallbackPaths = new Set<string>()
  const files = commit.files.map((file) => {
    if (hasDiffSource(file)) return file
    const fallback = pullRequestFiles.get(file.path)
    if (fallback === undefined || !hasDiffSource(fallback)) return file
    fallbackPaths.add(file.path)
    return {
      ...fallback,
      ...file,
      patch: fallback.patch,
      oldContents: fallback.oldContents,
      newContents: fallback.newContents,
    }
  })
  return {
    commit,
    projection: projectPullRequest(`${viewerId}-${commit.sha}`, { ...pullRequest, files }),
    fallbackPaths,
  }
}

const combineCommitProjections = (
  pullRequestProjection: PullRequestProjection,
  commits: readonly {
    readonly projection: PullRequestProjection
  }[],
): PullRequestProjection => {
  if (commits.length === 1) return commits[0]!.projection
  const totals = new Map<
    string,
    { additions: number; deletions: number; latest: PullRequestFileEntry }
  >()
  for (const { projection } of commits) {
    for (const entry of projection.entries) {
      const previous = totals.get(entry.path)
      totals.set(entry.path, {
        additions: (previous?.additions ?? 0) + entry.additions,
        deletions: (previous?.deletions ?? 0) + entry.deletions,
        latest: entry,
      })
    }
  }
  const pullRequestByPath = new Map(
    pullRequestProjection.entries.map((entry) => [entry.path, entry]),
  )
  const orderedPaths = [
    ...pullRequestProjection.entries.flatMap((entry) =>
      totals.has(entry.path) ? [entry.path] : [],
    ),
    ...[...totals.keys()].filter((path) => !pullRequestByPath.has(path)),
  ]
  const entries = orderedPaths.map((path) => {
    const total = totals.get(path)!
    const base = pullRequestByPath.get(path) ?? total.latest
    return {
      id: base.id,
      path: base.path,
      status: base.status,
      additions: total.additions,
      deletions: total.deletions,
      item: base.item,
      problem: base.problem,
    }
  })
  return {
    entries,
    items: entries.flatMap((entry) => (entry.item === undefined ? [] : [entry.item])),
    additions: entries.reduce((total, entry) => total + entry.additions, 0),
    deletions: entries.reduce((total, entry) => total + entry.deletions, 0),
    problemCount: entries.reduce(
      (total, entry) => total + (entry.problem === undefined ? 0 : 1),
      0,
    ),
  }
}

/**
 * Configures the review provider with a stable id, one pull request or a stack in any order,
 * initial request and path selection, diff view and word-level preferences, and the children that
 * consume the context.
 */
export interface PullRequestReviewProps {
  readonly id: string
  /** One request, or several forming a stack (any order; sorted by base↔head refs). */
  readonly pullRequests: readonly PullRequestData[]
  /** Request shown first; defaults to the top of the stack. */
  readonly initialNumber?: number | undefined
  /** File selected on mount; defaults to the first renderable entry and scrolls into view. */
  readonly initialSelectedPath?: string | undefined
  readonly view?: DiffView | undefined
  readonly wordLevel?: DiffWordLevel | undefined
  readonly children: ReactNode
}

/**
 * Provider component that orders the stack, computes overlaps and per-request projections, and
 * supplies review context to nested selection, diff, and treemap parts.
 */
export const PullRequestReview = ({
  id,
  pullRequests,
  initialNumber,
  initialSelectedPath,
  view: initialView = 'split',
  wordLevel = 'word',
  children,
}: PullRequestReviewProps) => {
  const stack = useMemo(() => orderPullRequestStack(pullRequests), [pullRequests])
  const overlap = useMemo(() => pullRequestStackOverlap(stack), [stack])
  const projections = useMemo(
    () => new Map(stack.map((pr) => [pr.number, projectPullRequest(`${id}-${pr.number}`, pr)])),
    [id, stack],
  )
  const generatedHiddenIds = useMemo(
    () =>
      new Map(
        stack.map((pr) => [
          pr.number,
          new Set(
            pr.files.flatMap((file) =>
              file.provenance === 'generated' ? [treemapIdForPath(file.path)] : [],
            ),
          ),
        ]),
      ),
    [stack],
  )

  const [activeNumber, setActiveNumberState] = useState<number>(
    () => initialNumber ?? stack.at(-1)?.number ?? 0,
  )
  const [selectedCommitShas, setSelectedCommitShasState] = useState<
    ReadonlySet<string> | undefined
  >(undefined)
  const [hiddenIdsByNumber, setHiddenIdsByNumber] = useState<
    ReadonlyMap<number, ReadonlySet<string>>
  >(() => generatedHiddenIds)
  const pullRequest = stack.find((pr) => pr.number === activeNumber) ?? stack.at(-1)
  if (pullRequest === undefined) {
    throw new Error('<PullRequestReview> needs at least one pull request')
  }

  const pullRequestProjection = projections.get(pullRequest.number)!
  const commits = pullRequest.commits ?? EMPTY_COMMITS
  const selectedProjectedCommits = useMemo(
    () =>
      selectedCommitShas === undefined
        ? undefined
        : commits.flatMap((commit) =>
            selectedCommitShas.has(commit.sha)
              ? [projectCommit(`${id}-${pullRequest.number}`, pullRequest, commit)]
              : [],
          ),
    [commits, id, pullRequest, selectedCommitShas],
  )
  const projection = useMemo(
    () =>
      selectedProjectedCommits === undefined
        ? pullRequestProjection
        : combineCommitProjections(pullRequestProjection, selectedProjectedCommits),
    [pullRequestProjection, selectedProjectedCommits],
  )
  const treemapModel = useMemo(
    () =>
      pullRequestTreemapModel(pullRequest, projection, {
        sharedWith: stack.length > 1 ? overlap.get(pullRequest.number) : undefined,
      }),
    [overlap, projection, pullRequest, stack.length],
  )
  const groupColorForPath = useCallback(
    (path: string) => {
      const index = topLevelGroupIndex(treemapModel, path)
      return index === undefined ? undefined : groupColor(index).stroke
    },
    [treemapModel],
  )
  const filterChurnById = useMemo(() => {
    const totals = new Map<string, { additions: number; deletions: number }>()
    const visit = (node: TreemapNode): { additions: number; deletions: number } => {
      if (node.children === undefined || node.children.length === 0) {
        const total = {
          additions: node.metrics?.additions ?? 0,
          deletions: node.metrics?.deletions ?? 0,
        }
        totals.set(node.id, total)
        return total
      }
      let additions = 0
      let deletions = 0
      for (const child of node.children) {
        const childTotal = visit(child)
        additions += childTotal.additions
        deletions += childTotal.deletions
      }
      const total = { additions, deletions }
      totals.set(node.id, total)
      return total
    }
    visit(treemapModel.root)
    return totals
  }, [treemapModel])
  const filterRenderValue = useCallback(
    (node: TreemapNode, leafCount: number): ReactNode => {
      // A node that carries its own aggregate (e.g. a breadcrumb over the filtered
      // subtree) wins over the whole-request table used by the filter list.
      const { additions = 0, deletions = 0 } =
        node.metrics !== undefined && 'additions' in node.metrics
          ? node.metrics
          : (filterChurnById.get(node.id) ?? {})
      const hasChildren = (node.children?.length ?? 0) > 0
      return (
        <>
          {hasChildren ? (
            <span {...stylex.props(styles.filterFileCount)}>
              {leafCount.toLocaleString()} {leafCount === 1 ? 'file' : 'files'}
            </span>
          ) : null}
          <span {...stylex.props(styles.filterChurn)}>
            {additions > 0 ? (
              <span {...stylex.props(styles.filterAdditions)}>+{additions.toLocaleString()}</span>
            ) : null}
            {deletions > 0 ? (
              <span {...stylex.props(styles.filterDeletions)}>−{deletions.toLocaleString()}</span>
            ) : null}
          </span>
        </>
      )
    },
    [filterChurnById],
  )

  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    () =>
      initialSelectedPath ??
      pullRequestProjection.entries.find((entry) => entry.item !== undefined)?.path,
  )
  const [requestedScopePath, setScopePathState] = useState<string | undefined>(undefined)
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | undefined>(() =>
    selectedPath !== undefined &&
    pullRequestProjection.entries.some(
      (entry) => entry.path === selectedPath && entry.item !== undefined,
    )
      ? { path: selectedPath, nonce: 1 }
      : undefined,
  )
  const [view, setView] = useState<DiffView>(initialView)
  const hiddenIds = hiddenIdsByNumber.get(pullRequest.number) ?? EMPTY_IDS

  const setHiddenIds = useCallback(
    (ids: ReadonlySet<string>) => {
      setHiddenIdsByNumber((previous) => {
        const next = new Map(previous)
        next.set(pullRequest.number, ids)
        return next
      })
    },
    [pullRequest.number],
  )
  const hidePaths = useCallback(
    (paths: readonly string[]) => {
      const next = new Set(hiddenIds)
      for (const entry of pullRequestProjection.entries) {
        if (paths.some((path) => inScope(entry.path, path))) {
          next.add(treemapIdForPath(entry.path))
        }
      }
      setHiddenIds(next)
    },
    [hiddenIds, pullRequestProjection.entries, setHiddenIds],
  )
  const soloPaths = useCallback(
    (paths: readonly string[]) => {
      setHiddenIds(
        new Set(
          pullRequestProjection.entries.flatMap((entry) =>
            paths.some((path) => inScope(entry.path, path)) ? [] : [treemapIdForPath(entry.path)],
          ),
        ),
      )
    },
    [pullRequestProjection.entries, setHiddenIds],
  )

  const selectPath = useCallback((path: string | undefined) => {
    setSelectedPath(path)
    if (path !== undefined) {
      setScrollRequest((prev) => ({ path, nonce: (prev?.nonce ?? 0) + 1 }))
      setScopePathState((scope) => (inScope(path, scope) ? scope : undefined))
    }
  }, [])

  const setScopePath = useCallback(
    (path: string | undefined) => {
      setScopePathState(path)
      if (selectedPath === undefined || inScope(selectedPath, path)) return
      setSelectedPath(undefined)
      setScrollRequest(undefined)
    },
    [selectedPath],
  )

  const setSelectedCommits = useCallback(
    (shas: ReadonlySet<string> | undefined) => {
      setSelectedCommitShasState(shas)
      const firstPath =
        shas === undefined
          ? pullRequestProjection.entries[0]?.path
          : commits.find((commit) => shas.has(commit.sha))?.files[0]?.path
      setSelectedPath(firstPath)
      setScopePathState((scope) =>
        firstPath === undefined || inScope(firstPath, scope) ? scope : undefined,
      )
      setScrollRequest((previous) =>
        firstPath === undefined
          ? undefined
          : { path: firstPath, nonce: (previous?.nonce ?? 0) + 1 },
      )
    },
    [commits, pullRequestProjection.entries],
  )

  const setActiveNumber = useCallback(
    (number: number) => {
      if (number === activeNumber) return
      setActiveNumberState(number)
      setSelectedCommitShasState(undefined)
      setScopePathState(undefined)
      setSelectedPath(projections.get(number)?.entries[0]?.path)
      setScrollRequest(undefined)
    },
    [activeNumber, projections],
  )

  const visibleEntries = useMemo(
    () => projection.entries.filter((entry) => !hiddenIds.has(treemapIdForPath(entry.path))),
    [hiddenIds, projection],
  )
  const scopePath = useMemo(
    () =>
      effectiveScopePath(
        requestedScopePath,
        visibleEntries.map((entry) => entry.path),
      ),
    [requestedScopePath, visibleEntries],
  )
  const scopedEntries = useMemo(
    () => visibleEntries.filter((entry) => inScope(entry.path, scopePath)),
    [scopePath, visibleEntries],
  )
  const commitProjections = useMemo<readonly PullRequestCommitProjection[] | undefined>(
    () =>
      selectedProjectedCommits?.map(({ commit, projection: commitProjection, fallbackPaths }) => {
        const scopedCommitEntries = commitProjection.entries.filter(
          (entry) => inScope(entry.path, scopePath) && !hiddenIds.has(treemapIdForPath(entry.path)),
        )
        return {
          commit,
          projection: commitProjection,
          scopedEntries: scopedCommitEntries,
          items: scopedCommitEntries.flatMap((entry) =>
            entry.item === undefined ? [] : [entry.item],
          ),
          fallbackPaths,
        }
      }),
    [hiddenIds, scopePath, selectedProjectedCommits],
  )
  const selectedEntry = projection.entries.find((entry) => entry.path === selectedPath)

  const state = useMemo<PullRequestReviewState>(
    () => ({
      id,
      stack,
      pullRequest,
      baseProjection: pullRequestProjection,
      projection,
      commits,
      selectedCommitShas,
      setSelectedCommits,
      commitProjections,
      sharedWith: overlap.get(pullRequest.number) ?? EMPTY_SHARED_WITH,
      treemapModel,
      groupColorForPath,
      activeNumber: pullRequest.number,
      setActiveNumber,
      filterRenderValue,
      selectedPath,
      selectedEntry,
      selectPath,
      scopePath,
      setScopePath,
      scopedEntries,
      hiddenIds,
      setHiddenIds,
      hidePaths,
      soloPaths,
      hiddenCount: hiddenIds.size,
      scrollRequest,
      view,
      setView,
      wordLevel,
    }),
    [
      id,
      stack,
      pullRequest,
      pullRequestProjection,
      projection,
      commits,
      selectedCommitShas,
      setSelectedCommits,
      commitProjections,
      overlap,
      treemapModel,
      groupColorForPath,
      setActiveNumber,
      filterRenderValue,
      selectedPath,
      selectedEntry,
      selectPath,
      scopePath,
      setScopePath,
      scopedEntries,
      hiddenIds,
      setHiddenIds,
      hidePaths,
      soloPaths,
      scrollRequest,
      view,
      wordLevel,
    ],
  )

  return <ReviewContext.Provider value={state}>{children}</ReviewContext.Provider>
}

const styles = stylex.create({
  filterFileCount: {
    flex: '0 0 auto',
    paddingBlock: '0.05rem',
    paddingInline: '0.25rem',
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-gray-800'],
    fontSize: '0.6rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  filterChurn: {
    marginLeft: 'auto',
    display: 'inline-flex',
    gap: '0.25rem',
    flex: '0 0 auto',
    fontSize: '0.68rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  filterAdditions: { color: tokens['--ds-green-700'] },
  filterDeletions: { color: tokens['--ds-red-700'] },
})
