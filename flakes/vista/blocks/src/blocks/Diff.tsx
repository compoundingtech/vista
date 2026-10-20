import type { FileDiffOptions } from '@pierre/diffs'
import { PatchDiff } from '@pierre/diffs/react'
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
/**
 * `diff` block: wraps `@pierre/diffs` (decision 0024). Authored from a unified
 * patch string or an old/new file pair (framed into a patch), with a runtime
 * split⇄unified toggle, word-level granularity, and collapsible hunks.
 *
 * The dependency is fully encapsulated here: the document references diff content
 * by Vista's own `DiffSource` shape (portable, MED.AUTH-R25); @pierre is an implementation
 * detail. Theme is reconciled with the kit's `--vista-*` tokens via the
 * registered `vista-light`/`vista-dark` Shiki themes (KR07, see `pierre-theme`).
 */
import * as React from 'react'

import type { DiffSource, DiffView, DiffWordLevel } from '../model.ts'
import { useTheme } from '../theme.ts'
import { ensureVistaDiffThemes, VISTA_DIFF_THEMES, VISTA_DIFF_UNSAFE_CSS } from './pierre-theme.ts'
import { ResizableSplit } from './ResizableSplit.tsx'

/** Build a unified patch from an old/new file pair so `PatchDiff` can render it. */
const filesToPatch = ({
  path,
  oldContents,
  newContents,
}: {
  path: string
  oldContents: string
  newContents: string
}): string => {
  const oldLines = oldContents.split('\n')
  const newLines = newContents.split('\n')
  // A whole-file replacement hunk: correct unified-diff framing that @pierre
  // re-diffs at render (it does its own char/word diffing inside the hunk).
  const header = `--- a/${path}\n+++ b/${path}\n@@ -1,${oldLines.length} +1,${newLines.length} @@\n`
  const body = [...oldLines.map((l) => `-${l}`), ...newLines.map((l) => `+${l}`)].join('\n')
  return header + body + '\n'
}

/** Configures user-resizable height for a diff via initial, minimum, and maximum CSS size strings. */
export interface DiffHeightResizeConfig {
  readonly initialSize: string
  readonly minSize?: string | undefined
  readonly maxSize?: string | undefined
}

/**
 * Props for the diff block: the source content plus optional view mode, word-level granularity,
 * initial collapsed state, caption, height resizing, and style overrides excluding overflow.
 */
export interface DiffProps {
  readonly id: string
  readonly source: DiffSource
  readonly view?: DiffView | undefined
  readonly wordLevel?: DiffWordLevel | undefined
  readonly collapsed?: boolean | undefined
  readonly caption?: string | undefined
  readonly heightResize?: DiffHeightResizeConfig | undefined
  readonly style?: StyleXStylesWithout<{ overflow: 'hidden' }> | undefined
}

interface DiffRenderSignature {
  readonly source: DiffSource
  readonly view: DiffView
  readonly wordLevel: DiffWordLevel
  readonly collapsed: boolean
  readonly epoch: number
}

interface DiffExtentState {
  readonly epoch: number
  readonly logicalPx: number
  readonly usefulPx: number
}

const sameDiffSource = (left: DiffSource, right: DiffSource): boolean =>
  left._tag === right._tag &&
  (left._tag === 'patch'
    ? right._tag === 'patch' && left.patch === right.patch
    : right._tag === 'files' &&
      left.path === right.path &&
      left.oldContents === right.oldContents &&
      left.newContents === right.newContents)

const sameDiffRenderSignature = (
  signature: DiffRenderSignature,
  source: DiffSource,
  view: DiffView,
  wordLevel: DiffWordLevel,
  collapsed: boolean,
): boolean =>
  sameDiffSource(signature.source, source) &&
  signature.view === view &&
  signature.wordLevel === wordLevel &&
  signature.collapsed === collapsed

/** Add Vista-owned fixed chrome to Pierre's committed logical row extent. */
export const diffUsefulExtent = ({
  logicalPx,
  toolbarPx,
  captionPx,
  borderStartPx,
  borderEndPx,
}: {
  readonly logicalPx: number
  readonly toolbarPx: number
  readonly captionPx: number
  readonly borderStartPx: number
  readonly borderEndPx: number
}): number | undefined => {
  const values = [logicalPx, toolbarPx, captionPx, borderStartPx, borderEndPx]
  if (values.some((value) => !Number.isFinite(value) || value < 0) || logicalPx === 0) {
    return undefined
  }
  return values.reduce((sum, value) => sum + value, 0)
}

