/**
 * Ordered PDF/scanned-page lens. Combined shows one strip of merged page cards (after
 * render + per-page mark); side by side shows two aligned page columns. Selecting a page
 * opens its pair in a nested `ImageDiff`.
 *
 * Page identity is the render's `contentHash` only (never the URL), and `pageCount` per
 * side keeps unrendered pages visible as placeholders so a 6-page PDF with 3 renders
 * never reads as 3 → 3. Pages are not line-oriented, so `@pierre/diffs` does not apply;
 * selection is React Aria `GridList`, the unchanged fold a React Aria `Disclosure`.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  Disclosure,
  DisclosurePanel,
  GridLayout,
  GridList,
  GridListItem,
  Heading,
  ListLayout,
  Size,
  Virtualizer,
  type GridLayoutOptions,
  type ListLayoutOptions,
  type Selection,
} from 'react-aria-components'

import type { ChangeCounts, ChangeKind, DiffSide } from './contract.ts'
import { ChangeMark, DiffFrame, useDiffArrangement } from './DiffFrame.tsx'
import {
  ImageDiff,
  ImageThumb,
  defaultImageDiffThresholds,
  imageVerdictKind,
  lensFrameProps,
  settledDefault,
  useImageVerdicts,
  type DifferenceStyle,
  type ImageCombinedMode,
  type ImageSource,
  type ImageVerdict,
  type ImageVerdictRequest,
  type LensFrameProps,
} from './ImageDiff.tsx'

// ---------------------------------------------------------------------------
// Model (pure, React-free)
// ---------------------------------------------------------------------------

/** One page render; `contentHash` is a digest of the rendered content and the page's identity. */
export interface PageImage extends ImageSource {
  readonly label?: string | undefined
}

/**
 * One side of a page set. `pages` are renders of the leading pages; `pageCount` is the
 * document's real page count (defaults to `pages.length`), the rest become placeholders.
 */
export interface PageSetSide {
  readonly pages: readonly PageImage[]
  readonly pageCount?: number | undefined
}

/** What one side of a pair holds. */
export type PageSlot =
  | { readonly _tag: 'Absent' }
  /** The page exists (within `pageCount`) but was not rendered. */
  | { readonly _tag: 'Unrendered' }
  | { readonly _tag: 'Rendered'; readonly image: PageImage }

/** What is known about a pair before any pixel work. */
export type PairStatus =
  /** `hash`: same bytes (unchanged, or moved when reordered); `presence`: added/removed page. */
  | { readonly _tag: 'Known'; readonly kind: ChangeKind; readonly basis: 'hash' | 'presence' }
  | { readonly _tag: 'NeedsPixels' }
  | { readonly _tag: 'Unrendered' }

/** Aligned page pair. Indices are zero-based; `undefined` means the page does not exist on that side. */
export interface PagePair {
  readonly key: string
  readonly beforeIndex: number | undefined
  readonly afterIndex: number | undefined
  readonly before: PageSlot
  readonly after: PageSlot
  readonly status: PairStatus
}

/** Page matching mode. `index` pairs equal positions; `content` anchors equal hashes across insertions/reorders. */
export type PageAlignment = 'index' | 'content'

/** Resolved state of one pair: the pixel verdict where one was needed. */
export type PageVerdict =
  | ImageVerdict
  | { readonly _tag: 'Known'; readonly kind: ChangeKind }
  | { readonly _tag: 'Unrendered' }

/** A pair with its resolved verdict and kind (`undefined` while pending, failed or unrendered). */
export interface PageEntry {
  readonly pair: PagePair
  readonly verdict: PageVerdict
  readonly kind: ChangeKind | undefined
}

/** A pure page-set comparison. */
export interface PageSetModel {
  readonly entries: readonly PageEntry[]
  readonly counts: ChangeCounts
  readonly pending: number
  readonly unrendered: number
  readonly failed: number
}

const slotsOf = (side: PageSetSide): readonly PageSlot[] =>
  Array.from({ length: Math.max(side.pages.length, side.pageCount ?? 0) }, (_, index): PageSlot => {
    const image = side.pages[index]
    return image === undefined ? { _tag: 'Unrendered' } : { _tag: 'Rendered', image }
  })

