/**
 * Document lens: diffs two versions of a structured document (a Notion-like ordered block
 * tree plus title, location and properties) and renders it as a readable document rather
 * than as a raw tree.
 *
 * Matching: blocks pair by stable `id` when both sides carry one; otherwise by exact
 * content signature (LCS over each sibling list), then leftover blocks of the same type
 * pair as `changed` by word similarity. Out-of-order pairs and blocks whose id appears
 * under a different parent become `moved` (a ghost at the old position, the block at the
 * new one). Embedded files, custom blocks and properties expose render slots so callers
 * can nest other lenses.
 *
 * Arrangements: combined renders one document with removed blocks ghosted and added ones
 * highlighted; side by side renders two aligned columns (one grid row per block pair, gap
 * placeholders where a side has no block). Blocks with children use React Aria
 * `Disclosure`. Inline word diffs stay hand-rolled: `@pierre/diffs` renders line-oriented
 * code views and exposes no word-diff primitive for rendered prose blocks.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import { Button, Disclosure, DisclosurePanel, Link } from 'react-aria-components'

import type {
  ChangeCounts,
  ChangeKind,
  DiffArrangement,
  DiffRelation,
  DiffSide,
} from './contract.ts'
import {
  changeKindStyles,
  ChangeMark,
  DiffFrame,
  useDiffArrangement,
  withOccurrenceKeys,
} from './DiffFrame.tsx'

// ---------------------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------------------

/** Fields every block carries. */
export interface BlockBase {
  readonly id?: string
  /**
   * Explains a change that is not visible in the content, e.g. `regenerated` or
   * `re-uploaded, same bytes`. On the after block (before block for removals); a paired
   * block with a note counts as `changed` even when its content is identical.
   */
  readonly note?: string
}

/** Embedded image/file/PDF block; `fingerprint` (e.g. a content hash) detects swapped files. */
export interface EmbedBlock extends BlockBase {
  readonly _tag: 'embed'
  readonly media: 'image' | 'file' | 'pdf'
  readonly name: string
  /** The file itself (image, PDF, …). */
  readonly src?: string
  /** Rendered thumbnail, e.g. the first PDF page as an image; images fall back to `src`. */
  readonly preview?: string
  /** Where to open the file; defaults to `src`. */
  readonly href?: string
  readonly fingerprint?: string
  readonly caption?: string
  /** Short secondary line, e.g. `3 pages · 212 KB`. */
  readonly meta?: string
}

/** Open extension block; `signature` is the text used for matching and default rendering. */
export interface CustomBlock extends BlockBase {
  readonly _tag: 'custom'
  readonly customType: string
  readonly signature: string
  readonly data?: unknown
}

/** One block of a structured document. */
export type DocBlock =
  | (BlockBase & { readonly _tag: 'heading'; readonly level: 1 | 2 | 3; readonly text: string })
  | (BlockBase & { readonly _tag: 'paragraph'; readonly text: string })
  | (BlockBase & {
      readonly _tag: 'listItem'
      readonly style: 'bulleted' | 'numbered'
      readonly text: string
      readonly children?: readonly DocBlock[]
    })
  | (BlockBase & { readonly _tag: 'todo'; readonly checked: boolean; readonly text: string })
  | (BlockBase & { readonly _tag: 'callout'; readonly label?: string; readonly text: string })
  | (BlockBase & {
      readonly _tag: 'toggle'
      readonly text: string
      readonly children: readonly DocBlock[]
    })
  | EmbedBlock
  | (BlockBase & { readonly _tag: 'childPage'; readonly title: string })
  | CustomBlock

/** One captured version of a document. */
export interface DocSnapshot {
  readonly title: string
  /** Ancestor path from the workspace root to the parent, e.g. `['Finance', 'Inbox']`. */
  readonly location?: readonly string[]
  readonly properties?: Readonly<Record<string, string>>
  readonly blocks: readonly DocBlock[]
}

// ---------------------------------------------------------------------------------------
// Word diff (private; a sibling TextDiff lens has its own, see report)
// ---------------------------------------------------------------------------------------

/** One segment of an inline word diff. */
export interface WordOp {
  readonly op: 'equal' | 'insert' | 'delete'
  readonly text: string
}

const lcsPairs = <A, B>(
  a: readonly A[],
  b: readonly B[],
  eq: (x: A, y: B) => boolean,
): ReadonlyArray<readonly [number, number]> => {
  const n = a.length
  const m = b.length
  const w = m + 1
  const t = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] = eq(a[i] as A, b[j] as B)
        ? (t[(i + 1) * w + j + 1] ?? 0) + 1
        : Math.max(t[(i + 1) * w + j] ?? 0, t[i * w + j + 1] ?? 0)
    }
  }
  const out: Array<readonly [number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(a[i] as A, b[j] as B)) {
      out.push([i, j])
      i++
      j++
    } else if ((t[(i + 1) * w + j] ?? 0) >= (t[i * w + j + 1] ?? 0)) i++
    else j++
  }
  return out
}

const tokenize = (text: string): readonly string[] => text.match(/\s+|[^\s]+/g) ?? []

const pushOp = (ops: WordOp[], op: WordOp['op'], text: string): void => {
  const last = ops.at(-1)
  if (last?.op === op) ops[ops.length - 1] = { op, text: last.text + text }
  else ops.push({ op, text })
}

/** Beyond this many token comparisons the word diff degrades to delete-all/insert-all. */
const WORD_DIFF_BUDGET = 250_000

/** Minimal word-level diff (LCS over word and whitespace tokens). */
export const wordDiff = (before: string, after: string): readonly WordOp[] => {
  const a = tokenize(before)
  const b = tokenize(after)
  const ops: WordOp[] = []
  if (a.length * b.length > WORD_DIFF_BUDGET) {
    if (before) ops.push({ op: 'delete', text: before })
    if (after) ops.push({ op: 'insert', text: after })
    return ops
  }
  let i = 0
  let j = 0
  for (const [pi, pj] of [...lcsPairs(a, b, (x, y) => x === y), [a.length, b.length] as const]) {
    for (; i < pi; i++) pushOp(ops, 'delete', a[i] ?? '')
    for (; j < pj; j++) pushOp(ops, 'insert', b[j] ?? '')
    if (pi < a.length) pushOp(ops, 'equal', a[pi] ?? '')
    i = pi + 1
    j = pj + 1
  }
  return ops
}

// ---------------------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------------------

type DocBlockTag = DocBlock['_tag']

const blockText = (block: DocBlock): string | undefined => {
  switch (block._tag) {
    case 'heading':
    case 'paragraph':
    case 'listItem':
    case 'todo':
    case 'callout':
    case 'toggle':
      return block.text
    case 'childPage':
      return block.title
    case 'embed':
    case 'custom':
      return undefined
  }
}

const blockChildren = (block: DocBlock): readonly DocBlock[] =>
  block._tag === 'toggle' || block._tag === 'listItem' ? (block.children ?? []) : []

/**
 * Full self-content signature (children excluded): equal signatures mean an unchanged block.
 * A fingerprinted embed is identified by its fingerprint alone: file URLs (e.g. presigned Notion
 * URLs) rotate per fetch and never establish sameness or difference (MED.BLK.DIFF-R92).
 */
const signature = (block: DocBlock): string => {
  switch (block._tag) {
    case 'heading':
      return `heading|${block.level}|${block.text}`
    case 'paragraph':
      return `paragraph|${block.text}`
    case 'listItem':
      return `listItem|${block.style}|${block.text}`
    case 'todo':
      return `todo|${block.checked ? 'x' : ' '}|${block.text}`
    case 'callout':
      return `callout|${block.label ?? ''}|${block.text}`
    case 'toggle':
      return `toggle|${block.text}`
    case 'embed':
      return `embed|${block.media}|${block.name}|${block.fingerprint === undefined ? `src:${block.src ?? ''}` : `hash:${block.fingerprint}`}|${block.caption ?? ''}|${block.meta ?? ''}`
    case 'childPage':
      return `childPage|${block.title}`
    case 'custom':
      return `custom|${block.customType}|${block.signature}`
  }
}

const words = (text: string): readonly string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)

/** A block's lowercase word multiset, built once per block for the similarity pass. */
interface WordBag {
  readonly counts: ReadonlyMap<string, number>
  readonly size: number
}

