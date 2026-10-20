/** Interactive value-proportioned hierarchy over a directly supplied typed model. */
import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'

import type {
  TreemapColorBy,
  TreemapLayout,
  TreemapLens,
  TreemapModel,
  TreemapNode,
} from '../../model.ts'
import { useTheme } from '../../theme.ts'
import { FilterPanel } from './FilterPanel.tsx'
import { ChevronDown, ChevronRight, TileMaximize } from './icons.tsx'
import {
  buildIndex,
  DEPTH_RAMP,
  expandToLeafIds,
  TREEMAP_HEADER_HEIGHT,
  groupColor,
  project,
  pruneModel,
  resolveHiddenFacetLeafIds,
  searchMatches,
  tileColor,
  truncate,
  VALUE_RAMP,
  type DerivedNode,
} from './projection.ts'
import { TooltipOverlay } from './TooltipOverlay.tsx'

/**
 * TEMPORARY depth-indicator variant switch (decision 0055 exploration). Selects how a
 * tile signals "can drill deeper" vs "leaf" — the ambiguous case being a *capped* tile
 * (children exist but aren't drawn: below the depth cap, or folded into "+N more") which
 * otherwise looks identical to a leaf. `'off'` = current behaviour. The variants are kept
 * side-by-side (see the `DepthIndicatorExploration` story) so a human can compare and pick
 * a winner; the consolidation to one treatment happens AFTER that pick.
 */
export type DepthIndicatorVariant = 'off' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5'

/** Drillability class of a rendered tile. `capped` = the look-like-a-leaf ambiguous case. */
type DepthClass = 'leaf' | 'open' | 'capped'
const depthClass = (d: DerivedNode): DepthClass =>
  d.kind === 'leaf' ? 'leaf' : d.kind === 'summarized' || d.kind === 'aggregate' ? 'capped' : 'open'

/** Below these tile dimensions the corner glyphs/badges are dropped for a bare dot. */
const DEPTH_TINY_W = 26
const DEPTH_TINY_H = 16

