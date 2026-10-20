/**
 * Trace lens: compares two OTel traces span-by-span. Spans are aligned by their
 * structural path (service + span name chain from the root, disambiguated by
 * sibling ordinal in start order). Combined arrangement: one merged waterfall with
 * before/after bars per span; side by side: two waterfalls on a shared time axis
 * with row-aligned spans. Deltas, status flips and attribute changes sit on each row.
 *
 * Not `@pierre/diffs`: a waterfall is a time/geometry view, not line-oriented text.
 * Span attributes stay a local key list instead of a nested `RecordDiff`: they are flat
 * string maps, and a full framed lens per span would dwarf the one-line waterfall row.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  Input,
  SearchField,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components'

import type { TraceData, TraceSpan } from '../../model.ts'
import type { ChangeCounts, ChangeKind, DiffArrangement, DiffFrameProps } from './contract.ts'
import { ChangeMark, DiffFrame, changeKindAccent, useDiffArrangement } from './DiffFrame.tsx'

/** Span outcome as recorded by the collector: `unset` covers spans that never reported a status. */
export type SpanStatus = 'ok' | 'error' | 'unset'

/** One side of an aligned span, with times relative to its own trace start. */
export interface TraceSpanSnapshot {
  readonly spanId: string
  readonly startMs: number
  readonly durationMs: number
  readonly status: SpanStatus
  readonly attributes: Readonly<Record<string, string>>
}

/** One attribute that differs between the two sides of an aligned span. */
export interface TraceAttributeChange {
  readonly key: string
  readonly kind: Extract<ChangeKind, 'added' | 'removed' | 'changed'>
  readonly before?: string
  readonly after?: string
}

/** One row of the merged waterfall: a span present on either or both sides. */
export interface TraceSpanDiff {
  /** Structural path of the span on the side it is shown at (after side when present). */
  readonly path: string
  readonly depth: number
  readonly serviceName: string
  readonly name: string
  readonly kind: ChangeKind
  readonly before?: TraceSpanSnapshot
  readonly after?: TraceSpanSnapshot
  /** After minus before duration; a whole added (+) or removed (-) span counts fully. */
  readonly deltaMs: number
  /** Relative duration change; absent when the span exists on one side only. */
  readonly deltaRatio?: number | undefined
  readonly durationChanged: boolean
  readonly statusChanged: boolean
  readonly attributeChanges: readonly TraceAttributeChange[]
  /** For `moved` spans: the parent chain the span lived under before, e.g. `api:GET /x`. */
  readonly movedFrom?: string
}

/** Thresholds that decide when a duration delta counts as a change. */
export interface TraceDiffThresholds {
  /** Minimum absolute delta in ms (default 2). */
  readonly ms?: number
  /** Minimum relative delta, 0.1 = 10% (default 0.1). */
  readonly ratio?: number
}

/** Result of `diffTraces`: merged rows in tree pre-order plus totals and counts. */
export interface TraceDiffModel {
  readonly rows: readonly TraceSpanDiff[]
  readonly counts: ChangeCounts
  readonly beforeTotalMs: number
  readonly afterTotalMs: number
}

interface IndexedSpan {
  readonly path: string
  readonly parentPath: string
  readonly depth: number
  readonly span: TraceSpan
  readonly snapshot: TraceSpanSnapshot
  /** Human-readable ancestor chain, used to describe moves. */
  readonly ancestry: string
}

const PATH_SEP = '\n'

const toNanos = (value: string): bigint => {
  try {
    return BigInt(value)
  } catch {
    return 0n
  }
}

const nanosToMs = (nanos: bigint): number => Number(nanos) / 1e6

const statusOf = (span: TraceSpan): SpanStatus => {
  const code = (span.statusCode ?? '').toUpperCase()
  if (code.includes('ERROR')) return 'error'
  if (code.includes('OK')) return 'ok'
  return 'unset'
}

const spanIdentity = (span: TraceSpan): string => `${span.serviceName}:${span.name}`

/**
 * Index a trace by structural path; orphans (unknown parent) become roots, and so does the
 * earliest span of any parent cycle (A under B under A), which no root would otherwise reach.
 */