const wordBag = (block: DocBlock): WordBag => {
  const text =
    block._tag === 'embed'
      ? block.name
      : block._tag === 'custom'
        ? block.signature
        : (blockText(block) ?? '')
  const list = words(text)
  const counts = new Map<string, number>()
  for (const word of list) counts.set(word, (counts.get(word) ?? 0) + 1)
  return { counts, size: list.length }
}

/** Blocks of different kinds score 0, so only same-kind pairs are ever compared. */
const similarityKind = (block: DocBlock): string =>
  block._tag === 'embed'
    ? `embed|${block.media}`
    : block._tag === 'custom'
      ? `custom|${block.customType}`
      : block._tag

/** Sørensen–Dice overlap of two word multisets, in [0, 1]; `undefined` when it cannot reach `floor`. */
const dice = (a: WordBag, b: WordBag, floor: number): number | undefined => {
  const total = a.size + b.size
  if (total === 0) return 1
  if ((2 * Math.min(a.size, b.size)) / total < floor) return undefined
  const [small, large] =
    a.counts.size <= b.counts.size ? [a.counts, b.counts] : [b.counts, a.counts]
  let shared = 0
  for (const [word, count] of small) shared += Math.min(count, large.get(word) ?? 0)
  return (2 * shared) / total
}

/**
 * Content similarity between two same-kind id-less blocks (see {@link similarityKind}).
 * Embeds of the same media start at 0.5; everything else is the word-bag Dice overlap.
 */
const bagSimilarity = (tag: DocBlockTag, a: WordBag, b: WordBag): number => {
  if (tag === 'embed') return 0.5 + 0.5 * (dice(a, b, 0) ?? 0)
  return dice(a, b, SIMILARITY_THRESHOLD) ?? 0
}

/** Minimum similarity for two unmatched id-less blocks to count as one `changed` block. */
const SIMILARITY_THRESHOLD = 0.4

const shorten = (text: string, max = 40): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

const blockLabel = (block: DocBlock): string => {
  if (block._tag === 'embed') return block.name
  if (block._tag === 'custom') return `${block.customType}: ${block.signature}`
  return blockText(block) ?? block._tag
}

// ---------------------------------------------------------------------------------------
// Diff model
// ---------------------------------------------------------------------------------------

/** Where a moved block came from / went to. */
export interface BlockMove {
  /** `source` is the ghost at the old position, `target` the block at its new position. */
  readonly role: 'source' | 'target'
  /** `sibling`: reordered within the same parent; `parent`: re-parented. */
  readonly scope: 'sibling' | 'parent'
  /** Human-readable location on the other end of the move. */
  readonly counterpart: string
}

/** One aligned block of the merged document. */
export interface BlockRow {
  readonly key: string
  readonly kind: ChangeKind
  readonly depth: number
  readonly before?: DocBlock | undefined
  readonly after?: DocBlock | undefined
  readonly move?: BlockMove | undefined
  /** True when the block's own content differs (independent of `kind`, e.g. moved and edited). */
  readonly contentChanged: boolean
  /** Inline word diff for changed text-bearing blocks. */
  readonly textDiff?: readonly WordOp[] | undefined
  /** Semantic-only change annotation carried by the block (see {@link BlockBase.note}). */
  readonly note?: string | undefined
  readonly children: readonly BlockRow[]
  /** Number of non-unchanged rows anywhere below this row. */
  readonly descendantChanges: number
}

/** One property (key/value) comparison. */
export interface PropertyChange {
  readonly key: string
  readonly kind: ChangeKind
  readonly before?: string | undefined
  readonly after?: string | undefined
}

/** Complete change model for a document pair. */
export interface DocumentDiffModel {
  readonly title: {
    readonly kind: ChangeKind
    readonly before: string
    readonly after: string
    readonly diff: readonly WordOp[]
  }
  readonly location: {
    readonly kind: ChangeKind
    readonly before: readonly string[]
    readonly after: readonly string[]
  }
  readonly properties: readonly PropertyChange[]
  readonly rows: readonly BlockRow[]
  /** Block-level counts (moves counted once, at the target). */
  readonly blockCounts: ChangeCounts
  /** Blocks + title + location + properties. */
  readonly counts: ChangeCounts
}

interface IndexedBlock {
  readonly block: DocBlock
  readonly parentLabel: string
}

const indexIds = (blocks: readonly DocBlock[]): ReadonlyMap<string, IndexedBlock> => {
  const index = new Map<string, IndexedBlock>()
  const walk = (list: readonly DocBlock[], parentLabel: string): void => {
    for (const block of list) {
      if (block.id !== undefined) index.set(block.id, { block, parentLabel })
      walk(blockChildren(block), `under "${shorten(blockLabel(block), 28)}"`)
    }
  }
  walk(blocks, 'top level')
  return index
}

type BeforeSlot =
  | { readonly _tag: 'anchor'; readonly afterIndex: number }
  | { readonly _tag: 'pairedLater' }
  | { readonly _tag: 'removed' }
  | { readonly _tag: 'moveSource'; readonly move: BlockMove }

type AfterSlot =
  | { readonly _tag: 'anchor'; readonly beforeIndex: number }
  | { readonly _tag: 'changed'; readonly before: DocBlock }
  | { readonly _tag: 'moveTarget'; readonly before: DocBlock; readonly move: BlockMove }
  | { readonly _tag: 'added' }

interface DiffContext {
  readonly beforeIds: ReadonlyMap<string, IndexedBlock>
  readonly afterIds: ReadonlyMap<string, IndexedBlock>
}

const countDescendants = (children: readonly BlockRow[]): number =>
  children.reduce((sum, row) => sum + (row.kind === 'unchanged' ? 0 : 1) + row.descendantChanges, 0)

const pairRow = (
  ctx: DiffContext,
  key: string,
  depth: number,
  before: DocBlock,
  after: DocBlock,
  move: BlockMove | undefined,
): BlockRow => {
  const contentChanged = signature(before) !== signature(after)
  const beforeText = blockText(before)
  const afterText = blockText(after)
  const children = diffLevel(ctx, blockChildren(before), blockChildren(after), depth + 1, key)
  return {
    key,
    kind: move ? 'moved' : contentChanged || after.note !== undefined ? 'changed' : 'unchanged',
    depth,
    before,
    after,
    move,
    contentChanged,
    note: after.note,
    textDiff:
      contentChanged &&
      beforeText !== undefined &&
      afterText !== undefined &&
      beforeText !== afterText
        ? wordDiff(beforeText, afterText)
        : undefined,
    children,
    descendantChanges: countDescendants(children),
  }
}

const oneSidedRow = (
  ctx: DiffContext,
  key: string,
  depth: number,
  side: 'before' | 'after',
  block: DocBlock,
): BlockRow => {
  const children =
    side === 'before'
      ? diffLevel(ctx, blockChildren(block), [], depth + 1, key)
      : diffLevel(ctx, [], blockChildren(block), depth + 1, key)
  return {
    key,
    kind: side === 'before' ? 'removed' : 'added',
    depth,
    before: side === 'before' ? block : undefined,
    after: side === 'after' ? block : undefined,
    contentChanged: true,
    note: block.note,
    children,
    descendantChanges: countDescendants(children),
  }
}

/** Interns `value` to a dense integer id within `table`. */
const intern = (table: Map<string, number>, value: string): number => {
  let id = table.get(value)
  if (id === undefined) {
    id = table.size
    table.set(value, id)
  }
  return id
}

/** Before-block indices sharing one match key; `pos` skips entries already consumed. */
interface Bucket {
  readonly indices: number[]
  pos: number
}

const pushBucket = (buckets: Map<number, Bucket>, key: number, i: number): void => {
  const bucket = buckets.get(key)
  if (bucket) bucket.indices.push(i)
  else buckets.set(key, { indices: [i], pos: 0 })
}

