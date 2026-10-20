/**
 * Prose text lens: word-level diff for human text (page bodies, OCR extractions, captions).
 * Paragraphs and unique unchanged word anchors partition the alignment; linear-space Myers
 * handles regions without anchors. Long unchanged stretches fold behind a disclosure.
 *
 * Three renderers, all following the frame arrangement:
 * - `pierre` (default, the `lines` text shape): the source lines, unchanged, through
 *   `@pierre/diffs` (plain-text language, line numbers, word-level line diff, wrapping, folded
 *   hunks). Indentation and line breaks are compared exactly as written.
 * - `inline` (the `prose` text shape): own marks inside flowing paragraphs.
 * - `pierre-sentences`: prose over pierre. The text is reflowed to one sentence per line first,
 *   so dense rewrites read side by side; whitespace inside a sentence is normalised and line
 *   numbers are hidden because they no longer match the source.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import type { ReactNode } from 'react'
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components'

import type { ChangeCounts, DiffArrangement, DiffRelation, DiffSide } from './contract.ts'
import { ChangeMark, DiffFrame, useDiffArrangement, withOccurrenceKeys } from './DiffFrame.tsx'

// --- sequence diff (patience anchors + linear-space Myers bisect) ---

/** One run of a sequence alignment; indices are half-open ranges into `a` (before) and `b` (after). */
export interface SequenceRun {
  readonly _tag: 'equal' | 'removed' | 'added'
  readonly aStart: number
  readonly aEnd: number
  readonly bStart: number
  readonly bEnd: number
}

/** Emit coalesced runs, preserving half-open indices on both sides. */
const appendRun = (
  runs: SequenceRun[],
  tag: SequenceRun['_tag'],
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => {
  if (aStart === aEnd && bStart === bEnd) return
  const last = runs[runs.length - 1]
  if (last?._tag === tag && last.aEnd === aStart && last.bEnd === bStart) {
    runs[runs.length - 1] = { _tag: tag, aStart: last.aStart, aEnd, bStart: last.bStart, bEnd }
  } else {
    runs.push({ _tag: tag, aStart, aEnd, bStart, bEnd })
  }
}

/**
 * Myers' bidirectional frontier: find an overlap without retaining the O(D²) trace.
 * Coordinates are relative to the supplied subranges. The frontier uses O(N+M) space.
 */
const bisect = (
  a: Int32Array,
  b: Int32Array,
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) => {
  const n = aEnd - aStart
  const m = bEnd - bStart
  const maxD = Math.ceil((n + m) / 2)
  const offset = maxD + 1
  const size = 2 * maxD + 3
  const forward = new Int32Array(size)
  const reverse = new Int32Array(size)
  forward.fill(-1)
  reverse.fill(-1)
  forward[offset + 1] = 0
  reverse[offset + 1] = 0
  const delta = n - m
  const odd = delta % 2 !== 0
  for (let d = 0; d <= maxD; d++) {
    for (let k = -d; k <= d; k += 2) {
      const i = offset + k
      let x =
        k === -d || (k !== d && forward[i - 1]! < forward[i + 1]!)
          ? forward[i + 1]!
          : forward[i - 1]! + 1
      let y = x - k
      if (x < 0 || x > n || y < 0 || y > m) {
        forward[i] = -1
        continue
      }
      while (x < n && y < m && a[aStart + x] === b[bStart + y]) {
        x++
        y++
      }
      forward[i] = x
      if (odd && d > 0 && k >= delta - d + 1 && k <= delta + d - 1) {
        const back = reverse[offset + delta - k]!
        if (back >= 0 && x + back >= n) return [aStart + x, bStart + y] as const
      }
    }
    for (let k = -d; k <= d; k += 2) {
      const i = offset + k
      let x =
        k === -d || (k !== d && reverse[i - 1]! < reverse[i + 1]!)
          ? reverse[i + 1]!
          : reverse[i - 1]! + 1
      let y = x - k
      if (x < 0 || x > n || y < 0 || y > m) {
        reverse[i] = -1
        continue
      }
      while (x < n && y < m && a[aEnd - x - 1] === b[bEnd - y - 1]) {
        x++
        y++
      }
      reverse[i] = x
      if (!odd && k >= delta - d && k <= delta + d) {
        const front = forward[offset + delta - k]!
        if (front >= 0 && front + x >= n)
          return [aStart + front, bStart + front - delta + k] as const
      }
    }
  }
  return [aEnd, bEnd] as const
}

/**
 * Unique common tokens are stable patience anchors. In OCR text, identical whole lines
 * are rare at 30% edits, but distinctive unchanged words split the work into small regions.
 * The LIS keeps anchors ordered, even when text was moved between the two sides.
 */
const patienceAnchors = (a: Int32Array, b: Int32Array): readonly (readonly [number, number])[] => {
  const positions = new Map<number, number>()
  for (let j = 0; j < b.length; j++) {
    const id = b[j]!
    positions.set(id, positions.has(id) ? -1 : j)
  }
  const frequencies = new Map<number, number>()
  for (const id of a) frequencies.set(id, (frequencies.get(id) ?? 0) + 1)
  const unique: [number, number][] = []
  for (let i = 0; i < a.length; i++) {
    const id = a[i]!
    const j = positions.get(id)
    if (j !== undefined && j >= 0 && frequencies.get(id) === 1) unique.push([i, j])
  }
  const tails: number[] = []
  const previous = new Int32Array(unique.length).fill(-1)
  for (let i = 0; i < unique.length; i++) {
    const j = unique[i]![1]
    let lo = 0,
      hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (unique[tails[mid]!]![1] < j) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) previous[i] = tails[lo - 1]!
    tails[lo] = i
  }
  const anchors: [number, number][] = []
  let i = tails[tails.length - 1]
  while (i !== undefined && i >= 0) {
    anchors.push(unique[i]!)
    i = previous[i]
  }
  return anchors.toReversed()
}

