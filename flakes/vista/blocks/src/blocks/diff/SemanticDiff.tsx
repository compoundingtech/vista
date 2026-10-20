/**
 * Data-first entry point of the semantic diff family: `<SemanticDiff before after>` takes
 * two `DiffInput`s (provenance + `DiffSubject` data) and dispatches on `_tag` to the lens
 * that renders it. Agents author data; the lens components stay exported as the escape
 * hatch for callers that need lens-specific knobs.
 *
 * Nesting follows the data: a document embed that carries a `subject` and a record field
 * that holds a `subject` render a nested `SemanticDiff` automatically, and nested frames
 * inherit the parent's arrangement. When the two sides have different tags the result is a
 * `kind changed` frame that shows each side through its own lens.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

import type { DiffSource, TraceData } from '../../model.ts'
import { CodeDiff, codeDiffModel } from './CodeDiff.tsx'
import type {
  ChangeCounts,
  ChangeKind,
  DiffArrangement,
  DiffRelation,
  DiffSide,
} from './contract.ts'
import { DiagramDiff, diffDiagrams, type DiagramGraph } from './DiagramDiff.tsx'
import { DiffFrame, useDiffArrangement } from './DiffFrame.tsx'
import {
  diffDocument,
  DocumentDiff,
  type DocBlock,
  type DocSnapshot,
  type EmbedBlock,
} from './DocumentDiff.tsx'
import {
  definedProps,
  ImageDiff,
  imageDiffCounts,
  imageDiffKind,
  imageDiffModel,
} from './ImageDiff.tsx'
import { alignPageSets, PageSetDiff, pageSetModel, type PageSetSide } from './PageSetDiff.tsx'
import {
  RecordDiff,
  recordDiffModel,
  recordValueKey,
  type RecordEntries,
  type RecordValue,
} from './RecordDiff.tsx'
import {
  isSubject,
  type DiffInput,
  type DiffSubject,
  type DiffSubjectTag,
  type DocumentSubjectSnapshot,
  type RecordFields,
  type RecordFieldValue,
  type SubjectDocBlock,
  type SubjectEmbedBlock,
  type SubjectOf,
} from './subject.ts'
import { TextDiff, textDiffModel } from './TextDiff.tsx'
import { diffTraces, TraceDiff } from './TraceDiff.tsx'
import { diffTrees, TreeDiff } from './TreeDiff.tsx'

// ---------------------------------------------------------------------------------------
// Pure model
// ---------------------------------------------------------------------------------------

/** Display names of subject tags, e.g. in the `kind changed` note. */
export const subjectTagLabel: Readonly<Record<DiffSubjectTag, string>> = {
  image: 'image',
  pageSet: 'page set',
  text: 'text',
  code: 'code',
  record: 'record',
  document: 'document',
  tree: 'tree',
  trace: 'trace',
  diagram: 'diagram',
}

const emptyPages: PageSetSide = { pages: [] }
const emptyTrace: TraceData = { traceId: '', spans: [] }
const emptyGraph: DiagramGraph = { nodes: [], edges: [] }

const changeKindsWithChange: readonly ChangeKind[] = ['added', 'removed', 'changed', 'moved']

const pick = <T extends DiffSubjectTag>(
  subject: DiffSubject | null,
  tag: T,
): SubjectOf<T> | undefined => (isSubject(subject, tag) ? subject : undefined)

/**
 * Content identity of a subject (MED.BLK.DIFF-R92): equal keys mean equal content. Images
 * and pages are keyed only by `contentHash`, never by URL; a subject holding any unhashed
 * image or page (at any depth) has no key (`undefined`), since only a pixel comparison can
 * tell. Other subjects key by their JSON value, with nested subjects replaced by their keys.
 */