const slotHash = (slot: PageSlot | undefined): string | undefined =>
  slot?._tag === 'Rendered' ? slot.image.contentHash : undefined

const sameContent = (a: PageSlot | undefined, b: PageSlot | undefined): boolean => {
  const hash = slotHash(a)
  return hash !== undefined && hash === slotHash(b)
}

const pairStatus = (before: PageSlot, after: PageSlot): PairStatus => {
  if (before._tag === 'Absent') return { _tag: 'Known', kind: 'added', basis: 'presence' }
  if (after._tag === 'Absent') return { _tag: 'Known', kind: 'removed', basis: 'presence' }
  if (before._tag === 'Unrendered' || after._tag === 'Unrendered') return { _tag: 'Unrendered' }
  return sameContent(before, after)
    ? { _tag: 'Known', kind: 'unchanged', basis: 'hash' }
    : { _tag: 'NeedsPixels' }
}

const absent: PageSlot = { _tag: 'Absent' }

const pagePair = (
  before: readonly PageSlot[],
  after: readonly PageSlot[],
  beforeIndex: number | undefined,
  afterIndex: number | undefined,
): PagePair => {
  const b = beforeIndex === undefined ? absent : (before[beforeIndex] ?? absent)
  const a = afterIndex === undefined ? absent : (after[afterIndex] ?? absent)
  return {
    key: `${beforeIndex ?? '-'}:${afterIndex ?? '-'}:${slotHash(b) ?? (b._tag === 'Rendered' ? b.image.src : b._tag)}:${slotHash(a) ?? (a._tag === 'Rendered' ? a.image.src : a._tag)}`,
    beforeIndex,
    afterIndex,
    before: b,
    after: a,
    status: pairStatus(b, a),
  }
}

/** Longest common subsequence of hashed pages, used as stable anchors for content alignment. */
const matchingAnchors = (
  before: readonly PageSlot[],
  after: readonly PageSlot[],
): readonly [number, number][] => {
  const cols = after.length + 1
  const lengths = new Uint32Array((before.length + 1) * cols)
  const at = (i: number, j: number): number => lengths[i * cols + j] ?? 0
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i * cols + j] = sameContent(before[i], after[j])
        ? 1 + at(i + 1, j + 1)
        : Math.max(at(i + 1, j), at(i, j + 1))
    }
  }
  const anchors: [number, number][] = []
  let i = 0
  let j = 0
  while (i < before.length && j < after.length) {
    if (sameContent(before[i], after[j])) anchors.push([i++, j++])
    else if (at(i + 1, j) >= at(i, j + 1)) i++
    else j++
  }
  return anchors
}

/**
 * Align two ordered page sets by index, or by hash anchors with positional pairing inside
 * unmatched gaps. Unrendered pages take part positionally. A page with an equal hash but
 * reordered across anchors is reported as `moved` (not as a removed+added pair).
 */
