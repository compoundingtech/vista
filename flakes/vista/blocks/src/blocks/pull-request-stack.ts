/**
 * Pure helpers for reviewing a *stack* of pull requests — an ordered chain where
 * each request's base branch is the head branch of the one below it. The stack is
 * still captured data (decision 0080): nothing here fetches, and the order is
 * derived from the authored `baseRef`/`headRef` pairs so an author can hand the
 * blocks the requests in any order.
 */
import type { PullRequestData } from './pull-request.ts'

/**
 * Order requests base→top by following `baseRef → headRef` links. A request
 * whose base is no other request's head is a stack root; when several roots
 * exist (or refs are missing) the authored order is kept for the remainder, so
 * the function never drops a request.
 */
export const orderPullRequestStack = (
  pullRequests: readonly PullRequestData[],
): readonly PullRequestData[] => {
  const byHead = new Map<string, PullRequestData>()
  const byBase = new Map<string, PullRequestData>()
  for (const pr of pullRequests) {
    if (pr.headRef !== undefined) byHead.set(pr.headRef, pr)
    if (pr.baseRef !== undefined) byBase.set(pr.baseRef, pr)
  }

  const placed = new Set<PullRequestData>()
  const ordered: PullRequestData[] = []
  const roots = pullRequests.filter((pr) => pr.baseRef === undefined || !byHead.has(pr.baseRef))
  for (const root of roots) {
    let cursor: PullRequestData | undefined = root
    while (cursor !== undefined && !placed.has(cursor)) {
      placed.add(cursor)
      ordered.push(cursor)
      // The request stacked on top of this one bases itself on this one's head.
      const next: PullRequestData | undefined =
        cursor.headRef === undefined ? undefined : byBase.get(cursor.headRef)
      cursor = next
    }
  }
  // Cycles or duplicate heads leave requests unplaced; keep them in authored order.
  for (const pr of pullRequests) if (!placed.has(pr)) ordered.push(pr)
  return ordered
}

/** Keep a directory scope only while at least one visible path remains beneath it. */
export const effectiveScopePath = (
  scopePath: string | undefined,
  visiblePaths: readonly string[],
): string | undefined =>
  scopePath !== undefined &&
  visiblePaths.some((path) => path === scopePath || path.startsWith(`${scopePath}/`))
    ? scopePath
    : undefined

/**
 * For every changed path, the numbers of the *other* requests in the stack that
 * also change it — the files a reviewer must read across request boundaries.
 * Keyed by request number, then path; a path touched by one request only is absent.
 */
export const pullRequestStackOverlap = (
  pullRequests: readonly PullRequestData[],
): ReadonlyMap<number, ReadonlyMap<string, readonly number[]>> => {
  const touchedBy = new Map<string, number[]>()
  for (const pr of pullRequests) {
    for (const file of pr.files) {
      const list = touchedBy.get(file.path)
      if (list === undefined) touchedBy.set(file.path, [pr.number])
      else list.push(pr.number)
    }
  }
  const result = new Map<number, Map<string, readonly number[]>>()
  for (const pr of pullRequests) {
    const perPath = new Map<string, readonly number[]>()
    for (const file of pr.files) {
      const others = (touchedBy.get(file.path) ?? []).filter((n) => n !== pr.number)
      if (others.length > 0) perPath.set(file.path, others)
    }
    result.set(pr.number, perPath)
  }
  return result
}

/** Roll-up of a stack for its navigation chrome. */
export interface PullRequestStackAggregate {
  readonly count: number
  readonly files: number
  readonly additions: number
  readonly deletions: number
  /** Distinct paths changed by more than one request. */
  readonly sharedPaths: number
}

/**
 * Aggregates a stack of pull requests into totals for additions, deletions, and file count, plus a
 * per-path count of how many requests touch each distinct file path.
 */
export const summarizePullRequestStack = (
  pullRequests: readonly PullRequestData[],
): PullRequestStackAggregate => {
  const requestCountByPath = new Map<string, number>()
  let additions = 0
  let deletions = 0
  let files = 0
  for (const pr of pullRequests) {
    files += pr.files.length
    for (const path of new Set(pr.files.map((file) => file.path))) {
      requestCountByPath.set(path, (requestCountByPath.get(path) ?? 0) + 1)
    }
    additions += pr.additions ?? sum(pr.files.map((f) => f.additions ?? 0))
    deletions += pr.deletions ?? sum(pr.files.map((f) => f.deletions ?? 0))
  }
  return {
    count: pullRequests.length,
    files,
    additions,
    deletions,
    sharedPaths: [...requestCountByPath.values()].filter((count) => count > 1).length,
  }
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
