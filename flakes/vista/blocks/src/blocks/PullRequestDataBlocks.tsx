'use client'

import * as React from 'react'

import { useDataBinding, useDataExtraction } from '../authoring.tsx'
import {
  availableValue,
  bind,
  BindingFailureDiagnostic,
  bindingFailureMessage,
  useBindingContext,
  useCapturedBindingContext,
} from '../data-query.tsx'
import { type ChecksState, gh } from '../provider-contracts.ts'
import type { PullRequestViewerProps } from './PullRequestViewer.tsx'

// The StyleX views load lazily so the Node-side semantic extractor never
// evaluates `tokens.stylex` outside the StyleX compiler (same as data-components).
const PullRequestReviewView = React.lazy(() =>
  import('./PullRequestDataViews.tsx').then((module) => ({
    default: module.PullRequestReviewView,
  })),
)
const PullRequestChecksView = React.lazy(() =>
  import('./PullRequestDataViews.tsx').then((module) => ({
    default: module.PullRequestChecksView,
  })),
)
const PullRequestStackSummaryFrame = React.lazy(() =>
  import('./PullRequestStackSummaryView.tsx').then((module) => ({
    default: module.PullRequestStackSummaryFrame,
  })),
)
const PullRequestStackSummaryRowView = React.lazy(() =>
  import('./PullRequestStackSummaryView.tsx').then((module) => ({
    default: module.PullRequestStackSummaryRowView,
  })),
)

/**
 * Identifies a pull request by repository and number (with an optional derived block id) and
 * forwards the remaining viewer props once the PR has been fetched.
 */
export interface PullRequestReviewBlockProps extends Omit<
  PullRequestViewerProps,
  'id' | 'pullRequest' | 'stack'
> {
  readonly id?: string
  readonly repo: string
  readonly pr: number
}

/** Capture and render one pull request through the unchanged static viewer. */
export const PullRequestReviewBlock = ({
  id,
  repo,
  pr,
  ...viewerOptions
}: PullRequestReviewBlockProps): React.ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        gh.ops.pullRequest,
        { repo, pr },
        {
          mode: 'frozen',
          effectfulCapture: 'acknowledged',
        },
      ),
    [pr, repo],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  if (extracting) return undefined
  const resolved = availableValue(result)
  if (resolved === undefined) {
    return result._tag === 'Failure' ? (
      <>
        <p role="alert">
          Unable to load pull request #{pr}: {bindingFailureMessage(result)}
        </p>
        <BindingFailureDiagnostic result={result} />
      </>
    ) : (
      <p role="status">Loading pull request #{pr}…</p>
    )
  }
  return (
    <React.Suspense fallback={<p role="status">Loading pull request #{pr}…</p>}>
      <PullRequestReviewView
        {...viewerOptions}
        id={id ?? `${semanticId}-pull-request`}
        pullRequest={resolved.value}
        {...(result._tag === 'Failure' ? { error: bindingFailureMessage(result) } : {})}
      />
      {result._tag === 'Failure' ? <BindingFailureDiagnostic result={result} /> : undefined}
    </React.Suspense>
  )
}

const PullRequestChecksFallback = ({
  state,
  provenance,
}: {
  readonly state: ChecksState
  readonly provenance: 'Frozen' | 'CatchingUp' | 'Live'
}): React.ReactNode => (
  <section aria-label={`Pull request #${state.pullRequest.number} checks`}>
    <header>
      <h3>
        <a href={state.pullRequest.url}>#{state.pullRequest.number}</a> {state.pullRequest.title}
      </h3>
      <span data-provenance={provenance}>{provenance}</span>
    </header>
    <p>
      Head <code>{state.pullRequest.headSha.slice(0, 12)}</code>; {Object.keys(state.checks).length}{' '}
      captured check rows.
    </p>
  </section>
)

/**
 * Identifies a pull request by repository and number, with an optional block id, for the checks
 * block that renders a snapshot first and then switches to the shared live subscription.
 */
export interface PullRequestChecksProps {
  readonly id?: string
  readonly repo: string
  readonly pr: number
}

/** Snapshot-first pull-request checks followed by the shared live subscription. */
export const PullRequestChecks = ({ id, repo, pr }: PullRequestChecksProps): React.ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        gh.ops.checksStream,
        { repo, pr },
        {
          mode: 'subscription',
          effectfulCapture: 'acknowledged',
        },
      ),
    [pr, repo],
  )
  const { extracting, result, semanticId } = useBindingContext(binding)
  const snapshot = React.useRef<ChecksState | undefined>(undefined)
  if (extracting) return undefined
  const resolved = availableValue(result)
  if (resolved === undefined) {
    return result._tag === 'Failure' ? (
      <>
        <p role="alert">Unable to load pull request checks: {bindingFailureMessage(result)}</p>
        <BindingFailureDiagnostic result={result} />
      </>
    ) : (
      <p role="status">Loading pull request checks…</p>
    )
  }
  if (snapshot.current === undefined && resolved._tag !== 'Live') snapshot.current = resolved.value
  return (
    <div id={id ?? `${semanticId}-checks`}>
      <React.Suspense
        fallback={<PullRequestChecksFallback state={resolved.value} provenance={resolved._tag} />}
      >
        <PullRequestChecksView
          state={resolved.value}
          provenance={resolved._tag}
          {...(snapshot.current === undefined ? {} : { snapshot: snapshot.current })}
          {...(result._tag === 'Failure' ? { error: bindingFailureMessage(result) } : {})}
        />
        {result._tag === 'Failure' ? <BindingFailureDiagnostic result={result} /> : undefined}
      </React.Suspense>
    </div>
  )
}

