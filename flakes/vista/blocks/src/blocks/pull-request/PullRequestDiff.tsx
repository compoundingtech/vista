/**
 * The heavy halves of the review: the `@pierre/trees` file rail and the
 * `@pierre/diffs` `CodeView` pane. Both follow the shared review state — the
 * rail selects, the treemap selects or scopes, and the pane scrolls to whatever
 * was selected — through the single `pierre-theme` bridge (decision 0024).
 */
import { CodeView } from '@pierre/diffs/react'
import type { CodeViewHandle, CodeViewReactOptions } from '@pierre/diffs/react'
import type { FileTreeRowDecorationRenderer } from '@pierre/trees'
import { FileTree as PierreFileTree, useFileTree, useFileTreeSearch } from '@pierre/trees/react'
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Button } from 'react-aria-components'

import { useTheme } from '../../theme.ts'
import {
  ensureVistaDiffThemes,
  VISTA_DIFF_THEMES,
  VISTA_DIFF_UNSAFE_CSS,
  VISTA_TREE_UNSAFE_CSS,
  vistaTreeStyles,
} from '../pierre-theme.ts'
import { FilterPanel as TreemapFilterPanel } from '../treemap/FilterPanel.tsx'
import { buildIndex } from '../treemap/projection.ts'
import {
  usePullRequestReview,
  type PullRequestCommitProjection,
  type ScrollRequest,
} from './review.tsx'

/** Path-first navigation over the files in scope. */
export const PullRequestFileRail = ({
  filter = false,
  style,
}: {
  readonly filter?: boolean | undefined
  readonly style?: StyleXStylesWithout<{ display: string }> | undefined
}) => {
  const { scopePath, activeNumber } = usePullRequestReview()
  return (
    <nav {...stylex.props(styles.rail, style)} aria-label="Changed files">
      {/* `useFileTree` seeds paths and selection once, so the hook owner remounts per request/scope. */}
      <RailTree key={`${activeNumber}:${scopePath ?? ''}`} filter={filter} />
    </nav>
  )
}

const RAIL_TREE_CSS = `
  ${VISTA_TREE_UNSAFE_CSS}
  [data-item-section='decoration'] {
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }
  [data-item-section='decoration'] > span {
    white-space: nowrap;
  }
  [data-item-section='decoration'] > span > span:first-child {
    display: inline-block;
    margin-inline-end: 0.4rem;
    font-size: 0.45em;
    line-height: 1;
    vertical-align: middle;
  }
`

const DIFF_CODE_VIEW_CSS = `
  ${VISTA_DIFF_UNSAFE_CSS}
  :host {
    --diffs-font-size: 12px;
  }
  [data-additions-count],
  [data-deletions-count] {
    display: none;
  }
`

