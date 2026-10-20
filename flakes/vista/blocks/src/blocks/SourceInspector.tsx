import { CodeView } from '@pierre/diffs/react'
import type { CodeViewHandle, CodeViewReactOptions } from '@pierre/diffs/react'
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react'
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { Tab, TabList, TabPanel, Tabs } from '@vista/ui/components'
import { scale, tokens } from '@vista/ui/tokens.stylex'
/**
 * `source-inspector` block: a read-only, whole-file counterpart to the
 * pull-request review surface. File rail plus code pane plus a details aside
 * (file meta, semantic manifest, receipt projection, authoring trail), all
 * rendered from a static, serializable `AppSourceData` captured at publish
 * time — the same frozen-capture contract as `PullRequestData`.
 *
 * Dependency encapsulation matches the `diff`/`file-tree`/`pull-request`
 * blocks (decision 0024): the authored model is Vista's own, the `@pierre`
 * projection lives in `app-source.ts`, and both libraries are themed through
 * the single `pierre-theme` bridge (KR07).
 *
 * The block renders no headings and no `data-vista-*` markers, so the shell
 * outline never picks up inspector chrome. View state — selected file,
 * details tab, scroll position — is presentation state below the block. It
 * emits no SemanticNode and changes none.
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'

import { useTheme } from '../theme.ts'
import type { AppSourceData } from './app-source.ts'
import { projectAppSource } from './app-source.ts'
import {
  ensureVistaDiffThemes,
  VISTA_DIFF_THEMES,
  VISTA_DIFF_UNSAFE_CSS,
  VISTA_TREE_UNSAFE_CSS,
  vistaTreeStyles,
} from './pierre-theme.ts'

export type {
  AppSourceData,
  AppSourceFile,
  AppSourceReceipt,
  AppSourceTrailStep,
} from './app-source.ts'

/**
 * Props for the source inspector over a static capture, requiring the whole memoized source (the
 * internal projection keys off its identity), an initially selected path defaulting to the first
 * captured file, a viewport height, and styles that cannot override container-type or overflow
 * clipping.
 */
export interface SourceInspectorProps {
  readonly id: string
  /** The whole capture as static data. Memoize it: the projection keys off identity. */
  readonly source: AppSourceData
  /** Path selected on first render. Defaults to the first captured file. */
  readonly initialSelectedPath?: string | undefined
  /** Height of the scrolling inspector viewport (rail + code pane). */
  readonly viewportHeight?: string | undefined
  readonly caption?: string | undefined
  readonly style?:
    | StyleXStylesWithout<{ containerType: 'inline-size'; overflow: 'hidden' }>
    | undefined
}

type DetailTab = 'file' | 'semantics' | 'receipt' | 'trail'

const TAB_LABEL: Record<DetailTab, string> = {
  file: 'File',
  semantics: 'Semantics',
  receipt: 'Receipt',
  trail: 'Trail',
}

const SourceFileRail = ({
  paths,
  selectedPath,
  onSelectionChange,
  treeStyle,
}: {
  readonly paths: string[]
  readonly selectedPath: string | undefined
  readonly onSelectionChange: (selectedPaths: readonly string[]) => void
  readonly treeStyle: CSSProperties
}) => {
  // Tabs builds a collection from its children. Keep the imperative Pierre
  // model local to the rendered rail so a collection render cannot unmount a
  // second view that shares the same model.
  const { model } = useFileTree({
    paths,
    initialExpansion: 'open',
    search: true,
    unsafeCSS: VISTA_TREE_UNSAFE_CSS,
    ...(selectedPath === undefined ? {} : { initialSelectedPaths: [selectedPath] }),
    onSelectionChange,
  })

  return (
    <nav {...stylex.props(styles.rail)} aria-label="Captured files">
      <PierreFileTree model={model} style={treeStyle} />
    </nav>
  )
}