const styles = stylex.create({
  figure: { margin: 0 },
  // `canvasHeight="100%"`: the whole figure→root→stage→canvas chain stretches to
  // the parent box (a resizable pane) instead of the canvas carrying a fixed height.
  // Grid rather than nested flex: `minmax(0, 1fr)` tracks stretch children to the
  // pane identically across engines, where flex `auto` bases + min-size chains do not.
  figureFill: {
    blockSize: '100%',
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr)',
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
  // Root stays a column; the stage takes the slack with a 0% basis (never `auto`).
  rootFill: { minHeight: 0, minWidth: 0, gap: 0 },
  stageFill: {
    flex: '1 1 0%',
    flexBasis: '0%',
    minHeight: 0,
    minWidth: 0,
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    containerType: 'inline-size',
  },
  caption: { marginTop: '0.5rem', fontSize: '0.82rem', color: tokens['--ds-gray-800'] },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' },
  // Compact chrome: breadcrumb takes the slack, the control groups never wrap.
  controlsCompact: { flexWrap: 'nowrap', gap: '0.4rem' },
  crumbsCompact: {
    flex: '1 1 auto',
    flexWrap: 'nowrap',
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  rootCompact: { gap: '0.4rem' },
  search: { position: 'relative', flex: '1 1 15rem', minWidth: '12rem' },
  searchInput: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':focus-visible': tokens['--ds-blue-700'],
    },
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    borderRadius: scale.radiusSm,
    paddingBlock: '0.35rem',
    paddingInline: '0.6rem',
    font: 'inherit',
    fontSize: '0.78rem',
    outline: { default: 'none', ':focus-visible': `2px solid var(--ds-focus-color)` },
    outlineOffset: { default: 0, ':focus-visible': 1 },
  },
  searchCount: {
    position: 'absolute',
    right: '0.5rem',
    top: '0.45rem',
    fontSize: '0.66rem',
    color: tokens['--ds-gray-800'],
    pointerEvents: 'none',
  },
  menu: {
    position: 'absolute',
    zIndex: 20,
    top: '2.1rem',
    left: 0,
    right: 0,
    maxHeight: '16rem',
    overflowY: 'auto',
    margin: 0,
    padding: '0.25rem',
    listStyle: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
  },
  menuButton: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    width: '100%',
    borderWidth: 0,
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    color: tokens['--ds-foreground'],
    font: 'inherit',
    fontSize: '0.78rem',
    textAlign: 'left',
    paddingBlock: '0.3rem',
    paddingInline: '0.45rem',
    borderRadius: scale.radiusSm,
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid var(--ds-focus-color)` },
    outlineOffset: { default: 0, ':focus-visible': -1 },
  },
  menuLabel: { fontFamily: scale.fontMono, fontWeight: 600, whiteSpace: 'nowrap' },
  menuPath: {
    flex: 1,
    color: tokens['--ds-gray-800'],
    fontSize: '0.68rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menuValue: {
    color: tokens['--ds-gray-900'],
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  segmentGroup: {
    display: 'inline-flex',
    flexShrink: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    overflow: 'hidden',
  },
  segment: {
    borderWidth: 0,
    borderLeftWidth: { default: 1, ':first-child': 0 },
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-200'],
    color: {
      default: tokens['--ds-gray-900'],
      ':hover:not(:disabled)': tokens['--ds-foreground'],
    },
    font: 'inherit',
    fontSize: '0.74rem',
    paddingBlock: '0.3rem',
    paddingInline: '0.55rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid var(--ds-focus-color)` },
    outlineOffset: { default: 0, ':focus-visible': -1 },
    opacity: { default: 1, ':disabled': 0.4 },
  },
  activeSegment: {
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 14%, var(--ds-background-100))',
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-blue-700'],
    fontWeight: 600,
  },
  staticSegment: {
    cursor: 'default',
    color: tokens['--ds-foreground'],
    fontVariantNumeric: 'tabular-nums',
  },
  crumbs: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.1rem',
    fontSize: '0.78rem',
  },
  crumbWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  crumbValue: {
    display: 'inline-flex',
    gap: '0.35rem',
    marginInlineStart: '0.4rem',
    fontWeight: 400,
  },
  crumbSeparator: {
    display: 'inline-flex',
    alignItems: 'center',
    color: tokens['--ds-gray-800'],
    paddingInline: '0.25rem',
  },
  crumbSeparatorIcon: { width: '0.7rem', height: '0.7rem' },
  crumb: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    borderWidth: 0,
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    color: tokens['--ds-blue-700'],
    font: 'inherit',
    cursor: 'zoom-out',
    paddingBlock: '0.12rem',
    paddingInline: '0.4rem',
    borderRadius: scale.radiusSm,
    outline: { default: 'none', ':focus-visible': `2px solid var(--ds-focus-color)` },
  },
  currentCrumb: { color: tokens['--ds-foreground'], fontWeight: 600, cursor: 'pointer' },
  crumbCaret: {
    display: 'inline-flex',
    alignItems: 'center',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: tokens['--ds-gray-800'], ':hover': tokens['--ds-foreground'] },
    font: 'inherit',
    cursor: 'pointer',
    paddingBlock: '0.12rem',
    paddingInline: '0.2rem',
    outline: { default: 'none', ':focus-visible': `2px solid var(--ds-focus-color)` },
  },
  crumbCaretIcon: { width: '0.6rem', height: '0.6rem' },
  siblingMenu: {
    position: 'absolute',
    zIndex: 20,
    top: '1.6rem',
    left: 0,
    margin: 0,
    padding: '0.25rem',
    listStyle: 'none',
    maxHeight: '16rem',
    overflowY: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
  },
  sibling: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    width: '100%',
    minWidth: '11rem',
    borderWidth: 0,
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    color: tokens['--ds-foreground'],
    font: 'inherit',
    fontSize: '0.78rem',
    textAlign: 'left',
    paddingBlock: '0.25rem',
    paddingInline: '0.45rem',
    borderRadius: scale.radiusSm,
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid var(--ds-focus-color)` },
  },
  currentSibling: { fontWeight: 600, color: tokens['--ds-blue-700'] },
  siblingValue: { color: tokens['--ds-gray-800'], fontVariantNumeric: 'tabular-nums' },
  crumbTotal: {
    marginLeft: 'auto',
    color: tokens['--ds-gray-800'],
    fontSize: '0.72rem',
    fontVariantNumeric: 'tabular-nums',
  },
  stage: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'stretch',
    flexDirection: { default: 'row', '@container (max-width: 48rem)': 'column' },
  },
  canvas: {
    position: 'relative',
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: 0,
    height: 'clamp(22rem, 58cqw, 34rem)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    overflow: 'hidden',
    backgroundColor: tokens['--ds-background-100'],
  },
  canvasHeight: (height: string) => ({ height }),
  // Filling a host pane, the surrounding surface (split separator, host frame)
  // already draws the edges; the canvas' own frame would double every one of them.
  canvasFill: { height: '100%', minHeight: 0, borderWidth: 0, borderRadius: 0 },
  // Keep the SVG out of flex intrinsic sizing. Its numeric dimensions still define
  // the user-space used by the projection, while the canvas alone owns layout size.
  canvasSvg: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' },
  detail: {
    flex: '0 0 15rem',
    flexBasis: { default: '15rem', '@container (max-width: 48rem)': 'auto' },
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    paddingBlock: '0.75rem',
    paddingInline: '0.8rem',
    fontSize: '0.78rem',
  },
  detailBody: { flex: '1 1 auto', minHeight: 0 },
  detailEmpty: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.74rem',
    lineHeight: 1.5,
    marginBlock: 0,
    marginTop: '0.4rem',
  },
  detailPath: {
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontSize: '0.66rem',
    lineHeight: 1.5,
    wordBreak: 'break-all',
    marginBottom: '0.4rem',
    paddingBottom: '0.4rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  detailTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontFamily: scale.fontMono,
    fontWeight: 600,
    fontSize: '0.82rem',
    marginBottom: '0.5rem',
    wordBreak: 'break-all',
  },
  detailTitleIcon: {
    flex: '0 0 auto',
    width: '0.7rem',
    height: '0.7rem',
    color: tokens['--ds-gray-800'],
  },
  detailRows: { margin: 0 },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', lineHeight: 1.9 },
  detailTerm: { color: tokens['--ds-gray-900'] },
  detailDescription: { margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
  legend: {
    marginTop: 'auto',
    paddingTop: '0.6rem',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
  },
  legendHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: tokens['--ds-gray-800'],
    marginBottom: '0.45rem',
  },
  legendMode: {
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: '0.72rem',
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
  },
  legendGroups: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.28rem',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 },
  legendSwatch: {
    flex: '0 0 auto',
    width: '0.85rem',
    height: '0.85rem',
    borderRadius: 3,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  legendSwatchColor: (backgroundColor: string, borderColor: string) => ({
    backgroundColor,
    borderColor,
  }),
  legendLabel: {
    fontFamily: scale.fontMono,
    fontSize: '0.72rem',
    color: tokens['--ds-foreground'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  legendMore: { fontSize: '0.68rem', color: tokens['--ds-gray-800'], fontStyle: 'italic' },
  legendRampWrap: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  legendRamp: {
    display: 'block',
    height: '0.7rem',
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
  },
  legendRampColor: (background: string) => ({ background }),
  legendRampEnds: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.68rem',
    color: tokens['--ds-gray-900'],
  },
  node: {
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':focus-visible': `2px dashed var(--ds-blue-700)`,
    },
    outlineOffset: { default: 0, ':focus-visible': -2 },
    userSelect: 'none',
  },
  nodePosition: (transform: string) => ({ transform }),
  // Tiles animate only while a semantic move (drill, zoom, filter) is in flight —
  // never in response to the container resizing, which may tick for many frames
  // (e.g. the Storybook manager settling its iframe) and would otherwise leave
  // engines that resume interrupted transitions with tiles mid-flight.
  nodeAnimating: {
    transition: {
      default: 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  nodeDrillable: { cursor: 'zoom-in' },
  nodeLeaf: { cursor: 'default' },
  nodeMuted: { opacity: 0.28 },
  // Geometry lives in SVG attributes (see the <rect>), not CSS: WebKit does not
  // reliably apply/transition CSS `width`/`height` on SVG rects, which left tiles
  // at a stale size while their transforms moved. Only paint properties animate.
  rect: {
    transition: {
      default: 'stroke 0.15s ease, stroke-width 0.15s ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  rectBase: { fillOpacity: 1, strokeWidth: 1 },
  rectSummarized: { fillOpacity: 0.82 },
  rectAggregate: { fillOpacity: 0.55, strokeDasharray: '4 3' },
  rectEmphasized: { stroke: tokens['--ds-blue-700'], strokeWidth: 2 },
  rectSelected: { strokeWidth: 2.5 },
  rectColor: (fill: string, stroke: string) => ({ fill, stroke }),
  label: {
    pointerEvents: 'none',
    userSelect: 'none',
    fontFamily: scale.fontMono,
    overflow: 'hidden',
  },
  matchedLabel: { fontWeight: 700 },
  containerLabel: {
    fill: tokens['--ds-foreground'],
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  labelSize: { fill: tokens['--ds-gray-800'], fontWeight: 400, fontSize: '0.64rem' },
  leafLabel: { fill: tokens['--ds-foreground'], fontSize: '0.67rem' },
  syntheticLabel: { fill: tokens['--ds-gray-900'], fontStyle: 'italic' },
  chevron: {
    color: { default: tokens['--ds-gray-900'], ':hover': tokens['--ds-blue-700'] },
    cursor: 'pointer',
  },
  cornerCount: {
    fill: tokens['--ds-gray-800'],
    fontSize: '0.62rem',
    fontVariantNumeric: 'tabular-nums',
  },
  depthDot: { fill: tokens['--ds-blue-700'], pointerEvents: 'none' },
  depthGlyph: {
    fill: tokens['--ds-gray-900'],
    fontFamily: scale.fontMono,
    fontSize: '0.62rem',
    fontWeight: 600,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  depthBadge: { pointerEvents: 'none', userSelect: 'none' },
  depthBadgeBackground: {
    fill: 'color-mix(in srgb, var(--ds-blue-700) 22%, var(--ds-background-100))',
    stroke: tokens['--ds-blue-700'],
    strokeWidth: 1,
  },
  depthBadgeText: {
    fill: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontSize: '0.6rem',
    fontWeight: 600,
  },
  depthFold: { pointerEvents: 'none' },
  depthFoldFace: {
    fill: 'color-mix(in srgb, var(--ds-blue-700) 42%, var(--ds-background-100))',
    stroke: 'none',
  },
  depthFoldCrease: { stroke: tokens['--ds-blue-700'], strokeWidth: 1 },
  depthStack: { pointerEvents: 'none' },
  depthStackEdge: {
    fill: 'none',
    stroke: tokens['--ds-blue-700'],
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  depthStackUnder: {
    stroke: 'color-mix(in srgb, var(--ds-blue-700) 55%, var(--ds-background-100))',
  },
  missing: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-red-900'],
    color: tokens['--ds-red-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 4%, var(--ds-background-100))',
    paddingBlock: '0.5rem',
    paddingInline: '0.75rem',
    borderRadius: scale.radiusDefault,
    fontSize: '0.88rem',
  },
})

/**
 * The per-tile depth-indicator overlay for the corner-mark variants (D1/D2/D3/D5). D4 is
 * a border encoding handled on the tile `<rect>` stroke, not here. Anchored bottom-right
 * (free of the top-right drill chevron); degrades to a bare dot on tiny tiles.
 */
const DepthCorner = ({
  variant,
  cls,
  count,
  w,
  h,
}: {
  variant: DepthIndicatorVariant
  cls: DepthClass
  count: number
  w: number
  h: number
}): React.ReactElement | null => {
  const capped = cls === 'capped'
  // D2/D3/D5 mark capped-only tiles; D1 marks every drillable tile (open + capped).
  if ((variant === 'D2' || variant === 'D3' || variant === 'D5') && !capped) return null
  if (variant === 'off' || variant === 'D4' || cls === 'leaf') return null

  const tiny = w < DEPTH_TINY_W || h < DEPTH_TINY_H
  if (tiny) {
    // Not enough room for a glyph/badge — keep a minimal "there is more" dot.
    return <circle {...stylex.props(styles.depthDot)} cx={w - 3.5} cy={h - 3.5} r={2} />
  }

  if (variant === 'D1') {
    const glyph = capped ? `⊕ ${count}` : '⊕'
    return (
      <text {...stylex.props(styles.depthGlyph)} x={w - 4} y={h - 5} textAnchor="end">
        {glyph}
      </text>
    )
  }
  if (variant === 'D2') {
    const text = `▾ +${count}`
    const bw = Math.min(w - 6, text.length * 5.6 + 8)
    return (
      <g {...stylex.props(styles.depthBadge)} transform={`translate(${w - bw - 3}, ${h - 16})`}>
        <rect {...stylex.props(styles.depthBadgeBackground)} width={bw} height={13} rx={3} />
        <text {...stylex.props(styles.depthBadgeText)} x={bw / 2} y={9.5} textAnchor="middle">
          {text}
        </text>
      </g>
    )
  }
  if (variant === 'D3') {
    const s = Math.min(14, w * 0.4, h * 0.4)
    return (
      <g {...stylex.props(styles.depthFold)} aria-hidden="true">
        <polygon
          {...stylex.props(styles.depthFoldFace)}
          points={`${w},${h - s} ${w},${h} ${w - s},${h}`}
        />
        <line {...stylex.props(styles.depthFoldCrease)} x1={w - s} y1={h} x2={w} y2={h - s} />
      </g>
    )
  }
  // D5: two nested corner brackets at the bottom-right → a stacked-cards "layers beneath" look.
  const bracket = (o: number, len: number) =>
    `${w - o - len},${h - o} ${w - o},${h - o} ${w - o},${h - o - len}`
  return (
    <g {...stylex.props(styles.depthStack)} aria-hidden="true">
      <polyline {...stylex.props(styles.depthStackEdge)} points={bracket(2, 10)} />
      <polyline
        {...stylex.props(styles.depthStackEdge, styles.depthStackUnder)}
        points={bracket(5, 7)}
      />
    </g>
  )
}

/** Render depth-cap ceiling (≥ 10, so deep drilling + a modest cap stays legible). */
const MAX_DEPTH_CAP = 12
const HEADER_FS = 11
const LEAF_FS = 10.5

const pct = (part: number, whole: number): string =>
  whole > 0 ? `${((100 * part) / whole).toFixed(1)}%` : '—'

/**
 * Format a magnitude in the model's domain units — the ONE formatter shared by tile
 * labels, the tooltip, the detail panel, and the legend endpoints, so numbers read
 * consistently everywhere. `unit === 'bytes'` → human bytes (B/KB/MB/GB/TB); otherwise
 * `<localeNumber> <unit>`, with the `valueNoun` appended only where a caller wants it to
 * read naturally (e.g. legend endpoints: "316 lines churn"). Generic: any future scenario
 * ($ cost, requests, ms) formats correctly by just setting `unit`/`valueNoun` on the model.
 */
const formatMagnitude = (value: number, unit?: string, valueNoun?: string): string => {
  if (unit === 'bytes') {
    const abs = Math.abs(value)
    if (abs < 1024) return `${value} B`
    if (abs < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
    if (abs < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(2)} MB`
    if (abs < 1024 ** 4) return `${(value / 1024 ** 3).toFixed(2)} GB`
    return `${(value / 1024 ** 4).toFixed(2)} TB`
  }
  const core = unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString()
  return valueNoun ? `${core} ${valueNoun}` : core
}