const indexTrace = (trace: TraceData): { byPath: Map<string, IndexedSpan>; totalMs: number } => {
  const byPath = new Map<string, IndexedSpan>()
  if (trace.spans.length === 0) return { byPath, totalMs: 0 }
  const ids = new Set(trace.spans.map((span) => span.spanId))
  /** Parsed once per span: BigInt parsing inside the sort comparator dominated indexing. */
  const startOf = new Map<TraceSpan, bigint>()
  let t0 = toNanos(trace.spans[0]!.startTimeUnixNano)
  let t1 = toNanos(trace.spans[0]!.endTimeUnixNano)
  const children = new Map<string, TraceSpan[]>()
  for (const span of trace.spans) {
    const start = toNanos(span.startTimeUnixNano)
    const end = toNanos(span.endTimeUnixNano)
    startOf.set(span, start)
    if (start < t0) t0 = start
    if (end > t1) t1 = end
    const parent =
      span.parentSpanId !== '' && span.parentSpanId !== span.spanId && ids.has(span.parentSpanId)
        ? span.parentSpanId
        : ''
    const siblings = children.get(parent)
    if (siblings === undefined) children.set(parent, [span])
    else siblings.push(span)
  }
  const byStart = (a: TraceSpan, b: TraceSpan): number => {
    const d = startOf.get(a)! - startOf.get(b)!
    return d < 0n ? -1 : d > 0n ? 1 : 0
  }
  const visited = new Set<string>()
  /** Indexes one span under `parentPath`; `ordinals` disambiguates same-identity siblings. */
  const place = (
    span: TraceSpan,
    parentPath: string,
    ancestry: string,
    depth: number,
    ordinals: Map<string, number>,
  ) => {
    visited.add(span.spanId)
    const identity = spanIdentity(span)
    const ordinal = ordinals.get(identity) ?? 0
    ordinals.set(identity, ordinal + 1)
    const path = `${parentPath}${PATH_SEP}${identity}#${ordinal}`
    const start = startOf.get(span)!
    byPath.set(path, {
      path,
      parentPath,
      depth,
      span,
      ancestry,
      snapshot: {
        spanId: span.spanId,
        startMs: nanosToMs(start - t0),
        durationMs: Math.max(0, nanosToMs(toNanos(span.endTimeUnixNano) - start)),
        status: statusOf(span),
        attributes: Object.fromEntries((span.attributes ?? []).map((a) => [a.key, a.value])),
      },
    })
    visit(span.spanId, path, ancestry === '' ? identity : `${ancestry} > ${identity}`, depth + 1)
  }
  const visit = (
    parentId: string,
    parentPath: string,
    ancestry: string,
    depth: number,
    ordinals = new Map<string, number>(),
  ) => {
    for (const span of (children.get(parentId) ?? []).toSorted(byStart)) {
      if (!visited.has(span.spanId)) place(span, parentPath, ancestry, depth, ordinals)
    }
  }
  const rootOrdinals = new Map<string, number>()
  visit('', '', '', 0, rootOrdinals)
  const unreached = trace.spans.filter((span) => !visited.has(span.spanId))
  for (const span of unreached.toSorted(byStart)) {
    if (!visited.has(span.spanId)) place(span, '', '', 0, rootOrdinals)
  }
  return { byPath, totalMs: nanosToMs(t1 - t0) }
}

/** Key-wise attribute comparison; order-insensitive. */
export const diffSpanAttributes = (
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): readonly TraceAttributeChange[] => {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].toSorted()
  return keys.flatMap((key): TraceAttributeChange[] => {
    const b = before[key]
    const a = after[key]
    if (b === undefined && a !== undefined) return [{ key, kind: 'added', after: a }]
    if (b !== undefined && a === undefined) return [{ key, kind: 'removed', before: b }]
    if (b !== undefined && a !== undefined && a !== b)
      return [{ key, kind: 'changed', before: b, after: a }]
    return []
  })
}

const compareSides = (
  before: TraceSpanSnapshot,
  after: TraceSpanSnapshot,
  thresholds: Required<TraceDiffThresholds>,
) => {
  const deltaMs = after.durationMs - before.durationMs
  const deltaRatio = before.durationMs > 0 ? deltaMs / before.durationMs : undefined
  const durationChanged =
    Math.abs(deltaMs) >= thresholds.ms &&
    (deltaRatio === undefined || Math.abs(deltaRatio) >= thresholds.ratio)
  const statusChanged = before.status !== after.status
  const attributeChanges = diffSpanAttributes(before.attributes, after.attributes)
  return { deltaMs, deltaRatio, durationChanged, statusChanged, attributeChanges }
}

/**
 * Align two traces by structural path and compute the merged waterfall model.
 * A span whose path disappears on one side and whose `service:name` identity
 * reappears exactly once under a different parent chain is reported as `moved`
 * (re-parented) rather than removed + added; its descendants travel with it and
 * are compared at their new location.
 */