export const alignPageSets = (
  beforeSide: PageSetSide,
  afterSide: PageSetSide,
  alignment: PageAlignment = 'index',
): readonly PagePair[] => {
  const before = slotsOf(beforeSide)
  const after = slotsOf(afterSide)
  if (alignment === 'index') {
    return Array.from({ length: Math.max(before.length, after.length) }, (_, index) =>
      pagePair(
        before,
        after,
        index < before.length ? index : undefined,
        index < after.length ? index : undefined,
      ),
    )
  }

  const pairedBefore = new Set<number>()
  const pairedAfter = new Set<number>()
  const mapped: PagePair[] = []
  let previousBefore = -1
  let previousAfter = -1
  const pairUp = (i: number | undefined, j: number | undefined) => {
    mapped.push(pagePair(before, after, i, j))
    if (i !== undefined && j !== undefined) {
      pairedBefore.add(i)
      pairedAfter.add(j)
    }
  }

  for (const [end, endAfter] of [
    ...matchingAnchors(before, after),
    [before.length, after.length] as const,
  ]) {
    const gapBefore = Array.from(
      { length: end - previousBefore - 1 },
      (_, n) => previousBefore + 1 + n,
    )
    const gapAfter = Array.from(
      { length: endAfter - previousAfter - 1 },
      (_, n) => previousAfter + 1 + n,
    )
    const paired = Math.min(gapBefore.length, gapAfter.length)
    for (let n = 0; n < paired; n++) pairUp(gapBefore[n], gapAfter[n])
    for (const i of gapBefore.slice(paired)) pairUp(i, undefined)
    for (const j of gapAfter.slice(paired)) pairUp(undefined, j)
    if (end < before.length && endAfter < after.length) pairUp(end, endAfter)
    previousBefore = end
    previousAfter = endAfter
  }

  // Recover hashed pages that crossed an LCS anchor: removed+added with equal hash is a move.
  const unpairedAfterByHash = new Map<string, number[]>()
  after.forEach((slot, j) => {
    const hash = slotHash(slot)
    if (hash === undefined || pairedAfter.has(j)) return
    unpairedAfterByHash.set(hash, [...(unpairedAfterByHash.get(hash) ?? []), j])
  })
  const moves = new Map<number, number>()
  before.forEach((slot, i) => {
    const hash = slotHash(slot)
    if (hash === undefined || pairedBefore.has(i)) return
    const j = unpairedAfterByHash.get(hash)?.shift()
    if (j !== undefined) moves.set(i, j)
  })
  const movedAfter = new Set(moves.values())
  return mapped.flatMap((pair): PagePair[] => {
    const j =
      pair.beforeIndex === undefined || pair.afterIndex !== undefined
        ? undefined
        : moves.get(pair.beforeIndex)
    if (j !== undefined) {
      const moved = pagePair(before, after, pair.beforeIndex, j)
      return [{ ...moved, status: { _tag: 'Known', kind: 'moved', basis: 'hash' } }]
    }
    return pair.beforeIndex === undefined &&
      pair.afterIndex !== undefined &&
      movedAfter.has(pair.afterIndex)
      ? []
      : [pair]
  })
}

/** Pixel request for a pair that needs one, else `undefined`. */
export const pagePixelRequest = (
  pair: PagePair,
  thresholds: { readonly tolerance: number; readonly minChangedRatio: number },
): ImageVerdictRequest | undefined =>
  pair.status._tag === 'NeedsPixels' &&
  pair.before._tag === 'Rendered' &&
  pair.after._tag === 'Rendered'
    ? { before: pair.before.image, after: pair.after.image, ...thresholds }
    : undefined

/**
 * Resolve pairs against pixel verdicts (keyed by pair key) and count. Pending, failed and
 * unrendered pairs are never counted as changed; they are exposed separately.
 */
export const pageSetModel = (
  pairs: readonly PagePair[],
  pixelVerdicts: ReadonlyMap<string, ImageVerdict>,
): PageSetModel => {
  const counts: Partial<Record<ChangeKind, number>> = {}
  let pending = 0
  let unrendered = 0
  let failed = 0
  const entries = pairs.map((pair): PageEntry => {
    const verdict: PageVerdict =
      pair.status._tag === 'Known'
        ? pair.status.basis === 'hash' && pair.status.kind === 'unchanged'
          ? { _tag: 'SameBytes', contentHash: slotHash(pair.before) ?? '' }
          : { _tag: 'Known', kind: pair.status.kind }
        : pair.status._tag === 'Unrendered'
          ? { _tag: 'Unrendered' }
          : (pixelVerdicts.get(pair.key) ?? { _tag: 'Pending' })
    const kind =
      verdict._tag === 'Known'
        ? verdict.kind
        : verdict._tag === 'Unrendered'
          ? undefined
          : imageVerdictKind(verdict)
    if (kind !== undefined) counts[kind] = (counts[kind] ?? 0) + 1
    else if (verdict._tag === 'Unrendered') unrendered++
    else if (verdict._tag === 'Failed') failed++
    else pending++
    return { pair, verdict, kind }
  })
  return { entries, counts, pending, unrendered, failed }
}