/** Render a `source-inspector` block: capture chrome, file rail, code pane, details. */
export const SourceInspector = ({
  id,
  source,
  initialSelectedPath,
  viewportHeight = '34rem',
  caption,
  style,
}: SourceInspectorProps) => {
  ensureVistaDiffThemes()
  const theme = useTheme()
  const codeViewRef = useRef<CodeViewHandle<undefined, undefined>>(null)

  // Referentially stable for a stable `source`: `CodeView` is controlled
  // by `items`, and a fresh array every render would re-seed the virtualizer.
  const projection = useMemo(() => projectAppSource(id, source), [id, source])
  const { entries, items, byteTotal } = projection

  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    () => initialSelectedPath ?? entries[0]?.path,
  )
  const selected = entries.find((entry) => entry.path === selectedPath)

  // The rail drives the pane: selecting a file scrolls the virtualized viewer
  // to that item. The pane never writes back (decision 0080 view state).
  const onSelectionChange = useCallback(
    (selectedPaths: readonly string[]) => {
      const path = selectedPaths[0]
      const entry = entries.find((candidate) => candidate.path === path)
      if (entry === undefined) return // a directory row, not a captured file
      setSelectedPath(entry.path)
      codeViewRef.current?.scrollTo({ type: 'item', id: entry.id, align: 'start' })
    },
    [entries],
  )

  const paths = useMemo(() => entries.map((entry) => entry.path), [entries])

  // Per-file line counts in the sticky headers, mirroring the pull-request
  // viewer's per-file +/- counts. Keyed by item id so the lookup is O(1).
  // A <CodeView> prop (not an option): the vanilla options type carries the
  // file metadata instead of the item.
  const linesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry.lines])),
    [entries],
  )
  const renderHeaderMetadata = useCallback(
    (item: { readonly id: string }) => {
      const lines = linesById.get(item.id)
      return lines === undefined ? null : `${lines} ${lines === 1 ? 'line' : 'lines'}`
    },
    [linesById],
  )
  const options = useMemo<CodeViewReactOptions<undefined, undefined>>(
    () => ({
      theme: VISTA_DIFF_THEMES,
      themeType: theme,
      unsafeCSS: VISTA_DIFF_UNSAFE_CSS,
      stickyHeaders: true,
      expandUnchanged: false,
      enableLineSelection: true,
    }),
    [theme],
  )

  const treeStyle = useMemo(() => ({ ...vistaTreeStyles(theme), height: '100%' }), [theme])

  const availableTabs = useMemo(() => {
    const tabs: DetailTab[] = ['file']
    if (source.semantics !== undefined) tabs.push('semantics')
    if (source.receipt !== undefined) tabs.push('receipt')
    if (source.trail !== undefined && source.trail.length > 0) tabs.push('trail')
    return tabs
  }, [source.semantics, source.receipt, source.trail])
  const [copied, setCopied] = useState(false)

  // Copy the frozen source-dir path: clipboard API on a user gesture, with a
  // legacy execCommand fallback. SSR-safe — no browser globals at render.
  const copySourceDir = useCallback(async () => {
    const value = source.sourceDir
    if (value === undefined) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
        await navigator.clipboard.writeText(value)
      } else if (typeof document !== 'undefined') {
        const area = document.createElement('textarea')
        area.value = value
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      } else {
        return
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }, [source.sourceDir])

  const versionLabel = typeof source.version === 'number' ? `v${source.version}` : source.version
  const hasFiles = entries.length > 0

  return (
    <section
      {...stylex.props(styles.root, style)}
      id={id}
      data-theme={theme}
      aria-label={`Source of ${source.slug} ${versionLabel}`}
    >
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.state)}>source</span>
        <span {...stylex.props(styles.title)}>
          {source.owner} / {source.slug} {versionLabel}
        </span>
        <span {...stylex.props(styles.meta)}>
          {entries.length} {entries.length === 1 ? 'file' : 'files'} · {byteTotal} bytes frozen
        </span>
      </div>
      {source.sourceDir === undefined ? null : (
        <div {...stylex.props(styles.sourceDir)}>
          <code {...stylex.props(styles.sourceDirPath)} title={source.sourceDir}>
            {source.sourceDir}
          </code>
          <button
            type="button"
            {...stylex.props(styles.copyButton)}
            onClick={() => void copySourceDir()}
            aria-live="polite"
          >
            {copied ? 'Copied' : 'Copy path'}
          </button>
        </div>
      )}

      {!hasFiles ? (
        <p {...stylex.props(styles.empty)}>This capture holds no files.</p>
      ) : (
        <Tabs defaultSelectedKey="file" variant="secondary" style={styles.tabs}>
          <div {...stylex.props(styles.toolbar)}>
            <p {...stylex.props(styles.selectedPath)} aria-live="polite">
              {selected === undefined
                ? 'No file selected'
                : `${selected.path} — ${selected.lines} ${selected.lines === 1 ? 'line' : 'lines'}`}
            </p>
            <TabList aria-label="Details" variant="secondary" style={styles.detailTabList}>
              {availableTabs.map((key) => (
                <Tab key={key} id={key} variant="secondary">
                  {TAB_LABEL[key]}
                </Tab>
              ))}
            </TabList>
          </div>

          <div {...stylex.props(styles.split, styles.splitSize(viewportHeight))}>
            <SourceFileRail
              paths={paths}
              selectedPath={selectedPath}
              onSelectionChange={onSelectionChange}
              treeStyle={treeStyle}
            />
            <CodeView<undefined, undefined>
              ref={codeViewRef}
              items={items}
              options={options}
              renderHeaderMetadata={renderHeaderMetadata}
              disableWorkerPool
              {...stylex.props(styles.pane)}
            />
          </div>

          <TabPanel id="file" variant="secondary" style={styles.detailTabPanel}>
            <aside {...stylex.props(styles.details)} aria-label="Capture details">
              <dl {...stylex.props(styles.definitionList)}>
                <dt>Path</dt>
                <dd>{selected?.path ?? '—'}</dd>
                <dt>Lines</dt>
                <dd>{selected === undefined ? '—' : String(selected.lines)}</dd>
                <dt>Bytes</dt>
                <dd>{selected === undefined ? '—' : String(selected.bytes)}</dd>
                <dt>Files in capture</dt>
                <dd>{String(entries.length)}</dd>
              </dl>
            </aside>
          </TabPanel>
          {source.semantics === undefined ? null : (
            <TabPanel id="semantics" variant="secondary" style={styles.detailTabPanel}>
              <aside {...stylex.props(styles.details)} aria-label="Capture details">
                <div {...stylex.props(styles.semantics)}>
                  <p {...stylex.props(styles.semanticsApp)}>
                    {source.semantics.app.title} · {source.semantics.app.template} ·{' '}
                    {source.semantics.app.status.locked} locked · {source.semantics.app.status.open}{' '}
                    open · {source.semantics.app.status.awaiting} awaiting
                  </p>
                  <ul {...stylex.props(styles.nodeList)}>
                    {source.semantics.nodes.map((node) => (
                      <li key={node.id}>
                        <span {...stylex.props(styles.nodeKind)}>{node.kind}</span>{' '}
                        {node.label === undefined ? null : (
                          <>
                            <span {...stylex.props(styles.nodeLabel)}>{node.label}</span>{' '}
                          </>
                        )}
                        <span {...stylex.props(styles.nodeId)}>{node.id}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </TabPanel>
          )}
          {source.receipt === undefined ? null : (
            <TabPanel id="receipt" variant="secondary" style={styles.detailTabPanel}>
              <aside {...stylex.props(styles.details)} aria-label="Capture details">
                <dl {...stylex.props(styles.definitionList)}>
                  <dt>Version</dt>
                  <dd>v{source.receipt.version}</dd>
                  <dt>Base path</dt>
                  <dd>{source.receipt.basePath}</dd>
                  <dt>Semantics sha</dt>
                  <dd {...stylex.props(styles.mono)}>
                    {source.receipt.semanticsSha256.slice(0, 16)}…
                  </dd>
                  <dt>Files</dt>
                  <dd>{String(source.receipt.fileCount)}</dd>
                  <dt>Bytes</dt>
                  <dd>{String(source.receipt.byteTotal)}</dd>
                </dl>
              </aside>
            </TabPanel>
          )}
          {source.trail === undefined || source.trail.length === 0 ? null : (
            <TabPanel id="trail" variant="secondary" style={styles.detailTabPanel}>
              <aside {...stylex.props(styles.details)} aria-label="Capture details">
                <ol {...stylex.props(styles.trailList)}>
                  {source.trail.map((step) => (
                    <li key={step.command} {...stylex.props(styles.trailStep)}>
                      <code {...stylex.props(styles.mono)}>{step.command}</code>
                      <div {...stylex.props(styles.trailDetail)}>{step.detail}</div>
                    </li>
                  ))}
                </ol>
              </aside>
            </TabPanel>
          )}
        </Tabs>
      )}

      {caption ? <footer {...stylex.props(styles.caption)}>{caption}</footer> : null}
    </section>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    margin: 0,
    padding: '0.9rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: '0.6rem',
    rowGap: '0.25rem',
  },
  state: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    paddingBlock: '0.1rem',
    paddingInline: '0.4rem',
    borderRadius: scale.radiusSm,
    color: tokens['--ds-purple-700'],
    backgroundColor: tokens['--ds-purple-200'],
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
  },
  meta: {
    fontSize: '0.78rem',
    color: tokens['--ds-gray-800'],
  },
  sourceDir: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
  },
  sourceDirPath: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: scale.fontMono,
    fontSize: '0.74rem',
    color: tokens['--ds-gray-800'],
  },
  copyButton: {
    flexShrink: 0,
    fontSize: '0.74rem',
    paddingBlock: '0.2rem',
    paddingInline: '0.6rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
  },
  tabs: {
    rowGap: '0.6rem',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
  },
  selectedPath: {
    margin: 0,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: scale.fontMono,
    fontSize: '0.76rem',
    color: tokens['--ds-gray-900'],
  },
  detailTabList: {
    flexShrink: 0,
  },
  detailTabPanel: {
    // Offset Tabs' canonical panel padding so the existing inter-region gap
    // remains 0.6rem while the panel content keeps its own padding.
    marginTop: '-1rem',
  },
  split: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(11rem, 18rem) minmax(0, 1fr)',
      '@container (max-width: 52rem)': 'minmax(0, 1fr)',
    },
    gridTemplateRows: {
      default: 'minmax(0, 1fr)',
      '@container (max-width: 52rem)': 'minmax(6rem, 12rem) minmax(0, 1fr)',
    },
    gap: '0.6rem',
    minHeight: 0,
  },
  splitSize: (blockSize: string) => ({ blockSize }),
  rail: {
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
  },
  pane: {
    minHeight: 0,
    blockSize: '100%',
    overflowY: 'auto',
    overflowX: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  details: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    paddingBlock: '0.6rem',
    paddingInline: '0.8rem',
    fontSize: '0.8rem',
    color: tokens['--ds-gray-900'],
  },
  definitionList: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gap: '0.2rem 1rem',
  },
  mono: {
    fontFamily: scale.fontMono,
    fontSize: '0.76rem',
    overflowWrap: 'anywhere',
  },
  semantics: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  semanticsApp: {
    margin: 0,
    fontSize: '0.78rem',
    color: tokens['--ds-gray-800'],
  },
  nodeList: {
    margin: 0,
    paddingInlineStart: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  nodeKind: {
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-800'],
  },
  nodeLabel: {
    color: tokens['--ds-foreground'],
  },
  nodeId: {
    fontFamily: scale.fontMono,
    fontSize: '0.72rem',
    color: tokens['--ds-gray-800'],
  },
  trailList: {
    margin: 0,
    paddingInlineStart: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  trailStep: {
    fontSize: '0.8rem',
  },
  trailDetail: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.76rem',
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
  caption: {
    fontSize: '0.8rem',
    color: tokens['--ds-gray-800'],
  },
})