export const diffTraces = (
  before: TraceData,
  after: TraceData,
  thresholds: TraceDiffThresholds = {},
): TraceDiffModel => {
  const limits = { ms: thresholds.ms ?? 2, ratio: thresholds.ratio ?? 0.1 }
  const b = indexTrace(before)
  const a = indexTrace(after)

  const removedOnly = [...b.byPath.values()].filter((s) => !a.byPath.has(s.path))
  const addedOnly = [...a.byPath.values()].filter((s) => !b.byPath.has(s.path))
  const countBy = (list: readonly IndexedSpan[]) => {
    const counts = new Map<string, number>()
    for (const s of list) {
      const identity = spanIdentity(s.span)
      counts.set(identity, (counts.get(identity) ?? 0) + 1)
    }
    return counts
  }
  const removedCounts = countBy(removedOnly)
  const addedCounts = countBy(addedOnly)
  /** Unique removed span per identity; only identities occurring once on each side can move. */
  const removedByIdentity = new Map<string, IndexedSpan>()
  for (const s of removedOnly) removedByIdentity.set(spanIdentity(s.span), s)
  /** Paths start with `PATH_SEP`; yields the path itself and every ancestor path. */
  const selfAndAncestors = function* (path: string) {
    for (let i = path.indexOf(PATH_SEP, 1); i !== -1; i = path.indexOf(PATH_SEP, i + 1)) {
      yield path.slice(0, i)
    }
    yield path
  }
  /** Earliest registered root covering `path` (the root itself or any ancestor of it). */
  const coveringIndex = (path: string, roots: ReadonlyMap<string, number>) => {
    let found: number | undefined
    for (const prefix of selfAndAncestors(path)) {
      const index = roots.get(prefix)
      if (index !== undefined && (found === undefined || index < found)) found = index
    }
    return found
  }
  /** Moved subtree roots, found in pre-order so a moved parent claims its descendants. */
  const moves: { readonly from: IndexedSpan; readonly to: string }[] = []
  const moveIndexByFrom = new Map<string, number>()
  const moveIndexByTo = new Map<string, number>()
  for (const added of addedOnly) {
    const identity = spanIdentity(added.span)
    if (addedCounts.get(identity) !== 1 || removedCounts.get(identity) !== 1) continue
    const source = removedByIdentity.get(identity)!
    if (source.ancestry === added.ancestry) continue
    if (
      coveringIndex(source.path, moveIndexByFrom) !== undefined ||
      coveringIndex(added.path, moveIndexByTo) !== undefined
    ) {
      continue
    }
    moveIndexByFrom.set(source.path, moves.length)
    moveIndexByTo.set(added.path, moves.length)
    moves.push({ from: source, to: added.path })
  }
  const remap = (path: string) => {
    const index = coveringIndex(path, moveIndexByFrom)
    if (index === undefined) return path
    const move = moves[index]!
    return `${move.to}${path.slice(move.from.path.length)}`
  }
  const movedFrom = new Map(
    moves.map((m) => [m.to, m.from.ancestry === '' ? '(root)' : m.from.ancestry] as const),
  )
  const beforeByPath = new Map(
    [...b.byPath.values()].map(
      (s) => [remap(s.path), { ...s, parentPath: remap(s.parentPath) }] as const,
    ),
  )

  const order = new Map<string, number>()
  const parentOf = new Map<string, string>()
  for (const [path, s] of beforeByPath) {
    order.set(path, s.snapshot.startMs)
    parentOf.set(path, s.parentPath)
  }
  for (const s of a.byPath.values()) {
    order.set(s.path, s.snapshot.startMs)
    parentOf.set(s.path, s.parentPath)
  }
  const childrenOf = new Map<string, string[]>()
  for (const [path, parentPath] of parentOf) {
    const parent = parentOf.has(parentPath) ? parentPath : ''
    const siblings = childrenOf.get(parent)
    if (siblings === undefined) childrenOf.set(parent, [path])
    else siblings.push(path)
  }

  const rows: TraceSpanDiff[] = []
  const emit = (parentPath: string, depth: number) => {
    const kids = (childrenOf.get(parentPath) ?? []).toSorted(
      (x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0),
    )
    for (const path of kids) {
      const bs = beforeByPath.get(path)
      const as = a.byPath.get(path)
      const span = (as ?? bs)!.span
      const base = { path, depth, serviceName: span.serviceName, name: span.name }
      if (bs && as) {
        const cmp = compareSides(bs.snapshot, as.snapshot, limits)
        const moved = movedFrom.get(path)
        const kind: ChangeKind =
          moved !== undefined
            ? 'moved'
            : cmp.durationChanged || cmp.statusChanged || cmp.attributeChanges.length > 0
              ? 'changed'
              : 'unchanged'
        rows.push({
          ...base,
          ...cmp,
          kind,
          before: bs.snapshot,
          after: as.snapshot,
          ...(moved === undefined ? {} : { movedFrom: moved }),
        })
      } else if (as) {
        rows.push({
          ...base,
          kind: 'added',
          after: as.snapshot,
          deltaMs: as.snapshot.durationMs,
          durationChanged: true,
          statusChanged: false,
          attributeChanges: [],
        })
      } else if (bs) {
        rows.push({
          ...base,
          kind: 'removed',
          before: bs.snapshot,
          deltaMs: -bs.snapshot.durationMs,
          durationChanged: true,
          statusChanged: false,
          attributeChanges: [],
        })
      }
      emit(path, depth + 1)
    }
  }
  emit('', 0)

  const counts: Partial<Record<ChangeKind, number>> = {}
  for (const row of rows) counts[row.kind] = (counts[row.kind] ?? 0) + 1
  return { rows, counts, beforeTotalMs: b.totalMs, afterTotalMs: a.totalMs }
}

/** Row ordering in the view: trace structure, or largest regression first. */
export type TraceDiffSort = 'structure' | 'regression'

/** Which rows the view shows and in what order. */
export interface TraceRowQuery {
  readonly sort: TraceDiffSort
  /** Hide `unchanged` spans. */
  readonly changedOnly: boolean
  /** Case-insensitive substring match on service or span name; empty matches all. */
  readonly text: string
}

/** Regression sort puts spans that newly failed first. */
const statusWeight = (row: TraceSpanDiff) =>
  row.statusChanged && row.after?.status === 'error' ? 1 : 0

/** Order/filter rows of a trace diff model for display. */
export const selectTraceRows = (
  rows: readonly TraceSpanDiff[],
  { sort, changedOnly, text }: TraceRowQuery,
): readonly TraceSpanDiff[] => {
  const needle = text.trim().toLowerCase()
  const kept = rows.filter(
    (row) =>
      (!changedOnly || row.kind !== 'unchanged') &&
      (needle === '' || `${row.serviceName} ${row.name}`.toLowerCase().includes(needle)),
  )
  if (sort === 'structure') return kept
  return kept.toSorted((x, y) => statusWeight(y) - statusWeight(x) || y.deltaMs - x.deltaMs)
}

/**
 * Bar encoding of the combined arrangement (side by side always draws one plain bar per side):
 * `stacked` thin before + after bars, `ghost` after bar over a dashed before outline,
 * `delta` only the duration delta as a bar left/right of a zero line.
 */
export type TraceBarStyle = 'stacked' | 'ghost' | 'delta'

/**
 * `absolute`: both sides on one shared ms axis. `normalized`: each side scaled to its own
 * trace total, so structural shifts stay visible when the whole trace got slower.
 */
export type TraceTimeAxis = 'absolute' | 'normalized'

