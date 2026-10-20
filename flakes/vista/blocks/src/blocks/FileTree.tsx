import type { GitStatusEntry } from '@pierre/trees'
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react'
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
/**
 * `file-tree` block: wraps `@pierre/trees` (decision 0024). Authored from a path
 * list with per-path `gitStatus`; supports `flattenEmptyDirectories`.
 *
 * The dependency is encapsulated: the document references tree content by Vista's
 * own `FileTreeEntry[]` shape (portable, MED.AUTH-R25). `@pierre/trees` renders into an
 * open Shadow DOM; theme is reconciled by applying the kit-derived
 * `--trees-theme-*` custom properties to the host (they inherit into the shadow
 * root) — KR07, see `pierre-theme`.
 */
import { useMemo } from 'react'

import type { FileTreeEntry } from '../model.ts'
import { useTheme } from '../theme.ts'
import { VISTA_TREE_UNSAFE_CSS, vistaTreeStyles } from './pierre-theme.ts'

/**
 * Props for the file-tree block: the entry list carrying git statuses, whether to flatten empty
 * directories, an optional caption, and style overrides excluding overflow.
 */
export interface FileTreeProps {
  readonly id: string
  readonly entries: readonly FileTreeEntry[]
  readonly flattenEmptyDirectories?: boolean | undefined
  readonly caption?: string | undefined
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden' }> | undefined
}

/** Render a `file-tree` block: a path list with git status via `@pierre/trees`. */
export const FileTree = ({
  id,
  entries,
  flattenEmptyDirectories = false,
  caption,
  style,
}: FileTreeProps) => {
  const theme = useTheme()
  const paths = useMemo(() => entries.map((e) => e.path), [entries])
  const hasEntries = entries.length > 0
  const gitStatus = useMemo<readonly GitStatusEntry[]>(
    () => entries.flatMap((e) => (e.status ? [{ path: e.path, status: e.status }] : [])),
    [entries],
  )

  const { model } = useFileTree({
    paths,
    gitStatus,
    flattenEmptyDirectories,
    unsafeCSS: VISTA_TREE_UNSAFE_CSS,
  })
  // The tree is virtualized, so the `<file-tree-container>` host needs an
  // explicit height. Directories render collapsed by default, so sizing to the
  // raw path count over-reserves (a 7-path tree under two dirs shows 3 rows) and
  // leaves a dead band. Size to the *visible collapsed* rows instead: the number
  // of distinct top-level segments. The theme styles inherit into the shadow root.
  const visibleRowCount = useMemo(() => {
    const topLevel = new Set(paths.map((p) => p.split('/')[0]))
    return Math.max(topLevel.size, 1)
  }, [paths])
  const pierreStyle = useMemo(
    () => ({
      ...vistaTreeStyles(theme),
      height: `${Math.min(visibleRowCount, 18) * 1.75 + 0.75}rem`,
    }),
    [theme, visibleRowCount],
  )

  return (
    <figure {...stylex.props(styles.root, style)} id={id} data-theme={theme}>
      <div {...stylex.props(styles.host)}>
        {hasEntries ? (
          <PierreFileTree model={model} style={pierreStyle} />
        ) : (
          <p {...stylex.props(styles.empty)}>No files.</p>
        )}
      </div>
      {caption ? <figcaption {...stylex.props(styles.caption)}>{caption}</figcaption> : null}
    </figure>
  )
}

const styles = stylex.create({
  root: {
    margin: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    overflow: 'hidden',
  },
  host: {
    paddingBlock: '0.4rem',
    paddingInline: '0.25rem',
    minHeight: '4rem',
    backgroundColor: tokens['--ds-background-200'],
    maxWidth: '100%',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  empty: {
    margin: 0,
    padding: '0.75rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.82rem',
  },
  caption: {
    display: 'block',
    paddingBlock: '0.4rem',
    paddingInline: '0.6rem',
    fontSize: '0.8rem',
    color: tokens['--ds-gray-800'],
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
})