/**
 * Default page of a page set: the first pair that is not unchanged (added, removed, moved,
 * changed, failed or unrendered), decided in page order once every earlier pair has settled.
 */
export const pageSetDefault = (entries: readonly PageEntry[]): PageEntry | undefined =>
  settledDefault(entries, (entry) =>
    entry.verdict._tag === 'Pending'
      ? 'pending'
      : entry.kind === 'unchanged'
        ? 'quiet'
        : 'attention',
  )

/** `N pages` or `N pages (M rendered)`. */
export const describePageSide = (side: PageSetSide): string => {
  const count = Math.max(side.pages.length, side.pageCount ?? 0)
  return `${count} ${count === 1 ? 'page' : 'pages'}${side.pages.length < count ? ` (${side.pages.length} rendered)` : ''}`
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Combined-arrangement layout of the page cards. */
export type PageSetLayout =
  /** One horizontal, scrollable strip in page order. */
  | 'filmstrip'
  /** Wrapping grid of page cards in page order. */
  | 'grid'
  /** Only pages that need attention; unchanged pages folded behind "N unchanged". */
  | 'changed'

/** Props for `PageSetDiff`. */
export interface PageSetDiffProps extends LensFrameProps {
  readonly title: React.ReactNode
  readonly before: DiffSide
  readonly after: DiffSide
  readonly beforePages: readonly PageImage[]
  readonly afterPages: readonly PageImage[]
  /** Real page count per side; pages beyond the renders are shown as placeholders. */
  readonly beforePageCount?: number | undefined
  readonly afterPageCount?: number | undefined
  readonly alignment?: PageAlignment | undefined
  readonly tolerance?: number | undefined
  readonly minChangedRatio?: number | undefined
  /** Card layout in the combined arrangement. */
  readonly combinedLayout?: PageSetLayout | undefined
  /** Initial combined mode of the selected page's `ImageDiff`. */
  readonly defaultImageMode?: ImageCombinedMode | undefined
  readonly differenceStyle?: DifferenceStyle | undefined
}

const pageNumber = (index: number | undefined) => (index === undefined ? '—' : String(index + 1))

const pageLabel = (pair: PagePair): string => {
  const before = pageNumber(pair.beforeIndex)
  const after = pageNumber(pair.afterIndex)
  return before === after ? `Page ${before}` : `Page ${before} → ${after}`
}

const slotImage = (slot: PageSlot): PageImage | undefined =>
  slot._tag === 'Rendered' ? slot.image : undefined

const slotPlaceholder = (slot: PageSlot): string =>
  slot._tag === 'Unrendered' ? 'Not rendered' : 'No page'

const entryLabel = (entry: PageEntry): string => {
  switch (entry.verdict._tag) {
    case 'Known':
      return entry.verdict.kind
    case 'Unrendered':
      return 'not rendered'
    case 'SameBytes':
      return 'unchanged · same bytes'
    case 'Pending':
      return 'comparing…'
    case 'Failed':
      return 'unavailable'
    case 'Compared':
      return entry.verdict.kind === 'changed'
        ? 'changed'
        : entry.verdict.bytes === 'different'
          ? 'same render · different bytes'
          : 'no visible change'
  }
}

const EntryMark = ({ entry }: { readonly entry: PageEntry }) =>
  entry.kind === undefined || entry.kind === 'unchanged' ? (
    <span {...stylex.props(styles.quiet, entry.verdict._tag === 'Failed' && styles.error)}>
      {entryLabel(entry)}
    </span>
  ) : (
    <ChangeMark kind={entry.kind}>{entryLabel(entry)}</ChangeMark>
  )

/** Page-set diff with a selectable page list and a nested image lens for the selected pair. */
export const PageSetDiff = ({
  title,
  before,
  after,
  beforePages,
  afterPages,
  beforePageCount,
  afterPageCount,
  alignment = 'index',
  tolerance = defaultImageDiffThresholds.tolerance,
  minChangedRatio = defaultImageDiffThresholds.minChangedRatio,
  combinedLayout = 'filmstrip',
  defaultImageMode = 'difference',
  differenceStyle = 'pixels',
  ...frame
}: PageSetDiffProps) => {
  const beforeSide = { pages: beforePages, pageCount: beforePageCount }
  const afterSide = { pages: afterPages, pageCount: afterPageCount }
  const pairs = React.useMemo(
    () =>
      alignPageSets(
        { pages: beforePages, pageCount: beforePageCount },
        { pages: afterPages, pageCount: afterPageCount },
        alignment,
      ),
    [beforePages, afterPages, beforePageCount, afterPageCount, alignment],
  )
  const requests = pairs.flatMap((pair) => {
    const request = pagePixelRequest(pair, { tolerance, minChangedRatio })
    return request === undefined ? [] : [{ key: pair.key, request }]
  })
  const results = useImageVerdicts(requests.map(({ request }) => request))
  const model = pageSetModel(
    pairs,
    new Map(requests.map(({ key }, index) => [key, results[index] ?? { _tag: 'Pending' }])),
  )

  return (
    <DiffFrame
      {...lensFrameProps(frame)}
      title={title}
      lens="page set"
      before={before}
      after={after}
      counts={model.counts}
    >
      <PageSetBody
        before={before}
        after={after}
        summary={`${describePageSide(beforeSide)} → ${describePageSide(afterSide)}`}
        model={model}
        combinedLayout={combinedLayout}
        defaultImageMode={defaultImageMode}
        differenceStyle={differenceStyle}
        tolerance={tolerance}
        minChangedRatio={minChangedRatio}
      />
    </DiffFrame>
  )
}

const PageSetBody = ({
  before,
  after,
  summary,
  model,
  combinedLayout,
  defaultImageMode,
  differenceStyle,
  tolerance,
  minChangedRatio,
}: {
  readonly before: DiffSide
  readonly after: DiffSide
  readonly summary: string
  readonly model: PageSetModel
  readonly combinedLayout: PageSetLayout
  readonly defaultImageMode: ImageCombinedMode
  readonly differenceStyle: DifferenceStyle
  readonly tolerance: number
  readonly minChangedRatio: number
}) => {
  const arrangement = useDiffArrangement()
  const [selectedKey, setSelectedKey] = React.useState<string | undefined>(undefined)
  const [imageMode, setImageMode] = React.useState<ImageCombinedMode>(defaultImageMode)
  const selected =
    model.entries.find((entry) => entry.pair.key === selectedKey) ?? pageSetDefault(model.entries)
  const list = {
    tolerance,
    minChangedRatio,
    selectedKey: selected?.pair.key,
    onSelectionChange: (keys: Selection) => {
      if (keys === 'all') return
      const next = [...keys][0]
      if (next !== undefined) setSelectedKey(String(next))
    },
  }
  const notes = [
    model.unrendered > 0 ? `${model.unrendered} not rendered` : undefined,
    model.pending > 0 ? `${model.pending} comparing` : undefined,
    model.failed > 0 ? `${model.failed} unavailable` : undefined,
  ].filter((note) => note !== undefined)

  return (
    <div {...stylex.props(styles.body)}>
      <p {...stylex.props(styles.summary)}>{[summary, ...notes].join(' · ')}</p>
      {model.entries.length === 0 ? (
        <p {...stylex.props(styles.empty)}>No pages on either side.</p>
      ) : arrangement === 'split' ? (
        <PageColumns before={before} after={after} entries={model.entries} {...list} />
      ) : combinedLayout === 'changed' ? (
        <ChangedPages entries={model.entries} {...list} />
      ) : (
        <PageCards label="Pages" entries={model.entries} layout={combinedLayout} {...list} />
      )}
      {selected === undefined ? null : (
        <SelectedPage
          entry={selected}
          before={before}
          after={after}
          imageMode={imageMode}
          onImageModeChange={setImageMode}
          differenceStyle={differenceStyle}
          tolerance={tolerance}
          minChangedRatio={minChangedRatio}
        />
      )}
    </div>
  )
}

interface PageListProps {
  readonly entries: readonly PageEntry[]
  readonly selectedKey: string | undefined
  readonly onSelectionChange: (keys: Selection) => void
  readonly tolerance: number
  readonly minChangedRatio: number
}

/**
 * Lists longer than this mount through a React Aria `Virtualizer` (viewport plus overscan
 * only; keyboard focus and selection follow the layout, not the DOM). Shorter lists, such
 * as P3's changed pages, render in full with plain CSS layout.
 */
const virtualizeAbove = 24

/** Pixel metrics mirror the CSS below: 150px cards, `space2` (8px) gaps, 2px ring room. */
const filmstripLayoutOptions: ListLayoutOptions = {
  orientation: 'horizontal',
  rowSize: 150,
  gap: 8,
  padding: 2,
}
const cardGridLayoutOptions: GridLayoutOptions = {
  minItemSize: new Size(150, 172),
  maxItemSize: new Size(Number.POSITIVE_INFINITY, 172),
  minSpace: new Size(8, 8),
}
/** Row: 120px thumb + `space1` padding + border; `space1` gap. Measured after mount. */
const pageRowLayoutOptions: ListLayoutOptions = { estimatedRowSize: 130, gap: 4 }

const selectionOf = (selectedKey: string | undefined): readonly string[] =>
  selectedKey === undefined ? [] : [selectedKey]

/** Combined card: the page once (after render, before render dimmed if removed) with its mark. */
const PageCards = ({
  label,
  entries,
  layout,
  selectedKey,
  onSelectionChange,
  tolerance,
  minChangedRatio,
}: PageListProps & { readonly label: string; readonly layout: PageSetLayout }) => {
  const virtualized = entries.length > virtualizeAbove
  const filmstrip = layout === 'filmstrip'
  const items = React.useMemo(
    () =>
      entries.map((entry) => {
        const shown = entry.pair.after._tag === 'Absent' ? entry.pair.before : entry.pair.after
        return (
          <GridListItem
            key={entry.pair.key}
            id={entry.pair.key}
            textValue={`${pageLabel(entry.pair)}: ${entryLabel(entry)}`}
            {...stylex.props(styles.card, virtualized && styles.cardFill, styles.ring)}
          >
            <ImageThumb
              image={slotImage(shown)}
              placeholder={slotPlaceholder(shown)}
              mark={entry.kind}
              dimmed={entry.kind === 'removed'}
              verdictRequest={pagePixelRequest(entry.pair, { tolerance, minChangedRatio })}
            />
            <span {...stylex.props(styles.cardFooter)}>
              <strong>{pageLabel(entry.pair)}</strong>
              <EntryMark entry={entry} />
            </span>
          </GridListItem>
        )
      }),
    [entries, tolerance, minChangedRatio, virtualized],
  )
  const list = (
    <GridList
      aria-label={label}
      layout="grid"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selectionOf(selectedKey)}
      onSelectionChange={onSelectionChange}
      {...stylex.props(
        virtualized
          ? filmstrip
            ? styles.filmstripWindow
            : styles.cardGridWindow
          : filmstrip
            ? styles.filmstrip
            : styles.cardGrid,
      )}
    >
      {items}
    </GridList>
  )
  if (!virtualized) return list
  return filmstrip ? (
    <Virtualizer layout={ListLayout} layoutOptions={filmstripLayoutOptions}>
      {list}
    </Virtualizer>
  ) : (
    <Virtualizer layout={GridLayout} layoutOptions={cardGridLayoutOptions} shouldObserveItemSize>
      {list}
    </Virtualizer>
  )
}