export const subjectKey = (subject: DiffSubject): string | undefined => {
  let keyed = true
  const hash = (image: { readonly contentHash?: string | undefined }): string => {
    if (image.contentHash === undefined) keyed = false
    return image.contentHash ?? ''
  }
  const fields = (record: RecordFields): Readonly<Record<string, unknown>> =>
    Object.fromEntries(
      Object.entries(record).map(([name, value]) => [
        name,
        value._tag === 'subject' ? { _tag: 'subject', key: key(value.subject) } : value,
      ]),
    )
  const block = (node: SubjectDocBlock): unknown => {
    switch (node._tag) {
      case 'embed': {
        const { subject: nested, ...embed } = node
        return nested === undefined ? embed : { ...embed, subject: key(nested) }
      }
      case 'listItem':
        return node.children === undefined ? node : { ...node, children: node.children.map(block) }
      case 'toggle':
        return { ...node, children: node.children.map(block) }
      default:
        return node
    }
  }
  const key = (value: DiffSubject): string => {
    switch (value._tag) {
      case 'image':
        return `image|${hash(value)}`
      case 'pageSet':
        return `pageSet|${value.pageCount ?? ''}|${value.pages.map(hash).join(',')}`
      case 'record':
        return JSON.stringify({ _tag: 'record', fields: fields(value.fields) })
      case 'document':
        return JSON.stringify({
          ...value,
          ...(value.properties === undefined ? {} : { properties: fields(value.properties) }),
          blocks: value.blocks.map(block),
        })
      default:
        return JSON.stringify(value)
    }
  }
  const result = key(subject)
  return keyed ? result : undefined
}

/** FNV-1a, 32-bit, as 8 hex digits: a short fingerprint for embeds without their own hash. */
const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const slug = (text: string): string => text.replace(/[^a-zA-Z0-9_-]+/g, '-')

// --- record ---

/** A record field holding a subject (on either side), compared by a nested `SemanticDiff`. */
interface NestedField {
  readonly key: string
  readonly before: DiffSubject | null
  readonly after: DiffSubject | null
}

/** A record split into plain fields (record lens rows) and nested subject fields. */
interface RecordParts {
  readonly before: RecordEntries
  readonly after: RecordEntries
  readonly nested: readonly NestedField[]
}

/** A plain field paired with a subject field becomes a subject of its own so the kinds compare. */
const fieldSubject = (value: RecordFieldValue): DiffSubject => {
  switch (value._tag) {
    case 'subject':
      return value.subject
    case 'text':
      return { _tag: 'text', text: value.value, shape: 'prose' }
    case 'code':
      return { _tag: 'code', path: value.path, contents: value.value }
    default:
      return { _tag: 'record', fields: { value } }
  }
}

const recordParts = (before: RecordFields, after: RecordFields): RecordParts => {
  const plainBefore: Record<string, RecordValue> = {}
  const plainAfter: Record<string, RecordValue> = {}
  const nested: NestedField[] = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[key]
    const a = after[key]
    if ((b === undefined || b._tag !== 'subject') && (a === undefined || a._tag !== 'subject')) {
      if (b !== undefined) plainBefore[key] = b
      if (a !== undefined) plainAfter[key] = a
    } else {
      nested.push({
        key,
        before: b === undefined ? null : fieldSubject(b),
        after: a === undefined ? null : fieldSubject(a),
      })
    }
  }
  return { before: plainBefore, after: plainAfter, nested }
}

/** Plain leaf rows plus one row per nested subject field (counted by its overall kind). */
const recordPartsCounts = (parts: RecordParts): ChangeCounts => {
  const counts: Partial<Record<ChangeKind, number>> = {
    ...recordDiffModel(parts.before, parts.after).counts,
  }
  for (const field of parts.nested) {
    const kind = diffSubjectKind(field.before, field.after)
    if (kind !== undefined) counts[kind] = (counts[kind] ?? 0) + 1
  }
  return counts
}

// --- document ---

/** Documents lowered to the document lens's model; `subjects` maps converted embeds back to their data. */
interface DocumentPair {
  readonly before: DocSnapshot
  readonly after: DocSnapshot
  readonly subjects: WeakMap<EmbedBlock, DiffSubject>
}