/** Aligns one sibling list; recursion handles children of every emitted row. */
const diffLevel = (
  ctx: DiffContext,
  before: readonly DocBlock[],
  after: readonly DocBlock[],
  depth: number,
  parentKey: string,
): readonly BlockRow[] => {
  const beforeLevelIds = new Set(before.flatMap((b) => (b.id === undefined ? [] : [b.id])))
  const afterLevelIds = new Set(after.flatMap((b) => (b.id === undefined ? [] : [b.id])))

  const beforeSlots: Array<BeforeSlot | undefined> = before.map(() => undefined)
  const afterSlots: Array<AfterSlot | undefined> = after.map(() => undefined)

  // Re-parented blocks: id known elsewhere in the other tree but not in this sibling list.
  before.forEach((block, i) => {
    if (block.id === undefined || afterLevelIds.has(block.id)) return
    const target = ctx.afterIds.get(block.id)
    if (target) {
      beforeSlots[i] = {
        _tag: 'moveSource',
        move: { role: 'source', scope: 'parent', counterpart: target.parentLabel },
      }
    }
  })
  after.forEach((block, j) => {
    if (block.id === undefined || beforeLevelIds.has(block.id)) return
    const source = ctx.beforeIds.get(block.id)
    if (source) {
      afterSlots[j] = {
        _tag: 'moveTarget',
        before: source.block,
        move: { role: 'target', scope: 'parent', counterpart: source.parentLabel },
      }
    }
  })

  // Per-block match keys, computed once per sibling list: signatures and ids interned to
  // integers so the LCS table and the move/similarity passes compare numbers, not strings.
  const sigIds = new Map<string, number>()
  const idIds = new Map<string, number>()
  const beforeSig = before.map((block) => intern(sigIds, signature(block)))
  const afterSig = after.map((block) => intern(sigIds, signature(block)))
  const beforeId = before.map((block) => (block.id === undefined ? -1 : intern(idIds, block.id)))
  const afterId = after.map((block) => (block.id === undefined ? -1 : intern(idIds, block.id)))
  const sameBlock = (i: number, j: number): boolean =>
    beforeId[i]! !== -1 && afterId[j]! !== -1
      ? beforeId[i] === afterId[j]
      : beforeSig[i] === afterSig[j]

  const freeBefore = before.flatMap((_, i) => (beforeSlots[i] ? [] : [i]))
  const freeAfter = after.flatMap((_, j) => (afterSlots[j] ? [] : [j]))
  for (const [x, y] of lcsPairs(freeBefore, freeAfter, sameBlock)) {
    const i = freeBefore[x]!
    const j = freeAfter[y]!
    beforeSlots[i] = { _tag: 'anchor', afterIndex: j }
    afterSlots[j] = { _tag: 'anchor', beforeIndex: i }
  }

  // Out-of-order pairs (same id, or identical id-less content) become sibling moves: each
  // leftover after-block takes the first leftover before-block it matches. Buckets keep this
  // linear: by id (both sides carry ids), by signature among id-less before-blocks (after-block
  // has an id), and by signature among all before-blocks (after-block is id-less).
  const byId = new Map<number, Bucket>()
  const bySigIdless = new Map<number, Bucket>()
  const bySigAll = new Map<number, Bucket>()
  before.forEach((_, i) => {
    if (beforeSlots[i]) return
    if (beforeId[i] !== -1) pushBucket(byId, beforeId[i]!, i)
    else pushBucket(bySigIdless, beforeSig[i]!, i)
    pushBucket(bySigAll, beforeSig[i]!, i)
  })
  /** First still-unmatched before index in a bucket (consumed entries are skipped for good). */
  const firstFree = (bucket: Bucket | undefined): number => {
    if (!bucket) return -1
    while (bucket.pos < bucket.indices.length && beforeSlots[bucket.indices[bucket.pos]!])
      bucket.pos++
    return bucket.pos < bucket.indices.length ? bucket.indices[bucket.pos]! : -1
  }
  after.forEach((_, j) => {
    if (afterSlots[j]) return
    let i: number
    if (afterId[j] !== -1) {
      const viaId = firstFree(byId.get(afterId[j]!))
      const viaSig = firstFree(bySigIdless.get(afterSig[j]!))
      i = viaId === -1 ? viaSig : viaSig === -1 ? viaId : Math.min(viaId, viaSig)
    } else i = firstFree(bySigAll.get(afterSig[j]!))
    const match = before[i]
    if (i === -1 || !match) return
    beforeSlots[i] = {
      _tag: 'moveSource',
      move: { role: 'source', scope: 'sibling', counterpart: `position ${j + 1}` },
    }
    afterSlots[j] = {
      _tag: 'moveTarget',
      before: match,
      move: { role: 'target', scope: 'sibling', counterpart: `position ${i + 1}` },
    }
  })

  // Similar leftovers pair as `changed` (never across two distinct stable ids), best first.
  // Word bags are built once per block; pairs are bucketed by comparable kind and pruned by the
  // Dice length bound (2·min/(sum) < threshold can never qualify), which leaves results exact.
  const leftBefore = before.flatMap((_, i) => (beforeSlots[i] ? [] : [i]))
  const leftAfter = after.flatMap((_, j) => (afterSlots[j] ? [] : [j]))
  const candidates: Array<{ readonly i: number; readonly j: number; readonly score: number }> = []
  if (leftBefore.length > 0 && leftAfter.length > 0) {
    const afterByKind = new Map<string, number[]>()
    for (const j of leftAfter) {
      const kind = similarityKind(after[j]!)
      const list = afterByKind.get(kind)
      if (list) list.push(j)
      else afterByKind.set(kind, [j])
    }
    const afterBags = new Map<number, WordBag>()
    for (const i of leftBefore) {
      const b = before[i]!
      const peers = afterByKind.get(similarityKind(b))
      if (!peers) continue
      const bBag = wordBag(b)
      for (const j of peers) {
        const a = after[j]!
        if (b.id !== undefined && a.id !== undefined) continue
        let aBag = afterBags.get(j)
        if (!aBag) {
          aBag = wordBag(a)
          afterBags.set(j, aBag)
        }
        const score = bagSimilarity(b._tag, bBag, aBag)
        if (score >= SIMILARITY_THRESHOLD) candidates.push({ i, j, score })
      }
    }
  }
  candidates.sort((x, y) => y.score - x.score || Math.abs(x.i - x.j) - Math.abs(y.i - y.j))
  for (const { i, j } of candidates) {
    const b = before[i]
    if (beforeSlots[i] || afterSlots[j] || !b) continue
    beforeSlots[i] = { _tag: 'pairedLater' }
    afterSlots[j] = { _tag: 'changed', before: b }
  }

  // Merge: before-only rows flush ahead of the next anchor; after-side rows keep after order.
  const rows: BlockRow[] = []
  let cursor = 0
  const nextKey = () => `${parentKey}.${rows.length}`
  const flushBefore = (until: number): void => {
    for (; cursor < until; cursor++) {
      const slot = beforeSlots[cursor] ?? { _tag: 'removed' }
      const block = before[cursor]
      if (!block) continue
      if (slot._tag === 'removed') rows.push(oneSidedRow(ctx, nextKey(), depth, 'before', block))
      else if (slot._tag === 'moveSource')
        rows.push({
          key: nextKey(),
          kind: 'moved',
          depth,
          before: block,
          move: slot.move,
          contentChanged: false,
          children: [],
          descendantChanges: 0,
        })
    }
  }
  after.forEach((block, j) => {
    const slot = afterSlots[j] ?? { _tag: 'added' }
    switch (slot._tag) {
      case 'anchor': {
        flushBefore(slot.beforeIndex)
        cursor = slot.beforeIndex + 1
        const b = before[slot.beforeIndex]
        if (b) rows.push(pairRow(ctx, nextKey(), depth, b, block, undefined))
        return
      }
      case 'changed':
        rows.push(pairRow(ctx, nextKey(), depth, slot.before, block, undefined))
        return
      case 'moveTarget':
        rows.push(pairRow(ctx, nextKey(), depth, slot.before, block, slot.move))
        return
      case 'added':
        rows.push(oneSidedRow(ctx, nextKey(), depth, 'after', block))
        return
    }
  })
  flushBefore(before.length)
  return rows
}

const addCount = (counts: Partial<Record<ChangeKind, number>>, kind: ChangeKind, n = 1): void => {
  counts[kind] = (counts[kind] ?? 0) + n
}

const countRows = (
  rows: readonly BlockRow[],
  counts: Partial<Record<ChangeKind, number>>,
): void => {
  for (const row of rows) {
    if (row.move?.role !== 'source') addCount(counts, row.kind)
    countRows(row.children, counts)
  }
}

const diffProperties = (
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): readonly PropertyChange[] => {
  const keys = [...Object.keys(before), ...Object.keys(after).filter((key) => !(key in before))]
  return keys.map((key) => {
    const b = before[key]
    const a = after[key]
    const kind: ChangeKind =
      b === undefined ? 'added' : a === undefined ? 'removed' : a === b ? 'unchanged' : 'changed'
    return { key, kind, before: b, after: a }
  })
}