/** P3: pages needing attention first; unchanged pages folded behind a disclosure. */
const ChangedPages = ({
  entries,
  selectedKey,
  onSelectionChange,
  tolerance,
  minChangedRatio,
}: PageListProps) => {
  const attention = entries.filter((entry) => entry.kind !== 'unchanged')
  const unchanged = entries.filter((entry) => entry.kind === 'unchanged')
  return (
    <div {...stylex.props(styles.body)}>
      {attention.length === 0 ? (
        <p {...stylex.props(styles.empty)}>Every page is unchanged.</p>
      ) : (
        <PageCards
          label="Changed pages"
          entries={attention}
          layout="grid"
          selectedKey={selectedKey}
          onSelectionChange={onSelectionChange}
          tolerance={tolerance}
          minChangedRatio={minChangedRatio}
        />
      )}
      {unchanged.length === 0 ? null : (
        <Disclosure {...stylex.props(styles.fold)}>
          <Heading level={4} {...stylex.props(styles.foldHeading)}>
            <Button slot="trigger" {...stylex.props(styles.foldTrigger, styles.ring)}>
              {unchanged.length} unchanged {unchanged.length === 1 ? 'page' : 'pages'}
            </Button>
          </Heading>
          <DisclosurePanel>
            <PageCards
              label="Unchanged pages"
              entries={unchanged}
              layout="grid"
              selectedKey={selectedKey}
              onSelectionChange={onSelectionChange}
              tolerance={tolerance}
              minChangedRatio={minChangedRatio}
            />
          </DisclosurePanel>
        </Disclosure>
      )}
    </div>
  )
}