/** Align by key equality, using patience anchors and linear-space Myers for the gaps. */
export const diffSequence = <T,>(
  a: readonly T[],
  b: readonly T[],
  key: (item: T) => string = String,
): readonly SequenceRun[] => {
  const ids = new Map<string, number>()
  const intern = (item: T) => {
    const k = key(item)
    const known = ids.get(k)
    if (known !== undefined) return known
    ids.set(k, ids.size)
    return ids.size - 1
  }
  const ia = Int32Array.from(a, intern)
  const ib = Int32Array.from(b, intern)
  const runs: SequenceRun[] = []
  const align = (as: number, ae: number, bs: number, be: number): void => {
    const initialA = as,
      initialB = bs
    while (as < ae && bs < be && ia[as] === ib[bs]) {
      as++
      bs++
    }
    appendRun(runs, 'equal', initialA, as, initialB, bs)
    let suffix = 0
    while (ae - suffix > as && be - suffix > bs && ia[ae - suffix - 1] === ib[be - suffix - 1])
      suffix++
    const endA = ae,
      endB = be
    ae -= suffix
    be -= suffix
    if (as === ae || bs === be) {
      appendRun(runs, 'removed', as, ae, bs, bs)
      appendRun(runs, 'added', ae, ae, bs, be)
    } else {
      const [x, y] = bisect(ia, ib, as, ae, bs, be)
      if ((x === as && y === bs) || (x === ae && y === be)) {
        // No common token: the shortest script removes then adds.
        appendRun(runs, 'removed', as, ae, bs, bs)
        appendRun(runs, 'added', ae, ae, bs, be)
      } else {
        align(as, x, bs, y)
        align(x, ae, y, be)
      }
    }
    appendRun(runs, 'equal', endA - suffix, endA, endB - suffix, endB)
  }
  if (ia.length + ib.length < 512) {
    align(0, ia.length, 0, ib.length)
  } else {
    const anchors = patienceAnchors(ia, ib)
    let as = 0,
      bs = 0
    for (const [ae, be] of anchors) {
      align(as, ae, bs, be)
      appendRun(runs, 'equal', ae, ae + 1, be, be + 1)
      as = ae + 1
      bs = be + 1
    }
    align(as, ia.length, bs, ib.length)
  }
  return runs
}

// --- text model ---

/** One aligned piece of prose. `whitespaceOnly` marks edits that only touch spacing/line breaks. */
export type TextSegment =
  | { readonly _tag: 'equal'; readonly text: string }
  | { readonly _tag: 'added'; readonly text: string; readonly whitespaceOnly: boolean }
  | { readonly _tag: 'removed'; readonly text: string; readonly whitespaceOnly: boolean }
  | {
      readonly _tag: 'changed'
      readonly before: string
      readonly after: string
      readonly whitespaceOnly: boolean
    }