/** One side's lowering of a subject document: the side and the embed → subject map it fills. */
interface Lowering {
  readonly side: 'before' | 'after'
  readonly subjects: WeakMap<EmbedBlock, DiffSubject>
}

/**
 * Comparable identity of a nested subject on one side. Unkeyed subjects (unhashed images or
 * pages) get a per-side token: no URL decides, and the pair always reaches its nested lens,
 * which reports the pending or pixel verdict instead of `unchanged`.
 */
const nestedIdentity = (subject: DiffSubject, side: Lowering['side']): string => {
  if (subject._tag === 'image' && subject.contentHash !== undefined) return subject.contentHash
  const key = subjectKey(subject)
  return fnv1a(key ?? `unkeyed|${side}`)
}

const toEmbed = (block: SubjectEmbedBlock, lowering: Lowering): EmbedBlock => {
  const { subject, ...embed } = block
  if (subject === undefined) return embed
  const preview =
    embed.preview ??
    (subject._tag === 'image'
      ? subject.src
      : subject._tag === 'pageSet'
        ? subject.pages[0]?.src
        : undefined)
  const identity = nestedIdentity(subject, lowering.side)
  const converted: EmbedBlock = {
    ...embed,
    // The fingerprint is part of the block signature, so a changed subject makes a changed
    // embed even when the author's own fingerprint stayed the same.
    fingerprint:
      embed.fingerprint === undefined || embed.fingerprint === identity
        ? identity
        : `${embed.fingerprint}|${identity}`,
    ...(preview === undefined ? {} : { preview }),
  }
  lowering.subjects.set(converted, subject)
  return converted
}

const toDocBlock = (block: SubjectDocBlock, lowering: Lowering): DocBlock => {
  switch (block._tag) {
    case 'embed':
      return toEmbed(block, lowering)
    case 'listItem': {
      const { children, ...item } = block
      return children === undefined
        ? item
        : { ...item, children: children.map((child) => toDocBlock(child, lowering)) }
    }
    case 'toggle': {
      const { children, ...toggle } = block
      return { ...toggle, children: children.map((child) => toDocBlock(child, lowering)) }
    }
    default:
      return block
  }
}

/** Property values as comparable strings; the rendered table is the nested record lens. */
const propertyKeys = (
  fields: RecordFields,
  side: Lowering['side'],
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value._tag === 'subject'
        ? `subject|${nestedIdentity(value.subject, side)}`
        : recordValueKey(value),
    ]),
  )

const toDocSnapshot = (doc: DocumentSubjectSnapshot, lowering: Lowering): DocSnapshot => ({
  title: doc.title,
  ...(doc.location === undefined ? {} : { location: doc.location }),
  ...(doc.properties === undefined
    ? {}
    : { properties: propertyKeys(doc.properties, lowering.side) }),
  blocks: doc.blocks.map((block) => toDocBlock(block, lowering)),
})

const documentPair = (
  before: DocumentSubjectSnapshot | undefined,
  after: DocumentSubjectSnapshot | undefined,
): DocumentPair => {
  const subjects = new WeakMap<EmbedBlock, DiffSubject>()
  const title = (after ?? before)?.title ?? ''
  const convert = (
    doc: DocumentSubjectSnapshot | undefined,
    side: Lowering['side'],
  ): DocSnapshot =>
    doc === undefined ? { title, blocks: [] } : toDocSnapshot(doc, { side, subjects })
  return { before: convert(before, 'before'), after: convert(after, 'after'), subjects }
}

// --- code ---

const codeSource = (
  before: SubjectOf<'code'> | undefined,
  after: SubjectOf<'code'> | undefined,
): DiffSource => ({
  _tag: 'files',
  path: (after ?? before)?.path ?? '',
  oldContents: before?.contents ?? '',
  newContents: after?.contents ?? '',
})

// --- counts ---

/**
 * Change counts of a subject pair, in the units of the lens that renders it (pages, lines,
 * rows, blocks, …). Pixel comparisons are not run here: image pairs that need pixels count
 * nothing until rendered. Different tags count as one `changed`; two absent sides as none.
 */