/** Render a `diff` block: a unified patch or file pair via `@pierre/diffs`. */
export const Diff = ({
  id,
  source,
  view: initialView = 'unified',
  wordLevel = 'word',
  collapsed = false,
  caption,
  heightResize,
  style,
}: DiffProps) => {
  ensureVistaDiffThemes()
  const theme = useTheme()
  const [view, setView] = React.useState<DiffView>(initialView)
  const figureRef = React.useRef<HTMLElement>(null)
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const captionRef = React.useRef<HTMLElement>(null)
  const signatureRef = React.useRef<DiffRenderSignature>({
    source,
    view,
    wordLevel,
    collapsed,
    epoch: 1,
  })
  if (!sameDiffRenderSignature(signatureRef.current, source, view, wordLevel, collapsed)) {
    signatureRef.current = {
      source,
      view,
      wordLevel,
      collapsed,
      epoch: signatureRef.current.epoch + 1,
    }
  }
  const epoch = signatureRef.current.epoch
  const [extentState, setExtentState] = React.useState<DiffExtentState | undefined>(undefined)
  const settledExtent = extentState?.epoch === epoch ? extentState : undefined

  const options = React.useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({
      theme: VISTA_DIFF_THEMES,
      themeType: theme,
      unsafeCSS: VISTA_DIFF_UNSAFE_CSS,
      diffStyle: view,
      lineDiffType: wordLevel,
      expandUnchanged: !collapsed,
      onPostRender: (node, _instance, phase) => {
        const failOpen = () =>
          setExtentState((current) => (current?.epoch === epoch ? undefined : current))
        if (phase === 'unmount') {
          failOpen()
          return
        }
        const figure = figureRef.current
        const toolbar = toolbarRef.current
        if (figure === null || toolbar === null) {
          failOpen()
          return
        }
        const figureStyle = getComputedStyle(figure)
        const logicalPx = node.scrollHeight
        const usefulPx = diffUsefulExtent({
          logicalPx,
          toolbarPx: toolbar.offsetHeight,
          captionPx: captionRef.current?.offsetHeight ?? 0,
          borderStartPx: Number.parseFloat(figureStyle.borderBlockStartWidth),
          borderEndPx: Number.parseFloat(figureStyle.borderBlockEndWidth),
        })
        if (usefulPx === undefined) {
          failOpen()
          return
        }
        setExtentState((current) =>
          current?.epoch === epoch &&
          current.logicalPx === logicalPx &&
          current.usefulPx === usefulPx
            ? current
            : { epoch, logicalPx, usefulPx },
        )
      },
    }),
    [collapsed, epoch, theme, view, wordLevel],
  )

  const patch =
    source._tag === 'patch'
      ? source.patch
      : filesToPatch({
          path: source.path,
          oldContents: source.oldContents,
          newContents: source.newContents,
        })
  const isEmpty = patch.trim().length === 0

  const figure = (
    <figure
      ref={figureRef}
      {...stylex.props(styles.root, style, heightResize !== undefined && styles.heightResizable)}
      id={id}
      data-theme={theme}
      data-vista-diff-height-resizable={heightResize === undefined ? undefined : ''}
      data-vista-diff-logical-extent={settledExtent?.logicalPx}
      data-vista-useful-extent={settledExtent?.usefulPx}
    >
      <div ref={toolbarRef} {...stylex.props(styles.toolbar)}>
        <div {...stylex.props(styles.toggle)} role="group" aria-label="Diff layout">
          <button
            type="button"
            {...stylex.props(styles.toggleButton, view === 'unified' && styles.toggleButtonActive)}
            aria-pressed={view === 'unified'}
            onClick={() => setView('unified')}
          >
            Unified
          </button>
          <button
            type="button"
            {...stylex.props(styles.toggleButton, view === 'split' && styles.toggleButtonActive)}
            aria-pressed={view === 'split'}
            onClick={() => setView('split')}
          >
            Split
          </button>
        </div>
      </div>
      <div {...stylex.props(styles.host)}>
        {isEmpty ? (
          <p {...stylex.props(styles.empty)}>No diff content.</p>
        ) : (
          <PatchDiff patch={patch} options={options} />
        )}
      </div>
      {caption ? (
        <figcaption ref={captionRef} {...stylex.props(styles.caption)}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )

  if (heightResize === undefined) return figure

  return (
    <ResizableSplit
      id={`${id}-height-resize`}
      direction="vertical"
      initialSize={heightResize.initialSize}
      minSize={heightResize.minSize}
      maxSize={heightResize.maxSize}
      contentSemantics="finite-scroll"
      usefulExtentReadiness={
        settledExtent === undefined
          ? { _tag: 'pending', epoch }
          : { _tag: 'settled', epoch: settledExtent.epoch }
      }
      usefulExtentSample={
        settledExtent === undefined
          ? undefined
          : { epoch: settledExtent.epoch, px: settledExtent.usefulPx }
      }
      first={figure}
    />
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
  heightResizable: {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingBlock: '0.4rem',
    paddingInline: '0.5rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  toggle: {
    display: 'inline-flex',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-background-200'],
  },
  toggleButton: {
    fontSize: '0.78rem',
    paddingBlock: '0.2rem',
    paddingInline: '0.6rem',
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
    transitionProperty: 'background-color, color',
    transitionDuration: '0.12s',
    transitionTimingFunction: 'ease',
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
    outlineStyle: {
      default: 'none',
      ':focus-visible': 'solid',
    },
    outlineColor: {
      default: 'transparent',
      ':focus-visible': tokens['--ds-focus-color'],
    },
    outlineOffset: {
      default: 0,
      ':focus-visible': -2,
    },
    position: {
      default: 'static',
      ':focus-visible': 'relative',
    },
    zIndex: {
      default: 'auto',
      ':focus-visible': 1,
    },
  },
  toggleButtonActive: {
    backgroundColor: {
      default: `color-mix(in srgb, ${tokens['--ds-blue-900']} 4%, ${tokens['--ds-background-100']})`,
      ':hover': `color-mix(in srgb, ${tokens['--ds-blue-900']} 4%, ${tokens['--ds-background-100']})`,
    },
    color: {
      default: tokens['--ds-blue-700'],
      ':hover': tokens['--ds-blue-700'],
    },
  },
  host: {
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