/** Result of diffing two prose texts. */
export interface TextDiffModel {
  readonly segments: readonly TextSegment[]
  /** Segment counts: each added/removed/changed run of words counts once. */
  readonly counts: ChangeCounts
  readonly identical: boolean
  readonly stats: {
    readonly addedWords: number
    readonly removedWords: number
    readonly whitespaceOnlySegments: number
    readonly beforeChars: number
    readonly afterChars: number
  }
}

const TOKEN_RE = /\s+|[\p{L}\p{N}_]+(?:['’\-.][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu

/** Split prose into word, whitespace and punctuation tokens; concatenation reproduces the input. */
export const tokenizeProse = (text: string): readonly string[] => text.match(TOKEN_RE) ?? []

/** Split into paragraphs, each keeping its trailing blank-line separator (lossless). */
const splitParagraphs = (text: string): readonly string[] => {
  const parts: string[] = []
  const re = /\n[ \t]*\n\s*/g
  let start = 0
  for (const match of text.matchAll(re)) {
    const end = match.index + match[0].length
    parts.push(text.slice(start, end))
    start = end
  }
  if (start < text.length) parts.push(text.slice(start))
  return parts
}

const isBlank = (text: string) => text.trim() === ''

const countWords = (text: string) => text.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0

/** Unit the differing regions are aligned by. */
export type TextGranularity = 'word' | 'char' | 'sentence'

/** Segments for one differing region at the given granularity, before semantic cleanup. */
const regionSegments = (
  before: string,
  after: string,
  granularity: TextGranularity,
): TextSegment[] => {
  const tokenize = (text: string): readonly string[] =>
    granularity === 'word'
      ? tokenizeProse(text)
      : granularity === 'char'
        ? Array.from(text)
        : splitSentences(text)
  const a = tokenize(before)
  const b = tokenize(after)
  return diffSequence(a, b, (t) => t).map((run): TextSegment => {
    switch (run._tag) {
      case 'equal':
        return { _tag: 'equal', text: a.slice(run.aStart, run.aEnd).join('') }
      case 'removed': {
        const text = a.slice(run.aStart, run.aEnd).join('')
        return { _tag: 'removed', text, whitespaceOnly: isBlank(text) }
      }
      case 'added': {
        const text = b.slice(run.bStart, run.bEnd).join('')
        return { _tag: 'added', text, whitespaceOnly: isBlank(text) }
      }
    }
  })
}

const sideText = (segment: TextSegment, side: 'before' | 'after'): string => {
  switch (segment._tag) {
    case 'equal':
      return segment.text
    case 'added':
      return side === 'after' ? segment.text : ''
    case 'removed':
      return side === 'before' ? segment.text : ''
    case 'changed':
      return side === 'before' ? segment.before : segment.after
  }
}

/** Segment identity for React keys: tag plus both sides' text. */
const segmentIdentity = (segment: TextSegment): string =>
  `${segment._tag}:${sideText(segment, 'before')}\u0000${sideText(segment, 'after')}`

const normalizeWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Semantic cleanup: absorb whitespace/punctuation glue between edits, then coalesce adjacent
 * removed/added runs into `changed` segments classified as whitespace-only when both sides
 * match after whitespace normalisation.
 */
const cleanup = (raw: readonly TextSegment[]): TextSegment[] => {
  const absorbed: TextSegment[] = []
  raw.forEach((segment, index) => {
    const prev = raw[index - 1]
    const next = raw[index + 1]
    if (
      segment._tag === 'equal' &&
      // Whitespace/punctuation glue between two edits joins them (`quick brown` -> `slow red` is one edit).
      /^[\s\p{P}]{1,3}$/u.test(segment.text) &&
      prev !== undefined &&
      next !== undefined &&
      prev._tag !== 'equal' &&
      next._tag !== 'equal' &&
      !(prev._tag !== 'changed' && prev.whitespaceOnly) &&
      !(next._tag !== 'changed' && next.whitespaceOnly)
    ) {
      absorbed.push(
        { _tag: 'removed', text: segment.text, whitespaceOnly: false },
        { _tag: 'added', text: segment.text, whitespaceOnly: false },
      )
      return
    }
    absorbed.push(segment)
  })
  const out: TextSegment[] = []
  let before = ''
  let after = ''
  let pending = false
  const flush = () => {
    if (!pending) return
    if (before === '') {
      out.push({ _tag: 'added', text: after, whitespaceOnly: isBlank(after) })
    } else if (after === '') {
      out.push({ _tag: 'removed', text: before, whitespaceOnly: isBlank(before) })
    } else {
      out.push({
        _tag: 'changed',
        before,
        after,
        whitespaceOnly: normalizeWhitespace(before) === normalizeWhitespace(after),
      })
    }
    before = ''
    after = ''
    pending = false
  }
  for (const segment of absorbed) {
    if (segment._tag === 'equal') {
      flush()
      const last = out[out.length - 1]
      if (last?._tag === 'equal')
        out[out.length - 1] = { _tag: 'equal', text: last.text + segment.text }
      else if (segment.text !== '') out.push(segment)
      continue
    }
    before += sideText(segment, 'before')
    after += sideText(segment, 'after')
    pending = true
  }
  flush()
  return out
}

/**
 * Diff two prose texts. Paragraphs are aligned first (cheap, keeps edits local to the
 * paragraph they happen in); only differing paragraph runs are diffed at `granularity`.
 */
export const textDiffModel = (
  before: string,
  after: string,
  granularity: TextGranularity = 'word',
): TextDiffModel => {
  const pa = splitParagraphs(before)
  const pb = splitParagraphs(after)
  const raw: TextSegment[] = []
  const runs = diffSequence(pa, pb, (p) => p)
  let index = 0
  while (index < runs.length) {
    const run = runs[index]!
    if (run._tag === 'equal') {
      raw.push({ _tag: 'equal', text: pa.slice(run.aStart, run.aEnd).join('') })
      index++
      continue
    }
    let beforeText = ''
    let afterText = ''
    while (index < runs.length && runs[index]!._tag !== 'equal') {
      const r = runs[index]!
      beforeText += pa.slice(r.aStart, r.aEnd).join('')
      afterText += pb.slice(r.bStart, r.bEnd).join('')
      index++
    }
    raw.push(...regionSegments(beforeText, afterText, granularity))
  }
  const segments = cleanup(raw)
  let added = 0
  let removed = 0
  let changed = 0
  let addedWords = 0
  let removedWords = 0
  let whitespaceOnlySegments = 0
  for (const segment of segments) {
    if (segment._tag === 'equal') continue
    if (segment.whitespaceOnly) whitespaceOnlySegments++
    if (segment._tag === 'added') added++
    if (segment._tag === 'removed') removed++
    if (segment._tag === 'changed') changed++
    addedWords += countWords(sideText(segment, 'after'))
    removedWords += countWords(sideText(segment, 'before'))
  }
  return {
    segments,
    counts: { added, removed, changed },
    identical: before === after,
    stats: {
      addedWords,
      removedWords,
      whitespaceOnlySegments,
      beforeChars: before.length,
      afterChars: after.length,
    },
  }
}

// --- collapsing ---

/** Render chunk: visible segments, or a collapsed unchanged stretch with an expand affordance. */
export type TextChunk =
  | { readonly _tag: 'visible'; readonly segments: readonly TextSegment[] }
  | {
      readonly _tag: 'collapsed'
      readonly id: number
      readonly text: string
      readonly sentences: number
      readonly paragraphs: number
    }

/** Options for `textDiffChunks`: equal stretches longer than `collapseAbove` chars fold, keeping ~`contextChars` of whole sentences on each side of an edit. */
export interface TextChunkOptions {
  readonly collapseAbove?: number
  readonly contextChars?: number
}

const splitSentences = (text: string): readonly string[] => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })
    return Array.from(segmenter.segment(text), (s) => s.segment)
  }
  return text.match(/[^.!?\n]*(?:[.!?]+|\n+|$)\s*/g)?.filter((s) => s !== '') ?? [text]
}