/** Side by side: two aligned page columns, one selectable row per pair, windowed together under one scroller. */
const PageColumns = ({
  before,
  after,
  entries,
  selectedKey,
  onSelectionChange,
  tolerance,
  minChangedRatio,
}: PageListProps & { readonly before: DiffSide; readonly after: DiffSide }) => {
  const items = React.useMemo(
    () =>
      entries.map((entry) => (
        <GridListItem
          key={entry.pair.key}
          id={entry.pair.key}
          textValue={`${pageLabel(entry.pair)}: ${entryLabel(entry)}`}
          {...stylex.props(styles.row, styles.ring)}
        >
          <ImageThumb
            image={slotImage(entry.pair.before)}
            placeholder={slotPlaceholder(entry.pair.before)}
            caption={`p${pageNumber(entry.pair.beforeIndex)}`}
            mark={entry.kind === 'removed' ? 'removed' : undefined}
            verdictRequest={pagePixelRequest(entry.pair, { tolerance, minChangedRatio })}
          />
          <span {...stylex.props(styles.rowVerdict)}>
            <strong>{pageLabel(entry.pair)}</strong>
            <EntryMark entry={entry} />
          </span>
          <ImageThumb
            image={slotImage(entry.pair.after)}
            placeholder={slotPlaceholder(entry.pair.after)}
            caption={`p${pageNumber(entry.pair.afterIndex)}`}
            mark={entry.kind === 'removed' ? undefined : entry.kind}
          />
        </GridListItem>
      )),
    [entries, tolerance, minChangedRatio],
  )
  const list = (
    <GridList
      aria-label="Page pairs"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selectionOf(selectedKey)}
      onSelectionChange={onSelectionChange}
      {...stylex.props(styles.rows)}
    >
      {items}
    </GridList>
  )
  return (
    <div {...stylex.props(styles.columns)}>
      <div aria-hidden {...stylex.props(styles.columnsHeader)}>
        <span>{before.label}</span>
        <span />
        <span>{after.label}</span>
      </div>
      {entries.length > virtualizeAbove ? (
        <Virtualizer layout={ListLayout} layoutOptions={pageRowLayoutOptions} shouldObserveItemSize>
          {list}
        </Virtualizer>
      ) : (
        list
      )}
    </div>
  )
}