/** Compact ms/s formatting for durations and deltas. */
export const formatMs = (ms: number): string => {
  const abs = Math.abs(ms)
  if (abs >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (abs >= 10) return `${Math.round(ms)} ms`
  if (abs >= 1) return `${ms.toFixed(1)} ms`
  return `${ms.toFixed(2)} ms`
}

const formatSigned = (ms: number) => `${ms > 0 ? '+' : ms < 0 ? '−' : '±'}${formatMs(Math.abs(ms))}`
const formatRatio = (ratio: number) =>
  `${ratio > 0 ? '+' : ratio < 0 ? '−' : '±'}${Math.abs(ratio * 100).toFixed(ratio !== 0 && Math.abs(ratio) < 0.1 ? 1 : 0)}%`

/** Props for `TraceDiff`; frame props (`arrangement`, `nested`, …) pass through to `DiffFrame`. */
export interface TraceDiffProps extends Pick<
  DiffFrameProps,
  | 'id'
  | 'title'
  | 'before'
  | 'after'
  | 'arrangement'
  | 'relation'
  | 'defaultArrangement'
  | 'mode'
  | 'collapsed'
  | 'nested'
> {
  readonly beforeTrace: TraceData
  readonly afterTrace: TraceData
  readonly thresholds?: TraceDiffThresholds
  /** Combined-arrangement bar encoding; defaults to `stacked`. */
  readonly bars?: TraceBarStyle
  /** Defaults to `absolute`. */
  readonly timeAxis?: TraceTimeAxis
  readonly defaultSort?: TraceDiffSort
  readonly defaultChangedOnly?: boolean
}

/** Trace comparison rendered inside `DiffFrame`; the frame's arrangement picks merged vs aligned waterfalls. */
export const TraceDiff = ({
  beforeTrace,
  afterTrace,
  thresholds,
  bars = 'stacked',
  timeAxis = 'absolute',
  defaultSort = 'structure',
  defaultChangedOnly = false,
  ...frame
}: TraceDiffProps) => {
  const model = React.useMemo(
    () => diffTraces(beforeTrace, afterTrace, thresholds),
    [beforeTrace, afterTrace, thresholds],
  )
  return (
    <DiffFrame {...frame} lens="trace" counts={model.counts}>
      <TraceDiffBody
        model={model}
        beforeLabel={frame.before.label}
        afterLabel={frame.after.label}
        bars={bars}
        timeAxis={timeAxis}
        defaultSort={defaultSort}
        defaultChangedOnly={defaultChangedOnly}
      />
    </DiffFrame>
  )
}

/** Horizontal scale of a time lane: what 100% of the lane width stands for. */
type TimeAxis =
  | { readonly _tag: 'time'; readonly totalMs: number }
  | { readonly _tag: 'share'; readonly totalMs: number }

type DeltaAxis = { readonly _tag: 'delta'; readonly maxAbsMs: number }

type LaneAxis = TimeAxis | DeltaAxis

/** Scales for both sides plus the delta scale, derived from the whole model so filtering never rescales. */
interface TraceScales {
  readonly before: TimeAxis
  readonly after: TimeAxis
  readonly delta: DeltaAxis
}

const traceScales = (model: TraceDiffModel, timeAxis: TraceTimeAxis): TraceScales => {
  const shared = Math.max(model.beforeTotalMs, model.afterTotalMs, 0.001)
  let maxAbsMs = 0.001
  for (const row of model.rows) maxAbsMs = Math.max(maxAbsMs, Math.abs(row.deltaMs))
  const delta: DeltaAxis = { _tag: 'delta', maxAbsMs }
  if (timeAxis === 'absolute') {
    const axis: TimeAxis = { _tag: 'time', totalMs: shared }
    return { before: axis, after: axis, delta }
  }
  return {
    before: { _tag: 'share', totalMs: model.beforeTotalMs > 0 ? model.beforeTotalMs : shared },
    after: { _tag: 'share', totalMs: model.afterTotalMs > 0 ? model.afterTotalMs : shared },
    delta,
  }
}

const percent = (value: number, total: number) =>
  `${Math.max(0, Math.min(100, (value / total) * 100))}%`

const TRACE_VIEWPORT_HEIGHT = 440
const TRACE_OVERSCAN = 5
const estimatedRowHeight = (row: TraceSpanDiff) =>
  31 +
  (row.movedFrom !== undefined ? 24 : 0) +
  (row.statusChanged ? 24 : 0) +
  (row.attributeChanges.length > 0 ? 24 + row.attributeChanges.length * 24 : 0)

/** A span with status, attribute or move detail renders a second (detail) row under its own. */
const hasDetail = (row: TraceSpanDiff): boolean =>
  row.attributeChanges.length > 0 || row.statusChanged || row.movedFrom !== undefined

/**
 * `aria-rowindex` of each span's first row (the header row is 1), plus one past the last at
 * index `rows.length`, so the windowed table reports positions against every filtered row.
 */
const ariaRowStarts = (rows: readonly TraceSpanDiff[]): readonly number[] => {
  const next = [2]
  for (const row of rows) next.push(next[next.length - 1]! + (hasDetail(row) ? 2 : 1))
  return next
}

/** First row whose bottom is below the viewport edge. */
const rowAt = (offsets: readonly number[], position: number) => {
  let low = 0
  let high = offsets.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (offsets[middle + 1]! <= position) low = middle + 1
    else high = middle
  }
  return low
}