export const diffSubjectCounts = (
  before: DiffSubject | null,
  after: DiffSubject | null,
): ChangeCounts => {
  const present = after ?? before
  if (present === null) return {}
  if (before !== null && after !== null && before._tag !== after._tag) return { changed: 1 }
  switch (present._tag) {
    case 'image':
      return imageDiffCounts(
        imageDiffModel({ before: pick(before, 'image'), after: pick(after, 'image') }),
      )
    case 'pageSet':
      return pageSetModel(
        alignPageSets(pick(before, 'pageSet') ?? emptyPages, pick(after, 'pageSet') ?? emptyPages),
        new Map(),
      ).counts
    case 'text':
      return textDiffModel(pick(before, 'text')?.text ?? '', pick(after, 'text')?.text ?? '').counts
    case 'code':
      return codeDiffModel(codeSource(pick(before, 'code'), pick(after, 'code'))).counts
    case 'record':
      return recordPartsCounts(
        recordParts(pick(before, 'record')?.fields ?? {}, pick(after, 'record')?.fields ?? {}),
      )
    case 'document': {
      const pair = documentPair(pick(before, 'document'), pick(after, 'document'))
      return diffDocument(pair.before, pair.after).counts
    }
    case 'tree':
      return diffTrees(pick(before, 'tree')?.roots ?? [], pick(after, 'tree')?.roots ?? []).counts
    case 'trace':
      return diffTraces(pick(before, 'trace') ?? emptyTrace, pick(after, 'trace') ?? emptyTrace)
        .counts
    case 'diagram':
      return diffDiagrams(
        pick(before, 'diagram') ?? emptyGraph,
        pick(after, 'diagram') ?? emptyGraph,
      ).counts
  }
}

/**
 * Overall kind of a subject pair, e.g. for one record row or one summary line. `undefined`
 * when nothing is compared or when only a pixel comparison could tell (an unkeyed image or
 * page with no other change is pending, never `unchanged`).
 */
export const diffSubjectKind = (
  before: DiffSubject | null,
  after: DiffSubject | null,
): ChangeKind | undefined => {
  if (before === null) return after === null ? undefined : 'added'
  if (after === null) return 'removed'
  if (before._tag !== after._tag) return 'changed'
  const beforeKey = subjectKey(before)
  const afterKey = subjectKey(after)
  if (beforeKey !== undefined && beforeKey === afterKey) return 'unchanged'
  if (isSubject(before, 'image') && isSubject(after, 'image'))
    return imageDiffKind(imageDiffModel({ before, after }))
  const pages =
    isSubject(before, 'pageSet') && isSubject(after, 'pageSet')
      ? pageSetModel(alignPageSets(before, after), new Map())
      : undefined
  const counts = pages?.counts ?? diffSubjectCounts(before, after)
  if (changeKindsWithChange.some((kind) => (counts[kind] ?? 0) > 0)) return 'changed'
  // Pairs still awaiting a pixel verdict cannot be called unchanged yet.
  const pending =
    beforeKey === undefined ||
    afterKey === undefined ||
    (pages !== undefined && pages.pending + pages.failed > 0)
  return pending ? undefined : 'unchanged'
}

// ---------------------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------------------

/** Props for {@link SemanticDiff}. */
export interface SemanticDiffProps {
  readonly id?: string
  readonly title: React.ReactNode
  readonly before: DiffInput
  readonly after: DiffInput
  /** Defaults to `temporal`; forwarded to every lens and nested subject frame. */
  readonly relation?: DiffRelation
  /** Controlled arrangement; omit to start from `defaultArrangement` or inherit the parent frame's. */
  readonly arrangement?: DiffArrangement
  readonly defaultArrangement?: DiffArrangement
  /** Compact frame inside another lens; set automatically for nested subjects. */
  readonly nested?: boolean
}