/** Pure change model for a document pair. */
export const diffDocument = (before: DocSnapshot, after: DocSnapshot): DocumentDiffModel => {
  const ctx: DiffContext = { beforeIds: indexIds(before.blocks), afterIds: indexIds(after.blocks) }
  const rows = diffLevel(ctx, before.blocks, after.blocks, 0, 'b')
  const blockCounts: Partial<Record<ChangeKind, number>> = {}
  countRows(rows, blockCounts)

  const properties = diffProperties(before.properties ?? {}, after.properties ?? {})
  const beforeLocation = before.location ?? []
  const afterLocation = after.location ?? []
  const locationKind: ChangeKind =
    beforeLocation.join('\u0000') === afterLocation.join('\u0000') ? 'unchanged' : 'moved'
  const titleKind: ChangeKind = before.title === after.title ? 'unchanged' : 'changed'

  const counts: Partial<Record<ChangeKind, number>> = { ...blockCounts }
  for (const property of properties) addCount(counts, property.kind)
  if (titleKind !== 'unchanged') addCount(counts, titleKind)
  if (locationKind !== 'unchanged') addCount(counts, locationKind)

  return {
    title: {
      kind: titleKind,
      before: before.title,
      after: after.title,
      diff: titleKind === 'unchanged' ? [] : wordDiff(before.title, after.title),
    },
    location: { kind: locationKind, before: beforeLocation, after: afterLocation },
    properties,
    rows,
    blockCounts,
    counts,
  }
}

// ---------------------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------------------

/**
 * Change marker: `bar` (colored inline-start bar, prose stays untinted), `glyph`
 * (`+ − ~ ↕` column plus a background tint) or `tint` (background tint only).
 */
export type DocumentGutter = 'bar' | 'glyph' | 'tint'

/**
 * Removed blocks in the combined arrangement: `inline` (ghosted and struck in place),
 * `collapsed` (an expandable `N removed` marker in place) or `margin` (ghosted in a side
 * margin next to where they were). Side by side always shows them in the before column.
 */
export type DocumentRemovedPresentation = 'inline' | 'collapsed' | 'margin'

/** Embeds as a `card` (thumbnail + open link) or a collapsed `chip` that expands to the card. */
export type DocumentEmbedPresentation = 'card' | 'chip'

/** Props for {@link DocumentDiff}. */
export interface DocumentDiffProps {
  readonly id?: string
  /** Frame heading; defaults to the after-side document title. */
  readonly title?: React.ReactNode
  readonly before: DocSnapshot
  readonly after: DocSnapshot
  readonly beforeSide: DiffSide
  readonly afterSide: DiffSide
  readonly arrangement?: DiffArrangement
  /** Defaults to `temporal`; `peer` presents the sides as A vs B. */
  readonly relation?: DiffRelation
  readonly defaultArrangement?: DiffArrangement
  readonly nested?: boolean
  readonly defaultCollapsed?: boolean
  /** Fold runs of at least this many unchanged blocks; `0` disables folding. Default 3. */
  readonly foldUnchanged?: number
  /** Default `bar`. */
  readonly gutter?: DocumentGutter
  /** Default `inline`. */
  readonly removed?: DocumentRemovedPresentation
  /** Default `card`. */
  readonly embeds?: DocumentEmbedPresentation
  /**
   * Render slot for a changed (or moved-and-edited) embed pair, e.g. a nested image lens.
   * Return `undefined` to fall back to the built-in before/after embeds.
   */
  readonly renderEmbed?: (before: EmbedBlock, after: EmbedBlock) => React.ReactNode | undefined
  /** Replaces the built-in property table, e.g. with a nested record lens. */
  readonly renderProperties?: (
    changes: readonly PropertyChange[],
    before: Readonly<Record<string, string>>,
    after: Readonly<Record<string, string>>,
  ) => React.ReactNode
  /** Renders `custom` blocks; defaults to a labelled card showing the signature. */
  readonly renderCustom?: (block: CustomBlock, side: 'before' | 'after') => React.ReactNode
}

interface ViewOptions {
  readonly arrangement: DiffArrangement
  readonly gutter: DocumentGutter
  readonly removed: DocumentRemovedPresentation
  readonly embeds: DocumentEmbedPresentation
  readonly renderEmbed: DocumentDiffProps['renderEmbed']
  readonly renderCustom: DocumentDiffProps['renderCustom']
}

interface RowItem {
  readonly _tag: 'row'
  readonly row: BlockRow
  readonly beforeOrdinal: number | undefined
  readonly afterOrdinal: number | undefined
  readonly children: readonly ViewItem[]
}

type ViewItem =
  | RowItem
  /** Run of unchanged blocks folded behind a disclosure. */
  | {
      readonly _tag: 'fold'
      readonly key: string
      readonly depth: number
      readonly items: readonly RowItem[]
    }
  /** Run of removed blocks behind an `N removed` disclosure (combined + `collapsed` only). */
  | {
      readonly _tag: 'removedRun'
      readonly key: string
      readonly depth: number
      readonly items: readonly RowItem[]
    }

const isQuiet = (row: BlockRow): boolean => row.kind === 'unchanged' && row.descendantChanges === 0

const countBlocks = (rows: readonly BlockRow[]): number =>
  rows.reduce((sum, row) => sum + 1 + countBlocks(row.children), 0)

const isNumbered = (block: DocBlock | undefined): boolean =>
  block?._tag === 'listItem' && block.style === 'numbered'

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/** Numbers list items per side, then groups runs: long unchanged runs fold, removed runs group on request. */
const buildView = (
  rows: readonly BlockRow[],
  foldAt: number,
  groupRemoved: boolean,
): readonly ViewItem[] => {
  let beforeOrdinal = 0
  let afterOrdinal = 0
  const items = rows.map((row): RowItem => {
    const beforeCounts = row.before !== undefined && row.move?.role !== 'target'
    const afterCounts = row.after !== undefined
    if (beforeCounts) beforeOrdinal = isNumbered(row.before) ? beforeOrdinal + 1 : 0
    if (afterCounts) afterOrdinal = isNumbered(row.after) ? afterOrdinal + 1 : 0
    return {
      _tag: 'row',
      row,
      beforeOrdinal: beforeCounts && isNumbered(row.before) ? beforeOrdinal : undefined,
      afterOrdinal: afterCounts && isNumbered(row.after) ? afterOrdinal : undefined,
      children: buildView(row.children, foldAt, groupRemoved),
    }
  })
  const out: ViewItem[] = []
  let i = 0
  while (i < items.length) {
    const start = i
    const first = items[i]
    if (!first) break
    if (isQuiet(first.row)) {
      while (items[i] !== undefined && isQuiet((items[i] as RowItem).row)) i++
      const run = items.slice(start, i)
      const head = run[0]
      const tail = run.at(-1)
      // Keep one block of context on each side of a folded run.
      if (foldAt > 0 && run.length >= foldAt && run.length > 2 && head && tail) {
        out.push(
          head,
          {
            _tag: 'fold',
            key: `fold-${head.row.key}`,
            depth: head.row.depth,
            items: run.slice(1, -1),
          },
          tail,
        )
      } else out.push(...run)
    } else if (groupRemoved && first.row.kind === 'removed') {
      while (items[i]?.row.kind === 'removed') i++
      out.push({
        _tag: 'removedRun',
        key: `removed-${first.row.key}`,
        depth: first.row.depth,
        items: items.slice(start, i),
      })
    } else {
      out.push(first)
      i++
    }
  }
  return out
}

const GLYPH: Readonly<Record<ChangeKind, string>> = {
  added: '+',
  removed: '−',
  changed: '~',
  moved: '↕',
  unchanged: '',
}

/** Text with an optional inline word diff; `side` selects which half of the diff to show. */
const DiffText = ({
  text,
  diff,
  side,
}: {
  readonly text: string
  readonly diff: readonly WordOp[] | undefined
  readonly side: 'before' | 'after' | 'both'
}): React.ReactNode => {
  if (!diff) return text
  return withOccurrenceKeys(diff, (op) => `${op.op}:${op.text}`).map(({ key, item: op }) => {
    if (op.op === 'equal') return <React.Fragment key={key}>{op.text}</React.Fragment>
    if (op.op === 'delete')
      return side === 'after' ? null : (
        <ChangeMark key={key} kind="removed">
          {op.text}
        </ChangeMark>
      )
    return side === 'before' ? null : (
      <ChangeMark key={key} kind="added">
        {op.text}
      </ChangeMark>
    )
  })
}