/** A left→right intensity gradient over the semantic background for a ramp legend. */
const rampCss = (ramp: { token: string; min: number; max: number }): string =>
  `linear-gradient(to right, color-mix(in srgb, ${ramp.token} ${ramp.min}%, ${tokens['--ds-background-100']}), color-mix(in srgb, ${ramp.token} ${ramp.max}%, ${tokens['--ds-background-100']}))`

/** Show at most this many group swatches before collapsing the tail into "+N more". */
const LEGEND_GROUP_CAP = 10

/** Below these tile dimensions the corner glyph is dropped (the zoom cursor still applies). */
const DEPTH_GLYPH_MIN_W = 22
const DEPTH_GLYPH_MIN_H = 15
/** Rendered size (px) of the SVG maximize affordance drawn in a tile corner / header. */
const TILE_MAXIMIZE_PX = 11

/** Additive metrics over a subtree's leaves (containers may carry aggregates; leaves are the source). */
const sumLeafMetrics = (node: TreemapNode): Record<string, number> => {
  const out: Record<string, number> = {}
  const walk = (n: TreemapNode) => {
    if (n.children === undefined || n.children.length === 0) {
      for (const [k, v] of Object.entries(n.metrics ?? {})) out[k] = (out[k] ?? 0) + v
      return
    }
    for (const c of n.children) walk(c)
  }
  walk(node)
  return out
}

const isTreemapLeaf = (d: DerivedNode): boolean =>
  d.kind === 'aggregate' || d.kind === 'summarized' || !d.children || d.children.length === 0

const segBtn = (active: boolean, label: string, onClick: () => void, aria?: string) => (
  <button
    type="button"
    {...stylex.props(styles.segment, active && styles.activeSegment)}
    aria-pressed={active}
    aria-label={aria}
    onClick={onClick}
  >
    {label}
  </button>
)

/**
 * Describes the node handed to a custom detail renderer: identity, label, value with optional
 * unit, label path from the root, parent and total shares, descendant and leaf counts, and any
 * extra metrics.
 */
export interface TreemapDetailProps {
  readonly node: {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly path: readonly string[]
    readonly pctOfParent: number
    readonly pctOfTotal: number
    readonly childCount: number
    readonly leafCount: number
    readonly metrics?: Readonly<Record<string, number>>
    readonly unit?: string
    readonly valueNoun?: string
  }
}

/**
 * How much of its own chrome the block renders. `full` is the standalone
 * figure. `compact` drops the search box and the pinned-detail/legend panel and
 * inlines the breadcrumb into the controls row, for a treemap embedded as a
 * navigator inside another surface that owns search and detail itself.
 */
export type TreemapChrome = 'full' | 'compact'

/** The real model node behind a pinned or activated tile (synthetic "+N more" tiles resolve to their parent). */
export interface TreemapSelection {
  readonly id: string
  readonly label: string
  /** Labels root → this node. */
  readonly path: readonly string[]
  /** `true` for a model leaf — the unit a consumer can open, e.g. one changed file. */
  readonly isLeaf: boolean
}