/** Frame inputs every lens branch receives. */
interface LensCommon {
  readonly id: string
  readonly title: React.ReactNode
  readonly beforeSide: DiffSide
  readonly afterSide: DiffSide
  readonly relation: DiffRelation | undefined
  readonly arrangement: DiffArrangement | undefined
  readonly defaultArrangement: DiffArrangement | undefined
  readonly nested: boolean
}

interface LensProps<T extends DiffSubjectTag> {
  readonly common: LensCommon
  readonly before: SubjectOf<T> | undefined
  readonly after: SubjectOf<T> | undefined
}

/** Frame pass-through every lens receives: relation and arrangement, omitted when unset. */
const frameProps = (common: LensCommon) =>
  definedProps({
    relation: common.relation,
    arrangement: common.arrangement,
    defaultArrangement: common.defaultArrangement,
  })

/** A nested subject pair under `common`: same sides and relation, arrangement inherited. */
const NestedSubject = ({
  common,
  suffix,
  title,
  before,
  after,
  defaultArrangement,
}: {
  readonly common: LensCommon
  readonly suffix: string
  readonly title: React.ReactNode
  readonly before: DiffSubject | null
  readonly after: DiffSubject | null
  readonly defaultArrangement?: DiffArrangement
}) => (
  <SemanticDiff
    id={`${common.id}-${slug(suffix)}`}
    title={title}
    before={{ side: common.beforeSide, subject: before }}
    after={{ side: common.afterSide, subject: after }}
    nested
    {...definedProps({ relation: common.relation, defaultArrangement })}
  />
)

const ImageLens = ({ common, before, after }: LensProps<'image'>) => (
  <ImageDiff
    id={common.id}
    title={common.title}
    before={common.beforeSide}
    after={common.afterSide}
    beforeImage={before}
    afterImage={after}
    nested={common.nested}
    relation={common.relation}
    arrangement={common.arrangement}
    defaultArrangement={common.defaultArrangement}
  />
)

const PageSetLens = ({ common, before, after }: LensProps<'pageSet'>) => (
  <PageSetDiff
    id={common.id}
    title={common.title}
    before={common.beforeSide}
    after={common.afterSide}
    beforePages={before?.pages ?? []}
    afterPages={after?.pages ?? []}
    beforePageCount={before?.pageCount}
    afterPageCount={after?.pageCount}
    nested={common.nested}
    relation={common.relation}
    arrangement={common.arrangement}
    defaultArrangement={common.defaultArrangement}
  />
)

/** `lines` renders through `@pierre/diffs`, `prose` with inline word marks. */
const TextLens = ({ common, before, after }: LensProps<'text'>) => (
  <TextDiff
    id={common.id}
    title={common.title}
    before={common.beforeSide}
    after={common.afterSide}
    beforeText={before?.text ?? ''}
    afterText={after?.text ?? ''}
    renderer={((after ?? before)?.shape ?? 'lines') === 'lines' ? 'pierre' : 'inline'}
    nested={common.nested}
    {...frameProps(common)}
  />
)

const CodeLens = ({ common, before, after }: LensProps<'code'>) => {
  const source = React.useMemo(() => codeSource(before, after), [before, after])
  return (
    <CodeDiff
      id={common.id}
      title={common.title}
      before={common.beforeSide}
      after={common.afterSide}
      source={source}
      nested={common.nested}
      {...frameProps(common)}
      {...definedProps({ lang: (after ?? before)?.lang })}
    />
  )
}

/**
 * Plain fields render as the record lens; fields holding subjects nest their own lens
 * below it inside one record frame.
 */