const StackCaptureRegistration = ({
  repo,
  pr,
}: {
  readonly repo: string
  readonly pr: number
}): React.ReactNode => {
  const review = React.useMemo(
    () =>
      bind(gh.ops.pullRequest, { repo, pr }, { mode: 'frozen', effectfulCapture: 'acknowledged' }),
    [pr, repo],
  )
  const liveChecks = React.useMemo(
    () =>
      bind(
        gh.ops.checksStream,
        { repo, pr },
        { mode: 'subscription', effectfulCapture: 'acknowledged' },
      ),
    [pr, repo],
  )
  useDataBinding(review)
  useDataBinding(liveChecks)
  return undefined
}

const PullRequestStackSummaryRow = ({
  repo,
  pr,
  tier,
  selected,
  orderedPrs,
  onSelect,
}: {
  readonly repo: string
  readonly pr: number
  readonly tier?: string
  readonly selected: boolean
  readonly orderedPrs: readonly number[]
  readonly onSelect: (pr: number) => void
}): React.ReactNode => {
  const binding = React.useMemo(
    () =>
      bind(
        gh.ops.checksStream,
        { repo, pr },
        { mode: 'subscription', effectfulCapture: 'acknowledged' },
      ),
    [pr, repo],
  )
  const { result } = useCapturedBindingContext(binding)
  const resolved = availableValue(result)
  if (resolved === undefined) {
    return (
      <tr>
        <td colSpan={8}>
          {result._tag === 'Failure'
            ? `Unable to load pull request #${String(pr)} summary: ${bindingFailureMessage(result)}`
            : `Loading pull request #${String(pr)} summary…`}
        </td>
      </tr>
    )
  }
  return (
    <PullRequestStackSummaryRowView
      state={resolved.value}
      selected={selected}
      orderedPrs={orderedPrs}
      onSelect={onSelect}
      {...(tier === undefined ? {} : { tier })}
    />
  )
}

/**
 * Builds the storage key for the stack's selected row, scoping it to the app segment parsed from
 * the route path (falling back to `embedded`) plus the repository.
 */
export const pullRequestStackSelectionStorageKey = (
  repo: string,
  pathname = typeof window === 'undefined' ? '' : window.location.pathname,
): string => {
  const route = /^\/r\/([^/]+)\/([^/]+)\//.exec(pathname)
  const app = route === null ? 'embedded' : `${route[1]}/${route[2]}`
  return `vista:ui:${app}:pull-request-stack:${repo}:selected`
}

/**
 * Describes the stack rows (PR numbers with optional tier labels), the current or default
 * selection, and the callback invoked when a row is chosen.
 */
export interface PullRequestStackSummaryProps {
  readonly repo: string
  readonly prs: readonly number[]
  readonly tierLabels?: Readonly<Partial<Record<number, string>>>
  readonly selected?: number
  readonly defaultSelected?: number
  readonly onSelect?: (pr: number) => void
}

/**
 * Dense snapshot-backed navigation for a pull-request stack. The summary keeps
 * every row frozen while registering the review and live-check bindings needed
 * when the app mounts one selected detail.
 */
export const PullRequestStackSummary = ({
  repo,
  prs,
  tierLabels,
  selected,
  defaultSelected,
  onSelect,
}: PullRequestStackSummaryProps): React.ReactNode => {
  const extracting = useDataExtraction()
  const prKey = prs.join(',')
  const fallback = prs.includes(defaultSelected ?? -1) ? defaultSelected : prs[0]
  const [uncontrolledSelected, setUncontrolledSelected] = React.useState(fallback)
  const storageKey = pullRequestStackSelectionStorageKey(repo)

  React.useEffect(() => {
    if (selected !== undefined || typeof window === 'undefined') return
    try {
      const stored = Number(window.localStorage.getItem(storageKey))
      if (prs.includes(stored)) setUncontrolledSelected(stored)
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
  }, [prKey, prs, selected, storageKey])

  const selectedPr = prs.includes(selected ?? uncontrolledSelected ?? -1)
    ? (selected ?? uncontrolledSelected)
    : prs[0]
  const selectPr = React.useCallback(
    (pr: number) => {
      if (!prs.includes(pr)) return
      if (selected === undefined) {
        setUncontrolledSelected(pr)
        try {
          window.localStorage.setItem(storageKey, String(pr))
        } catch {
          // Selection remains usable even when persistence is unavailable.
        }
      }
      onSelect?.(pr)
    },
    [onSelect, prs, selected, storageKey],
  )

  if (extracting) {
    return (
      <>
        {prs.map((pr) => (
          <StackCaptureRegistration key={pr} repo={repo} pr={pr} />
        ))}
      </>
    )
  }
  if (prs.length === 0) return <p role="status">No pull requests are in this stack.</p>

  return (
    <React.Suspense fallback={<p role="status">Loading pull request stack summary…</p>}>
      <PullRequestStackSummaryFrame>
        {prs.map((pr) => (
          <PullRequestStackSummaryRow
            key={pr}
            repo={repo}
            pr={pr}
            selected={pr === selectedPr}
            orderedPrs={prs}
            onSelect={selectPr}
            {...(tierLabels?.[pr] === undefined ? {} : { tier: tierLabels[pr] })}
          />
        ))}
      </PullRequestStackSummaryFrame>
    </React.Suspense>
  )
}
