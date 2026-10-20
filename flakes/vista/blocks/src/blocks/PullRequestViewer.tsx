/**
 * `pull-request` block: the default composition of the read-only review parts
 * (decision 0080) — header, markdown body, toolbar, unrenderable-file list, and
 * the file rail beside the multi-file `@pierre/diffs` pane; optionally a churn
 * treemap that scopes and navigates the diff.
 *
 * It is a *review* surface, not a review *client*: no comment submission, no
 * fetching, no edit mode. Authors who need another arrangement compose the same
 * parts under `PullRequestReview` directly.
 */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'

import type { DiffView, DiffWordLevel } from '../model.ts'
import { useTheme } from '../theme.ts'
import type { PullRequestData } from './pull-request.ts'
import {
  PullRequestBody,
  PullRequestHeader,
  PullRequestProblems,
  PullRequestStackNav,
} from './pull-request/parts.tsx'
import { PullRequestDiffPane, PullRequestFileRail } from './pull-request/PullRequestDiff.tsx'
import { PullRequestTreemap } from './pull-request/PullRequestTreemap.tsx'
import { PullRequestReview, usePullRequestReview } from './pull-request/review.tsx'
import { ResizableSplit } from './ResizableSplit.tsx'

export type { PullRequestData, PullRequestFile } from './pull-request.ts'

/** Where the churn treemap sits. `rail` is a secondary compact composition. */
export type PullRequestTreemapPlacement = 'none' | 'above' | 'rail'

/**
 * Configures the static viewer with the memoized full pull-request data, optional stack siblings
 * for navigation, initial layout and diff granularity, and the path selected on first render.
 */
export interface PullRequestViewerProps {
  readonly id: string
  /** The whole pull request as static data. Memoize it: the projection keys off identity. */
  readonly pullRequest: PullRequestData
  /** Further requests of the same stack; the viewer adds stack navigation. */
  readonly stack?: readonly PullRequestData[] | undefined
  /** Initial layout; the viewer also exposes a runtime split⇄unified toggle. */
  readonly view?: DiffView | undefined
  /** Inline-diff granularity passed through to `@pierre/diffs`. */
  readonly wordLevel?: DiffWordLevel | undefined
  /**
   * Path selected on first render. Defaults to the first renderable changed-file entry.
   * The selected entry scrolls into view initially; explicitly selected unknown or
   * unrenderable paths remain selected without an initial scroll.
   */
  readonly initialSelectedPath?: string | undefined
  /** Height of the resizable review viewport (treemap, file rail, and code pane). */
  readonly viewportHeight?: string | undefined
  /** Treemap placement. Defaults to the full-width banner; `rail` is a secondary compact view. */
  readonly treemap?: PullRequestTreemapPlacement | undefined
  /** Fold the description behind a disclosure (default) or show it inline. */
  readonly bodyCollapsible?: boolean | undefined
  readonly caption?: string | undefined
  readonly style?:
    | StyleXStylesWithout<{ containerType: 'inline-size'; overflow: 'hidden' }>
    | undefined
}

const Layout = ({
  viewportHeight,
  treemap,
  bodyCollapsible,
  caption,
}: {
  viewportHeight: string
  treemap: PullRequestTreemapPlacement
  bodyCollapsible: boolean
  caption: string | undefined
}) => {
  const { id, baseProjection, pullRequest } = usePullRequestReview()
  const hasFiles = baseProjection.entries.length > 0
  const hasRenderable = baseProjection.items.length > 0
  const railDiff = (
    <ResizableSplit
      id={`${id}-rail-diff`}
      direction="horizontal"
      initialSize="18rem"
      minSize="12rem"
      maxSize="40rem"
      first={
        treemap === 'rail' ? (
          <PullRequestTreemap filter style={styles.mapRail} />
        ) : (
          <PullRequestFileRail />
        )
      }
      second={<PullRequestDiffPane />}
    />
  )
  const review =
    treemap === 'above' ? (
      <ResizableSplit
        id={`${id}-treemap-review`}
        direction="vertical"
        // Keep the diff as the primary work area; the treemap remains independently resizable.
        initialSize="10rem"
        minSize="8rem"
        maxSize="60vh"
        first={
          <PullRequestTreemap filter canvasHeight="100%" chrome="compact" style={styles.mapAbove} />
        }
        second={railDiff}
      />
    ) : (
      railDiff
    )
  return (
    <section
      {...stylex.props(styles.layout)}
      aria-label={`Pull request #${pullRequest.number}`}
      role="region"
    >
      <PullRequestStackNav titles="inline" />
      <PullRequestHeader />
      <PullRequestBody collapsible={bodyCollapsible} />
      <PullRequestProblems />
      {!hasFiles ? (
        <p {...stylex.props(styles.empty)}>This pull request changes no files.</p>
      ) : !hasRenderable ? (
        <p {...stylex.props(styles.empty)}>No file in this pull request could be rendered.</p>
      ) : (
        <ResizableSplit
          id={`${id}-review-edge`}
          direction="vertical"
          initialSize={viewportHeight}
          minSize="18rem"
          maxSize="min(96rem, 160vh)"
          first={review}
        />
      )}
      {caption ? <footer {...stylex.props(styles.caption)}>{caption}</footer> : null}
    </section>
  )
}

/** Render a `pull-request` block: PR chrome, file rail, and a multi-file diff. */
export const PullRequestViewer = ({
  id,
  pullRequest,
  stack,
  view,
  wordLevel,
  initialSelectedPath,
  viewportHeight = 'max(36rem, 70vh)',
  treemap = 'above',
  bodyCollapsible = true,
  caption,
  style,
}: PullRequestViewerProps) => {
  const theme = useTheme()
  const pullRequests =
    stack === undefined || stack.length === 0
      ? [pullRequest]
      : stack.some((pr) => pr.number === pullRequest.number)
        ? stack
        : [...stack, pullRequest]
  return (
    <section {...stylex.props(styles.root, style)} id={id} data-theme={theme}>
      <PullRequestReview
        id={id}
        pullRequests={pullRequests}
        initialNumber={pullRequest.number}
        initialSelectedPath={initialSelectedPath}
        view={view}
        wordLevel={wordLevel}
      >
        <Layout
          viewportHeight={viewportHeight}
          treemap={treemap}
          bodyCollapsible={bodyCollapsible}
          caption={caption}
        />
      </PullRequestReview>
    </section>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    inlineSize: '100%',
    boxSizing: 'border-box',
    margin: 0,
    padding: '0.6rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    overflow: 'hidden',
  },
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  mapAbove: { minHeight: 0 },
  mapRail: { margin: 0, minHeight: 0, overflow: 'hidden' },
  empty: {
    margin: 0,
    padding: '0.9rem',
    fontSize: '0.82rem',
    color: tokens['--ds-gray-800'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
  },
  caption: {
    fontSize: '0.8rem',
    color: tokens['--ds-gray-800'],
  },
})