const Chevron = ({
  isExpanded,
  label,
}: {
  readonly isExpanded: boolean
  readonly label: string
}): React.ReactNode => (
  <Button
    slot="trigger"
    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
    {...stylex.props(styles.chevron)}
  >
    <span aria-hidden {...stylex.props(styles.chevronGlyph, isExpanded && styles.chevronOpen)}>
      ›
    </span>
  </Button>
)

/** Thumbnail (render preview, or the image itself), name, meta and an open link. */
const EmbedCard = ({ block }: { readonly block: EmbedBlock }): React.ReactNode => {
  const thumb = block.preview ?? (block.media === 'image' ? block.src : undefined)
  const href = block.href ?? block.src
  return (
    <div {...stylex.props(styles.embed)}>
      {thumb ? (
        <img
          src={thumb}
          alt={block.caption ?? `${block.name} preview`}
          loading="lazy"
          decoding="async"
          {...stylex.props(styles.embedThumb)}
        />
      ) : (
        <span aria-hidden {...stylex.props(styles.embedThumb, styles.embedPlaceholder)}>
          {block.media.toUpperCase()}
        </span>
      )}
      <span {...stylex.props(styles.embedText)}>
        <span {...stylex.props(styles.embedTitle)}>
          <span {...stylex.props(styles.embedMedia)}>{block.media}</span>
          <span {...stylex.props(styles.embedName)}>{block.name}</span>
        </span>
        {block.meta || block.fingerprint ? (
          <span {...stylex.props(styles.muted)}>
            {[block.meta, block.fingerprint ? `sha ${block.fingerprint.slice(0, 10)}` : undefined]
              .filter(Boolean)
              .join(' · ')}
          </span>
        ) : null}
        {block.caption ? <span {...stylex.props(styles.muted)}>{block.caption}</span> : null}
        {href ? (
          <Link href={href} target="_blank" rel="noreferrer" {...stylex.props(styles.embedLink)}>
            Open {block.media === 'image' ? 'image' : block.media === 'pdf' ? 'PDF' : 'file'} ↗
          </Link>
        ) : null}
      </span>
    </div>
  )
}

