/**
 * Key-value record lens: page properties, JSON objects, config. One row per leaf path;
 * nested objects and lists of objects recurse into path rows, lists of scalars diff inline
 * as chips (with move detection), long text values nest a `TextDiff` and code values nest a
 * `CodeDiff` (loaded on demand, so a plain property diff never pulls `@pierre/diffs`).
 *
 * Arrangement: combined puts `before → after` inline in one value column; side by side gives
 * before and after their own columns. Rows are a React Aria `Table` (or `GridList` for the
 * compact line layout) and unchanged runs fold behind a React Aria `Disclosure`. Lists over
 * `virtualizeAbove` rows go through a RAC `Virtualizer`, so only rows near the viewport mount.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  Cell,
  Column,
  Disclosure,
  DisclosurePanel,
  GridList,
  GridListItem,
  ListLayout,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  ToggleButton,
  Virtualizer,
} from 'react-aria-components'

import type { DiffSource } from '../../model.ts'
import type {
  ChangeCounts,
  ChangeKind,
  DiffArrangement,
  DiffRelation,
  DiffSide,
} from './contract.ts'
import {
  ChangeMark,
  changeKindLabel,
  DiffFrame,
  useDiffArrangement,
  withOccurrenceKeys,
} from './DiffFrame.tsx'
import { diffSequence, TextDiff } from './TextDiff.tsx'

// --- values ---

/** A typed record value. `code` nests a `CodeDiff`; long `text` nests a `TextDiff`. */
export type RecordValue =
  | { readonly _tag: 'text'; readonly value: string }
  | { readonly _tag: 'number'; readonly value: number; readonly unit?: string }
  | { readonly _tag: 'boolean'; readonly value: boolean }
  /** ISO 8601 date or date-time. */
  | { readonly _tag: 'date'; readonly value: string }
  | { readonly _tag: 'url'; readonly value: string; readonly label?: string }
  | { readonly _tag: 'code'; readonly path: string; readonly value: string }
  | { readonly _tag: 'list'; readonly items: readonly RecordValue[] }
  | { readonly _tag: 'object'; readonly entries: RecordEntries }
  | { readonly _tag: 'empty' }

/** Ordered key -> value map (object key order is the display order). */
export type RecordEntries = Readonly<Record<string, RecordValue>>

/** Convert plain JSON into typed record values (strings stay `text`; no date/url sniffing). */
export const recordValueFromJson = (json: unknown): RecordValue => {
  if (json === null || json === undefined) return { _tag: 'empty' }
  if (typeof json === 'string') return { _tag: 'text', value: json }
  if (typeof json === 'number') return { _tag: 'number', value: json }
  if (typeof json === 'boolean') return { _tag: 'boolean', value: json }
  if (Array.isArray(json)) return { _tag: 'list', items: json.map(recordValueFromJson) }
  if (typeof json === 'object')
    return {
      _tag: 'object',
      entries: Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, recordValueFromJson(v)]),
      ),
    }
  return { _tag: 'text', value: String(json) }
}

/** Container keys are recursive; values are immutable, so each container is keyed once. */
const containerKeys = new WeakMap<RecordValue, string>()

/** Stable identity string used for equality and list alignment. */
export const recordValueKey = (value: RecordValue): string => {
  switch (value._tag) {
    case 'list':
    case 'object': {
      const cached = containerKeys.get(value)
      if (cached !== undefined) return cached
      const key =
        value._tag === 'list'
          ? `[${value.items.map(recordValueKey).join(',')}]`
          : `{${Object.entries(value.entries)
              .map(([k, v]) => `${JSON.stringify(k)}:${recordValueKey(v)}`)
              .join(',')}}`
      containerKeys.set(value, key)
      return key
    }
    case 'empty':
      return 'empty'
    case 'number':
      return `number:${value.value}${value.unit ?? ''}`
    case 'url':
      return `url:${value.value}|${value.label ?? ''}`
    case 'code':
      return `code:${value.path}:${value.value}`
    default:
      return `${value._tag}:${String(value.value)}`
  }
}

const isContainer = (
  value: RecordValue | undefined,
): value is Extract<RecordValue, { _tag: 'list' | 'object' }> =>
  value !== undefined &&
  (value._tag === 'object' ||
    (value._tag === 'list' && value.items.some((i) => i._tag === 'object' || i._tag === 'list')))

// --- model ---

/** Path segment: object key or list index. */
export type RecordPathSegment = string | number

/** Diff of one record entry: a leaf comparison or a container whose children are diffed. */
export type RecordEntryDiff =
  | {
      readonly _tag: 'leaf'
      readonly path: readonly RecordPathSegment[]
      readonly kind: ChangeKind
      readonly before?: RecordValue
      readonly after?: RecordValue
      /** For `moved` list items: index on the before side. */
      readonly movedFrom?: number
    }
  | {
      readonly _tag: 'branch'
      readonly path: readonly RecordPathSegment[]
      readonly kind: ChangeKind
      readonly container: 'object' | 'list'
      readonly children: readonly RecordEntryDiff[]
    }

/** Result of diffing two records. Counts are per leaf row. */
export interface RecordDiffModel {
  readonly entries: readonly RecordEntryDiff[]
  readonly counts: ChangeCounts
  readonly identical: boolean
}

const childrenOf = (
  value: RecordValue | undefined,
): readonly (readonly [RecordPathSegment, RecordValue])[] => {
  if (value?._tag === 'object') return Object.entries(value.entries)
  if (value?._tag === 'list') return value.items.map((item, i) => [i, item] as const)
  return []
}

