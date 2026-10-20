/**
 * Churn treemap of the active request: answers "where is this change heavy?"
 * and doubles as navigation. Pinning a directory tile scopes the file rail and
 * diff pane to it; pinning a file selects it; Enter / double-click on a file
 * opens it (selects and scrolls the pane). The model is derived from the same
 * projection the pane renders, so both agree on every count.
 */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import { useCallback, useState, type ReactNode } from 'react'

import type { TreemapLens } from '../../model.ts'
import { PULL_REQUEST_TREEMAP_LENSES, pathForTreemapId, treemapIdForPath } from '../pull-request.ts'
import {
  Treemap,
  type TreemapChrome,
  type TreemapDetailProps,
  type TreemapSelection,
} from '../treemap/Treemap.tsx'
import { PullRequestCommits } from './PullRequestCommits.tsx'
import { usePullRequestReview } from './review.tsx'

/**
 * Props that shape the review-embedded treemap: lens list and default, initial depth cap and
 * canvas height, chrome mode ranging from embedded to standalone, filter-panel visibility, and
 * trailing controls, caption, and style.
 */
export interface PullRequestTreemapProps {
  readonly lenses?: readonly TreemapLens[] | undefined
  readonly defaultLensId?: string | undefined
  /** Initial render-depth cap; subsequent changes stay with the review session. */
  readonly defaultMaxDepth?: number | undefined
  /** CSS height of the tile canvas, e.g. `'14rem'` for a banner placement. */
  readonly canvasHeight?: string | undefined
  /** Embedded navigator by default; `'full'` restores the standalone search/detail/legend. */
  readonly chrome?: TreemapChrome | undefined
  /** Show the shared hide/show filter panel; off by default in review chrome. */
  readonly filter?: boolean | undefined
  /** Extra controls rendered after the commit-focus dropdown. */
  readonly controls?: ReactNode | undefined
  readonly caption?: string | undefined
  readonly style?: StyleXStylesWithout<{ position: string }> | undefined
}

const FileDetail = ({ node }: TreemapDetailProps) => {
  const { projection } = usePullRequestReview()
  const path = pathForTreemapId(node.id)
  const entry = path === undefined ? undefined : projection.entries.find((e) => e.path === path)
  return (
    <div {...stylex.props(styles.detail)}>
      <div {...stylex.props(styles.detailPath)}>{path ?? node.label}</div>
      <div {...stylex.props(styles.detailMeta)}>
        {entry === undefined
          ? `${node.leafCount} files · ${node.value} lines · ${(node.pctOfTotal * 100).toFixed(1)}% of request`
          : `${entry.status} · +${entry.additions} −${entry.deletions}${entry.problem === undefined ? '' : ` · ${entry.problem}`}`}
      </div>
      {entry === undefined ? (
        <div {...stylex.props(styles.detailHint)}>
          Click, Enter, or double-click to scope the diff
        </div>
      ) : (
        <div {...stylex.props(styles.detailHint)}>
          Click, Enter, or double-click to open the diff
        </div>
      )}
    </div>
  )
}

/**
 * Renders a pull request as a pure treemap of files sized by churn and nested by directory, with
 * status/provenance/stack facets selectable through lenses and defaulting to compact review
 * chrome.
 */
export const PullRequestTreemap = ({
  lenses = PULL_REQUEST_TREEMAP_LENSES,
  defaultLensId,
  defaultMaxDepth = 4,
  canvasHeight,
  chrome = 'compact',
  filter = false,
  controls,
  caption,
  style,
}: PullRequestTreemapProps) => {
  const {
    id,
    pullRequest,
    treemapModel,
    filterRenderValue,
    scopePath,
    selectPath,
    setScopePath,
    hiddenIds,
    setHiddenIds,
    hidePaths,
    soloPaths,
  } = usePullRequestReview()
  // Review-wide working state: the keyed Treemap still resets request-local
  // zoom/selection when stack navigation swaps requests, while depth follows
  // the reviewer across that navigation.
  const [maxDepth, setMaxDepth] = useState(defaultMaxDepth)

  const chooseSelection = useCallback(
    (selection: TreemapSelection | undefined) => {
      const path = selection === undefined ? undefined : pathForTreemapId(selection.id)
      if (selection === undefined || path === undefined) {
        setScopePath(undefined)
      } else if (selection.isLeaf) {
        selectPath(path)
      } else {
        setScopePath(path)
      }
    },
    [selectPath, setScopePath],
  )
  const hideSelection = useCallback(
    (selection: TreemapSelection) => {
      const path = pathForTreemapId(selection.id)
      if (path !== undefined) hidePaths([path])
    },
    [hidePaths],
  )
  const soloSelection = useCallback(
    (selection: TreemapSelection) => {
      const path = pathForTreemapId(selection.id)
      if (path !== undefined) soloPaths([path])
    },
    [soloPaths],
  )

  return (
    <Treemap
      // Keyed per request and lens so block-local zoom/selection/lens state resets with them.
      key={`${pullRequest.number}:${defaultLensId ?? ''}`}
      id={`${id}-treemap`}
      model={treemapModel}
      rootId={scopePath === undefined ? undefined : treemapIdForPath(scopePath)}
      lenses={lenses}
      {...(defaultLensId === undefined ? {} : { defaultLensId })}
      chrome={chrome}
      maxDepth={maxDepth}
      onMaxDepthChange={setMaxDepth}
      showDepthControl
      renderDetail={FileDetail}
      onSelect={chooseSelection}
      onActivate={chooseSelection}
      excludedIds={hiddenIds}
      onExcludedIdsChange={setHiddenIds}
      filter={filter}
      filterRenderValue={filter ? filterRenderValue : undefined}
      controls={
        <>
          <PullRequestCommits />
          {controls}
        </>
      }
      onHide={hideSelection}
      onSolo={soloSelection}
      {...(canvasHeight === undefined ? {} : { canvasHeight })}
      {...(caption === undefined ? {} : { caption })}
      {...(style === undefined ? {} : { style })}
    />
  )
}

const styles = stylex.create({
  detail: { display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.5rem' },
  detailPath: {
    fontFamily: 'var(--ds-font-mono)',
    fontSize: '0.74rem',
    color: tokens['--ds-foreground'],
    overflowWrap: 'anywhere',
  },
  detailMeta: { fontSize: '0.74rem', color: tokens['--ds-gray-900'] },
  detailHint: { fontSize: '0.7rem', color: tokens['--ds-gray-700'] },
})