const EmbedView = ({
  block,
  options,
}: {
  readonly block: EmbedBlock
  readonly options: ViewOptions
}): React.ReactNode =>
  options.embeds === 'card' ? (
    <EmbedCard block={block} />
  ) : (
    <Disclosure {...stylex.props(styles.group)}>
      {({ isExpanded }) => (
        <>
          <Button slot="trigger" {...stylex.props(styles.embedChip)}>
            <span {...stylex.props(styles.embedMedia)}>{block.media}</span>
            <span {...stylex.props(styles.embedName)}>{block.name}</span>
            <span
              aria-hidden
              {...stylex.props(styles.chevronGlyph, isExpanded && styles.chevronOpen)}
            >
              ›
            </span>
          </Button>
          <DisclosurePanel>
            <EmbedCard block={block} />
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )

/** Renders one block the way a document would, optionally with an inline word diff. */
const BlockBody = ({
  block,
  diff,
  side,
  ordinal,
  chevron,
  hiddenChildren,
  options,
}: {
  readonly block: DocBlock
  readonly diff: readonly WordOp[] | undefined
  readonly side: 'before' | 'after' | 'both'
  readonly ordinal: number | undefined
  /** Disclosure toggle for blocks with children (toggle, nested list item). */
  readonly chevron: React.ReactNode
  /** Unchanged blocks hidden inside a collapsed block. */
  readonly hiddenChildren: number
  readonly options: ViewOptions
}): React.ReactNode => {
  const text = (value: string) => <DiffText text={value} diff={diff} side={side} />
  const hint =
    hiddenChildren > 0 ? (
      <span {...stylex.props(styles.muted)}>
        {plural(hiddenChildren, 'unchanged block')} inside
      </span>
    ) : null
  switch (block._tag) {
    case 'heading':
      return (
        <div
          role="heading"
          aria-level={block.level + 1}
          {...stylex.props(
            styles.heading,
            block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3,
          )}
        >
          {text(block.text)}
        </div>
      )
    case 'paragraph':
      return <p {...stylex.props(styles.paragraph)}>{text(block.text)}</p>
    case 'listItem':
      return (
        <div {...stylex.props(styles.inlineRow)}>
          {chevron}
          <span {...stylex.props(styles.listMarker)}>
            {block.style === 'numbered' ? `${ordinal ?? 1}.` : '•'}
          </span>
          <span>{text(block.text)}</span>
          {hint}
        </div>
      )
    case 'todo':
      return (
        <div {...stylex.props(styles.inlineRow)}>
          <span
            role="img"
            aria-label={block.checked ? 'done' : 'open'}
            {...stylex.props(styles.checkbox, block.checked && styles.checkboxChecked)}
          >
            {block.checked ? '✓' : ''}
          </span>
          <span {...stylex.props(block.checked && styles.todoDone)}>{text(block.text)}</span>
        </div>
      )
    case 'callout':
      return (
        <div {...stylex.props(styles.callout)}>
          {block.label ? <span {...stylex.props(styles.calloutLabel)}>{block.label}</span> : null}
          <span>{text(block.text)}</span>
        </div>
      )
    case 'toggle':
      return (
        <div {...stylex.props(styles.inlineRow)}>
          {chevron ?? (
            <span aria-hidden {...stylex.props(styles.listMarker)}>
              ›
            </span>
          )}
          <span {...stylex.props(styles.toggleText)}>{text(block.text)}</span>
          {hint}
        </div>
      )
    case 'embed':
      return <EmbedView block={block} options={options} />
    case 'childPage':
      return (
        <div {...stylex.props(styles.inlineRow)}>
          <span {...stylex.props(styles.pageGlyph)} aria-hidden />
          <span {...stylex.props(styles.pageLink)}>{text(block.title)}</span>
        </div>
      )
    case 'custom':
      return (
        options.renderCustom?.(block, side === 'before' ? 'before' : 'after') ?? (
          <div {...stylex.props(styles.custom)}>
            <span {...stylex.props(styles.embedMedia)}>{block.customType}</span>
            <span>{block.signature}</span>
          </div>
        )
      )
  }
}

const embedPair = (row: BlockRow): readonly [EmbedBlock, EmbedBlock] | undefined =>
  row.contentChanged && row.before?._tag === 'embed' && row.after?._tag === 'embed'
    ? [row.before, row.after]
    : undefined

/**
 * A changed pair the combined view shows as two blocks rather than one: two embeds, or one block
 * whose type changed under the same id (an inline word diff on one block would hide the other side).
 */
const twoBlockPair = (row: BlockRow): readonly [DocBlock, DocBlock] | undefined =>
  row.contentChanged &&
  row.before !== undefined &&
  row.after !== undefined &&
  (row.before._tag !== row.after._tag || row.before._tag === 'embed')
    ? [row.before, row.after]
    : undefined

/**
 * The side whose block draws the disclosure chevron: the after block unless only the before block
 * can hold the children (a container whose type changed). A move target's before side is a gap.
 */
const chevronSide = (row: BlockRow): 'before' | 'after' =>
  row.before !== undefined &&
  (row.after === undefined ||
    (row.move?.role !== 'target' &&
      blockChildren(row.after).length === 0 &&
      blockChildren(row.before).length > 0))
    ? 'before'
    : 'after'

/** Semantic-only change: visible annotation for a change the content does not show. */
const NoteChip = ({ note }: { readonly note: string }): React.ReactNode => (
  <span
    role="note"
    aria-label={`Change not visible in content: ${note}`}
    {...stylex.props(styles.noteChip)}
  >
    <span aria-hidden>≈</span> {note}
  </span>
)

const MoveNote = ({ move }: { readonly move: BlockMove }): React.ReactNode => (
  <span {...stylex.props(styles.moveNote)}>
    {move.role === 'source' ? 'moved to ' : 'moved from '}
    {move.counterpart}
  </span>
)

/** Short "was" hint for changed blocks whose change the inline diff does not show. */
const wasHint = (row: BlockRow): string | undefined => {
  const { before, after } = row
  if (!before || !after || row.textDiff || !row.contentChanged || twoBlockPair(row))
    return undefined
  if (before._tag === 'todo' && after._tag === 'todo' && before.checked !== after.checked)
    return `was ${before.checked ? 'done' : 'open'}`
  return `was: ${shorten(blockLabel(before), 60)}`
}

/** One marked block cell: change tint/bar/glyph per the gutter variant, indented to its depth. */
const MarkedCell = ({
  kind,
  depth,
  options,
  ghost = false,
  struck = false,
  children,
}: {
  readonly kind: ChangeKind
  readonly depth: number
  readonly options: ViewOptions
  readonly ghost?: boolean
  readonly struck?: boolean
  readonly children: React.ReactNode
}): React.ReactNode => (
  <div data-change-kind={kind} {...stylex.props(styles.markedRow)}>
    {options.gutter === 'glyph' ? (
      <span aria-hidden {...stylex.props(styles.glyph, kindText[kind])}>
        {GLYPH[kind]}
      </span>
    ) : null}
    <div
      {...stylex.props(
        styles.cell,
        styles.indent(depth),
        options.gutter === 'bar' ? [styles.bar, kindBar[kind]] : changeKindStyles[kind],
        ghost && styles.ghost,
        struck && styles.struck,
      )}
    >
      {children}
    </div>
  </div>
)

interface LineProps {
  readonly item: RowItem
  readonly options: ViewOptions
  readonly chevron: React.ReactNode
  readonly hiddenChildren: number
}

/** A changed embed pair: the caller's nested lens when provided, else both embeds. */
const nestedEmbed = (row: BlockRow, options: ViewOptions): React.ReactNode | undefined => {
  const pair = embedPair(row)
  return pair ? options.renderEmbed?.(pair[0], pair[1]) : undefined
}

const UnifiedLine = ({ item, options, chevron, hiddenChildren }: LineProps): React.ReactNode => {
  const { row } = item
  const block = row.after ?? row.before
  if (!block) return null
  const removed = row.kind === 'removed'
  const inMargin = removed && options.removed === 'margin'
  const pair = twoBlockPair(row)
  const nested = nestedEmbed(row, options)
  const was = removed ? undefined : wasHint(row)
  const content = (
    <>
      {nested ??
        (pair ? (
          <div {...stylex.props(styles.embedPair)}>
            <ChangeMark kind="removed" block>
              <BlockBody
                block={pair[0]}
                diff={row.textDiff}
                side="before"
                ordinal={item.beforeOrdinal}
                chevron={chevronSide(row) === 'before' ? chevron : undefined}
                hiddenChildren={chevronSide(row) === 'before' ? hiddenChildren : 0}
                options={options}
              />
            </ChangeMark>
            <span aria-hidden {...stylex.props(styles.muted)}>
              →
            </span>
            <ChangeMark kind="added" block>
              <BlockBody
                block={pair[1]}
                diff={row.textDiff}
                side="after"
                ordinal={item.afterOrdinal}
                chevron={chevronSide(row) === 'after' ? chevron : undefined}
                hiddenChildren={chevronSide(row) === 'after' ? hiddenChildren : 0}
                options={options}
              />
            </ChangeMark>
          </div>
        ) : (
          <BlockBody
            block={block}
            diff={row.textDiff}
            side="both"
            ordinal={item.afterOrdinal ?? item.beforeOrdinal}
            chevron={chevron}
            hiddenChildren={hiddenChildren}
            options={options}
          />
        ))}
      {row.move || row.note || was ? (
        <span {...stylex.props(styles.notes)}>
          {row.move ? <MoveNote move={row.move} /> : null}
          {row.note ? <NoteChip note={row.note} /> : null}
          {was ? <span {...stylex.props(styles.muted)}>{was}</span> : null}
        </span>
      ) : null}
    </>
  )
  const ghost = removed || row.move?.role === 'source'
  if (options.removed !== 'margin') {
    return (
      <MarkedCell
        kind={row.kind}
        depth={row.depth}
        options={options}
        ghost={ghost}
        struck={removed}
      >
        {content}
      </MarkedCell>
    )
  }
  return (
    <div {...stylex.props(styles.marginLine)}>
      {inMargin ? (
        <MarkedCell kind="removed" depth={row.depth} options={options}>
          <span {...stylex.props(styles.removedCaret)}>removed →</span>
        </MarkedCell>
      ) : (
        <MarkedCell kind={row.kind} depth={row.depth} options={options} ghost={ghost}>
          {content}
        </MarkedCell>
      )}
      <aside
        aria-label={inMargin ? 'Removed block' : undefined}
        {...stylex.props(styles.marginCell)}
      >
        {inMargin ? <div {...stylex.props(styles.marginGhost)}>{content}</div> : null}
      </aside>
    </div>
  )
}

/** Change kind of one side of a row in the side-by-side arrangement. */
const sideKind = (row: BlockRow, side: 'before' | 'after'): ChangeKind => {
  if (row.move)
    return row.move.role === (side === 'before' ? 'source' : 'target') ? 'moved' : 'unchanged'
  if (row.kind === 'removed') return side === 'before' ? 'removed' : 'unchanged'
  if (row.kind === 'added') return side === 'after' ? 'added' : 'unchanged'
  return row.kind
}

const SplitLine = ({ item, options, chevron, hiddenChildren }: LineProps): React.ReactNode => {
  const { row } = item
  const nested = nestedEmbed(row, options)
  if (nested !== undefined) {
    return (
      <div {...stylex.props(styles.splitNested, styles.indent(row.depth))}>
        <MarkedCell kind={row.kind} depth={0} options={options}>
          {nested}
          {row.note ? <NoteChip note={row.note} /> : null}
        </MarkedCell>
      </div>
    )
  }
  const chevronAt = chevronSide(row)
  const cell = (side: 'before' | 'after'): React.ReactNode => {
    const block =
      side === 'before' ? (row.move?.role === 'target' ? undefined : row.before) : row.after
    if (!block) {
      const gapNote =
        row.move && side === 'before'
          ? `moved from ${row.move.counterpart}`
          : row.move
            ? `moved to ${row.move.counterpart}`
            : undefined
      return (
        <div
          aria-hidden={gapNote === undefined}
          {...stylex.props(styles.gap, styles.indent(row.depth))}
        >
          {gapNote ? <span {...stylex.props(styles.moveNote)}>{gapNote}</span> : null}
        </div>
      )
    }
    const kind = sideKind(row, side)
    const noteSide = row.after ? 'after' : 'before'
    return (
      <MarkedCell
        kind={kind}
        depth={row.depth}
        options={options}
        ghost={row.move?.role === 'source'}
      >
        <BlockBody
          block={block}
          diff={row.textDiff}
          side={side}
          ordinal={side === 'before' ? item.beforeOrdinal : item.afterOrdinal}
          chevron={side === chevronAt ? chevron : undefined}
          hiddenChildren={side === chevronAt ? hiddenChildren : 0}
          options={options}
        />
        {row.note && side === noteSide ? <NoteChip note={row.note} /> : null}
      </MarkedCell>
    )
  }
  return (
    <div {...stylex.props(styles.splitLine)}>
      {cell('before')}
      {cell('after')}
    </div>
  )
}

/**
 * A block row; blocks with children wrap in a `Disclosure` (collapsed when nothing inside changed).
 * Memoized: `item` comes from the memoized view and `options` is stable per arrangement, so a
 * disclosure toggle or header re-render does not re-render every row of a long document.
 */
const RowView = React.memo(function RowView({
  item,
  options,
}: {
  readonly item: RowItem
  readonly options: ViewOptions
}): React.ReactNode {
  const Line = options.arrangement === 'split' ? SplitLine : UnifiedLine
  if (item.children.length === 0)
    return <Line item={item} options={options} chevron={undefined} hiddenChildren={0} />
  const block = item.row.after ?? item.row.before
  return (
    <Disclosure defaultExpanded={!isQuiet(item.row)} {...stylex.props(styles.group)}>
      {({ isExpanded }) => (
        <>
          <Line
            item={item}
            options={options}
            chevron={
              <Chevron
                isExpanded={isExpanded}
                label={block ? shorten(blockLabel(block)) : 'block'}
              />
            }
            hiddenChildren={isExpanded ? 0 : countBlocks(item.row.children)}
          />
          <DisclosurePanel {...stylex.props(styles.group)}>
            <Items items={item.children} options={options} />
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
})

/** Run of items behind a labelled disclosure trigger (folded unchanged or grouped removed blocks). */
const RunDisclosure = ({
  depth,
  label,
  removed,
  items,
  options,
}: {
  readonly depth: number
  readonly label: (isExpanded: boolean) => string
  readonly removed: boolean
  readonly items: readonly RowItem[]
  readonly options: ViewOptions
}): React.ReactNode => (
  <Disclosure {...stylex.props(styles.group)}>
    {({ isExpanded }) => (
      <>
        <Button
          slot="trigger"
          {...stylex.props(styles.fold, removed && styles.removedFold, styles.indent(depth))}
        >
          <span
            aria-hidden
            {...stylex.props(styles.chevronGlyph, isExpanded && styles.chevronOpen)}
          >
            ›
          </span>
          {label(isExpanded)}
        </Button>
        <DisclosurePanel {...stylex.props(styles.group)}>
          <Items items={items} options={removed ? { ...options, removed: 'inline' } : options} />
        </DisclosurePanel>
      </>
    )}
  </Disclosure>
)

const Items = ({
  items,
  options,
}: {
  readonly items: readonly ViewItem[]
  readonly options: ViewOptions
}): React.ReactNode =>
  items.map((item) => {
    switch (item._tag) {
      case 'row':
        return <RowView key={item.row.key} item={item} options={options} />
      case 'fold': {
        const count = countBlocks(item.items.map((entry) => entry.row))
        return (
          <RunDisclosure
            key={item.key}
            depth={item.depth}
            removed={false}
            items={item.items}
            options={options}
            label={(isExpanded) =>
              `${isExpanded ? 'Hide' : 'Show'} ${plural(count, 'unchanged block')}`
            }
          />
        )
      }
      case 'removedRun': {
        const count = countBlocks(item.items.map((entry) => entry.row))
        return (
          <RunDisclosure
            key={item.key}
            depth={item.depth}
            removed
            items={item.items}
            options={options}
            label={(isExpanded) =>
              `${plural(count, 'removed block')}${isExpanded ? '' : ' · show'}`
            }
          />
        )
      }
    }
  })

const PropertyTable = ({
  changes,
  arrangement,
}: {
  readonly changes: readonly PropertyChange[]
  readonly arrangement: DiffArrangement
}): React.ReactNode => (
  <dl {...stylex.props(styles.properties, arrangement === 'split' && styles.propertiesSplit)}>
    {changes.map((change) => (
      <React.Fragment key={change.key}>
        <dt {...stylex.props(styles.propertyKey, change.kind === 'unchanged' && styles.muted)}>
          {change.key}
        </dt>
        {arrangement === 'split' ? (
          <>
            <dd {...stylex.props(styles.propertyValue)}>
              {change.before === undefined ? null : (
                <ChangeMark kind={change.kind === 'unchanged' ? 'unchanged' : 'removed'}>
                  {change.before}
                </ChangeMark>
              )}
            </dd>
            <dd {...stylex.props(styles.propertyValue)}>
              {change.after === undefined ? null : (
                <ChangeMark kind={change.kind === 'unchanged' ? 'unchanged' : 'added'}>
                  {change.after}
                </ChangeMark>
              )}
            </dd>
          </>
        ) : (
          <dd {...stylex.props(styles.propertyValue)}>
            {change.kind === 'unchanged' ? (
              <span {...stylex.props(styles.muted)}>{change.after}</span>
            ) : (
              <>
                {change.before !== undefined ? (
                  <ChangeMark kind="removed">{change.before}</ChangeMark>
                ) : null}
                {change.before !== undefined && change.after !== undefined ? (
                  <span {...stylex.props(styles.muted)}> → </span>
                ) : null}
                {change.after !== undefined ? (
                  <ChangeMark kind="added">{change.after}</ChangeMark>
                ) : null}
              </>
            )}
          </dd>
        )}
      </React.Fragment>
    ))}
  </dl>
)

const Breadcrumb = ({ path }: { readonly path: readonly string[] }): React.ReactNode =>
  path.length === 0 ? <span {...stylex.props(styles.muted)}>workspace root</span> : path.join(' / ')

const DocumentHeader = ({
  model,
  before,
  after,
  arrangement,
  renderProperties,
}: {
  readonly model: DocumentDiffModel
  readonly before: DocSnapshot
  readonly after: DocSnapshot
  readonly arrangement: DiffArrangement
  readonly renderProperties: DocumentDiffProps['renderProperties']
}): React.ReactNode => {
  const titleDiff = model.title.kind === 'unchanged' ? undefined : model.title.diff
  const location = model.location
  const moved = location.kind === 'moved'
  return (
    <header {...stylex.props(styles.header)}>
      {arrangement === 'split' ? (
        <div {...stylex.props(styles.splitPair)}>
          <div {...stylex.props(styles.docTitle)}>
            <DiffText text={model.title.before} diff={titleDiff} side="before" />
          </div>
          <div {...stylex.props(styles.docTitle)}>
            <DiffText text={model.title.after} diff={titleDiff} side="after" />
          </div>
        </div>
      ) : (
        <div {...stylex.props(styles.docTitle)}>
          <DiffText text={model.title.after} diff={titleDiff} side="both" />
        </div>
      )}
      {location.before.length > 0 || location.after.length > 0 ? (
        arrangement === 'split' ? (
          <div {...stylex.props(styles.splitPair)}>
            {(['before', 'after'] as const).map((side) => (
              <div key={side} {...stylex.props(styles.location)}>
                <span {...stylex.props(styles.muted)}>Location</span>
                <ChangeMark kind={moved ? 'moved' : 'unchanged'} title="page moved">
                  <Breadcrumb path={location[side]} />
                </ChangeMark>
              </div>
            ))}
          </div>
        ) : (
          <div {...stylex.props(styles.location)}>
            <span {...stylex.props(styles.muted)}>Location</span>
            {moved ? (
              <ChangeMark kind="moved" title="page moved">
                <ChangeMark kind="removed">
                  <Breadcrumb path={location.before} />
                </ChangeMark>
                <span {...stylex.props(styles.muted)}> → </span>
                <Breadcrumb path={location.after} />
              </ChangeMark>
            ) : (
              <Breadcrumb path={location.after} />
            )}
          </div>
        )
      ) : null}
      {model.properties.length > 0
        ? (renderProperties?.(
            model.properties,
            before.properties ?? {},
            after.properties ?? {},
          ) ?? <PropertyTable changes={model.properties} arrangement={arrangement} />)
        : null}
    </header>
  )
}

const DocumentBody = ({
  model,
  props,
}: {
  readonly model: DocumentDiffModel
  readonly props: DocumentDiffProps
}): React.ReactNode => {
  const arrangement = useDiffArrangement()
  const gutter = props.gutter ?? 'bar'
  const removed = props.removed ?? 'inline'
  const embeds = props.embeds ?? 'card'
  const { renderEmbed, renderCustom } = props
  const options = React.useMemo<ViewOptions>(
    () => ({ arrangement, gutter, removed, embeds, renderEmbed, renderCustom }),
    [arrangement, gutter, removed, embeds, renderEmbed, renderCustom],
  )
  const foldAt = props.foldUnchanged ?? 3
  const groupRemoved = arrangement === 'unified' && removed === 'collapsed'
  const items = React.useMemo(
    () => buildView(model.rows, foldAt, groupRemoved),
    [model.rows, foldAt, groupRemoved],
  )
  return (
    <>
      <DocumentHeader
        model={model}
        before={props.before}
        after={props.after}
        arrangement={arrangement}
        renderProperties={props.renderProperties}
      />
      {arrangement === 'split' ? (
        <div {...stylex.props(styles.splitPair, styles.splitHead)}>
          <span>{props.beforeSide.label}</span>
          <span>{props.afterSide.label}</span>
        </div>
      ) : null}
      <div {...stylex.props(styles.doc)}>
        {items.length === 0 ? (
          <p {...stylex.props(styles.muted)}>Both versions have no blocks.</p>
        ) : (
          <Items items={items} options={options} />
        )}
      </div>
    </>
  )
}

/** Document lens: header (title, location, properties) plus the aligned block document. */
export const DocumentDiff = (props: DocumentDiffProps): React.ReactNode => {
  const model = React.useMemo(
    () => diffDocument(props.before, props.after),
    [props.before, props.after],
  )
  return (
    <DiffFrame
      {...(props.id === undefined ? {} : { id: props.id })}
      title={props.title ?? props.after.title}
      lens="document"
      before={props.beforeSide}
      after={props.afterSide}
      counts={model.counts}
      {...(props.arrangement === undefined ? {} : { arrangement: props.arrangement })}
      {...(props.relation === undefined ? {} : { relation: props.relation })}
      {...(props.defaultArrangement === undefined
        ? {}
        : { defaultArrangement: props.defaultArrangement })}
      {...(props.nested === undefined ? {} : { nested: props.nested })}
      {...(props.defaultCollapsed === undefined
        ? {}
        : { defaultCollapsed: props.defaultCollapsed })}
    >
      <DocumentBody model={model} props={props} />
    </DiffFrame>
  )
}

const kindText = stylex.create({
  added: { color: tokens['--ds-green-900'] },
  removed: { color: tokens['--ds-red-900'] },
  changed: { color: tokens['--ds-amber-900'] },
  moved: { color: tokens['--ds-blue-900'] },
  unchanged: {},
})

const kindBar = stylex.create({
  added: { borderInlineStartColor: tokens['--ds-green-900'] },
  removed: { borderInlineStartColor: tokens['--ds-red-900'] },
  changed: { borderInlineStartColor: tokens['--ds-amber-900'] },
  moved: { borderInlineStartColor: tokens['--ds-blue-700'], borderInlineStartStyle: 'dashed' },
  unchanged: {},
})

const styles = stylex.create({
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
    paddingBottom: scale.space3,
    marginBottom: scale.space3,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  docTitle: {
    fontSize: '1.35rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: tokens['--ds-foreground'],
  },
  location: {
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space2,
    fontSize: '0.82rem',
    color: tokens['--ds-gray-1000'],
  },
  properties: {
    display: 'grid',
    gridTemplateColumns: 'minmax(7rem, max-content) 1fr',
    columnGap: scale.space3,
    rowGap: scale.space1,
    margin: 0,
    fontSize: '0.82rem',
  },
  propertiesSplit: {
    gridTemplateColumns: 'minmax(7rem, max-content) minmax(0, 1fr) minmax(0, 1fr)',
  },
  propertyKey: {
    color: tokens['--ds-gray-900'],
  },
  propertyValue: {
    margin: 0,
    color: tokens['--ds-gray-1000'],
    overflowWrap: 'anywhere',
  },
  doc: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    color: tokens['--ds-gray-1000'],
    fontSize: '0.9rem',
    lineHeight: 1.55,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  splitPair: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: scale.space3,
  },
  splitHead: {
    marginBottom: scale.space2,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
  },
  splitLine: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: scale.space3,
    alignItems: 'stretch',
  },
  splitNested: {
    minWidth: 0,
  },
  gap: {
    minHeight: '1.6rem',
    paddingInline: scale.space2,
    borderRadius: scale.radiusSm,
    backgroundImage: `repeating-linear-gradient(135deg, ${tokens['--ds-gray-alpha-200']} 0 1px, transparent 1px 7px)`,
    display: 'flex',
    alignItems: 'center',
  },
  marginLine: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(9rem, 30%)',
    columnGap: scale.space3,
    alignItems: 'start',
  },
  marginCell: {
    minWidth: 0,
    alignSelf: 'stretch',
    paddingInlineStart: scale.space2,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'dashed',
    borderInlineStartColor: tokens['--ds-gray-alpha-400'],
  },
  marginGhost: {
    fontSize: '0.78rem',
    lineHeight: 1.4,
    opacity: 0.7,
    textDecorationLine: 'line-through',
    textDecorationColor: tokens['--ds-red-900'],
  },
  removedCaret: {
    fontSize: '0.7rem',
    color: tokens['--ds-gray-900'],
  },
  markedRow: {
    display: 'flex',
    alignItems: 'stretch',
    minWidth: 0,
  },
  glyph: {
    flexShrink: 0,
    width: '1.25rem',
    textAlign: 'center',
    fontFamily: scale.fontMono,
    fontSize: '0.8rem',
    lineHeight: 1.9,
    userSelect: 'none',
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    flexGrow: 1,
    minWidth: 0,
    paddingBlock: '2px',
    paddingInline: scale.space2,
    borderRadius: scale.radiusSm,
  },
  bar: {
    borderWidth: 0,
    borderInlineStartWidth: 3,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: 'transparent',
    borderRadius: 0,
  },
  indent: (depth: number) => ({
    marginInlineStart: `${depth * 1.5}rem`,
  }),
  ghost: {
    opacity: 0.6,
  },
  struck: {
    textDecorationLine: 'line-through',
    textDecorationColor: tokens['--ds-red-900'],
  },
  notes: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: scale.space2,
    textDecorationLine: 'none',
  },
  noteChip: {
    alignSelf: 'flex-start',
    paddingInline: scale.space1,
    borderRadius: scale.radiusSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-amber-700'],
    fontSize: '0.72rem',
    color: tokens['--ds-gray-1000'],
  },
  heading: {
    fontWeight: 650,
    lineHeight: 1.3,
    color: tokens['--ds-foreground'],
    paddingTop: scale.space1,
  },
  h1: { fontSize: '1.25rem' },
  h2: { fontSize: '1.08rem' },
  h3: { fontSize: '0.95rem' },
  paragraph: {
    margin: 0,
    overflowWrap: 'anywhere',
  },
  inlineRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space2,
    flexWrap: 'wrap',
    overflowWrap: 'anywhere',
  },
  listMarker: {
    minWidth: '1rem',
    color: tokens['--ds-gray-900'],
  },
  chevron: {
    appearance: 'none',
    alignSelf: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.1rem',
    height: '1.1rem',
    padding: 0,
    borderWidth: 0,
    borderRadius: scale.radiusSm,
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-200'] },
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  chevronGlyph: {
    display: 'inline-block',
    fontSize: '1rem',
    lineHeight: 1,
    transitionProperty: 'transform',
    transitionDuration: '120ms',
  },
  chevronOpen: { transform: 'rotate(90deg)' },
  checkbox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
    width: '0.9rem',
    height: '0.9rem',
    fontSize: '0.7rem',
    lineHeight: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-500'],
    borderRadius: scale.radiusSm,
  },
  checkboxChecked: {
    backgroundColor: tokens['--ds-blue-700'],
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-background-100'],
  },
  todoDone: {
    color: tokens['--ds-gray-900'],
  },
  callout: {
    display: 'flex',
    gap: scale.space2,
    alignItems: 'baseline',
    padding: scale.space2,
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-gray-alpha-100'],
  },
  calloutLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens['--ds-gray-900'],
  },
  toggleText: {
    fontWeight: 500,
  },
  pageGlyph: {
    display: 'inline-block',
    alignSelf: 'center',
    width: '0.7rem',
    height: '0.85rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-500'],
    borderRadius: '2px',
  },
  pageLink: {
    textDecorationLine: 'underline',
    textDecorationColor: tokens['--ds-gray-alpha-400'],
    textUnderlineOffset: '3px',
  },
  embed: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space3,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    minWidth: 0,
    textDecorationLine: 'none',
  },
  embedThumb: {
    width: '4.5rem',
    height: '4.5rem',
    objectFit: 'cover',
    objectPosition: 'top',
    borderRadius: scale.radiusSm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-background-100'],
    flexShrink: 0,
  },
  embedPlaceholder: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: scale.fontMono,
    fontSize: '0.72rem',
    color: tokens['--ds-gray-900'],
  },
  embedMedia: {
    flexShrink: 0,
    paddingInline: scale.space1,
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    fontFamily: scale.fontMono,
    fontSize: '0.68rem',
    color: tokens['--ds-gray-900'],
    textTransform: 'uppercase',
  },
  embedText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1px',
    minWidth: 0,
  },
  embedTitle: {
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space2,
    minWidth: 0,
  },
  embedName: {
    fontWeight: 500,
    overflowWrap: 'anywhere',
  },
  embedLink: {
    fontSize: '0.75rem',
    color: tokens['--ds-blue-900'],
    textDecorationLine: { default: 'none', ':hover': 'underline' },
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  embedChip: {
    appearance: 'none',
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space2,
    paddingBlock: '2px',
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '999px',
    backgroundColor: {
      default: tokens['--ds-background-200'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-1000'],
    fontSize: '0.8rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  embedPair: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'center',
    gap: scale.space2,
  },
  custom: {
    display: 'flex',
    alignItems: 'baseline',
    gap: scale.space2,
    padding: scale.space2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
  },
  moveNote: {
    fontSize: '0.75rem',
    color: tokens['--ds-blue-900'],
  },
  muted: {
    fontSize: '0.78rem',
    color: tokens['--ds-gray-900'],
  },
  fold: {
    appearance: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    alignSelf: 'flex-start',
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    color: tokens['--ds-gray-900'],
    fontSize: '0.75rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  removedFold: {
    borderColor: tokens['--ds-red-700'],
    color: tokens['--ds-gray-1000'],
    backgroundColor: {
      default: `color-mix(in srgb, ${tokens['--ds-red-900']} 8%, transparent)`,
      ':hover': `color-mix(in srgb, ${tokens['--ds-red-900']} 14%, transparent)`,
    },
  },
})