const TraceDiffBody = ({
  model,
  beforeLabel,
  afterLabel,
  bars,
  timeAxis,
  defaultSort,
  defaultChangedOnly,
}: {
  readonly model: TraceDiffModel
  readonly beforeLabel: string
  readonly afterLabel: string
  readonly bars: TraceBarStyle
  readonly timeAxis: TraceTimeAxis
  readonly defaultSort: TraceDiffSort
  readonly defaultChangedOnly: boolean
}) => {
  // The frame owns arrangement. Deferring this consumer keeps page-level toggles responsive.
  const arrangement = React.useDeferredValue(useDiffArrangement())
  const [sort, setSort] = React.useState<TraceDiffSort>(defaultSort)
  const [changedOnly, setChangedOnly] = React.useState(defaultChangedOnly)
  const [text, setText] = React.useState('')
  const deferredText = React.useDeferredValue(text)
  const rows = React.useMemo(
    () => selectTraceRows(model.rows, { sort, changedOnly, text: deferredText }),
    [model, sort, changedOnly, deferredText],
  )
  const scales = React.useMemo(() => traceScales(model, timeAxis), [model, timeAxis])
  const [heights, setHeights] = React.useState<ReadonlyMap<string, number>>(() => new Map())
  const onHeight = React.useCallback((path: string, height: number) => {
    setHeights((previous) => {
      if (height <= 0 || Math.abs((previous.get(path) ?? 0) - height) < 1) return previous
      return new Map(previous).set(path, height)
    })
  }, [])
  const offsets = React.useMemo(() => {
    const next = [0]
    for (const row of rows) {
      next.push(next[next.length - 1]! + (heights.get(row.path) ?? estimatedRowHeight(row)))
    }
    return next
  }, [rows, heights])
  const rowStarts = React.useMemo(() => ariaRowStarts(rows), [rows])
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewportHeight, setViewportHeight] = React.useState(TRACE_VIEWPORT_HEIGHT)
  const viewport = React.useCallback((element: HTMLDivElement | null) => {
    if (element === null) return
    const measure = () => setViewportHeight(element.clientHeight || TRACE_VIEWPORT_HEIGHT)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const totalHeight = offsets[rows.length]!
  const top = Math.min(scrollTop, Math.max(0, totalHeight - viewportHeight))
  const first = rows.length === 0 ? 0 : Math.max(0, rowAt(offsets, top) - TRACE_OVERSCAN)
  const last =
    rows.length === 0
      ? 0
      : Math.min(rows.length, rowAt(offsets, top + viewportHeight) + TRACE_OVERSCAN + 1)
  const totalDelta = model.afterTotalMs - model.beforeTotalMs
  const combinedAxis = bars === 'delta' ? scales.delta : scales.after

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.toolbar)}>
        <span {...stylex.props(styles.total)}>
          Trace {formatMs(model.beforeTotalMs)} → {formatMs(model.afterTotalMs)}{' '}
          <span {...stylex.props(deltaTone(totalDelta, model.beforeTotalMs))}>
            ({formatSigned(totalDelta)}
            {model.beforeTotalMs > 0 ? `, ${formatRatio(totalDelta / model.beforeTotalMs)}` : ''})
          </span>
        </span>
        <span {...stylex.props(styles.spacer)} />
        <SearchField
          aria-label="Filter spans"
          value={text}
          onChange={setText}
          {...stylex.props(styles.search)}
        >
          {({ isEmpty }) => (
            <>
              <Input placeholder="Filter spans" {...stylex.props(styles.searchInput)} />
              {isEmpty ? null : (
                <Button aria-label="Clear filter" {...stylex.props(styles.searchClear)}>
                  ×
                </Button>
              )}
            </>
          )}
        </SearchField>
        <ToggleButtonGroup
          aria-label="Sort spans"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[sort]}
          onSelectionChange={(keys) => {
            const next = [...keys][0]
            if (next === 'structure' || next === 'regression') setSort(next)
          }}
          {...stylex.props(styles.segmented)}
        >
          <ToggleButton id="structure" {...stylex.props(styles.segment)}>
            Tree order
          </ToggleButton>
          <ToggleButton id="regression" {...stylex.props(styles.segment)}>
            Largest regression
          </ToggleButton>
        </ToggleButtonGroup>
        <Switch isSelected={changedOnly} onChange={setChangedOnly} {...stylex.props(styles.switch)}>
          {({ isSelected }) => (
            <>
              <span {...stylex.props(styles.switchTrack, isSelected && styles.switchTrackOn)}>
                <span {...stylex.props(styles.switchThumb, isSelected && styles.switchThumbOn)} />
              </span>
              Changed only
            </>
          )}
        </Switch>
      </div>
      <div
        ref={viewport}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        {...stylex.props(styles.viewport)}
      >
        <div
          role="table"
          aria-label="Span comparison"
          aria-rowcount={rows.length === 0 ? 2 : rowStarts[rows.length]! - 1}
          {...stylex.props(
            styles.grid,
            arrangement === 'split' ? styles.gridSplit : styles.gridUnified,
          )}
        >
          <div role="row" aria-rowindex={1} {...stylex.props(styles.headerRow)}>
            <span role="columnheader" {...stylex.props(styles.headerCell)}>
              Span
            </span>
            {arrangement === 'split' ? (
              <>
                <span role="columnheader" {...stylex.props(styles.headerCell)}>
                  <AxisHeader
                    label={`${beforeLabel} · ${formatMs(model.beforeTotalMs)}`}
                    axis={scales.before}
                  />
                </span>
                <span role="columnheader" {...stylex.props(styles.headerCell)}>
                  <AxisHeader
                    label={`${afterLabel} · ${formatMs(model.afterTotalMs)}`}
                    axis={scales.after}
                  />
                </span>
              </>
            ) : (
              <span role="columnheader" {...stylex.props(styles.headerCell)}>
                <AxisHeader
                  label={bars === 'delta' ? 'Duration delta' : `${beforeLabel} / ${afterLabel}`}
                  axis={combinedAxis}
                />
              </span>
            )}
            <span role="columnheader" {...stylex.props(styles.headerCell, styles.alignEnd)}>
              Delta
            </span>
          </div>
          {rows.length === 0 ? (
            <div role="row" aria-rowindex={2} {...stylex.props(styles.empty)}>
              <span role="cell">
                {model.rows.length === 0
                  ? 'No spans.'
                  : changedOnly && deferredText.trim() === ''
                    ? 'No span changes beyond the threshold.'
                    : 'No spans match the filter.'}
              </span>
            </div>
          ) : (
            <>
              {first > 0 && (
                <div
                  aria-hidden
                  style={{ height: offsets[first] }}
                  {...stylex.props(styles.rowSpacer)}
                />
              )}
              {rows.slice(first, last).map((row, i) => (
                <SpanRow
                  key={row.path}
                  ariaRowIndex={rowStarts[first + i]!}
                  row={row}
                  arrangement={arrangement}
                  bars={bars}
                  scales={scales}
                  indent={sort === 'structure'}
                  onHeight={onHeight}
                />
              ))}
              {last < rows.length && (
                <div
                  aria-hidden
                  style={{ height: totalHeight - offsets[last]! }}
                  {...stylex.props(styles.rowSpacer)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const deltaTone = (deltaMs: number, baseMs: number) =>
  Math.abs(deltaMs) < 0.0005 || (baseMs > 0 && Math.abs(deltaMs / baseMs) < 0.01)
    ? styles.neutral
    : deltaMs > 0
      ? styles.worse
      : styles.better

const tickPositions = ['start', 'middle', 'end'] as const

const axisTicks = (axis: LaneAxis): Readonly<Record<(typeof tickPositions)[number], string>> => {
  switch (axis._tag) {
    case 'time':
      return { start: '0', middle: formatMs(axis.totalMs / 2), end: formatMs(axis.totalMs) }
    case 'share':
      return { start: '0%', middle: '50%', end: '100%' }
    case 'delta':
      return {
        start: `−${formatMs(axis.maxAbsMs)}`,
        middle: '0',
        end: `+${formatMs(axis.maxAbsMs)}`,
      }
  }
}

const AxisHeader = ({ label, axis }: { readonly label: string; readonly axis: LaneAxis }) => {
  const ticks = axisTicks(axis)
  return (
    <span {...stylex.props(styles.scaleHeader)}>
      <span>{label}</span>
      <span {...stylex.props(styles.scaleTicks)}>
        {tickPositions.map((position) => (
          <span key={position}>{ticks[position]}</span>
        ))}
      </span>
    </span>
  )
}

type BarSide = 'before' | 'after'

const barTone = (row: TraceSpanDiff, snapshot: TraceSpanSnapshot, side: BarSide) =>
  snapshot.status === 'error' || row.kind === 'removed'
    ? changeKindAccent.removed
    : side === 'before'
      ? tokens['--ds-gray-alpha-600']
      : row.kind === 'unchanged'
        ? tokens['--ds-blue-700']
        : changeKindAccent[row.kind]

/** Solid bar, or (`ghost`) a dashed outline marking where the before span sat. */
const Bar = ({
  row,
  side,
  axis,
  ghost = false,
}: {
  readonly row: TraceSpanDiff
  readonly side: BarSide
  readonly axis: TimeAxis
  readonly ghost?: boolean
}) => {
  const snapshot = row[side]
  if (!snapshot) return null
  const left = percent(snapshot.startMs, axis.totalMs)
  const width = percent(snapshot.durationMs, axis.totalMs)
  const tone = barTone(row, snapshot, side)
  return (
    <span
      title={`${side}: ${formatMs(snapshot.durationMs)} at ${formatMs(snapshot.startMs)}${snapshot.status === 'error' ? ' (error)' : ''}`}
      {...stylex.props(
        styles.bar,
        ghost ? styles.ghostGeometry(left, width, tone) : styles.barGeometry(left, width, tone),
      )}
    />
  )
}

const DeltaBar = ({ row, axis }: { readonly row: TraceSpanDiff; readonly axis: DeltaAxis }) => {
  const width = (Math.abs(row.deltaMs) / axis.maxAbsMs) * 50
  const tone = !row.durationChanged
    ? tokens['--ds-gray-alpha-500']
    : row.deltaMs > 0
      ? tokens['--ds-red-800']
      : tokens['--ds-green-800']
  return (
    <span {...stylex.props(styles.track, styles.trackTall)}>
      <span {...stylex.props(styles.zeroLine)} />
      <span
        title={`${formatSigned(row.deltaMs)}`}
        {...stylex.props(
          styles.bar,
          styles.barGeometry(`${row.deltaMs >= 0 ? 50 : 50 - width}%`, `${width}%`, tone),
        )}
      />
    </span>
  )
}

/** Combined-arrangement lane in the chosen bar encoding. */
const CombinedLane = ({
  row,
  bars,
  scales,
}: {
  readonly row: TraceSpanDiff
  readonly bars: TraceBarStyle
  readonly scales: TraceScales
}) => {
  switch (bars) {
    case 'stacked':
      return (
        <span {...stylex.props(styles.lane)}>
          <span {...stylex.props(styles.track)}>
            <Bar row={row} side="before" axis={scales.before} />
          </span>
          <span {...stylex.props(styles.track)}>
            <Bar row={row} side="after" axis={scales.after} />
          </span>
        </span>
      )
    case 'ghost':
      return (
        <span {...stylex.props(styles.lane)}>
          <span {...stylex.props(styles.track, styles.trackTall)}>
            <Bar row={row} side="after" axis={scales.after} />
            <Bar row={row} side="before" axis={scales.before} ghost />
          </span>
        </span>
      )
    case 'delta':
      return (
        <span {...stylex.props(styles.lane)}>
          <DeltaBar row={row} axis={scales.delta} />
        </span>
      )
  }
}

/** One side's lane in the side-by-side arrangement; a hatched track keeps rows aligned when the span is absent. */
const SideLane = ({
  row,
  side,
  axis,
}: {
  readonly row: TraceSpanDiff
  readonly side: BarSide
  readonly axis: TimeAxis
}) => {
  const snapshot = row[side]
  return (
    <span role="cell" {...stylex.props(styles.cell)}>
      <span {...stylex.props(styles.lane)}>
        {snapshot ? (
          <span {...stylex.props(styles.track, styles.trackTall)}>
            <Bar row={row} side={side} axis={axis} />
          </span>
        ) : (
          <span
            title={`not in ${side}`}
            {...stylex.props(styles.track, styles.trackTall, styles.absent)}
          />
        )}
      </span>
      <span {...stylex.props(styles.duration)}>
        {snapshot ? formatMs(snapshot.durationMs) : '—'}
      </span>
    </span>
  )
}

const StatusBadge = ({ status }: { readonly status: SpanStatus }) => (
  <span {...stylex.props(styles.status, status === 'error' && styles.statusError)}>{status}</span>
)

const SpanRow = React.memo(function SpanRow({
  row,
  arrangement,
  bars,
  scales,
  indent,
  onHeight,
  ariaRowIndex,
}: {
  readonly row: TraceSpanDiff
  readonly arrangement: DiffArrangement
  readonly bars: TraceBarStyle
  readonly scales: TraceScales
  readonly indent: boolean
  readonly onHeight: (path: string, height: number) => void
  /** `aria-rowindex` of the span's main row; its detail row follows. */
  readonly ariaRowIndex: number
}) {
  const measure = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null) return
      onHeight(row.path, element.getBoundingClientRect().height)
      if (typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(([entry]) => {
        if (entry)
          onHeight(
            row.path,
            entry.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height,
          )
      })
      observer.observe(element)
      return () => observer.disconnect()
    },
    [onHeight, row.path],
  )
  return (
    <div ref={measure} role="rowgroup" {...stylex.props(styles.rowGroup)}>
      <div role="row" aria-rowindex={ariaRowIndex} {...stylex.props(styles.row)}>
        <span role="cell" {...stylex.props(styles.labelCell)}>
          <ChangeMark kind={row.kind} block title={row.kind}>
            <span
              {...stylex.props(styles.labelInner, indent && styles.indent(row.depth))}
              title={row.path.split(PATH_SEP).filter(Boolean).join(' > ')}
            >
              <span {...stylex.props(styles.spanName)}>{row.name}</span>
              <span {...stylex.props(styles.service)}>{row.serviceName}</span>
            </span>
          </ChangeMark>
        </span>
        {arrangement === 'split' ? (
          <>
            <SideLane row={row} side="before" axis={scales.before} />
            <SideLane row={row} side="after" axis={scales.after} />
          </>
        ) : (
          <span role="cell" {...stylex.props(styles.cell)}>
            <CombinedLane row={row} bars={bars} scales={scales} />
          </span>
        )}
        <span
          role="cell"
          title={`${row.before ? formatMs(row.before.durationMs) : '—'} → ${row.after ? formatMs(row.after.durationMs) : '—'}`}
          {...stylex.props(
            styles.delta,
            row.kind === 'unchanged' || !row.durationChanged
              ? styles.neutral
              : row.deltaMs > 0
                ? styles.worse
                : styles.better,
          )}
        >
          {row.kind === 'added'
            ? 'new span'
            : row.kind === 'removed'
              ? 'gone'
              : `${formatSigned(row.deltaMs)}${row.deltaRatio === undefined ? '' : ` ${formatRatio(row.deltaRatio)}`}`}
        </span>
      </div>
      {hasDetail(row) ? (
        <div role="row" aria-rowindex={ariaRowIndex + 1} {...stylex.props(styles.detailRow)}>
          <div role="cell" {...stylex.props(styles.detail, indent && styles.indent(row.depth))}>
            {row.movedFrom === undefined ? null : (
              <div {...stylex.props(styles.detailLine)}>
                <ChangeMark kind="moved">moved</ChangeMark>
                <span>from under {row.movedFrom}</span>
              </div>
            )}
            {row.statusChanged && row.before && row.after ? (
              <div {...stylex.props(styles.detailLine)}>
                <span {...stylex.props(styles.attrKey)}>status</span>
                <StatusBadge status={row.before.status} />
                <span aria-hidden>→</span>
                <StatusBadge status={row.after.status} />
              </div>
            ) : null}
            {row.attributeChanges.length > 0 ? (
              <dl {...stylex.props(styles.attrList)}>
                {row.attributeChanges.map((change) => (
                  <div key={change.key} {...stylex.props(styles.attrRow)}>
                    <dt {...stylex.props(styles.attrKey)}>{change.key}</dt>
                    <dd {...stylex.props(styles.attrValue)}>
                      {change.before === undefined ? null : (
                        <ChangeMark kind="removed">{change.before}</ChangeMark>
                      )}
                      {change.kind === 'changed' ? <span aria-hidden> → </span> : null}
                      {change.after === undefined ? null : (
                        <ChangeMark kind="added">{change.after}</ChangeMark>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
})

const styles = stylex.create({
  indent: (depth: number) => ({ paddingInlineStart: `${depth * 0.9}rem` }),
  barGeometry: (left: string, width: string, color: string) => ({
    insetInlineStart: left,
    width,
    backgroundColor: color,
  }),
  ghostGeometry: (left: string, width: string, color: string) => ({
    insetInlineStart: left,
    width,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color,
  }),
  root: { display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
  },
  total: { color: tokens['--ds-gray-900'], fontVariantNumeric: 'tabular-nums' },
  spacer: { flexGrow: 1 },
  search: {
    display: 'inline-flex',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 6,
    backgroundColor: tokens['--ds-background-100'],
    paddingInline: '0.4rem',
    height: '1.6rem',
  },
  searchInput: {
    borderWidth: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-1000'],
    fontSize: '0.75rem',
    width: '9rem',
    '::placeholder': { color: tokens['--ds-gray-700'] },
  },
  searchClear: {
    appearance: 'none',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-800'],
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: 1,
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  segmented: {
    display: 'inline-flex',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    appearance: 'none',
    borderWidth: 0,
    fontSize: '0.75rem',
    paddingBlock: '0.2rem',
    paddingInline: '0.55rem',
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':is([data-selected])': tokens['--ds-gray-alpha-200'],
    },
    color: { default: tokens['--ds-gray-900'], ':is([data-selected])': tokens['--ds-gray-1000'] },
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  switch: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  switchTrack: {
    position: 'relative',
    width: 26,
    height: 14,
    borderRadius: 7,
    backgroundColor: tokens['--ds-gray-alpha-400'],
    transitionProperty: 'background-color',
    transitionDuration: '120ms',
  },
  switchTrackOn: { backgroundColor: tokens['--ds-blue-700'] },
  switchThumb: {
    position: 'absolute',
    top: 2,
    insetInlineStart: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens['--ds-background-100'],
    transitionProperty: 'inset-inline-start',
    transitionDuration: '120ms',
  },
  switchThumbOn: { insetInlineStart: 14 },
  viewport: { maxHeight: 440, overflowY: 'auto', overscrollBehavior: 'contain' },
  rowSpacer: { gridColumn: '1 / -1', pointerEvents: 'none' },
  grid: {
    display: 'grid',
    columnGap: '0.75rem',
    fontSize: '0.8rem',
    minWidth: 0,
  },
  gridUnified: { gridTemplateColumns: 'minmax(12rem, 18rem) minmax(10rem, 1fr) 8.5rem' },
  gridSplit: {
    gridTemplateColumns: 'minmax(12rem, 16rem) minmax(8rem, 1fr) minmax(8rem, 1fr) 8.5rem',
  },
  headerRow: {
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    paddingBottom: '0.25rem',
  },
  headerCell: { color: tokens['--ds-gray-800'], fontSize: '0.72rem', fontWeight: 500, minWidth: 0 },
  alignEnd: { textAlign: 'end' },
  scaleHeader: { display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  scaleTicks: {
    display: 'flex',
    justifyContent: 'space-between',
    fontVariantNumeric: 'tabular-nums',
    color: tokens['--ds-gray-700'],
  },
  rowGroup: {
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-100'],
  },
  row: {
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    alignItems: 'center',
    minHeight: '1.9rem',
  },
  labelCell: { minWidth: 0 },
  labelInner: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    minWidth: 0,
    overflow: 'hidden',
  },
  spanName: {
    fontFamily: scale.fontMono,
    color: tokens['--ds-gray-1000'],
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  service: { color: tokens['--ds-gray-800'], fontSize: '0.72rem', whiteSpace: 'nowrap' },
  cell: { display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 },
  lane: { display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 },
  track: {
    position: 'relative',
    height: 7,
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderRadius: 2,
  },
  trackTall: { height: 11 },
  absent: {
    backgroundImage: `repeating-linear-gradient(135deg, ${tokens['--ds-gray-alpha-200']} 0 3px, transparent 3px 7px)`,
  },
  zeroLine: {
    position: 'absolute',
    insetBlock: -2,
    insetInlineStart: '50%',
    width: 1,
    backgroundColor: tokens['--ds-gray-alpha-600'],
  },
  bar: {
    position: 'absolute',
    insetBlock: 0,
    minWidth: 2,
    borderRadius: 2,
    boxSizing: 'border-box',
  },
  duration: {
    width: '4.2rem',
    flexShrink: 0,
    textAlign: 'end',
    fontVariantNumeric: 'tabular-nums',
    color: tokens['--ds-gray-900'],
  },
  delta: { textAlign: 'end', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  neutral: { color: tokens['--ds-gray-800'] },
  worse: { color: tokens['--ds-red-900'] },
  better: { color: tokens['--ds-green-900'] },
  detailRow: { gridColumn: '1 / -1' },
  detail: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    paddingBottom: '0.4rem',
    marginInlineStart: '0.9rem',
    fontSize: '0.75rem',
  },
  detailLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: tokens['--ds-gray-900'],
  },
  attrList: { margin: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  attrRow: { display: 'flex', gap: '0.5rem', alignItems: 'baseline' },
  attrKey: { fontFamily: scale.fontMono, color: tokens['--ds-gray-800'], minWidth: '9rem' },
  attrValue: { margin: 0, fontFamily: scale.fontMono, overflowWrap: 'anywhere' },
  status: {
    fontFamily: scale.fontMono,
    fontSize: '0.7rem',
    paddingInline: '0.3rem',
    borderRadius: 4,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-gray-900'],
  },
  statusError: { backgroundColor: tokens['--ds-red-100'], color: tokens['--ds-red-900'] },
  empty: { gridColumn: '1 / -1', paddingBlock: '0.75rem', color: tokens['--ds-gray-800'] },
})