const SelectedPage = ({
  entry,
  before,
  after,
  imageMode,
  onImageModeChange,
  differenceStyle,
  tolerance,
  minChangedRatio,
}: {
  readonly entry: PageEntry
  readonly before: DiffSide
  readonly after: DiffSide
  readonly imageMode: ImageCombinedMode
  readonly onImageModeChange: (mode: ImageCombinedMode) => void
  readonly differenceStyle: DifferenceStyle
  readonly tolerance: number
  readonly minChangedRatio: number
}) => {
  const { pair } = entry
  if (pair.before._tag === 'Unrendered' || pair.after._tag === 'Unrendered') {
    return (
      <p {...stylex.props(styles.empty, styles.placeholderNote)}>
        {pageLabel(pair)} exists but was not rendered{' '}
        {pair.before._tag === 'Unrendered' && pair.after._tag === 'Unrendered'
          ? 'on either side'
          : pair.before._tag === 'Unrendered'
            ? `in ${before.label}`
            : `in ${after.label}`}
        ; render it to compare.
      </p>
    )
  }
  return (
    <ImageDiff
      key={pair.key}
      title={pageLabel(pair)}
      before={{ ...before, label: `${before.label} · p${pageNumber(pair.beforeIndex)}` }}
      after={{ ...after, label: `${after.label} · p${pageNumber(pair.afterIndex)}` }}
      beforeImage={slotImage(pair.before)}
      afterImage={slotImage(pair.after)}
      mode={imageMode}
      onModeChange={onImageModeChange}
      differenceStyle={differenceStyle}
      tolerance={tolerance}
      minChangedRatio={minChangedRatio}
      nested
    />
  )
}