/** Take whole sentences from the start (or end) until at least `chars` are covered. */
const takeSentences = (sentences: readonly string[], chars: number, fromEnd: boolean) => {
  let taken = 0
  let length = 0
  while (taken < sentences.length && length < chars) {
    const sentence = sentences[fromEnd ? sentences.length - 1 - taken : taken]!
    length += sentence.length
    taken++
  }
  return taken
}

/** Fold long unchanged stretches into collapsed chunks, snapping context to sentence boundaries. */
export const textDiffChunks = (
  segments: readonly TextSegment[],
  { collapseAbove = 480, contextChars = 160 }: TextChunkOptions = {},
): readonly TextChunk[] => {
  const chunks: TextChunk[] = []
  let visible: TextSegment[] = []
  let nextId = 0
  const pushVisible = (segment: TextSegment) => {
    if (segment._tag === 'equal' && segment.text === '') return
    visible.push(segment)
  }
  segments.forEach((segment, index) => {
    if (segment._tag !== 'equal' || segment.text.length <= collapseAbove) {
      pushVisible(segment)
      return
    }
    const sentences = splitSentences(segment.text)
    const head = index > 0 ? takeSentences(sentences, contextChars, false) : 0
    const tail =
      index < segments.length - 1
        ? Math.min(takeSentences(sentences, contextChars, true), sentences.length - head)
        : 0
    const folded = sentences.slice(head, sentences.length - tail)
    const foldedText = folded.join('')
    if (folded.length < 2 || foldedText.length < contextChars) {
      pushVisible(segment)
      return
    }
    pushVisible({ _tag: 'equal', text: sentences.slice(0, head).join('') })
    if (visible.length > 0) chunks.push({ _tag: 'visible', segments: visible })
    visible = []
    chunks.push({
      _tag: 'collapsed',
      id: nextId++,
      text: foldedText,
      sentences: folded.length,
      paragraphs: splitParagraphs(foldedText).length,
    })
    pushVisible({ _tag: 'equal', text: sentences.slice(sentences.length - tail).join('') })
  })
  if (visible.length > 0) chunks.push({ _tag: 'visible', segments: visible })
  return chunks
}