const DiffLayoutIcon = ({ split }: { readonly split: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    {split ? <path d="M8 3v10" /> : null}
  </svg>
)

const RailTree = ({ filter }: { readonly filter: boolean }) => {
  const theme = useTheme()
  const {
    scopedEntries,
    selectedPath,
    selectPath,
    scopePath,
    setScopePath,
    groupColorForPath,
    filterRenderValue,
    view,
    setView,
    treemapModel,
    hiddenIds,
    setHiddenIds,
    hiddenCount,
  } = usePullRequestReview()
  const selectedPathRef = useRef(selectedPath)
  selectedPathRef.current = selectedPath

  const railEntries = useMemo(
    () =>
      scopedEntries.map((entry) => ({
        entry,
        path: scopePath === undefined ? entry.path : entry.path.slice(`${scopePath}/`.length),
      })),
    [scopePath, scopedEntries],
  )
  const paths = useMemo(() => railEntries.map(({ path }) => path), [railEntries])
  const entryByRailPath = useMemo(
    () => new Map(railEntries.map(({ entry, path }) => [path, entry])),
    [railEntries],
  )
  const fullIndex = useMemo(() => buildIndex(treemapModel.root), [treemapModel])
  const scopeSegments = useMemo(() => scopePath?.split('/') ?? [], [scopePath])
  const selectedRailPath =
    selectedPath === undefined
      ? undefined
      : scopePath === undefined
        ? selectedPath
        : selectedPath.startsWith(`${scopePath}/`)
          ? selectedPath.slice(`${scopePath}/`.length)
          : undefined

  const churnByPath = useMemo(() => {
    const totals = new Map<string, { additions: number; deletions: number }>()
    for (const { entry, path } of railEntries) {
      totals.set(path, { additions: entry.additions, deletions: entry.deletions })
      const segments = path.split('/')
      for (let depth = 1; depth < segments.length; depth += 1) {
        const directory = segments.slice(0, depth).join('/')
        const previous = totals.get(directory)
        totals.set(directory, {
          additions: (previous?.additions ?? 0) + entry.additions,
          deletions: (previous?.deletions ?? 0) + entry.deletions,
        })
      }
    }
    return totals
  }, [railEntries])

  const churnByPathRef = useRef(churnByPath)
  churnByPathRef.current = churnByPath
  const renderRowDecoration = useCallback<FileTreeRowDecorationRenderer>(
    ({ item }) => {
      const path = item.kind === 'directory' ? item.path.replace(/\/$/, '') : item.path
      const churn = churnByPathRef.current.get(path)
      if (churn === undefined) return null
      const fullPath = scopePath === undefined ? path : `${scopePath}/${path}`
      const groupColor = groupColorForPath(fullPath)
      const parts: { text: string; color?: string }[] = []
      if (groupColor !== undefined) parts.push({ text: '●', color: groupColor })

      const muted = item.kind === 'directory'
      if (churn.additions > 0) {
        parts.push({
          text: `+${churn.additions}`,
          color: muted ? 'var(--ds-gray-800)' : 'var(--ds-green-700)',
        })
      }
      if (churn.deletions > 0) {
        parts.push({
          text: `${churn.additions > 0 ? '\u2009' : ''}−${churn.deletions}`,
          color: muted ? 'var(--ds-gray-800)' : 'var(--ds-red-700)',
        })
      }

      return {
        text: parts.map((part) => part.text).join(''),
        title: `${fullPath}: +${churn.additions} −${churn.deletions}`,
        parts,
      }
    },
    [groupColorForPath, scopePath],
  )

  const onSelectionChange = useCallback(
    (selectedPaths: readonly string[]) => {
      const railPath = selectedPaths[0]
      const path = railPath === undefined ? undefined : entryByRailPath.get(railPath)?.path
      if (path !== undefined && path !== selectedPathRef.current) selectPath(path)
    },
    [entryByRailPath, selectPath],
  )

  const { model } = useFileTree({
    paths,
    itemHeight: 28,
    initialExpansion: 'open',
    search: false,
    unsafeCSS: RAIL_TREE_CSS,
    ...(selectedRailPath === undefined ? {} : { initialSelectedPaths: [selectedRailPath] }),
    onSelectionChange,
    renderRowDecoration,
  })
  const pathsRef = useRef(paths)
  useEffect(() => {
    if (pathsRef.current === paths) return
    pathsRef.current = paths
    model.resetPaths(paths)
  }, [model, paths])

  const search = useFileTreeSearch(model)

  useEffect(() => {
    const selectedPaths = model.getSelectedPaths()
    for (const path of selectedPaths) {
      if (path !== selectedRailPath) model.getItem(path)?.deselect()
    }
    if (selectedRailPath === undefined || !paths.includes(selectedRailPath)) return
    if (!model.getSelectedPaths().includes(selectedRailPath)) {
      model.getItem(selectedRailPath)?.select()
    }
    model.scrollToPath(selectedRailPath, { focus: true, offset: 'nearest' })
  }, [model, paths, selectedRailPath])

  const treeStyle = useMemo(
    () => ({
      ...vistaTreeStyles(theme),
      height: '100%',
      '--trees-level-gap-override': '0.6rem',
      '--trees-padding-inline-override': '0.4rem',
      '--trees-item-padding-x-override': '0.4rem',
    }),
    [theme],
  )

  return (
    <PierreFileTree
      model={model}
      style={treeStyle}
      header={
        <div {...stylex.props(styles.railHeader)}>
          <div {...stylex.props(styles.railControls)}>
            <input
              type="search"
              value={search.value}
              onChange={(event) => search.setValue(event.currentTarget.value || null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (event.shiftKey) search.focusPreviousMatch()
                  else search.focusNextMatch()
                } else if (event.key === 'Escape') {
                  search.setValue(null)
                }
              }}
              placeholder="Search…"
              aria-label="Search changed files"
              {...stylex.props(styles.railSearch)}
            />
            {filter ? (
              <TreemapFilterPanel
                model={treemapModel}
                fullIndex={fullIndex}
                excludedIds={hiddenIds}
                onChange={setHiddenIds}
                formatValue={(value) => `${value.toLocaleString()} lines`}
                theme={theme}
                renderValue={filterRenderValue}
                trigger={
                  <Button
                    {...stylex.props(
                      styles.railFilterButton,
                      hiddenCount > 0 && styles.railFilterButtonActive,
                    )}
                    aria-label="Filter files"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M2.5 3h11L9.25 8v4l-2.5 1V8z" />
                    </svg>
                    {hiddenCount > 0 ? (
                      <span {...stylex.props(styles.railFilterBadge)}>{hiddenCount} hidden</span>
                    ) : null}
                  </Button>
                }
              />
            ) : null}
            <span {...stylex.props(styles.railLayoutGroup)} role="group" aria-label="Diff layout">
              <button
                type="button"
                {...stylex.props(
                  styles.railLayoutButton,
                  view === 'unified' && styles.railLayoutButtonActive,
                )}
                aria-label="Unified diff"
                aria-pressed={view === 'unified'}
                title="Unified diff"
                onClick={() => setView('unified')}
              >
                <DiffLayoutIcon split={false} />
              </button>
              <button
                type="button"
                {...stylex.props(
                  styles.railLayoutButton,
                  view === 'split' && styles.railLayoutButtonActive,
                )}
                aria-label="Split diff"
                aria-pressed={view === 'split'}
                title="Split diff"
                onClick={() => setView('split')}
              >
                <DiffLayoutIcon split />
              </button>
            </span>
          </div>
          {scopePath === undefined ? null : (
            <div
              {...stylex.props(styles.railScope)}
              aria-label={`Current file scope: ${scopePath}`}
              title={scopePath}
            >
              <button
                type="button"
                {...stylex.props(styles.scopeButton)}
                onClick={() => setScopePath(undefined)}
              >
                All files
              </button>
              <span {...stylex.props(styles.scopeSeparator)} aria-hidden="true">
                /
              </span>
              <span {...stylex.props(styles.scopeTrail)}>
                <span {...stylex.props(styles.scopeTrailInner)}>
                  {scopeSegments.map((segment, index) => {
                    const path = scopeSegments.slice(0, index + 1).join('/')
                    const current = index === scopeSegments.length - 1
                    return (
                      <span key={path} {...stylex.props(styles.scopePart)}>
                        {index > 0 ? (
                          <span {...stylex.props(styles.scopeSeparator)} aria-hidden="true">
                            /
                          </span>
                        ) : null}
                        {current ? (
                          <strong {...stylex.props(styles.scopeCurrent)}>{segment}</strong>
                        ) : (
                          <button
                            type="button"
                            {...stylex.props(styles.scopeButton)}
                            onClick={() => setScopePath(path)}
                          >
                            {segment}
                          </button>
                        )}
                      </span>
                    )
                  })}
                </span>
              </span>
            </div>
          )}
        </div>
      }
    />
  )
}