const RecordLens = ({ common, before, after }: LensProps<'record'>) => {
  const parts = React.useMemo(
    () => recordParts(before?.fields ?? {}, after?.fields ?? {}),
    [before, after],
  )
  if (parts.nested.length === 0) {
    return (
      <RecordDiff
        id={common.id}
        title={common.title}
        before={common.beforeSide}
        after={common.afterSide}
        beforeRecord={parts.before}
        afterRecord={parts.after}
        nested={common.nested}
        {...frameProps(common)}
      />
    )
  }
  const hasPlain = Object.keys(parts.before).length > 0 || Object.keys(parts.after).length > 0
  return (
    <DiffFrame
      id={common.id}
      title={common.title}
      lens="record"
      before={common.beforeSide}
      after={common.afterSide}
      counts={recordPartsCounts(parts)}
      nested={common.nested}
      {...frameProps(common)}
    >
      <div {...stylex.props(styles.stack)}>
        {hasPlain ? (
          <RecordDiff
            id={`${common.id}-fields`}
            title="Fields"
            before={common.beforeSide}
            after={common.afterSide}
            beforeRecord={parts.before}
            afterRecord={parts.after}
            nested
            {...definedProps({ relation: common.relation })}
          />
        ) : null}
        {parts.nested.map((field) => (
          <NestedSubject
            key={field.key}
            common={common}
            suffix={`field-${field.key}`}
            title={field.key}
            before={field.before}
            after={field.after}
          />
        ))}
      </div>
    </DiffFrame>
  )
}

/** Embeds carrying subjects nest their lens; page properties nest a record lens. */
const DocumentLens = ({ common, before, after }: LensProps<'document'>) => {
  const pair = React.useMemo(() => documentPair(before, after), [before, after])
  return (
    <DocumentDiff
      id={common.id}
      title={common.title}
      before={pair.before}
      after={pair.after}
      beforeSide={common.beforeSide}
      afterSide={common.afterSide}
      nested={common.nested}
      {...frameProps(common)}
      renderEmbed={(beforeEmbed, afterEmbed) => {
        const beforeSubject = pair.subjects.get(beforeEmbed)
        const afterSubject = pair.subjects.get(afterEmbed)
        if (beforeSubject === undefined && afterSubject === undefined) return undefined
        return (
          <NestedSubject
            common={common}
            suffix={`embed-${afterEmbed.id ?? afterEmbed.name}`}
            title={afterEmbed.caption ?? afterEmbed.name}
            before={beforeSubject ?? null}
            after={afterSubject ?? null}
          />
        )
      }}
      renderProperties={() => (
        <NestedSubject
          common={common}
          suffix="properties"
          title="Properties"
          before={before === undefined ? null : { _tag: 'record', fields: before.properties ?? {} }}
          after={after === undefined ? null : { _tag: 'record', fields: after.properties ?? {} }}
        />
      )}
    />
  )
}

const TreeLens = ({ common, before, after }: LensProps<'tree'>) => (
  <TreeDiff
    id={common.id}
    title={common.title}
    before={before?.roots ?? []}
    after={after?.roots ?? []}
    beforeSide={common.beforeSide}
    afterSide={common.afterSide}
    nested={common.nested}
    {...frameProps(common)}
  />
)

const TraceLens = ({ common, before, after }: LensProps<'trace'>) => (
  <TraceDiff
    id={common.id}
    title={common.title}
    before={common.beforeSide}
    after={common.afterSide}
    beforeTrace={before ?? emptyTrace}
    afterTrace={after ?? emptyTrace}
    nested={common.nested}
    {...frameProps(common)}
  />
)

const DiagramLens = ({ common, before, after }: LensProps<'diagram'>) => (
  <DiagramDiff
    id={common.id}
    title={common.title}
    before={common.beforeSide}
    after={common.afterSide}
    beforeGraph={before ?? emptyGraph}
    afterGraph={after ?? emptyGraph}
    nested={common.nested}
    {...frameProps(common)}
  />
)