// --- clipping ---

/** A side clipped to the lens budget; `totalChars` is the original length. */
interface ClippedText {
  readonly text: string
  readonly totalChars: number
}

const clipText = (text: string, clipAt: number): ClippedText => ({
  text: text.length > clipAt ? text.slice(0, clipAt) : text,
  totalChars: text.length,
})

/**
 * Body summary line. `identical` compares the full inputs, never the clipped prefixes, so
 * a difference past `clipAt` is not reported as identical text.
 */
export const textDiffSummary = (
  model: TextDiffModel,
  { identical, clipAt }: { readonly identical: boolean; readonly clipAt: number },
): string => {
  if (identical) return 'Identical text'
  if (model.identical)
    return `No changes in the first ${clipAt.toLocaleString()} characters; the texts differ after that`
  return (
    `${model.stats.addedWords} words added, ${model.stats.removedWords} removed` +
    (model.stats.whitespaceOnlySegments > 0
      ? `, ${model.stats.whitespaceOnlySegments} whitespace-only`
      : '')
  )
}

// --- pierre sources ---

/**
 * One sentence per line, paragraphs separated by a blank line: pierre diffs lines, so a
 * one-word edit in a 2 000-char OCR paragraph would otherwise replace the whole paragraph.
 * Whitespace inside a sentence is normalised, so whitespace-only edits are invisible here:
 * only the explicit `pierre-sentences` renderer uses it, never the `lines` shape.
 */
export const reflowProseToLines = (text: string): string =>
  splitParagraphs(text)
    .map((paragraph) =>
      splitSentences(paragraph)
        .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
        .filter((sentence) => sentence !== '')
        .join('\n'),
    )
    .filter((paragraph) => paragraph !== '')
    .join('\n\n')

const pierreLineDiff = { word: 'word-alt', char: 'char', sentence: 'none' } as const

/** Loaded on demand so the inline renderer never pulls `@pierre/diffs`. */
const LazyPierreDiff = React.lazy(() =>
  import('./CodeDiff.tsx').then((module) => ({ default: module.PierreDiff })),
)

// --- view ---

/**
 * How the text lens renders: `pierre` diffs the source lines as written (the `lines` shape),
 * `inline` marks edits inside flowing prose (the `prose` shape), and `pierre-sentences`
 * reflows prose to one sentence per line before handing it to pierre.
 */
export type TextRenderer = 'pierre' | 'inline' | 'pierre-sentences'

/** The file contents pierre diffs for a pierre renderer: source lines, or reflowed sentences. */
export const pierreTextContents = (
  text: string,
  renderer: Exclude<TextRenderer, 'inline'>,
): string => (renderer === 'pierre-sentences' ? reflowProseToLines(text) : text)

/** `folded` collapses long unchanged stretches; `full` shows every character. */
export type TextContext = 'folded' | 'full'