const FallbackNotice = ({ projection }: { readonly projection: PullRequestCommitProjection }) => {
  const paths = projection.scopedEntries.flatMap((entry) =>
    projection.fallbackPaths.has(entry.path) ? [entry.path] : [],
  )
  if (paths.length === 0) return null
  return (
    <p {...stylex.props(styles.fallbackNote)}>
      Using the pull-request patch for {paths.length === 1 ? paths[0] : `${paths.length} files`};
      the commit capture has no patch.
    </p>
  )
}

const CommitDiffSection = ({
  projection,
  options,
  scrollRequest,
  handlesScroll,
}: {
  readonly projection: PullRequestCommitProjection
  readonly options: CodeViewReactOptions<undefined, undefined>
  readonly scrollRequest: ScrollRequest | undefined
  readonly handlesScroll: boolean
}) => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const codeViewRef = useRef<CodeViewHandle<undefined, undefined>>(null)
  const subject = projection.commit.message.split(/\r?\n/, 1)[0] || '(no subject)'

  useEffect(() => {
    if (!handlesScroll || scrollRequest === undefined) return
    const entry = projection.scopedEntries.find(
      (candidate) => candidate.path === scrollRequest.path,
    )
    if (entry?.item === undefined) return
    sectionRef.current?.scrollIntoView({ block: 'start' })
    codeViewRef.current?.scrollTo({ type: 'item', id: entry.id, align: 'start' })
  }, [handlesScroll, projection.scopedEntries, scrollRequest])

  return (
    <section ref={sectionRef} {...stylex.props(styles.commitSection)}>
      <h3
        aria-label={`Commit ${projection.commit.sha.slice(0, 7)}: ${subject}`}
        {...stylex.props(styles.commitDivider)}
      >
        <span {...stylex.props(styles.commitSubject)}>{subject}</span>
        <code {...stylex.props(styles.commitSha)}>{projection.commit.sha.slice(0, 7)}</code>
      </h3>
      <FallbackNotice projection={projection} />
      {projection.items.length === 0 ? (
        <p {...stylex.props(styles.commitEmpty)}>No visible files from this commit.</p>
      ) : (
        <CodeView<undefined, undefined>
          ref={codeViewRef}
          items={projection.items}
          options={options}
          disableWorkerPool
          {...stylex.props(styles.codeView)}
        />
      )}
    </section>
  )
}