/** Combined stacks the two sides; side by side puts them in two columns. */
const KindChangedBody = ({
  common,
  before,
  after,
}: {
  readonly common: LensCommon
  readonly before: DiffSubject
  readonly after: DiffSubject
}) => {
  const arrangement = useDiffArrangement()
  return (
    <div {...stylex.props(styles.stack)}>
      <p {...stylex.props(styles.note)}>
        {`Kind changed: ${subjectTagLabel[before._tag]} → ${subjectTagLabel[after._tag]}. Each side is shown with its own lens.`}
      </p>
      <div {...stylex.props(styles.stack, arrangement === 'split' && styles.columns)}>
        {/* Each child shows one side, so it starts combined whatever the outer arrangement. */}
        <NestedSubject
          common={common}
          suffix="before"
          title={`${common.beforeSide.label} · ${subjectTagLabel[before._tag]}`}
          before={before}
          after={null}
          defaultArrangement="unified"
        />
        <NestedSubject
          common={common}
          suffix="after"
          title={`${common.afterSide.label} · ${subjectTagLabel[after._tag]}`}
          before={null}
          after={after}
          defaultArrangement="unified"
        />
      </div>
    </div>
  )
}

const KindChangedLens = ({
  common,
  before,
  after,
}: {
  readonly common: LensCommon
  readonly before: DiffSubject
  readonly after: DiffSubject
}) => (
  <DiffFrame
    id={common.id}
    title={common.title}
    lens="kind changed"
    before={common.beforeSide}
    after={common.afterSide}
    counts={{ changed: 1 }}
    nested={common.nested}
    {...frameProps(common)}
  >
    <KindChangedBody common={common} before={before} after={after} />
  </DiffFrame>
)

const EmptyLens = ({ common }: { readonly common: LensCommon }) => (
  <DiffFrame
    id={common.id}
    title={common.title}
    lens="empty"
    before={common.beforeSide}
    after={common.afterSide}
    counts={{}}
    nested={common.nested}
    {...frameProps(common)}
  >
    <p {...stylex.props(styles.note)}>Neither side has content.</p>
  </DiffFrame>
)

/**
 * Semantic diff of two data subjects: the lens is chosen by `_tag`, nested subjects render
 * nested lenses, and differing tags render a `kind changed` frame with both sides.
 */
export const SemanticDiff = ({
  id,
  title,
  before,
  after,
  relation,
  arrangement,
  defaultArrangement,
  nested = false,
}: SemanticDiffProps): React.ReactNode => {
  const reactId = React.useId()
  const common: LensCommon = {
    id: id ?? `semantic-diff-${slug(reactId)}`,
    title,
    beforeSide: before.side,
    afterSide: after.side,
    relation,
    arrangement,
    defaultArrangement,
    nested,
  }
  const b = before.subject
  const a = after.subject
  const present = a ?? b
  if (present === null) return <EmptyLens common={common} />
  if (b !== null && a !== null && b._tag !== a._tag)
    return <KindChangedLens common={common} before={b} after={a} />
  switch (present._tag) {
    case 'image':
      return <ImageLens common={common} before={pick(b, 'image')} after={pick(a, 'image')} />
    case 'pageSet':
      return <PageSetLens common={common} before={pick(b, 'pageSet')} after={pick(a, 'pageSet')} />
    case 'text':
      return <TextLens common={common} before={pick(b, 'text')} after={pick(a, 'text')} />
    case 'code':
      return <CodeLens common={common} before={pick(b, 'code')} after={pick(a, 'code')} />
    case 'record':
      return <RecordLens common={common} before={pick(b, 'record')} after={pick(a, 'record')} />
    case 'document':
      return (
        <DocumentLens common={common} before={pick(b, 'document')} after={pick(a, 'document')} />
      )
    case 'tree':
      return <TreeLens common={common} before={pick(b, 'tree')} after={pick(a, 'tree')} />
    case 'trace':
      return <TraceLens common={common} before={pick(b, 'trace')} after={pick(a, 'trace')} />
    case 'diagram':
      return <DiagramLens common={common} before={pick(b, 'diagram')} after={pick(a, 'diagram')} />
  }
}

const styles = stylex.create({
  stack: {
    display: 'grid',
    gap: scale.space3,
    minWidth: 0,
  },
  columns: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    alignItems: 'start',
  },
  note: {
    margin: 0,
    color: tokens['--ds-gray-900'],
    fontSize: '0.82rem',
  },
})