/** Props for the prose text lens. */
export interface TextDiffProps {
  readonly title: ReactNode
  readonly before: DiffSide
  readonly after: DiffSide
  readonly beforeText: string
  readonly afterText: string
  readonly arrangement?: DiffArrangement
  readonly defaultArrangement?: DiffArrangement
  /** Defaults to `temporal`; `peer` presents the sides as A vs B. */
  readonly relation?: DiffRelation
  /** Default `pierre`, matching the `lines` text shape. */
  readonly renderer?: TextRenderer
  /** Default `word`. */
  readonly granularity?: TextGranularity
  /** Default `folded`. */
  readonly context?: TextContext
  readonly collapseAbove?: number
  readonly contextChars?: number
  /** Each side is compared up to this many characters (default 100 000); a marker states what was clipped. */
  readonly clipAt?: number
  readonly nested?: boolean
  readonly collapsed?: boolean
  readonly id?: string
}

/** Make whitespace visible inside a whitespace-only edit. */
const VisibleWhitespace = ({ text }: { readonly text: string }) => (
  <>
    {withOccurrenceKeys(text, (ch) => ch).map(({ key, item: ch }) =>
      ch === ' ' ? (
        <span key={key} {...stylex.props(styles.ws)}>
          {'\u00b7'}
        </span>
      ) : ch === '\t' ? (
        <span key={key} {...stylex.props(styles.ws)}>
          {'\u2192'}
        </span>
      ) : ch === '\n' ? (
        <React.Fragment key={key}>
          <span {...stylex.props(styles.ws)}>{'\u21b5'}</span>
          {'\n'}
        </React.Fragment>
      ) : (
        <React.Fragment key={key}>{ch}</React.Fragment>
      ),
    )}
  </>
)

const Marked = ({
  kind,
  text,
  whitespaceOnly,
}: {
  readonly kind: 'added' | 'removed' | 'changed'
  readonly text: string
  readonly whitespaceOnly: boolean
}) =>
  text === '' ? null : (
    <ChangeMark kind={kind} {...(whitespaceOnly ? { title: 'whitespace-only change' } : {})}>
      {whitespaceOnly ? <VisibleWhitespace text={text} /> : text}
    </ChangeMark>
  )

/** Combined rendering of a segment: deletions then insertions inline. */
const UnifiedSegment = ({ segment }: { readonly segment: TextSegment }) => {
  switch (segment._tag) {
    case 'equal':
      return <>{segment.text}</>
    case 'added':
      return <Marked kind="added" text={segment.text} whitespaceOnly={segment.whitespaceOnly} />
    case 'removed':
      return <Marked kind="removed" text={segment.text} whitespaceOnly={segment.whitespaceOnly} />
    case 'changed':
      return (
        <>
          <Marked kind="removed" text={segment.before} whitespaceOnly={segment.whitespaceOnly} />
          <Marked kind="added" text={segment.after} whitespaceOnly={segment.whitespaceOnly} />
        </>
      )
  }
}

/** One side of a segment for the side-by-side arrangement. */
const SideSegment = ({
  segment,
  side,
}: {
  readonly segment: TextSegment
  readonly side: 'before' | 'after'
}) => {
  if (segment._tag === 'equal') return <>{segment.text}</>
  const kind =
    segment._tag === 'changed' && segment.whitespaceOnly
      ? 'changed'
      : side === 'before'
        ? 'removed'
        : 'added'
  return (
    <Marked kind={kind} text={sideText(segment, side)} whitespaceOnly={segment.whitespaceOnly} />
  )
}

/** Collapsed unchanged stretch as a React Aria disclosure; the panel holds the hidden text. */
const CollapsedText = ({
  chunk,
  children,
}: {
  readonly chunk: Extract<TextChunk, { _tag: 'collapsed' }>
  readonly children: ReactNode
}) => (
  <Disclosure {...stylex.props(styles.foldRoot)}>
    {({ isExpanded }) => (
      <>
        <Button slot="trigger" {...stylex.props(styles.fold)}>
          {isExpanded
            ? 'Hide unchanged text'
            : `${chunk.sentences} unchanged sentences${chunk.paragraphs > 1 ? ` across ${chunk.paragraphs} paragraphs` : ''} (${chunk.text.length.toLocaleString()} chars)`}
        </Button>
        <DisclosurePanel>{children}</DisclosurePanel>
      </>
    )}
  </Disclosure>
)