const Inner = ({
  id,
  model,
  lenses,
  defaultLensId,
  defaultExcludedIds,
  renderDetail: Detail,
  depthIndicator = 'off',
  onSelect,
  onActivate,
  canvasHeight,
  chrome = 'full',
  rootId: controlledRootId,
  maxDepth: controlledMaxDepth,
  onMaxDepthChange,
  showDepthControl = chrome === 'full',
  excludedIds: controlledExcludedIds,
  onExcludedIdsChange,
  filter = chrome === 'full',
  filterRenderValue,
  controls,
  onHide,
  onSolo,
}: {
  id: string
  model: TreemapModel
  lenses: readonly TreemapLens[]
  defaultLensId?: string
  defaultExcludedIds?: readonly string[]
  renderDetail?: ComponentType<TreemapDetailProps>
  depthIndicator?: DepthIndicatorVariant
  onSelect?: (selection: TreemapSelection | undefined) => void
  onActivate?: (selection: TreemapSelection) => void
  canvasHeight?: string
  chrome?: TreemapChrome
  rootId?: string | undefined
  maxDepth?: number | undefined
  onMaxDepthChange?: ((maxDepth: number) => void) | undefined
  showDepthControl?: boolean
  excludedIds?: ReadonlySet<string> | undefined
  onExcludedIdsChange?: ((next: ReadonlySet<string>) => void) | undefined
  filter?: boolean
  filterRenderValue?: ((node: TreemapNode, leafCount: number) => ReactNode) | undefined
  controls?: ReactNode
  onHide?: ((selection: TreemapSelection) => void) | undefined
  onSolo?: ((selection: TreemapSelection) => void) | undefined
}) => {
  const theme = useTheme()
  const fill = canvasHeight === '100%'
  const initial = lenses.find((l) => l.id === defaultLensId) ?? lenses[0]!
  const minAreaPct = initial.minAreaPct ?? 0.012
  const valueNoun = model.valueNoun ?? 'value'
  const unit = model.unit

  // Live lens = block-local state seeded from the default lens (kit convention).
  const [layout, setLayout] = useState<TreemapLayout>(initial.layout)
  const [rootId, setRootId] = useState<string | undefined>(controlledRootId ?? initial.rootId)
  // A consumer-owned zoom root (e.g. a review's directory scope) re-roots the map
  // whenever it changes; the block still drills locally in between.
  useEffect(() => {
    setRootId(controlledRootId ?? initial.rootId)
    setSelectedId(undefined)
    setOpenCrumb(undefined)
  }, [controlledRootId, initial.rootId])
  const [localMaxDepth, setLocalMaxDepth] = useState<number>(initial.maxDepth ?? 3)
  const maxDepth = controlledMaxDepth ?? localMaxDepth
  const changeMaxDepth = useCallback(
    (next: number) => {
      if (controlledMaxDepth === undefined) setLocalMaxDepth(next)
      onMaxDepthChange?.(next)
    },
    [controlledMaxDepth, onMaxDepthChange],
  )
  const [colorBy, setColorBy] = useState<TreemapColorBy>(initial.colorBy ?? 'group')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [hoverId, setHoverId] = useState<string | undefined>(undefined)
  const [openCrumb, setOpenCrumb] = useState<string | undefined>(undefined)
  const [showResults, setShowResults] = useState(false)

  // Hierarchical filter (decision 0055): a leaf-id set (empty = whole tree included).
  // Component-local — like zoom/search/selection, it is NOT in the serializable model.
  // Seeded once (there is no runtime lens switch) from the UNION of `defaultExcludedIds`
  // (subtree roots expanded to leaves) and the default lens's `hiddenFacets` (leaves whose
  // facet matches, e.g. generated files — decision 0068). Both are just seeds; the reviewer
  // reveals either via the "N hidden" filter, so completeness (MED.BLK.TREE-R61) holds.
  const [localExcludedIds, setLocalExcludedIds] = useState<ReadonlySet<string>>(() => {
    const seed = resolveHiddenFacetLeafIds(model, initial.hiddenFacets)
    if (defaultExcludedIds && defaultExcludedIds.length > 0) {
      for (const leafId of expandToLeafIds(model, defaultExcludedIds)) seed.add(leafId)
    }
    return seed
  })
  // A consumer may own the hidden set (e.g. a review hiding files across map, rail
  // and diff); otherwise it stays block-local.
  const excludedIds = controlledExcludedIds ?? localExcludedIds
  const setExcludedIds = useCallback(
    (next: ReadonlySet<string>) => {
      if (onExcludedIdsChange !== undefined) onExcludedIdsChange(next)
      if (controlledExcludedIds === undefined) setLocalExcludedIds(next)
    },
    [onExcludedIdsChange, controlledExcludedIds],
  )
  // Unpruned index feeds the filter tree UI so its checkboxes show ORIGINAL values.
  const fullIndex = useMemo(() => buildIndex(model.root), [model])
  // REMOVE + RE-SUM: prune the model by the excluded set BEFORE projecting; the scene
  // memo depends on the pruned model so the visible tiles reflow / re-sum globally.
  const prunedModel = useMemo(() => pruneModel(model, excludedIds), [model, excludedIds])

  // ── ResizeObserver sizing (the canvas has a CSS-fixed height; width is fluid). ──
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (cr) setSize({ width: Math.round(cr.width), height: Math.round(cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Semantic relayouts (zoom root, layout, depth, exclusions) animate; the flag is
  // cleared by the first `transitionend` that bubbles up from a tile.
  const [animating, setAnimating] = useState(false)
  const semanticKey = `${rootId ?? ''}|${layout}|${maxDepth}|${excludedIds.size}`
  const previousSemanticKey = useRef(semanticKey)
  useEffect(() => {
    if (previousSemanticKey.current === semanticKey) return
    previousSemanticKey.current = semanticKey
    setAnimating(true)
  }, [semanticKey])

  const formatValue = useCallback((n: number): string => formatMagnitude(n, unit), [unit])

  // ── STRUCTURAL: derived tree + laid-out rects (relayout only on these deps). ──
  const scene = useMemo(
    () => project({ model: prunedModel, lens: { layout, rootId, maxDepth, minAreaPct }, size }),
    [prunedModel, layout, rootId, maxDepth, minAreaPct, size],
  )
  const { rects, index, anchor, total, isAggregateRoot, derived, valueDomain } = scene

  // ── RESTYLE: search highlight/mute (Set lookups, no relayout). ──
  const searchState = useMemo(() => searchMatches(index, query), [index, query])
  const hasQuery = query.trim() !== ''

  // Breadcrumb = ancestor chain of the current display anchor (+ aggregate crumb).
  const crumbs = useMemo(() => {
    const ids: string[] = []
    let cur: string | undefined = anchor.node.id
    while (cur !== undefined) {
      ids.push(cur)
      cur = index.byId.get(cur)?.parentId
    }
    ids.reverse()
    const chain: {
      id: string
      label: string
      siblingsOf: string | undefined
      valueNode: TreemapNode | undefined
      leafCount: number
    }[] = ids.map((cid) => {
      const e = index.byId.get(cid)!
      // Metrics summed over the VISIBLE (pruned) subtree, so a crumb's value reflects
      // the active filter; leaf count comes from the same index.
      const metrics = sumLeafMetrics(e.node)
      const valueNode: TreemapNode = { ...e.node, metrics }
      return {
        id: cid,
        label: e.node.label,
        siblingsOf: e.parentId,
        valueNode,
        leafCount: e.leafCount,
      }
    })
    if (isAggregateRoot && rootId)
      chain.push({
        id: rootId,
        label: derived.label,
        siblingsOf: undefined,
        valueNode: undefined,
        leafCount: 0,
      })
    return chain
  }, [anchor, index, isAggregateRoot, rootId, derived.label])

  // Resolve a tile to the real model node the consumer cares about. Synthetic
  // "+N more" aggregates have no real identity of their own and resolve to their parent.
  const selectionOf = useCallback(
    (tileId: string): TreemapSelection | undefined => {
      const realId = rects.find((r) => r.node.id === tileId)?.node.realId ?? tileId
      const entry = fullIndex.byId.get(realId)
      if (entry === undefined) return undefined
      const children = entry.node.children
      return {
        id: realId,
        label: entry.node.label,
        path: entry.path,
        isLeaf: children === undefined || children.length === 0,
      }
    },
    [rects, fullIndex],
  )

  // Selection is block-local state, mirrored outward on every *explicit* pin
  // (click, Space, drill, breadcrumb) so a composing surface can follow it — and
  // so re-pinning the same tile after the consumer moved on still notifies.
  // Focus alone (arrow keys) moves the pin visually without notifying.
  // Stable identity: `selectionOf` changes on every relayout, and the callbacks
  // below (and the tile handlers depending on them) should not.
  const notifyRef = useRef<(tileId: string | undefined) => void>(() => {})
  useEffect(() => {
    notifyRef.current = (tileId) =>
      onSelect?.(tileId === undefined ? undefined : selectionOf(tileId))
  }, [onSelect, selectionOf])
  const notify = useCallback((tileId: string | undefined) => notifyRef.current(tileId), [])

  const drillTo = useCallback(
    (nextRoot: string | undefined, selectId?: string) => {
      setRootId(nextRoot)
      setSelectedId(selectId)
      setHoverId(undefined)
      setOpenCrumb(undefined)
      setShowResults(false)
      notify(selectId ?? nextRoot)
    },
    // Setters are stable; listing them keeps the compiler's inferred deps in sync.
    [notify, setRootId, setSelectedId, setHoverId, setOpenCrumb, setShowResults],
  )

  const select = useCallback(
    (tileId: string) => {
      setSelectedId(tileId)
      notify(tileId)
    },
    [notify, setSelectedId],
  )

  const ascend = useCallback(() => {
    const parent = isAggregateRoot ? anchor.node.id : anchor.parentId
    drillTo(parent)
  }, [anchor, isAggregateRoot, drillTo])

  const drillDerived = useCallback(
    (d: DerivedNode) => {
      if (d.drillId !== undefined) drillTo(d.drillId, d.realId)
      else if (onActivate !== undefined) {
        // A leaf cannot be drilled into; Enter / double-click "opens" it instead.
        const selection = selectionOf(d.id)
        if (selection !== undefined) onActivate(selection)
      }
    },
    [drillTo, onActivate, selectionOf],
  )

  // Roving tabindex: exactly one tab stop, following the selected tile — falling
  // back to the first tile whenever the selection resolves to no visible rect (e.g.
  // just after a drill re-roots and the selected id is the now-filtered-out root).
  const tileRefs = useRef(new Map<string, SVGGElement>())
  const selectedRect = selectedId
    ? rects.find((r) => r.node.id === selectedId || r.node.realId === selectedId)
    : undefined
  const rovingId = selectedRect?.node.id ?? rects[0]?.node.id
  const focusRect = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(rects.length - 1, idx))
      const nextId = rects[clamped]?.node.id
      if (nextId) tileRefs.current.get(nextId)?.focus()
    },
    [rects],
  )

  const onKey = useCallback(
    (e: React.KeyboardEvent, d: DerivedNode, i: number) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        drillDerived(d)
      } else if (e.key === ' ') {
        e.preventDefault()
        select(d.id)
      } else if (e.key === 'Delete') {
        e.preventDefault()
        const selection = selectionOf(d.id)
        if (selection !== undefined) onHide?.(selection)
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        ascend()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        focusRect(i + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        focusRect(i - 1)
      }
    },
    [drillDerived, select, ascend, focusRect, selectionOf, onHide],
  )

  // Search: pick a result → drill so it's visible + select it, reveal its path.
  const jumpToResult = useCallback(
    (rid: string) => {
      const e = index.byId.get(rid)
      if (!e) return
      // Drill to the match if it's a container, else to its parent so it renders.
      drillTo(e.childCount > 0 ? rid : e.parentId, rid)
    },
    [index, drillTo],
  )

  // ── Selected node → detail-panel data. ──
  const detail = useMemo(() => {
    if (!selectedId) return undefined
    const e = index.byId.get(selectedId)
    if (e) {
      const parentVal = e.parentId ? (index.byId.get(e.parentId)?.value ?? total) : total
      return {
        kind: 'node' as const,
        node: e.node,
        path: e.path,
        value: e.value,
        parentValue: parentVal,
        childCount: e.childCount,
        leafCount: e.leafCount,
      }
    }
    // Aggregate tile (synthetic): summarize the fold.
    const agg = rects.find((r) => r.node.id === selectedId)?.node
    if (agg) {
      return {
        kind: 'aggregate' as const,
        label: agg.label,
        value: agg.value,
        parentValue: anchor.value,
        childCount: agg.childCount ?? 0,
      }
    }
    return undefined
  }, [selectedId, index, total, rects, anchor.value])

  const customDetail = useMemo(() => {
    if (Detail === undefined || detail?.kind !== 'node') return undefined
    return (
      <Detail
        node={{
          id: detail.node.id,
          label: detail.node.label,
          value: detail.value,
          path: detail.path,
          pctOfParent: detail.parentValue > 0 ? detail.value / detail.parentValue : 0,
          pctOfTotal: total > 0 ? detail.value / total : 0,
          childCount: detail.childCount,
          leafCount: detail.leafCount,
          ...(detail.node.metrics ? { metrics: detail.node.metrics } : {}),
          ...(unit ? { unit } : {}),
          ...(valueNoun ? { valueNoun } : {}),
        }}
      />
    )
  }, [Detail, detail, unit, valueNoun, total])

  const displayRootId = anchor.node.id
  const colorLabel =
    colorBy === 'group' ? 'by group' : colorBy === 'depth' ? 'by depth' : `by ${valueNoun}`

  // Depth-legend endpoint: the deepest rendered level. The `value` legend reads the
  // SHARED `valueDomain` (min/max over the drawn leaves) straight off the scene, so the
  // tiles and their legend describe ONE view-relative scale (decision 0055) — the
  // faintest tile is `valueDomain.min`, the brightest `valueDomain.max`.
  const maxDepthRel = useMemo(() => rects.reduce((m, r) => Math.max(m, r.depth), 0), [rects])

  // Hover tooltip anchor + content: the hovered tile's bbox (canvas-local) drives a
  // React-Aria Popover that flips/shifts to never clip (decision 0055). Keyed on the
  // tile id so the anchor re-mounts cleanly per tile. `index`/`total` are the PRUNED
  // scene's, so the readout reflects the re-summed visible set (path / value / % / hints).
  const hoverTip = useMemo(() => {
    if (!hoverId) return undefined
    const r = rects.find((rc) => rc.node.id === hoverId)
    if (!r) return undefined
    const d = r.node
    const e = index.byId.get(d.realId)
    const path = e?.path?.join(' / ') ?? d.label
    const parentVal = e?.parentId ? (index.byId.get(e.parentId)?.value ?? total) : total
    const hint =
      d.kind === 'summarized'
        ? `▸ ${d.childCount} leaves · double-click to drill`
        : d.kind === 'aggregate'
          ? `▸ ${d.childCount} folded · double-click to expand`
          : undefined
    return {
      key: d.id,
      x0: r.x0,
      y0: r.y0,
      width: r.x1 - r.x0,
      height: r.y1 - r.y0,
      content: {
        label: d.label,
        path,
        valueNoun,
        valueStr: formatValue(d.value),
        pctParent: pct(d.value, parentVal),
        pctTotal: pct(d.value, total),
        hint,
      },
    }
  }, [hoverId, rects, index, total, valueNoun, formatValue])

  // Sibling-aware breadcrumb; inline in the controls row under compact chrome.
  const breadcrumb = (
    <nav
      {...stylex.props(styles.crumbs, chrome === 'compact' && styles.crumbsCompact)}
      aria-label="Breadcrumb"
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        const sibs = c.siblingsOf ? (index.byId.get(c.siblingsOf)?.node.children ?? []) : []
        return (
          <span key={c.id} {...stylex.props(styles.crumbWrap)}>
            {i > 0 ? (
              <span {...stylex.props(styles.crumbSeparator)} aria-hidden="true">
                <ChevronRight rootStyle={styles.crumbSeparatorIcon} />
              </span>
            ) : null}
            <button
              type="button"
              {...stylex.props(styles.crumb, isLast && styles.currentCrumb)}
              aria-current={isLast ? 'location' : undefined}
              onClick={() => drillTo(i === 0 ? undefined : c.id)}
            >
              {c.label}
              {filterRenderValue !== undefined && c.valueNode !== undefined ? (
                <span {...stylex.props(styles.crumbValue)}>
                  {filterRenderValue(c.valueNode, c.leafCount)}
                </span>
              ) : null}
            </button>
            {sibs.length > 1 ? (
              <>
                <button
                  type="button"
                  {...stylex.props(styles.crumbCaret)}
                  aria-label={`Siblings of ${c.label}`}
                  aria-expanded={openCrumb === c.id}
                  onClick={() => setOpenCrumb((o) => (o === c.id ? undefined : c.id))}
                >
                  <ChevronDown rootStyle={styles.crumbCaretIcon} />
                </button>
                {openCrumb === c.id ? (
                  <ul {...stylex.props(styles.siblingMenu)} role="listbox">
                    {sibs.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          {...stylex.props(styles.sibling, s.id === c.id && styles.currentSibling)}
                          onClick={() => drillTo(s.id)}
                        >
                          {s.label}
                          <span {...stylex.props(styles.siblingValue)}>
                            {formatValue(index.byId.get(s.id)?.value ?? 0)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </span>
        )
      })}
      {chrome === 'compact' ? null : (
        <span {...stylex.props(styles.crumbTotal)}>
          {formatValue(anchor.value)} · {anchor.leafCount} leaves
        </span>
      )}
    </nav>
  )

  return (
    <div
      {...stylex.props(
        styles.root,
        chrome === 'compact' && styles.rootCompact,
        fill && styles.rootFill,
      )}
      data-theme={theme}
    >
      {/* Controls: search, layout (MED.KIT-R63), color encoding, depth cap. */}
      <div {...stylex.props(styles.controls, chrome === 'compact' && styles.controlsCompact)}>
        {chrome === 'compact' ? breadcrumb : null}
        {chrome === 'compact' ? null : (
          <div {...stylex.props(styles.search)}>
            <input
              type="text"
              {...stylex.props(styles.searchInput)}
              placeholder="Search the whole tree…"
              value={query}
              aria-label="Search tree"
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
            />
            {hasQuery ? (
              <span {...stylex.props(styles.searchCount)}>{searchState.results.length} match</span>
            ) : null}
            {showResults && hasQuery && searchState.results.length > 0 ? (
              <ul {...stylex.props(styles.menu)} role="listbox" aria-label="Search results">
                {searchState.results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      {...stylex.props(styles.menuButton)}
                      onClick={() => jumpToResult(r.id)}
                    >
                      <span {...stylex.props(styles.menuLabel)}>{r.label}</span>
                      <span {...stylex.props(styles.menuPath)}>
                        {r.path.slice(0, -1).join(' / ')}
                      </span>
                      <span {...stylex.props(styles.menuValue)}>{formatValue(r.value)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {!filter ? null : (
          <FilterPanel
            model={model}
            fullIndex={fullIndex}
            excludedIds={excludedIds}
            onChange={setExcludedIds}
            formatValue={formatValue}
            theme={theme}
            renderValue={filterRenderValue}
          />
        )}
        {controls}
        <div {...stylex.props(styles.segmentGroup)} role="group" aria-label="Layout">
          {segBtn('treemap' === layout, 'treemap', () => setLayout('treemap'), 'Treemap layout')}
          {segBtn(
            'icicle' === layout,
            'icicle',
            () => {
              setLayout('icicle')
              if (maxDepth < 6) changeMaxDepth(7)
            },
            'Icicle layout',
          )}
        </div>
        {chrome === 'compact' ? null : (
          <div {...stylex.props(styles.segmentGroup)} role="group" aria-label="Color by">
            {segBtn(colorBy === 'group', 'group', () => setColorBy('group'), 'Color by group')}
            {segBtn(colorBy === 'depth', 'depth', () => setColorBy('depth'), 'Color by depth')}
            {segBtn(
              colorBy === 'value',
              valueNoun,
              () => setColorBy('value'),
              `Color by ${valueNoun}`,
            )}
          </div>
        )}
        {showDepthControl ? (
          <div {...stylex.props(styles.segmentGroup)} role="group" aria-label="Render depth">
            <button
              type="button"
              {...stylex.props(styles.segment)}
              aria-label="Decrease depth"
              disabled={maxDepth <= 1}
              onClick={() => changeMaxDepth(Math.max(1, maxDepth - 1))}
            >
              −
            </button>
            <span {...stylex.props(styles.segment, styles.staticSegment)}>depth {maxDepth}</span>
            <button
              type="button"
              {...stylex.props(styles.segment)}
              aria-label="Increase depth"
              disabled={maxDepth >= MAX_DEPTH_CAP}
              onClick={() => changeMaxDepth(Math.min(MAX_DEPTH_CAP, maxDepth + 1))}
            >
              +
            </button>
          </div>
        ) : null}
      </div>

      {chrome === 'compact' ? null : breadcrumb}

      <div {...stylex.props(styles.stage, fill && styles.stageFill)}>
        <div
          ref={canvasRef}
          {...stylex.props(
            styles.canvas,
            fill
              ? styles.canvasFill
              : canvasHeight === undefined
                ? undefined
                : styles.canvasHeight(canvasHeight),
          )}
          onClick={() => setShowResults(false)}
        >
          <svg
            width={size.width}
            height={size.height}
            role="tree"
            aria-label="Value-proportioned hierarchy"
            {...stylex.props(styles.canvasSvg)}
          >
            <defs>
              {rects.map((n, i) => (
                <clipPath key={n.node.id} id={`${id}-tmclip-${i}`}>
                  <rect width={Math.max(0, n.x1 - n.x0)} height={Math.max(0, n.y1 - n.y0)} />
                </clipPath>
              ))}
            </defs>
            <g>
              {rects.map((n, i) => {
                const d = n.node
                const w = n.x1 - n.x0
                const h = n.y1 - n.y0
                if (w <= 0.5 || h <= 0.5) return null
                const isTreemapContainer = layout === 'treemap' && !isTreemapLeaf(d)
                const { fill: tileFill, stroke } = tileColor({
                  d,
                  colorBy,
                  index,
                  displayRootId,
                  valueDomain,
                })
                const matched = hasQuery && searchState.matched.has(d.realId)
                const onPath = hasQuery && searchState.onPath.has(d.realId)
                const muted = hasQuery && !onPath && !matched
                const selected = selectedId === d.id || selectedId === d.realId
                const hovered = hoverId === d.id
                const clip = `url(#${id}-tmclip-${i})`
                const isSynthetic = d.kind === 'summarized' || d.kind === 'aggregate'

                const valStr = formatValue(d.value)
                const showHeaderVal = isTreemapContainer && w > 90
                const valW = showHeaderVal ? valStr.length * HEADER_FS * 0.6 + 8 : 0
                const headerLabel = truncate(d.label, w - 12 - valW, HEADER_FS)
                const leafLabel = truncate(
                  d.kind === 'aggregate'
                    ? `› ${d.label} (${valStr})`
                    : isSynthetic
                      ? `${d.label} · ${valStr}`
                      : d.label,
                  w - 10,
                  LEAF_FS,
                )
                const canLeafLabel = layout === 'icicle' ? h > 11 : h > 15

                // Drill affordance (decision 0055): every drillable (non-leaf) tile carries
                // the SAME SVG maximize icon in its bottom-right corner + a `zoom-in` cursor;
                // leaves carry nothing. A capped tile also shows its hidden-descendant count
                // as text next to the icon. `aria-expanded` (children drawn?) + `aria-level`
                // land the treeitem a11y gap.
                const cls = depthClass(d)
                const drillable = cls !== 'leaf'
                const baseStroke =
                  depthIndicator === 'D4'
                    ? drillable
                      ? 'var(--ds-blue-700)'
                      : 'var(--ds-gray-alpha-400)'
                    : stroke
                const showCorner =
                  depthIndicator === 'off' &&
                  drillable &&
                  w >= DEPTH_GLYPH_MIN_W &&
                  h >= DEPTH_GLYPH_MIN_H
                const cornerCount =
                  cls === 'capped' && (d.childCount ?? 0) > 0 ? String(d.childCount) : undefined

                return (
                  <g
                    key={d.id}
                    ref={
                      isTreemapContainer
                        ? undefined
                        : (el) => {
                            if (el) tileRefs.current.set(d.id, el)
                            else tileRefs.current.delete(d.id)
                          }
                    }
                    {...stylex.props(
                      styles.node,
                      styles.nodePosition(`translate(${n.x0}px, ${n.y0}px)`),
                      drillable ? styles.nodeDrillable : styles.nodeLeaf,
                      muted && styles.nodeMuted,
                      animating && styles.nodeAnimating,
                    )}
                    tabIndex={isTreemapContainer ? undefined : d.id === rovingId ? 0 : -1}
                    role={isTreemapContainer ? undefined : 'treeitem'}
                    aria-label={
                      isTreemapContainer
                        ? undefined
                        : `${d.label}, ${valStr}, ${pct(d.value, total)} of total${d.drillId ? ', drillable' : ''}`
                    }
                    aria-selected={isTreemapContainer ? undefined : selected}
                    aria-level={isTreemapContainer ? undefined : anchor.depth + n.depth}
                    aria-expanded={
                      isTreemapContainer ? undefined : drillable ? cls === 'open' : undefined
                    }
                    onFocus={isTreemapContainer ? undefined : () => setSelectedId(d.id)}
                    onKeyDown={isTreemapContainer ? undefined : (e) => onKey(e, d, i)}
                    onMouseDown={(e) => {
                      // Suppress the browser's dblclick-to-select-word on the second click of
                      // a drill, without touching single-click focus or drag-select elsewhere.
                      if (e.detail > 1) e.preventDefault()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Uniform modifier rule: option = exclude this, option+shift = only this.
                      if (e.altKey) {
                        const selection = selectionOf(d.id)
                        if (selection === undefined) return
                        if (e.shiftKey) onSolo?.(selection)
                        else onHide?.(selection)
                        return
                      }
                      select(d.id)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      drillDerived(d)
                    }}
                    onMouseEnter={() => setHoverId(d.id)}
                    onMouseLeave={() => setHoverId(undefined)}
                    onTransitionEnd={(e) => {
                      if (e.propertyName === 'transform') setAnimating(false)
                    }}
                  >
                    <rect
                      {...stylex.props(
                        styles.rect,
                        styles.rectBase,
                        styles.rectColor(
                          isTreemapContainer ? 'var(--ds-gray-alpha-100)' : tileFill,
                          baseStroke,
                        ),
                        d.kind === 'summarized' && styles.rectSummarized,
                        d.kind === 'aggregate' && styles.rectAggregate,
                        (hovered || matched) && styles.rectEmphasized,
                        selected && styles.rectEmphasized,
                        selected && styles.rectSelected,
                      )}
                      width={w}
                      height={h}
                      rx={2}
                    />
                    {isTreemapContainer ? (
                      <g
                        ref={(el) => {
                          if (el) tileRefs.current.set(d.id, el)
                          else tileRefs.current.delete(d.id)
                        }}
                        clipPath={clip}
                        role="treeitem"
                        tabIndex={d.id === rovingId ? 0 : -1}
                        aria-label={`${d.label}, ${valStr}, ${pct(d.value, total)} of total${d.drillId ? ', drillable' : ''}`}
                        aria-selected={selected}
                        aria-level={anchor.depth + n.depth}
                        aria-expanded={cls === 'open'}
                        data-treemap-parent-hit-region=""
                        onFocus={() => setSelectedId(d.id)}
                        onKeyDown={(e) => onKey(e, d, i)}
                      >
                        <rect
                          width={w}
                          height={Math.min(h, TREEMAP_HEADER_HEIGHT)}
                          fill="transparent"
                        />
                        <text
                          {...stylex.props(
                            styles.label,
                            styles.containerLabel,
                            matched && styles.matchedLabel,
                          )}
                          x={6}
                          y={16}
                        >
                          {headerLabel}
                        </text>
                        {d.drillId ? (
                          <TileMaximize
                            style={styles.chevron}
                            x={w - 4 - TILE_MAXIMIZE_PX}
                            y={6}
                            size={TILE_MAXIMIZE_PX}
                            onClick={(e) => {
                              e.stopPropagation()
                              drillDerived(d)
                            }}
                          />
                        ) : null}
                        {showHeaderVal ? (
                          <text
                            {...stylex.props(styles.labelSize)}
                            x={w - (d.drillId ? 16 : 5)}
                            y={16}
                            textAnchor="end"
                          >
                            {valStr}
                          </text>
                        ) : null}
                      </g>
                    ) : null}
                    {!isTreemapContainer && canLeafLabel && leafLabel ? (
                      <g clipPath={clip}>
                        <text
                          {...stylex.props(
                            styles.label,
                            styles.leafLabel,
                            isSynthetic && styles.syntheticLabel,
                            matched && styles.matchedLabel,
                          )}
                          x={5}
                          y={layout === 'icicle' ? h / 2 + 3.5 : 13}
                        >
                          {leafLabel}
                        </text>
                      </g>
                    ) : null}
                    {showCorner ? (
                      <g {...stylex.props(styles.chevron)}>
                        {cornerCount ? (
                          <text
                            {...stylex.props(styles.cornerCount)}
                            x={w - 4 - TILE_MAXIMIZE_PX - 2}
                            y={h - 5}
                            textAnchor="end"
                          >
                            {cornerCount}
                          </text>
                        ) : null}
                        <TileMaximize
                          x={w - 3 - TILE_MAXIMIZE_PX}
                          y={h - 3 - TILE_MAXIMIZE_PX}
                          size={TILE_MAXIMIZE_PX}
                          onClick={(e) => {
                            e.stopPropagation()
                            drillDerived(d)
                          }}
                        />
                      </g>
                    ) : null}
                    <DepthCorner
                      variant={depthIndicator}
                      cls={cls}
                      count={d.childCount ?? 0}
                      w={w}
                      h={h}
                    />
                  </g>
                )
              })}
            </g>
          </svg>

          {hoverTip ? (
            <TooltipOverlay
              key={hoverTip.key}
              x0={hoverTip.x0}
              y0={hoverTip.y0}
              width={hoverTip.width}
              height={hoverTip.height}
              isOpen
              onClose={() => setHoverId(undefined)}
              theme={theme}
              content={hoverTip.content}
            />
          ) : null}
        </div>

        {/* Pinned detail panel (MED.KIT-R62) — the durable replacement for the tooltip. */}
        {chrome === 'compact' ? null : (
          <aside {...stylex.props(styles.detail)} aria-label="Selected node detail">
            <div {...stylex.props(styles.detailBody)}>
              {detail === undefined ? (
                <p {...stylex.props(styles.detailEmpty)}>
                  Click a tile to pin its detail. Double-click / Enter to drill.
                </p>
              ) : detail.kind === 'aggregate' ? (
                <>
                  <div {...stylex.props(styles.detailTitle)}>
                    <ChevronRight rootStyle={styles.detailTitleIcon} />
                    {detail.label}
                  </div>
                  <dl {...stylex.props(styles.detailRows)}>
                    <div {...stylex.props(styles.detailRow)}>
                      <dt {...stylex.props(styles.detailTerm)}>{valueNoun}</dt>
                      <dd {...stylex.props(styles.detailDescription)}>
                        {formatValue(detail.value)}
                      </dd>
                    </div>
                    <div {...stylex.props(styles.detailRow)}>
                      <dt {...stylex.props(styles.detailTerm)}>folded nodes</dt>
                      <dd {...stylex.props(styles.detailDescription)}>{detail.childCount}</dd>
                    </div>
                    <div {...stylex.props(styles.detailRow)}>
                      <dt {...stylex.props(styles.detailTerm)}>% of parent</dt>
                      <dd {...stylex.props(styles.detailDescription)}>
                        {pct(detail.value, detail.parentValue)}
                      </dd>
                    </div>
                    <div {...stylex.props(styles.detailRow)}>
                      <dt {...stylex.props(styles.detailTerm)}>% of total</dt>
                      <dd {...stylex.props(styles.detailDescription)}>
                        {pct(detail.value, total)}
                      </dd>
                    </div>
                  </dl>
                  <p {...stylex.props(styles.detailEmpty)}>
                    Double-click the tile to expand these folded siblings.
                  </p>
                </>
              ) : (
                <>
                  <div {...stylex.props(styles.detailPath)}>{detail.path.join(' / ')}</div>
                  <div {...stylex.props(styles.detailTitle)}>{detail.node.label}</div>
                  {customDetail ?? (
                    <dl {...stylex.props(styles.detailRows)}>
                      <div {...stylex.props(styles.detailRow)}>
                        <dt {...stylex.props(styles.detailTerm)}>{valueNoun}</dt>
                        <dd {...stylex.props(styles.detailDescription)}>
                          {formatValue(detail.value)}
                        </dd>
                      </div>
                      <div {...stylex.props(styles.detailRow)}>
                        <dt {...stylex.props(styles.detailTerm)}>% of parent</dt>
                        <dd {...stylex.props(styles.detailDescription)}>
                          {pct(detail.value, detail.parentValue)}
                        </dd>
                      </div>
                      <div {...stylex.props(styles.detailRow)}>
                        <dt {...stylex.props(styles.detailTerm)}>% of total</dt>
                        <dd {...stylex.props(styles.detailDescription)}>
                          {pct(detail.value, total)}
                        </dd>
                      </div>
                      <div {...stylex.props(styles.detailRow)}>
                        <dt {...stylex.props(styles.detailTerm)}>children</dt>
                        <dd {...stylex.props(styles.detailDescription)}>{detail.childCount}</dd>
                      </div>
                      <div {...stylex.props(styles.detailRow)}>
                        <dt {...stylex.props(styles.detailTerm)}>leaves</dt>
                        <dd {...stylex.props(styles.detailDescription)}>{detail.leafCount}</dd>
                      </div>
                    </dl>
                  )}
                </>
              )}
            </div>

            {/* Permanent colour legend: explains the ACTIVE `colorBy` encoding using
              the SAME token mapping the tiles use (groupColor / DEPTH_RAMP / VALUE_RAMP). */}
            <div {...stylex.props(styles.legend)} aria-label="Colour legend">
              <div {...stylex.props(styles.legendHead)}>
                colour <span {...stylex.props(styles.legendMode)}>{colorLabel}</span>
              </div>
              {colorBy === 'group' ? (
                <ul {...stylex.props(styles.legendGroups)}>
                  {(anchor.node.children ?? []).slice(0, LEGEND_GROUP_CAP).map((c, i) => {
                    const sw = groupColor(i)
                    return (
                      <li key={c.id} {...stylex.props(styles.legendItem)}>
                        <span
                          {...stylex.props(
                            styles.legendSwatch,
                            styles.legendSwatchColor(sw.fill, sw.stroke),
                          )}
                          aria-hidden="true"
                        />
                        <span {...stylex.props(styles.legendLabel)}>{c.label}</span>
                      </li>
                    )
                  })}
                  {(anchor.node.children?.length ?? 0) > LEGEND_GROUP_CAP ? (
                    <li {...stylex.props(styles.legendItem, styles.legendMore)}>
                      +{(anchor.node.children?.length ?? 0) - LEGEND_GROUP_CAP} more groups
                    </li>
                  ) : null}
                  {(anchor.node.children?.length ?? 0) === 0 ? (
                    <li {...stylex.props(styles.legendItem, styles.legendMore)}>
                      no sub-groups at this level
                    </li>
                  ) : null}
                </ul>
              ) : (
                <div {...stylex.props(styles.legendRampWrap)}>
                  <span
                    {...stylex.props(
                      styles.legendRamp,
                      styles.legendRampColor(
                        rampCss(colorBy === 'depth' ? DEPTH_RAMP : VALUE_RAMP),
                      ),
                    )}
                    aria-hidden="true"
                  />
                  <div {...stylex.props(styles.legendRampEnds)}>
                    <span>
                      {colorBy === 'depth' ? 'depth 0' : formatMagnitude(valueDomain.min, unit)}
                    </span>
                    <span>
                      {colorBy === 'depth'
                        ? `depth ${maxDepthRel}`
                        : formatMagnitude(valueDomain.max, unit, valueNoun)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

/**
 * Configures the treemap: stable id, model, and lens list with defaults, initially excluded ids,
 * an optional custom detail renderer and depth-indicator variant, and callbacks fired on tile
 * pinning and leaf activation.
 */
export interface TreemapProps {
  readonly id: string
  readonly model: TreemapModel
  readonly lenses: readonly TreemapLens[]
  readonly defaultLensId?: string
  readonly defaultExcludedIds?: readonly string[]
  readonly renderDetail?: ComponentType<TreemapDetailProps>
  readonly depthIndicator?: DepthIndicatorVariant
  /** Fires when the pinned tile changes (click, Space, focus) and with `undefined` when cleared. */
  readonly onSelect?: (selection: TreemapSelection | undefined) => void
  /** Fires when a leaf is "opened" (Enter or double-click); containers drill instead. */
  readonly onActivate?: (selection: TreemapSelection) => void
  /** CSS height of the tile canvas; overrides the default `clamp(22rem, 58cqw, 34rem)`. */
  readonly canvasHeight?: string
  readonly chrome?: TreemapChrome
  /**
   * Zoom root owned by the consumer; when it changes the map re-roots to it
   * (`undefined` = model root). Drills report through `onSelect`, so a consumer
   * can mirror them back into this prop.
   */
  readonly rootId?: string | undefined
  /** Controlled render-depth cap. Defaults to the active lens's `maxDepth`. */
  readonly maxDepth?: number | undefined
  /** Called when the built-in depth stepper changes the render-depth cap. */
  readonly onMaxDepthChange?: ((maxDepth: number) => void) | undefined
  /** Show the built-in depth stepper. Defaults to on for `full` chrome and off for `compact`. */
  readonly showDepthControl?: boolean | undefined
  /** Consumer-owned hidden leaf ids (`root/<path>`); pair with `onExcludedIdsChange`. */
  readonly excludedIds?: ReadonlySet<string> | undefined
  readonly onExcludedIdsChange?: ((next: ReadonlySet<string>) => void) | undefined
  /** Show the hide/show filter panel button; defaults to on for `full` chrome, off for `compact`. */
  readonly filter?: boolean | undefined
  /** Custom value cell for filter-panel rows (e.g. churn instead of the magnitude). */
  readonly filterRenderValue?: ((node: TreemapNode, leafCount: number) => ReactNode) | undefined
  /** Consumer controls rendered in the controls row, right after the filter button. */
  readonly controls?: ReactNode | undefined
  /** Option-click or Delete on a tile: the consumer hides that node (e.g. adds it to `excludedIds`). */
  readonly onHide?: ((selection: TreemapSelection) => void) | undefined
  /** Option+Shift-click on a tile: keep only that node. */
  readonly onSolo?: ((selection: TreemapSelection) => void) | undefined
  readonly caption?: string
  readonly style?: StyleXStylesWithout<{ position: string }>
}

// oxlint-disable-next-line overeng/exports-first -- public component composed from local views
/**
 * Renders a lens-driven treemap over the supplied model, managing lens switching, exclusion
 * filtering, tile pinning and drill-down, and delegating detail presentation to the optional
 * renderer.
 */
export const Treemap = ({
  id,
  model,
  lenses,
  defaultLensId,
  defaultExcludedIds,
  renderDetail,
  depthIndicator,
  onSelect,
  onActivate,
  canvasHeight,
  chrome,
  rootId,
  maxDepth,
  onMaxDepthChange,
  showDepthControl,
  excludedIds,
  onExcludedIdsChange,
  filter,
  filterRenderValue,
  controls,
  onHide,
  onSolo,
  caption,
  style,
}: TreemapProps) => {
  if (lenses.length === 0) {
    return <div {...stylex.props(styles.missing, style)}>treemap: no lenses defined for "{id}"</div>
  }
  return (
    <figure
      {...stylex.props(styles.figure, canvasHeight === '100%' && styles.figureFill, style)}
      id={id}
    >
      <Inner
        id={id}
        model={model}
        lenses={lenses}
        {...(defaultLensId === undefined ? {} : { defaultLensId })}
        {...(defaultExcludedIds === undefined ? {} : { defaultExcludedIds })}
        {...(renderDetail === undefined ? {} : { renderDetail })}
        {...(depthIndicator === undefined ? {} : { depthIndicator })}
        {...(onSelect === undefined ? {} : { onSelect })}
        {...(onActivate === undefined ? {} : { onActivate })}
        {...(canvasHeight === undefined ? {} : { canvasHeight })}
        {...(chrome === undefined ? {} : { chrome })}
        rootId={rootId}
        maxDepth={maxDepth}
        onMaxDepthChange={onMaxDepthChange}
        {...(showDepthControl === undefined ? {} : { showDepthControl })}
        excludedIds={excludedIds}
        onExcludedIdsChange={onExcludedIdsChange}
        {...(filter === undefined ? {} : { filter })}
        filterRenderValue={filterRenderValue}
        controls={controls}
        onHide={onHide}
        onSolo={onSolo}
      />
      {caption ? <figcaption {...stylex.props(styles.caption)}>{caption}</figcaption> : null}
    </figure>
  )
}