const styles = stylex.create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space3,
    minWidth: 0,
  },
  summary: {
    margin: 0,
    fontSize: 12,
    color: tokens['--ds-gray-900'],
  },
  empty: {
    margin: 0,
    padding: scale.space4,
    fontSize: 13,
    color: tokens['--ds-gray-900'],
    textAlign: 'center',
  },
  quiet: {
    color: tokens['--ds-gray-900'],
  },
  error: {
    color: tokens['--ds-red-900'],
  },
  placeholderNote: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
  },
  ring: {
    outlineWidth: {
      default: 0,
      ':is([data-focus-visible])': 2,
    },
    outlineStyle: {
      default: 'none',
      ':is([data-focus-visible])': 'solid',
    },
    outlineColor: {
      default: 'transparent',
      ':is([data-focus-visible])': tokens['--ds-focus-color'],
    },
    outlineOffset: 2,
  },
  filmstrip: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 150,
    gap: scale.space2,
    padding: 2,
    paddingBottom: scale.space2,
    overflowX: 'auto',
    outline: 'none',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: scale.space2,
    padding: 2,
    outline: 'none',
  },
  /** Virtualized filmstrip: the list is its own horizontal scroller; `ListLayout` positions the cards. */
  filmstripWindow: {
    position: 'relative',
    height: 196,
    overflowX: 'auto',
    overflowY: 'hidden',
    outline: 'none',
    scrollbarColor: `${tokens['--ds-gray-alpha-400']} transparent`,
  },
  /** Virtualized grid: `GridLayout` positions the cards; the page scrolls it. */
  cardGridWindow: {
    position: 'relative',
    outline: 'none',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':is([data-selected])': tokens['--ds-blue-700'],
    },
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    boxShadow: {
      default: 'none',
      ':is([data-selected])': `0 0 0 1px ${tokens['--ds-blue-700']}`,
    },
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
  },
  cardFill: {
    boxSizing: 'border-box',
    height: '100%',
  },
  cardFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 11,
  },
  fold: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
  },
  foldHeading: {
    margin: 0,
  },
  foldTrigger: {
    paddingBlock: 4,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: 'transparent',
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-900'],
    fontFamily: scale.fontSans,
    fontSize: 12,
    cursor: 'pointer',
  },
  columns: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
  },
  columnsHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 150px minmax(0, 1fr)',
    gap: scale.space2,
    paddingInline: scale.space1,
    fontSize: 12,
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    outline: 'none',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 150px minmax(0, 1fr)',
    alignItems: 'center',
    gap: scale.space2,
    padding: scale.space1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: 'transparent',
      ':is([data-selected])': tokens['--ds-blue-700'],
    },
    borderRadius: scale.radiusSm,
    backgroundColor: {
      default: 'transparent',
      ':is([data-hovered])': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-1000'],
    cursor: 'pointer',
  },
  rowVerdict: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    fontSize: 11,
    textAlign: 'center',
  },
})