const diffEntry = (
  path: readonly RecordPathSegment[],
  before: RecordValue | undefined,
  after: RecordValue | undefined,
): RecordEntryDiff => {
  const sameContainer = isContainer(before) && isContainer(after) && before._tag === after._tag
  const oneSidedContainer =
    (before === undefined && isContainer(after)) || (after === undefined && isContainer(before))
  if (sameContainer || oneSidedContainer) {
    const container = (before ?? after)!._tag === 'object' ? 'object' : 'list'
    const children =
      container === 'object'
        ? diffObjectEntries(path, before, after)
        : diffListEntries(path, before, after)
    const kind: ChangeKind =
      before === undefined
        ? 'added'
        : after === undefined
          ? 'removed'
          : children.every((c) => c.kind === 'unchanged')
            ? 'unchanged'
            : 'changed'
    if (children.length > 0) return { _tag: 'branch', path, kind, container, children }
  }
  const kind: ChangeKind =
    before === undefined
      ? 'added'
      : after === undefined
        ? 'removed'
        : recordValueKey(before) === recordValueKey(after)
          ? 'unchanged'
          : 'changed'
  return {
    _tag: 'leaf',
    path,
    kind,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  }
}

/** Keys in after-order, with removed keys placed after their nearest surviving predecessor. */
const diffObjectEntries = (
  path: readonly RecordPathSegment[],
  before: RecordValue | undefined,
  after: RecordValue | undefined,
): RecordEntryDiff[] => {
  const b = before?._tag === 'object' ? before.entries : {}
  const a = after?._tag === 'object' ? after.entries : {}
  const order = Object.keys(a)
  let anchor = -1
  for (const key of Object.keys(b)) {
    const at = order.indexOf(key)
    if (at >= 0) {
      anchor = at
      continue
    }
    order.splice(anchor + 1, 0, key)
    anchor++
  }
  return order.map((key) => diffEntry([...path, key], b[key], a[key]))
}

/**
 * Lists of containers: LCS anchors identical items; remaining identical items are moves.
 * Pair unmatched items positionally (recursively), then show leftover removals.
 */
const diffListEntries = (
  path: readonly RecordPathSegment[],
  before: RecordValue | undefined,
  after: RecordValue | undefined,
): RecordEntryDiff[] => {
  const b = childrenOf(before).map(([, v]) => v)
  const a = childrenOf(after).map(([, v]) => v)
  const bKeys = b.map(recordValueKey)
  const aKeys = a.map(recordValueKey)
  const runs = diffSequence(bKeys, aKeys, (key) => key)
  const usedBefore = new Set<number>()
  const matches = new Map<number, { readonly from: number; readonly moved: boolean }>()
  for (const run of runs) {
    if (run._tag !== 'equal') continue
    for (let i = 0; i < run.bEnd - run.bStart; i++) {
      const from = run.aStart + i
      matches.set(run.bStart + i, { from, moved: false })
      usedBefore.add(from)
    }
  }
  // Moves: each unanchored after-item takes the first unused before-item with the same key.
  // Unused before indices are bucketed by key in ascending order, so this stays linear.
  const freeByKey = new Map<string, number[]>()
  bKeys.forEach((key, bi) => {
    if (usedBefore.has(bi)) return
    const bucket = freeByKey.get(key)
    if (bucket) bucket.push(bi)
    else freeByKey.set(key, [bi])
  })
  const taken = new Map<string, number>()
  for (let ai = 0; ai < a.length; ai++) {
    if (matches.has(ai)) continue
    const key = aKeys[ai]!
    const next = taken.get(key) ?? 0
    const from = freeByKey.get(key)?.[next]
    if (from === undefined) continue
    taken.set(key, next + 1)
    matches.set(ai, { from, moved: true })
    usedBefore.add(from)
  }
  const unmatchedBefore = b.map((_, i) => i).filter((i) => !usedBefore.has(i))
  let nextUnmatched = 0
  const out: RecordEntryDiff[] = []
  for (let ai = 0; ai < a.length; ai++) {
    const match = matches.get(ai)
    if (match !== undefined) {
      out.push(
        match.moved
          ? {
              _tag: 'leaf',
              path: [...path, ai],
              kind: 'moved',
              before: b[match.from]!,
              after: a[ai]!,
              movedFrom: match.from,
            }
          : diffEntry([...path, ai], b[match.from], a[ai]),
      )
      continue
    }
    const bi = unmatchedBefore[nextUnmatched++]
    out.push(diffEntry([...path, ai], bi === undefined ? undefined : b[bi], a[ai]))
  }
  for (const bi of unmatchedBefore.slice(nextUnmatched))
    out.push(diffEntry([...path, bi], b[bi], undefined))
  return out
}

/** Flatten a diff tree into its leaf rows (containers with no children render as leaves). */
export const recordDiffLeaves = (
  entries: readonly RecordEntryDiff[],
): readonly Extract<RecordEntryDiff, { _tag: 'leaf' }>[] =>
  entries.flatMap((entry) => (entry._tag === 'leaf' ? [entry] : recordDiffLeaves(entry.children)))

/** Diff two records (either side may be empty for create/delete). */
export const recordDiffModel = (before: RecordEntries, after: RecordEntries): RecordDiffModel => {
  const entries = diffObjectEntries(
    [],
    { _tag: 'object', entries: before },
    { _tag: 'object', entries: after },
  )
  const counts: Partial<Record<ChangeKind, number>> = {}
  for (const leaf of recordDiffLeaves(entries)) counts[leaf.kind] = (counts[leaf.kind] ?? 0) + 1
  return {
    entries,
    counts,
    identical: entries.every((e) => e.kind === 'unchanged'),
  }
}

// --- view model ---

/** Text values longer than this (or multi-line) delegate to a nested `TextDiff`. */
const LONG_TEXT = 80

const isLongText = (value: RecordValue | undefined) =>
  value?._tag === 'text' && (value.value.length > LONG_TEXT || value.value.includes('\n'))

type Leaf = Extract<RecordEntryDiff, { _tag: 'leaf' }>

type NonEmpty<T> = readonly [T, ...T[]]

/** Display row: a leaf, or a folded run of unchanged leaves (never empty by construction). */
type RecordRow =
  | { readonly _tag: 'leaf'; readonly leaf: Leaf }
  | { readonly _tag: 'fold'; readonly leaves: NonEmpty<Leaf> }

const formatPath = (path: readonly RecordPathSegment[]) =>
  path.map((s, i) => (typeof s === 'number' ? `[${s}]` : i === 0 ? s : `.${s}`)).join('')

