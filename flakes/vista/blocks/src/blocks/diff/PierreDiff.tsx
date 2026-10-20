/**
 * The `@pierre/diffs` renderer behind the code lens (and the text lens's line mode). Lives in
 * its own module so `CodeDiff.tsx` can `React.lazy` it: importing the code lens or
 * `codeDiffModel` never pulls pierre or the pierre theme into the eager graph.
 */
import {
  Virtualizer as PierreVirtualizer,
  type FileDiffOptions,
  type SupportedLanguages,
} from '@pierre/diffs'
import { MultiFileDiff, PatchDiff, VirtualizerContext } from '@pierre/diffs/react'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

import {
  ensureVistaDiffThemes,
  VISTA_DIFF_THEMES,
  VISTA_DIFF_UNSAFE_CSS,
} from '../../blocks/pierre-theme.ts'
import type { DiffSource } from '../../model.ts'
import { useTheme } from '../../theme.ts'
import type { DiffArrangement } from './contract.ts'

/** Inline highlight granularity inside changed lines (pierre `lineDiffType`). */
export type PierreLineDiff = 'word' | 'word-alt' | 'char' | 'none'

/** Props for {@link PierreDiff}. */
export interface PierreDiffProps {
  readonly source: DiffSource
  readonly arrangement: DiffArrangement
  readonly lineDiff?: PierreLineDiff
  /** `folded` collapses unchanged lines into expandable hunk separators. */
  readonly context?: 'folded' | 'full'
  /** Override language inference from the path (e.g. `text` for prose). */
  readonly lang?: SupportedLanguages
  /** `wrap` for prose, `scroll` for code. */
  readonly overflow?: 'scroll' | 'wrap'
  readonly lineNumbers?: 'shown' | 'hidden'
  /** The lens frame already names the file; pierre's own header is redundant there. */
  readonly fileHeader?: 'shown' | 'hidden'
}

/**
 * Diffs whose sources total more than this many lines (before + after contents, or patch lines)
 * render through pierre's virtualizer inside a bounded-height scroll region; smaller diffs keep
 * rendering unbounded in the page flow.
 */
export const VIRTUALIZE_ABOVE_LINES = 400

/** Line count of a text, counting a final unterminated line. */
const countLines = (text: string): number => {
  if (text === '') return 0
  let lines = 0
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) lines++
  return text.endsWith('\n') ? lines : lines + 1
}

/**
 * `@pierre/diffs` with Vista's registered themes. File pairs go through `MultiFileDiff` so
 * pierre computes real hunks (unchanged stretches fold); patches go through `PatchDiff`.
 *
 * The arrangement is layered onto a separately memoized base: pierre keys its highlight cache
 * on the render options that affect tokens (theme, `lineDiffType`, …) and highlights both
 * layouts at once, so an arrangement flip only changes `diffStyle` and reuses the cached
 * highlighted AST instead of re-tokenizing.
 *
 * Size threshold: when the source totals more than {@link VIRTUALIZE_ABOVE_LINES} lines (the
 * sum of both files' lines, or the patch's lines), the diff renders inside a scroll region capped
 * at 70vh that is labelled and keyboard-focusable, with pierre's virtualizer mounting only the
 * lines near that region's viewport. At or below the threshold it renders every line in the
 * page flow, as before.
 */
export const PierreDiff = ({
  source,
  arrangement,
  lineDiff = 'word',
  context = 'folded',
  lang,
  overflow = 'scroll',
  lineNumbers = 'shown',
  fileHeader = 'hidden',
}: PierreDiffProps) => {
  ensureVistaDiffThemes()
  const theme = useTheme()
  const baseOptions = React.useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({
      theme: VISTA_DIFF_THEMES,
      themeType: theme,
      unsafeCSS: VISTA_DIFF_UNSAFE_CSS,
      lineDiffType: lineDiff,
      expandUnchanged: context === 'full',
      overflow,
      disableLineNumbers: lineNumbers === 'hidden',
      disableFileHeader: fileHeader === 'hidden',
    }),
    [context, fileHeader, lineDiff, lineNumbers, overflow, theme],
  )
  const options = React.useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({ ...baseOptions, diffStyle: arrangement }),
    [baseOptions, arrangement],
  )
  const files = React.useMemo(
    () =>
      source._tag === 'files'
        ? {
            oldFile: {
              name: source.path,
              contents: source.oldContents,
              ...(lang === undefined ? {} : { lang }),
            },
            newFile: {
              name: source.path,
              contents: source.newContents,
              ...(lang === undefined ? {} : { lang }),
            },
          }
        : undefined,
    [source, lang],
  )
  const virtualize =
    (source._tag === 'files'
      ? countLines(source.oldContents) + countLines(source.newContents)
      : countLines(source.patch)) > VIRTUALIZE_ABOVE_LINES
  const virtualizer = React.useMemo(
    () => (virtualize && typeof window !== 'undefined' ? new PierreVirtualizer() : undefined),
    [virtualize],
  )
  // Mirrors pierre's React `<Virtualizer>`, but on our own element so the scroller can carry the
  // region role, label and tab stop keyboard users need to scroll it.
  const scrollerRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null) virtualizer?.setup(node)
      else virtualizer?.cleanUp()
    },
    [virtualizer],
  )
  const body =
    files !== undefined ? (
      <MultiFileDiff oldFile={files.oldFile} newFile={files.newFile} options={options} />
    ) : source._tag === 'patch' && source.patch.trim() !== '' ? (
      <PatchDiff patch={source.patch} options={options} />
    ) : (
      <p {...stylex.props(styles.empty)}>No diff content.</p>
    )
  if (virtualizer === undefined) {
    return (
      <div data-theme={theme} {...stylex.props(styles.host)}>
        {body}
      </div>
    )
  }
  return (
    <VirtualizerContext.Provider value={virtualizer}>
      <div
        ref={scrollerRef}
        data-theme={theme}
        role="region"
        aria-label={source._tag === 'files' ? `${source.path} diff` : 'Patch diff'}
        tabIndex={0}
        {...stylex.props(styles.host, styles.bounded)}
      >
        <div>{body}</div>
      </div>
    </VirtualizerContext.Provider>
  )
}

const styles = stylex.create({
  host: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  bounded: {
    maxHeight: '70vh',
    overflowY: 'auto',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
    outlineOffset: 2,
  },
  empty: {
    margin: 0,
    padding: '0.75rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.82rem',
  },
})