/** Multi-file virtualized diff of the files in scope, scrolled by selection. */
export const PullRequestDiffPane = ({
  style,
}: {
  readonly style?: StyleXStylesWithout<{ display: string }> | undefined
}) => {
  ensureVistaDiffThemes()
  const theme = useTheme()
  const {
    scopedEntries,
    commitProjections,
    scrollRequest,
    view,
    wordLevel,
    activeNumber,
    scopePath,
  } = usePullRequestReview()
  const codeViewRef = useRef<CodeViewHandle<undefined, undefined>>(null)
  const singleCommit = commitProjections?.length === 1 ? commitProjections[0] : undefined
  const activeEntries = singleCommit?.scopedEntries ?? scopedEntries

  // Referentially stable for a stable scope: `CodeView` is controlled by
  // `items`, and a fresh array every render would re-seed the virtualizer.
  const items = useMemo(
    () =>
      singleCommit?.items ??
      scopedEntries.flatMap((entry) => (entry.item === undefined ? [] : [entry.item])),
    [scopedEntries, singleCommit],
  )

  useEffect(() => {
    if (scrollRequest === undefined || (commitProjections?.length ?? 0) > 1) return
    const entry = activeEntries.find((candidate) => candidate.path === scrollRequest.path)
    if (entry?.item === undefined) return
    codeViewRef.current?.scrollTo({ type: 'item', id: entry.id, align: 'start' })
  }, [activeEntries, commitProjections, scrollRequest])

  const options = useMemo<CodeViewReactOptions<undefined, undefined>>(
    () => ({
      theme: VISTA_DIFF_THEMES,
      themeType: theme,
      diffStyle: view,
      lineDiffType: wordLevel,
      unsafeCSS: DIFF_CODE_VIEW_CSS,
      stickyHeaders: true,
      expandUnchanged: false,
      enableLineSelection: true,
    }),
    [theme, view, wordLevel],
  )

  if (commitProjections !== undefined && commitProjections.length > 1) {
    const scrollTargetSha =
      scrollRequest === undefined
        ? undefined
        : commitProjections.find((candidate) =>
            candidate.scopedEntries.some((entry) => entry.path === scrollRequest.path),
          )?.commit.sha
    return (
      <div {...stylex.props(styles.pane, style)}>
        <div {...stylex.props(styles.commitStack)}>
          {commitProjections.map((commitProjection) => (
            <CommitDiffSection
              key={commitProjection.commit.sha}
              projection={commitProjection}
              options={options}
              scrollRequest={scrollRequest}
              handlesScroll={commitProjection.commit.sha === scrollTargetSha}
            />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p {...stylex.props(styles.empty, style)}>
        {commitProjections?.length === 0
          ? 'No commits selected.'
          : activeEntries.length === 0
            ? 'No changed files in this scope.'
            : 'No file in this scope could be rendered.'}
      </p>
    )
  }

  return (
    <div {...stylex.props(styles.pane, style)}>
      {singleCommit === undefined ? null : <FallbackNotice projection={singleCommit} />}
      <CodeView<undefined, undefined>
        // The virtualizer keeps its scroll offset across item swaps; a new
        // request, scope, or commit focus must start at its first file.
        key={`${activeNumber}:${scopePath ?? ''}:${singleCommit?.commit.sha ?? 'all'}`}
        ref={codeViewRef}
        items={items}
        options={options}
        disableWorkerPool
        {...stylex.props(styles.codeView)}
      />
    </div>
  )
}

const styles = stylex.create({
  // No own border: these panes sit inside `ResizableSplit`, whose separator draws
  // the single seam line, and inside the viewer's own bordered frame. A pane border
  // here would stack a second (and across a seam, third) hairline on the same edge.
  rail: {
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-background-100'],
  },
  pane: {
    minHeight: 0,
    blockSize: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens['--ds-background-200'],
  },
  commitStack: {
    minHeight: 0,
    blockSize: '100%',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  commitSection: {
    minBlockSize: '24rem',
    blockSize: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens['--ds-background-200'],
  },
  commitDivider: {
    margin: 0,
    minBlockSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingInline: '0.65rem',
    borderBlockWidth: 1,
    borderBlockStyle: 'solid',
    borderBlockColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
  },
  commitSubject: {
    minWidth: 0,
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens['--ds-foreground'],
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  commitSha: {
    flexShrink: 0,
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    fontSize: '0.68rem',
  },
  fallbackNote: {
    margin: 0,
    paddingBlock: '0.35rem',
    paddingInline: '0.65rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-amber-900']} 6%, ${tokens['--ds-background-100']})`,
    color: tokens['--ds-amber-900'],
    fontSize: '0.7rem',
  },
  commitEmpty: {
    margin: 0,
    padding: '0.9rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.82rem',
  },
  railHeader: {
    inlineSize: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  railControls: {
    minBlockSize: '2.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    paddingBlock: '0.25rem',
    paddingInline: '0.4rem',
  },
  railScope: {
    minBlockSize: '1.6rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    paddingInline: '0.45rem',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    overflow: 'hidden',
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    fontSize: '0.66rem',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  scopeTrail: {
    minWidth: 0,
    flexGrow: 1,
    overflow: 'hidden',
    direction: 'rtl',
  },
  scopeTrailInner: {
    inlineSize: 'max-content',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    direction: 'ltr',
  },
  scopePart: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  scopeButton: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: {
      default: tokens['--ds-gray-800'],
      ':hover': tokens['--ds-foreground'],
    },
    font: 'inherit',
    cursor: 'pointer',
    outlineWidth: { default: 0, ':focus-visible': 2 },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineColor: { default: 'transparent', ':focus-visible': tokens['--ds-focus-color'] },
    outlineOffset: 1,
  },
  scopeSeparator: { color: tokens['--ds-gray-700'] },
  scopeCurrent: {
    color: tokens['--ds-foreground'],
    fontWeight: 600,
  },
  railSearch: {
    minWidth: 0,
    blockSize: '1.75rem',
    flexGrow: 1,
    boxSizing: 'border-box',
    paddingInline: '0.45rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':focus': tokens['--ds-focus-color'],
    },
    borderRadius: scale.radiusSm,
    outline: 'none',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    fontFamily: 'inherit',
    fontSize: '0.75rem',
  },
  railFilterButton: {
    minInlineSize: '1.75rem',
    blockSize: '1.75rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: '0.25rem',
    paddingInline: '0.3rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: {
      default: tokens['--ds-gray-900'],
      ':hover': tokens['--ds-foreground'],
    },
    fontFamily: 'inherit',
    cursor: 'pointer',
    outlineWidth: { default: 0, ':focus-visible': 2 },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineColor: { default: 'transparent', ':focus-visible': tokens['--ds-focus-color'] },
    outlineOffset: { default: 0, ':focus-visible': -2 },
  },
  railFilterButtonActive: {
    borderColor: tokens['--ds-blue-700'],
    backgroundColor: {
      default: `color-mix(in srgb, ${tokens['--ds-blue-700']} 12%, ${tokens['--ds-background-100']})`,
      ':hover': `color-mix(in srgb, ${tokens['--ds-blue-700']} 16%, ${tokens['--ds-background-100']})`,
    },
    color: {
      default: tokens['--ds-blue-700'],
      ':hover': tokens['--ds-blue-700'],
    },
  },
  railFilterBadge: {
    paddingBlock: '0.05rem',
    paddingInline: '0.2rem',
    borderRadius: scale.radiusSm,
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 18%, ${tokens['--ds-background-100']})`,
    color: tokens['--ds-blue-700'],
    fontSize: '0.58rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  railLayoutGroup: {
    display: 'inline-flex',
    flexShrink: 0,
    gap: 1,
    padding: 1,
    borderRadius: scale.radiusSm,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-gray-alpha-400'],
  },
  railLayoutButton: {
    inlineSize: '1.625rem',
    blockSize: '1.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderWidth: 0,
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: {
      default: tokens['--ds-gray-900'],
      ':hover': tokens['--ds-foreground'],
    },
    cursor: 'pointer',
    outlineWidth: { default: 0, ':focus-visible': 2 },
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineColor: { default: 'transparent', ':focus-visible': tokens['--ds-focus-color'] },
    outlineOffset: { default: 0, ':focus-visible': -2 },
    position: { default: 'static', ':focus-visible': 'relative' },
    zIndex: { default: 'auto', ':focus-visible': 1 },
  },
  railLayoutButtonActive: {
    backgroundColor: {
      default: `color-mix(in srgb, ${tokens['--ds-blue-900']} 10%, ${tokens['--ds-background-100']})`,
      ':hover': `color-mix(in srgb, ${tokens['--ds-blue-900']} 10%, ${tokens['--ds-background-100']})`,
    },
    color: {
      default: tokens['--ds-blue-700'],
      ':hover': tokens['--ds-blue-700'],
    },
  },
  codeView: {
    minHeight: 0,
    flexGrow: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
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
})