const leafKey = (leaf: Leaf) => `${formatPath(leaf.path)}:${leaf.kind}`

/** Fold runs of at least `minRun` unchanged leaves into one row; `minRun <= 0` never folds. */
const foldRows = (leaves: readonly Leaf[], minRun: number): readonly RecordRow[] => {
  const asLeaves = (run: readonly Leaf[]) => run.map((leaf): RecordRow => ({ _tag: 'leaf', leaf }))
  if (minRun <= 0) return asLeaves(leaves)
  const rows: RecordRow[] = []
  let run: Leaf[] = []
  const flush = () => {
    const [first, ...rest] = run
    if (first !== undefined && run.length >= minRun)
      rows.push({ _tag: 'fold', leaves: [first, ...rest] })
    else rows.push(...asLeaves(run))
    run = []
  }
  for (const leaf of leaves) {
    if (leaf.kind === 'unchanged') {
      run.push(leaf)
      continue
    }
    flush()
    rows.push({ _tag: 'leaf', leaf })
  }
  flush()
  return rows
}

/** A changed leaf whose values deserve their own lens instead of an inline cell. */
type NestedSpec =
  | {
      readonly _tag: 'code'
      readonly path: string
      readonly before: string
      readonly after: string
    }
  | { readonly _tag: 'text'; readonly before: string; readonly after: string }

const isTextish = (value: RecordValue | undefined) =>
  value === undefined || value._tag === 'text' || value._tag === 'empty'

const nestedSpecOf = (leaf: Leaf): NestedSpec | undefined => {
  if (leaf.kind === 'unchanged' || leaf.kind === 'moved') return undefined
  const b = leaf.before
  const a = leaf.after
  if ((b === undefined || b._tag === 'code') && (a === undefined || a._tag === 'code')) {
    const code = a ?? b
    return code === undefined
      ? undefined
      : { _tag: 'code', path: code.path, before: b?.value ?? '', after: a?.value ?? '' }
  }
  if (isTextish(b) && isTextish(a) && (isLongText(b) || isLongText(a)))
    return {
      _tag: 'text',
      before: b?._tag === 'text' ? b.value : '',
      after: a?._tag === 'text' ? a.value : '',
    }
  return undefined
}

const isScalarList = (
  value: RecordValue | undefined,
): value is Extract<RecordValue, { _tag: 'list' }> => value?._tag === 'list' && !isContainer(value)

/** How a leaf's values render: nested lens, chip diff, or plain values. */
type LeafBody =
  | { readonly _tag: 'nested'; readonly spec: NestedSpec }
  | {
      readonly _tag: 'chips'
      readonly before: readonly RecordValue[]
      readonly after: readonly RecordValue[]
    }
  | { readonly _tag: 'values' }

const leafBodyOf = (leaf: Leaf): LeafBody => {
  const spec = nestedSpecOf(leaf)
  if (spec !== undefined) return { _tag: 'nested', spec }
  if (leaf.kind === 'changed' && isScalarList(leaf.before) && isScalarList(leaf.after))
    return { _tag: 'chips', before: leaf.before.items, after: leaf.after.items }
  return { _tag: 'values' }
}

// --- value views ---

const formatDate = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return iso.length <= 10
    ? date.toISOString().slice(0, 10)
    : date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