/** States which side was clipped and by how much, so a partial comparison never reads as complete. */
const ClipMarker = ({
  before,
  after,
  clipAt,
}: {
  readonly before: ClippedText
  readonly after: ClippedText
  readonly clipAt: number
}) => {
  const clipped = [
    ...(before.totalChars > clipAt ? [`before ${before.totalChars.toLocaleString()}`] : []),
    ...(after.totalChars > clipAt ? [`after ${after.totalChars.toLocaleString()}`] : []),
  ]
  return clipped.length === 0 ? null : (
    <div role="note" {...stylex.props(styles.clip)}>
      {`\u22ef Clipped: compared the first ${clipAt.toLocaleString()} characters of each side (${clipped.join(', ')} chars total). Later edits are not shown.`}
    </div>
  )
}

const InlineBody = ({
  chunks,
  arrangement,
}: {
  readonly chunks: readonly TextChunk[]
  readonly arrangement: DiffArrangement
}) => {
  const keyed = withOccurrenceKeys(chunks, (chunk) =>
    chunk._tag === 'collapsed' ? `c${chunk.id}` : 'visible',
  )
  return arrangement === 'split' ? (
    <div {...stylex.props(styles.splitGrid)}>
      {keyed.map(({ key, item: chunk }) =>
        chunk._tag === 'collapsed' ? (
          <div key={key} {...stylex.props(styles.splitFull)}>
            <CollapsedText chunk={chunk}>
              <div {...stylex.props(styles.splitPair)}>
                <div {...stylex.props(styles.prose, styles.muted)}>{chunk.text}</div>
                <div {...stylex.props(styles.prose, styles.muted)}>{chunk.text}</div>
              </div>
            </CollapsedText>
          </div>
        ) : (
          <div key={key} {...stylex.props(styles.splitFull, styles.splitPair)}>
            {(['before', 'after'] as const).map((side) => (
              <div key={side} {...stylex.props(styles.prose)}>
                {withOccurrenceKeys(chunk.segments, segmentIdentity).map(
                  ({ key: segmentKey, item: segment }) => (
                    <SideSegment key={segmentKey} segment={segment} side={side} />
                  ),
                )}
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  ) : (
    <div {...stylex.props(styles.prose)}>
      {keyed.map(({ key, item: chunk }) =>
        chunk._tag === 'collapsed' ? (
          <CollapsedText key={key} chunk={chunk}>
            <span {...stylex.props(styles.muted)}>{chunk.text}</span>
          </CollapsedText>
        ) : (
          <React.Fragment key={key}>
            {withOccurrenceKeys(chunk.segments, segmentIdentity).map(
              ({ key: segmentKey, item: segment }) => (
                <UnifiedSegment key={segmentKey} segment={segment} />
              ),
            )}
          </React.Fragment>
        ),
      )}
    </div>
  )
}

const PierreBody = ({
  beforeText,
  afterText,
  renderer,
  granularity,
  context,
  arrangement,
}: {
  readonly beforeText: string
  readonly afterText: string
  readonly renderer: Exclude<TextRenderer, 'inline'>
  readonly granularity: TextGranularity
  readonly context: TextContext
  readonly arrangement: DiffArrangement
}) => {
  const source = React.useMemo(
    () => ({
      _tag: 'files' as const,
      path: 'text.txt',
      oldContents: pierreTextContents(beforeText, renderer),
      newContents: pierreTextContents(afterText, renderer),
    }),
    [beforeText, afterText, renderer],
  )
  return (
    <React.Suspense fallback={<div {...stylex.props(styles.summary)}>Loading diff renderer…</div>}>
      <LazyPierreDiff
        source={source}
        arrangement={arrangement}
        lineDiff={pierreLineDiff[granularity]}
        context={context}
        lang="text"
        overflow="wrap"
        // Reflowed sentence lines no longer match source line numbers.
        lineNumbers={renderer === 'pierre' ? 'shown' : 'hidden'}
      />
    </React.Suspense>
  )
}

/** Frame body: only mounted near the viewport; reads arrangement from the enclosing frame. */
const TextDiffBody = React.memo(
  ({
    model,
    identical,
    beforeClip,
    afterClip,
    clipAt,
    renderer,
    granularity,
    context,
    collapseAbove,
    contextChars,
  }: {
    readonly model: TextDiffModel
    /** Whether the full (unclipped) inputs are equal. */
    readonly identical: boolean
    readonly beforeClip: ClippedText
    readonly afterClip: ClippedText
    readonly clipAt: number
    readonly renderer: TextRenderer
    readonly granularity: TextGranularity
    readonly context: TextContext
    readonly collapseAbove: number | undefined
    readonly contextChars: number | undefined
  }) => {
    const arrangement = useDiffArrangement()
    const chunks = React.useMemo(
      () =>
        renderer !== 'inline'
          ? []
          : textDiffChunks(model.segments, {
              ...(context === 'full'
                ? { collapseAbove: Number.POSITIVE_INFINITY }
                : collapseAbove === undefined
                  ? {}
                  : { collapseAbove }),
              ...(contextChars === undefined ? {} : { contextChars }),
            }),
      [renderer, model, context, collapseAbove, contextChars],
    )
    return (
      <>
        <div {...stylex.props(styles.summary)}>{textDiffSummary(model, { identical, clipAt })}</div>
        {renderer === 'inline' ? (
          <InlineBody chunks={chunks} arrangement={arrangement} />
        ) : (
          <PierreBody
            beforeText={beforeClip.text}
            afterText={afterClip.text}
            renderer={renderer}
            granularity={granularity}
            context={context}
            arrangement={arrangement}
          />
        )}
        <ClipMarker before={beforeClip} after={afterClip} clipAt={clipAt} />
      </>
    )
  },
)

/** Text lens view: line or word-level diff inside `DiffFrame`, following the frame's arrangement. */
export const TextDiff = ({
  title,
  before,
  after,
  beforeText,
  afterText,
  arrangement,
  defaultArrangement,
  relation,
  renderer = 'pierre',
  granularity = 'word',
  context = 'folded',
  collapseAbove,
  contextChars,
  clipAt = 100_000,
  nested = false,
  collapsed,
  id,
}: TextDiffProps) => {
  const beforeClip = React.useMemo(() => clipText(beforeText, clipAt), [beforeText, clipAt])
  const afterClip = React.useMemo(() => clipText(afterText, clipAt), [afterText, clipAt])
  // Header counts must remain available while collapsed/off screen; never repeat this
  // alignment in the body. Other expensive, body-only lens models belong below DiffFrame.
  const model = React.useMemo(
    () => textDiffModel(beforeClip.text, afterClip.text, granularity),
    [beforeClip.text, afterClip.text, granularity],
  )
  const identical = React.useMemo(() => beforeText === afterText, [beforeText, afterText])
  // Equal clipped prefixes of different texts: the counts cover only the prefix, so the header
  // states no count rather than "no changes".
  const counts = model.identical && !identical ? undefined : model.counts
  return (
    <DiffFrame
      title={title}
      lens="text"
      before={before}
      after={after}
      nested={nested}
      {...(counts === undefined ? {} : { counts })}
      {...(relation === undefined ? {} : { relation })}
      {...(arrangement === undefined ? {} : { arrangement })}
      {...(defaultArrangement === undefined ? {} : { defaultArrangement })}
      {...(collapsed === undefined ? {} : { collapsed })}
      {...(id === undefined ? {} : { id })}
    >
      <TextDiffBody
        model={model}
        identical={identical}
        beforeClip={beforeClip}
        afterClip={afterClip}
        clipAt={clipAt}
        renderer={renderer}
        granularity={granularity}
        context={context}
        collapseAbove={collapseAbove}
        contextChars={contextChars}
      />
    </DiffFrame>
  )
}

const styles = stylex.create({
  summary: {
    fontSize: '0.78rem',
    color: tokens['--ds-gray-900'],
    marginBottom: '0.5rem',
  },
  prose: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    lineHeight: 1.65,
    fontSize: '0.9rem',
    color: tokens['--ds-gray-1000'],
    maxWidth: '78ch',
    minWidth: 0,
  },
  muted: {
    color: tokens['--ds-gray-900'],
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: '1.25rem',
  },
  splitFull: {
    gridColumn: '1 / -1',
  },
  splitPair: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: '1.25rem',
    paddingBlock: '0.25rem',
  },
  foldRoot: {
    marginBlock: '0.4rem',
    whiteSpace: 'normal',
  },
  fold: {
    display: 'block',
    width: '100%',
    paddingBlock: '0.25rem',
    paddingInline: '0.6rem',
    textAlign: 'left',
    fontFamily: scale.fontMono,
    fontSize: '0.75rem',
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
    outline: {
      default: 'none',
      ':is([data-focus-visible])': `2px solid ${tokens['--ds-focus-color']}`,
    },
  },
  clip: {
    marginTop: '0.6rem',
    paddingBlock: '0.3rem',
    paddingInline: '0.6rem',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-1000'],
    backgroundColor: tokens['--ds-amber-100'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-amber-400'],
    borderRadius: scale.radiusDefault,
  },
  ws: {
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
  },
})