/** URL as reviewed: host + path + query + fragment; the scheme only when it is not https. */
export const urlForm = (url: string): string => {
  try {
    const parsed = new URL(url)
    const scheme = parsed.protocol === 'https:' ? '' : `${parsed.protocol}//`
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${scheme}${parsed.host}${path}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

/** Compact, typed rendering of one value. */
const ValueView = ({ value }: { readonly value: RecordValue }): ReactNode => {
  switch (value._tag) {
    case 'empty':
      return <span {...stylex.props(styles.empty)}>empty</span>
    case 'text':
      return value.value === '' ? (
        <span {...stylex.props(styles.empty)}>""</span>
      ) : (
        <span {...stylex.props(styles.text)}>{value.value}</span>
      )
    case 'number':
      return (
        <span {...stylex.props(styles.number)}>
          {value.value.toLocaleString()}
          {value.unit === undefined ? null : ` ${value.unit}`}
        </span>
      )
    case 'boolean':
      return <span {...stylex.props(styles.mono)}>{value.value ? 'true' : 'false'}</span>
    case 'date':
      return (
        <time dateTime={value.value} {...stylex.props(styles.mono)}>
          {formatDate(value.value)}
        </time>
      )
    case 'url':
      // The URL itself is always visible: a label-only view hides host/path edits.
      return (
        <span {...stylex.props(styles.urlStack)}>
          {value.label === undefined ? null : (
            <span {...stylex.props(styles.text)}>{value.label}</span>
          )}
          <a href={value.value} target="_blank" rel="noreferrer" {...stylex.props(styles.link)}>
            {urlForm(value.value)}
          </a>
        </span>
      )
    case 'code':
      return (
        <span {...stylex.props(styles.mono)}>
          {value.path} ({value.value.split('\n').length} lines)
        </span>
      )
    case 'list':
      return value.items.length === 0 ? (
        <span {...stylex.props(styles.empty)}>[]</span>
      ) : (
        <span {...stylex.props(styles.chips)}>
          {withOccurrenceKeys(value.items, recordValueKey).map(({ key, item }) => (
            <span key={key} {...stylex.props(styles.chip)}>
              <ValueView value={item} />
            </span>
          ))}
        </span>
      )
    case 'object': {
      const keys = Object.keys(value.entries)
      return (
        <span {...stylex.props(styles.mono, styles.muted)}>
          {keys.length === 0 ? '{}' : `{ ${keys.join(', ')} }`}
        </span>
      )
    }
  }
}

/** One chip of a list chip diff; `key` is stable within the list for React. */
export interface ListChip {
  readonly item: RecordValue
  readonly kind: ChangeKind
  readonly key: string
}

/** Occurrences per value key. */
const countByKey = (items: readonly RecordValue[]) => {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = recordValueKey(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Take one occurrence from a per-key budget; false once it is spent. */
const takeFromBudget = (budget: Map<string, number>, key: string) => {
  const left = budget.get(key) ?? 0
  if (left === 0) return false
  budget.set(key, left - 1)
  return true
}

/**
 * Chips for a list of scalars in `after` order, removals in place. A value that was removed
 * in one place and added in another is one move, counted per occurrence: with `n` removals
 * and `m` additions of the same value, the first `min(n, m)` additions show as moved and that
 * many removals are hidden; the rest stay visible as added or removed.
 */
export const listChips = (
  before: readonly RecordValue[],
  after: readonly RecordValue[],
): readonly ListChip[] => {
  const runs = diffSequence(before, after, recordValueKey)
  const removedCounts = countByKey(
    runs.flatMap((r) => (r._tag === 'removed' ? before.slice(r.aStart, r.aEnd) : [])),
  )
  const addedCounts = countByKey(
    runs.flatMap((r) => (r._tag === 'added' ? after.slice(r.bStart, r.bEnd) : [])),
  )
  const moves = new Map<string, number>()
  for (const [key, removed] of removedCounts) {
    const added = addedCounts.get(key) ?? 0
    if (added > 0) moves.set(key, Math.min(removed, added))
  }
  const movedAdds = new Map(moves)
  const hiddenRemovals = new Map(moves)
  return runs.flatMap((run): ListChip[] => {
    if (run._tag === 'equal')
      return after
        .slice(run.bStart, run.bEnd)
        .map((item, i) => ({ item, kind: 'unchanged', key: `e${run.bStart + i}` }))
    if (run._tag === 'added')
      return after.slice(run.bStart, run.bEnd).map((item, i) => ({
        item,
        kind: takeFromBudget(movedAdds, recordValueKey(item)) ? 'moved' : 'added',
        key: `a${run.bStart + i}`,
      }))
    return before
      .slice(run.aStart, run.aEnd)
      .flatMap((item, i): ListChip[] =>
        takeFromBudget(hiddenRemovals, recordValueKey(item))
          ? []
          : [{ item, kind: 'removed', key: `r${run.aStart + i}` }],
      )
  })
}

/** Inline chip diff for a list of scalars (e.g. multi-select tags). */
const ListChipsDiff = ({
  before,
  after,
}: {
  readonly before: readonly RecordValue[]
  readonly after: readonly RecordValue[]
}) => (
  <span {...stylex.props(styles.chips)}>
    {listChips(before, after).map(({ item, kind, key }) => (
      <ChangeMark key={key} kind={kind}>
        <span {...stylex.props(styles.chip)}>
          <ValueView value={item} />
        </span>
      </ChangeMark>
    ))}
  </span>
)

/** Loaded on demand: only records with code values pay for the code lens and `@pierre/diffs`. */
const LazyCodeDiff = React.lazy(() =>
  import('./CodeDiff.tsx').then((module) => ({ default: module.CodeDiff })),
)

/**
 * Nested code lens. The `files` source is memoized on its contents so a record re-render
 * (arrangement flip, show-unchanged toggle) keeps `CodeDiff`'s model and pierre file memos warm.
 */
const NestedCodeLens = ({
  title,
  path,
  oldContents,
  newContents,
  before,
  after,
  relation,
}: {
  readonly title: string
  readonly path: string
  readonly oldContents: string
  readonly newContents: string
  readonly before: DiffSide
  readonly after: DiffSide
  readonly relation: DiffRelation
}) => {
  const source = React.useMemo<DiffSource>(
    () => ({ _tag: 'files', path, oldContents, newContents }),
    [path, oldContents, newContents],
  )
  return (
    <React.Suspense fallback={<span {...stylex.props(styles.muted)}>Loading code diff…</span>}>
      <LazyCodeDiff
        id={`record-${title}`}
        title={title}
        before={before}
        after={after}
        relation={relation}
        source={source}
        nested
      />
    </React.Suspense>
  )
}

/** Nested lens for a leaf whose value deserves its own diff; inherits the record's arrangement. */
const NestedLens = ({
  leaf,
  spec,
  before,
  after,
  relation,
}: {
  readonly leaf: Leaf
  readonly spec: NestedSpec
  readonly before: DiffSide
  readonly after: DiffSide
  readonly relation: DiffRelation
}) => {
  const title = formatPath(leaf.path)
  switch (spec._tag) {
    case 'code':
      return (
        <NestedCodeLens
          title={title}
          path={spec.path}
          oldContents={spec.before}
          newContents={spec.after}
          before={before}
          after={after}
          relation={relation}
        />
      )
    case 'text':
      return (
        <TextDiff
          title={title}
          before={before}
          after={after}
          relation={relation}
          beforeText={spec.before}
          afterText={spec.after}
          // A text value lifted into a record reads as prose.
          renderer="inline"
          nested
        />
      )
  }
}

const numberDelta = (leaf: Leaf) =>
  leaf.before?._tag === 'number' &&
  leaf.after?._tag === 'number' &&
  leaf.before.unit === leaf.after.unit &&
  leaf.after.value !== leaf.before.value
    ? leaf.after.value - leaf.before.value
    : undefined

const Delta = ({ leaf }: { readonly leaf: Leaf }) => {
  const delta = numberDelta(leaf)
  return delta === undefined ? null : (
    <span {...stylex.props(styles.delta)}>
      {delta > 0 ? '+' : ''}
      {delta.toLocaleString()}
    </span>
  )
}

const Absent = () => <span {...stylex.props(styles.absent)}>absent</span>

/** One side's value, marked by what happened to it on that side. */
const SideValue = ({ leaf, side }: { readonly leaf: Leaf; readonly side: 'before' | 'after' }) => {
  const value = side === 'before' ? leaf.before : leaf.after
  if (value === undefined) return <Absent />
  if (leaf.kind === 'unchanged') return <ValueView value={value} />
  if (leaf.kind === 'moved')
    return side === 'before' ? (
      <ValueView value={value} />
    ) : (
      <ChangeMark kind="moved" title={`moved from index ${leaf.movedFrom}`}>
        <ValueView value={value} />
      </ChangeMark>
    )
  return (
    <>
      <ChangeMark kind={side === 'before' ? 'removed' : 'added'}>
        <ValueView value={value} />
      </ChangeMark>
      {side === 'after' ? <Delta leaf={leaf} /> : null}
    </>
  )
}

/** Glyph between the two sides: `→` for before → after, `vs` for peers (no order in time). */
const relationGlyph = (relation: DiffRelation) => (relation === 'peer' ? 'vs' : '\u2192')

/** Combined value: `before → after` (or `A vs B`) inline for changes, a single marked value otherwise. */
const CombinedValue = ({
  leaf,
  relation,
}: {
  readonly leaf: Leaf
  readonly relation: DiffRelation
}) =>
  leaf.kind === 'changed' ? (
    <span {...stylex.props(styles.inlineChange)}>
      <SideValue leaf={leaf} side="before" />
      <span aria-hidden {...stylex.props(styles.arrow)}>
        {relationGlyph(relation)}
      </span>
      <SideValue leaf={leaf} side="after" />
    </span>
  ) : (
    <SideValue leaf={leaf} side={leaf.kind === 'removed' ? 'before' : 'after'} />
  )

const PathLabel = ({ path }: { readonly path: readonly RecordPathSegment[] }) => {
  const last = path[path.length - 1]
  const parent = formatPath(path.slice(0, -1))
  const own = typeof last === 'number' ? `[${last}]` : path.length > 1 ? `.${last}` : String(last)
  return (
    <span title={formatPath(path)} {...stylex.props(styles.path)}>
      {parent === '' ? null : <span {...stylex.props(styles.pathParent)}>{parent}</span>}
      <span {...stylex.props(styles.pathKey)}>{own}</span>
    </span>
  )
}

const KindTag = ({ leaf }: { readonly leaf: Leaf }) =>
  leaf.kind === 'unchanged' ? null : (
    <span {...stylex.props(styles.kind, kindColor[leaf.kind])}>
      {leaf.kind === 'moved' ? `moved from [${leaf.movedFrom}]` : changeKindLabel[leaf.kind]}
    </span>
  )

/** Values of a leaf in the given arrangement; nested lenses and chips span both sides. */
const LeafValues = ({
  leaf,
  body,
  arrangement,
  before,
  after,
  relation,
}: {
  readonly leaf: Leaf
  readonly body: LeafBody
  readonly arrangement: DiffArrangement
  readonly before: DiffSide
  readonly after: DiffSide
  readonly relation: DiffRelation
}) => {
  switch (body._tag) {
    case 'nested':
      return (
        <NestedLens
          leaf={leaf}
          spec={body.spec}
          before={before}
          after={after}
          relation={relation}
        />
      )
    case 'chips':
      return <ListChipsDiff before={body.before} after={body.after} />
    case 'values':
      return arrangement === 'split' ? (
        <>
          <SideValue leaf={leaf} side="before" />
          <SideValue leaf={leaf} side="after" />
        </>
      ) : (
        <CombinedValue leaf={leaf} relation={relation} />
      )
  }
}

/** Folded unchanged run: a disclosure listing each unchanged path with its (shared) value. */
const UnchangedFold = ({ leaves }: { readonly leaves: NonEmpty<Leaf> }) => (
  <Disclosure {...stylex.props(styles.foldRoot)}>
    {({ isExpanded }) => (
      <>
        <Button slot="trigger" {...stylex.props(styles.fold)}>
          <span>
            {isExpanded ? `Hide ${leaves.length} unchanged` : `${leaves.length} unchanged`}
          </span>
          {isExpanded ? null : (
            <span {...stylex.props(styles.foldPaths)}>
              {leaves.map((l) => formatPath(l.path)).join(', ')}
            </span>
          )}
        </Button>
        <DisclosurePanel>
          <dl {...stylex.props(styles.unchangedList)}>
            {leaves.map((leaf) => (
              <React.Fragment key={leafKey(leaf)}>
                <dt>
                  <PathLabel path={leaf.path} />
                </dt>
                <dd {...stylex.props(styles.unchangedValue)}>
                  {leaf.after === undefined ? <Absent /> : <ValueView value={leaf.after} />}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </DisclosurePanel>
      </>
    )}
  </Disclosure>
)

// --- layouts ---

interface LayoutProps {
  readonly label: string
  readonly rows: readonly RecordRow[]
  readonly arrangement: DiffArrangement
  readonly dimUnchanged: boolean
  readonly before: DiffSide
  readonly after: DiffSide
  readonly relation: DiffRelation
}

/**
 * Row lists longer than this render through a RAC `Virtualizer` (window scrolling: only rows
 * near the viewport mount). Shorter lists keep plain table/list flow, so small records and
 * records nested inside other lenses render exactly as before.
 */
const virtualizeAbove = 50

/** Estimated sizes only: nested lenses and expanded folds make rows variable, so rows are measured. */
const recordTableLayoutOptions = { estimatedRowHeight: 34, estimatedHeadingHeight: 30 }
const recordLinesLayoutOptions = { estimatedRowSize: 28, gap: 1 }

/** L1: React Aria table. Combined: Field | before → after. Side by side: Field | Before | After. */
const RecordTable = ({
  label,
  rows,
  arrangement,
  dimUnchanged,
  before,
  after,
  relation,
}: LayoutProps) => {
  const virtualized = rows.length > virtualizeAbove
  const columns =
    arrangement === 'split'
      ? [
          { id: 'field', label: 'Field' },
          { id: 'before', label: before.label },
          { id: 'after', label: after.label },
        ]
      : [
          { id: 'field', label: 'Field' },
          { id: 'value', label: `${before.label} ${relationGlyph(relation)} ${after.label}` },
        ]
  const table = (
    <Table aria-label={label} {...stylex.props(styles.table)}>
      <TableHeader>
        {columns.map((column) => (
          <Column
            key={column.id}
            id={column.id}
            isRowHeader={column.id === 'field'}
            // Virtualized cells are absolutely positioned by `TableLayout`, so the CSS column
            // width no longer applies; hand the same split to the layout instead.
            {...(virtualized ? { width: column.id === 'field' ? '28%' : '1fr' } : {})}
            {...stylex.props(styles.th, column.id === 'field' && styles.fieldColumn)}
          >
            {column.label}
          </Column>
        ))}
      </TableHeader>
      {/* Dynamic collection: RAC caches each rendered row per item, so rows only re-render when
          the (memoized) row list or a listed dependency changes. */}
      <TableBody
        items={rows}
        dependencies={[arrangement, dimUnchanged, before, after, relation, columns.length]}
      >
        {(row) => {
          if (row._tag === 'fold') {
            const key = `fold:${leafKey(row.leaves[0])}`
            return (
              <Row
                key={key}
                id={key}
                textValue={`${row.leaves.length} unchanged`}
                {...stylex.props(styles.tr, virtualized && styles.trVirtual)}
              >
                <Cell colSpan={columns.length} {...stylex.props(styles.td)}>
                  <UnchangedFold leaves={row.leaves} />
                </Cell>
              </Row>
            )
          }
          const { leaf } = row
          const body = leafBodyOf(leaf)
          const key = leafKey(leaf)
          const valueCells =
            body._tag !== 'values' || arrangement === 'unified'
              ? [
                  <Cell key="value" colSpan={columns.length - 1} {...stylex.props(styles.td)}>
                    <LeafValues
                      leaf={leaf}
                      body={body}
                      arrangement={arrangement}
                      before={before}
                      after={after}
                      relation={relation}
                    />
                  </Cell>,
                ]
              : (['before', 'after'] as const).map((side) => (
                  <Cell key={side} {...stylex.props(styles.td)}>
                    <SideValue leaf={leaf} side={side} />
                  </Cell>
                ))
          return (
            <Row
              key={key}
              id={key}
              textValue={formatPath(leaf.path)}
              {...stylex.props(
                styles.tr,
                virtualized && styles.trVirtual,
                dimUnchanged && leaf.kind === 'unchanged' && styles.dim,
              )}
            >
              {[
                <Cell key="field" {...stylex.props(styles.td, kindAccent[leaf.kind])}>
                  <PathLabel path={leaf.path} />
                  <KindTag leaf={leaf} />
                </Cell>,
                ...valueCells,
              ]}
            </Row>
          )
        }}
      </TableBody>
    </Table>
  )
  return virtualized ? (
    <Virtualizer
      layout={TableLayout}
      layoutOptions={recordTableLayoutOptions}
      shouldObserveItemSize
    >
      {table}
    </Virtualizer>
  ) : (
    table
  )
}

/**
 * L2: compact lines in a React Aria `GridList`. Combined: `key: before → after`.
 * Side by side: two aligned `key: value` columns, like two rendered config files.
 */
const RecordLines = ({
  label,
  rows,
  arrangement,
  dimUnchanged,
  before,
  after,
  relation,
}: LayoutProps) => {
  const virtualized = rows.length > virtualizeAbove
  const list = (
    <GridList
      aria-label={label}
      items={rows}
      dependencies={[arrangement, dimUnchanged, before, after, relation]}
      {...stylex.props(styles.lines)}
    >
      {(row) => {
        if (row._tag === 'fold') {
          const key = `fold:${leafKey(row.leaves[0])}`
          return (
            <GridListItem key={key} id={key} textValue={`${row.leaves.length} unchanged`}>
              <UnchangedFold leaves={row.leaves} />
            </GridListItem>
          )
        }
        const { leaf } = row
        const body = leafBodyOf(leaf)
        const key = leafKey(leaf)
        const path = formatPath(leaf.path)
        return (
          <GridListItem
            key={key}
            id={key}
            textValue={path}
            {...stylex.props(
              styles.line,
              virtualized && styles.lineVirtual,
              kindAccent[leaf.kind],
              dimUnchanged && leaf.kind === 'unchanged' && styles.dim,
            )}
          >
            {body._tag === 'values' && arrangement === 'split' ? (
              <span {...stylex.props(styles.linePair)}>
                {(['before', 'after'] as const).map((side) => (
                  <span key={side} {...stylex.props(styles.lineSide)}>
                    <span {...stylex.props(styles.lineKey)}>{path}:</span>
                    <SideValue leaf={leaf} side={side} />
                  </span>
                ))}
              </span>
            ) : (
              <span {...stylex.props(body._tag === 'nested' ? styles.lineNested : styles.lineSide)}>
                <span {...stylex.props(styles.lineKey)}>
                  {path}: <KindTag leaf={leaf} />
                </span>
                <LeafValues
                  leaf={leaf}
                  body={body}
                  arrangement={arrangement}
                  before={before}
                  after={after}
                  relation={relation}
                />
              </span>
            )}
          </GridListItem>
        )
      }}
    </GridList>
  )
  return virtualized ? (
    <Virtualizer layout={ListLayout} layoutOptions={recordLinesLayoutOptions} shouldObserveItemSize>
      {list}
    </Virtualizer>
  ) : (
    list
  )
}

const groupOrder: readonly ChangeKind[] = ['changed', 'added', 'removed', 'moved', 'unchanged']

const groupTitle: Readonly<Record<ChangeKind, string>> = {
  changed: 'Changed',
  added: 'Added',
  removed: 'Removed',
  moved: 'Moved',
  unchanged: 'Unchanged',
}

/** L3: one table per change kind, most consequential first. */
const RecordGroups = ({
  label,
  leaves,
  arrangement,
  unchanged,
  foldUnchangedAbove,
  before,
  after,
  relation,
}: {
  readonly label: string
  readonly leaves: readonly Leaf[]
  readonly arrangement: DiffArrangement
  readonly unchanged: RecordUnchangedRows
  readonly foldUnchangedAbove: number
  readonly before: DiffSide
  readonly after: DiffSide
  readonly relation: DiffRelation
}) => {
  const groups = React.useMemo(
    () =>
      groupOrder.flatMap((kind) => {
        const [first, ...rest] = leaves.filter((leaf) => leaf.kind === kind)
        if (first === undefined) return []
        const leavesOfKind: NonEmpty<Leaf> = [first, ...rest]
        return [
          {
            kind,
            leaves: leavesOfKind,
            rows: leavesOfKind.map((leaf): RecordRow => ({ _tag: 'leaf', leaf })),
          },
        ]
      }),
    [leaves],
  )
  return (
    <div {...stylex.props(styles.groups)}>
      {groups.map((group) => {
        const { kind } = group
        const folded =
          kind === 'unchanged' &&
          unchanged === 'fold' &&
          foldUnchangedAbove > 0 &&
          group.leaves.length >= foldUnchangedAbove
        return (
          <section key={kind} aria-label={`${groupTitle[kind]} fields`}>
            <h4 {...stylex.props(styles.groupHeading, kindColor[kind])}>
              {groupTitle[kind]} · {group.leaves.length}
            </h4>
            {folded ? (
              <UnchangedFold leaves={group.leaves} />
            ) : (
              <RecordTable
                label={`${label}: ${groupTitle[kind]}`}
                rows={group.rows}
                arrangement={arrangement}
                dimUnchanged={unchanged === 'dim'}
                before={before}
                after={after}
                relation={relation}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}

// --- lens ---

/** Row layout: `table` (L1), compact `lines` (L2), or `grouped` by change kind (L3). */
export type RecordRowLayout = 'table' | 'lines' | 'grouped'

/** Unchanged rows: `fold` runs into `N unchanged`, `dim` them inline, or `hide` them behind a toggle. */
export type RecordUnchangedRows = 'fold' | 'dim' | 'hide'

/** Props for the record lens. */
export interface RecordDiffProps {
  readonly title: ReactNode
  readonly before: DiffSide
  readonly after: DiffSide
  /** Defaults to `temporal`; `peer` presents the sides as A vs B. */
  readonly relation?: DiffRelation
  readonly beforeRecord: RecordEntries
  readonly afterRecord: RecordEntries
  readonly arrangement?: DiffArrangement
  readonly defaultArrangement?: DiffArrangement
  /** Default `table`. */
  readonly rowLayout?: RecordRowLayout
  /** Default `fold`. */
  readonly unchanged?: RecordUnchangedRows
  /** With `unchanged="fold"`: runs of at least this many unchanged rows fold (default 2); `0` never folds. */
  readonly foldUnchangedAbove?: number
  readonly nested?: boolean
  readonly collapsed?: boolean
  readonly id?: string
}

const RecordDiffBody = ({
  label,
  leaves,
  before,
  after,
  relation,
  rowLayout,
  unchanged,
  foldUnchangedAbove,
}: {
  readonly label: string
  readonly leaves: readonly Leaf[]
  readonly before: DiffSide
  readonly after: DiffSide
  readonly relation: DiffRelation
  readonly rowLayout: RecordRowLayout
  readonly unchanged: RecordUnchangedRows
  readonly foldUnchangedAbove: number
}) => {
  const arrangement = useDiffArrangement()
  const [showHidden, setShowHidden] = React.useState(false)
  const hiddenCount = React.useMemo(
    () => (unchanged === 'hide' ? leaves.filter((leaf) => leaf.kind === 'unchanged').length : 0),
    [leaves, unchanged],
  )
  const hideUnchanged = hiddenCount > 0 && !showHidden
  const visibleLeaves = React.useMemo(
    () => (hideUnchanged ? leaves.filter((leaf) => leaf.kind !== 'unchanged') : leaves),
    [hideUnchanged, leaves],
  )
  const rows = React.useMemo(
    () =>
      unchanged === 'fold'
        ? foldRows(visibleLeaves, foldUnchangedAbove)
        : visibleLeaves.map((leaf): RecordRow => ({ _tag: 'leaf', leaf })),
    [foldUnchangedAbove, unchanged, visibleLeaves],
  )
  if (leaves.length === 0)
    return <div {...stylex.props(styles.emptyRecord)}>Both records are empty</div>
  const layoutProps = {
    label,
    rows,
    arrangement,
    dimUnchanged: unchanged === 'dim',
    before,
    after,
    relation,
  }
  return (
    <>
      {hiddenCount > 0 ? (
        <ToggleButton
          isSelected={showHidden}
          onChange={setShowHidden}
          {...stylex.props(styles.hiddenToggle)}
        >
          {showHidden ? `Hide ${hiddenCount} unchanged` : `Show ${hiddenCount} unchanged`}
        </ToggleButton>
      ) : null}
      {rowLayout === 'grouped' ? (
        <RecordGroups
          label={label}
          leaves={visibleLeaves}
          arrangement={arrangement}
          unchanged={unchanged}
          foldUnchangedAbove={foldUnchangedAbove}
          before={before}
          after={after}
          relation={relation}
        />
      ) : rowLayout === 'lines' ? (
        <RecordLines {...layoutProps} />
      ) : (
        <RecordTable {...layoutProps} />
      )}
    </>
  )
}

/** Record lens view: per-path rows inside `DiffFrame`, nesting text/code lenses for rich values. */
export const RecordDiff = ({
  title,
  before,
  after,
  relation = 'temporal',
  beforeRecord,
  afterRecord,
  arrangement,
  defaultArrangement,
  rowLayout = 'table',
  unchanged = 'fold',
  foldUnchangedAbove = 2,
  nested = false,
  collapsed,
  id,
}: RecordDiffProps) => {
  const model = React.useMemo(
    () => recordDiffModel(beforeRecord, afterRecord),
    [beforeRecord, afterRecord],
  )
  const leaves = React.useMemo(() => recordDiffLeaves(model.entries), [model])
  return (
    <DiffFrame
      title={title}
      lens="record"
      before={before}
      after={after}
      relation={relation}
      counts={model.counts}
      nested={nested}
      {...(arrangement === undefined ? {} : { arrangement })}
      {...(defaultArrangement === undefined ? {} : { defaultArrangement })}
      {...(collapsed === undefined ? {} : { collapsed })}
      {...(id === undefined ? {} : { id })}
    >
      <RecordDiffBody
        label={typeof title === 'string' ? title : 'Record fields'}
        leaves={leaves}
        before={before}
        after={after}
        relation={relation}
        rowLayout={rowLayout}
        unchanged={unchanged}
        foldUnchangedAbove={foldUnchangedAbove}
      />
    </DiffFrame>
  )
}

const kindColor = stylex.create({
  added: { color: tokens['--ds-green-900'] },
  removed: { color: tokens['--ds-red-900'] },
  changed: { color: tokens['--ds-amber-900'] },
  moved: { color: tokens['--ds-blue-700'] },
  unchanged: { color: tokens['--ds-gray-900'] },
})

const kindAccent = stylex.create({
  added: { boxShadow: `inset 3px 0 0 ${tokens['--ds-green-700']}` },
  removed: { boxShadow: `inset 3px 0 0 ${tokens['--ds-red-700']}` },
  changed: { boxShadow: `inset 3px 0 0 ${tokens['--ds-amber-700']}` },
  moved: { boxShadow: `inset 3px 0 0 ${tokens['--ds-blue-700']}` },
  unchanged: { boxShadow: 'none' },
})

const styles = stylex.create({
  table: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-900'],
    paddingBlock: '0.3rem',
    paddingInline: '0.6rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  fieldColumn: {
    width: '28%',
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-200'],
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
    outlineOffset: -2,
  },
  /** Virtualized: the row sits in a sized, absolutely positioned wrapper and its cells are absolutely positioned; fill the wrapper so the bottom border sits under the cells. */
  trVirtual: {
    display: 'block',
    height: '100%',
    boxSizing: 'border-box',
  },
  td: {
    verticalAlign: 'baseline',
    paddingBlock: '0.35rem',
    paddingInline: '0.6rem',
    minWidth: 0,
    overflowWrap: 'anywhere',
    color: tokens['--ds-gray-1000'],
  },
  dim: {
    opacity: 0.55,
  },
  path: {
    display: 'block',
    fontFamily: scale.fontMono,
    fontSize: '0.8rem',
    overflowWrap: 'anywhere',
  },
  pathParent: {
    color: tokens['--ds-gray-900'],
  },
  pathKey: {
    color: tokens['--ds-gray-1000'],
    fontWeight: 600,
  },
  kind: {
    display: 'block',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  inlineChange: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.4rem',
  },
  arrow: {
    color: tokens['--ds-gray-900'],
  },
  text: {
    whiteSpace: 'pre-wrap',
    color: tokens['--ds-gray-1000'],
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    fontFamily: scale.fontMono,
  },
  mono: {
    fontFamily: scale.fontMono,
    fontSize: '0.8rem',
  },
  muted: {
    color: tokens['--ds-gray-900'],
  },
  empty: {
    color: tokens['--ds-gray-900'],
    fontStyle: 'italic',
  },
  absent: {
    color: tokens['--ds-gray-900'],
    fontStyle: 'italic',
    fontSize: '0.78rem',
  },
  urlStack: {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '0.05rem',
  },
  link: {
    fontFamily: scale.fontMono,
    fontSize: '0.78rem',
    color: tokens['--ds-blue-900'],
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    overflowWrap: 'anywhere',
  },
  chips: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
  },
  chip: {
    display: 'inline-block',
    paddingInline: '0.4rem',
    borderRadius: scale.radiusDefault,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    fontSize: '0.78rem',
  },
  delta: {
    marginInlineStart: '0.5rem',
    fontFamily: scale.fontMono,
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
  },
  foldRoot: {
    minWidth: 0,
  },
  fold: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'baseline',
    width: '100%',
    paddingBlock: '0.3rem',
    paddingInline: '0.6rem',
    textAlign: 'left',
    fontSize: '0.78rem',
    color: tokens['--ds-gray-900'],
    backgroundColor: {
      default: tokens['--ds-gray-alpha-100'],
      ':hover': tokens['--ds-gray-alpha-200'],
    },
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    cursor: 'pointer',
    minWidth: 0,
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  foldPaths: {
    fontFamily: scale.fontMono,
    fontSize: '0.72rem',
    color: tokens['--ds-gray-900'],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  unchangedList: {
    display: 'grid',
    gridTemplateColumns: 'minmax(8rem, 28%) minmax(0, 1fr)',
    columnGap: '1rem',
    rowGap: '0.2rem',
    margin: 0,
    paddingBlock: '0.4rem',
    paddingInline: '0.6rem',
    color: tokens['--ds-gray-900'],
  },
  unchangedValue: {
    margin: 0,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  lines: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    fontSize: '0.84rem',
  },
  line: {
    paddingBlock: '0.2rem',
    paddingInline: '0.6rem',
    // Off-screen lines skip layout/paint; `auto` remembers each line's last rendered height.
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 1.75rem',
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
    outlineOffset: -2,
  },
  /** Virtualized: the virtualizer already skips off-screen lines and must measure real heights, which content-visibility would hide. */
  lineVirtual: {
    contentVisibility: 'visible',
    containIntrinsicSize: 'none',
  },
  linePair: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: '1.25rem',
  },
  lineSide: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.5rem',
    minWidth: 0,
  },
  lineNested: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    minWidth: 0,
  },
  lineKey: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    fontFamily: scale.fontMono,
    fontSize: '0.8rem',
    color: tokens['--ds-gray-900'],
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  groupHeading: {
    margin: 0,
    marginBottom: '0.3rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  hiddenToggle: {
    marginBottom: '0.5rem',
    paddingBlock: '0.2rem',
    paddingInline: '0.6rem',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-1000'],
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': tokens['--ds-gray-alpha-100'],
      ':is([data-selected])': tokens['--ds-gray-alpha-200'],
    },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  emptyRecord: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.85rem',
  },
})
