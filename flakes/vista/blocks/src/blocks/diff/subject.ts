/**
 * The data-first input of the semantic diff family: what agents author. A `DiffSubject` is
 * one side of a comparison as plain data, tagged by `_tag`; `SemanticDiff` picks the lens.
 * Nesting is part of the data, not of the rendering: a document embed carries its own
 * subject (e.g. a page set) and a record field may hold a subject (e.g. an image), so every
 * App renders the same data the same way.
 *
 * Plain TS types rather than Effect `Schema`: the payloads are the lens modules' own
 * interfaces (`ImageSource`, `PageSetSide`, `DocSnapshot` blocks, `RecordValue`,
 * `TreeSnapshot`, `DiagramGraph`, …), which are plain TS. Expressing the union as Schema
 * would mean redefining every one of those shapes a second time; only `TraceData` exists
 * as a Schema already.
 */
import type { SupportedLanguages } from '@pierre/diffs'

import type { TraceData } from '../../model.ts'
import type { DiffSide } from './contract.ts'
import type { DiagramGraph } from './DiagramDiff.tsx'
import type { DocBlock, DocSnapshot, EmbedBlock } from './DocumentDiff.tsx'
import type { ImageSource } from './ImageDiff.tsx'
import type { PageSetSide } from './PageSetDiff.tsx'
import type { RecordValue } from './RecordDiff.tsx'
import type { TreeSnapshot } from './TreeDiff.tsx'

/**
 * How a text subject reads: `lines` (OCR, logs, extracted text; rendered line by line
 * through `@pierre/diffs`) or `prose` (paragraphs; rendered with inline word marks).
 */
export type TextShape = 'lines' | 'prose'

/** A record field that holds a whole subject; `SemanticDiff` nests the matching lens for it. */
export interface SubjectField {
  readonly _tag: 'subject'
  readonly subject: DiffSubject
}

/** A record field: a typed scalar/container value, or a nested subject. */
export type RecordFieldValue = RecordValue | SubjectField

/** Ordered key -> field map (object key order is the display order). */
export type RecordFields = Readonly<Record<string, RecordFieldValue>>

/** An embed block whose content is itself a subject (an image, a page set, …). */
export interface SubjectEmbedBlock extends EmbedBlock {
  /** The embedded content as data; a changed embed nests the matching lens. */
  readonly subject?: DiffSubject
}

/** A document block whose embeds (at any depth) may carry nested subjects. */
export type SubjectDocBlock =
  | Exclude<DocBlock, { readonly _tag: 'embed' | 'listItem' | 'toggle' }>
  | SubjectEmbedBlock
  | (Omit<Extract<DocBlock, { readonly _tag: 'listItem' }>, 'children'> & {
      readonly children?: readonly SubjectDocBlock[]
    })
  | (Omit<Extract<DocBlock, { readonly _tag: 'toggle' }>, 'children'> & {
      readonly children: readonly SubjectDocBlock[]
    })

/** A document version whose page properties are record fields (rendered as a nested record lens). */
export interface DocumentSubjectSnapshot extends Omit<DocSnapshot, 'blocks' | 'properties'> {
  readonly properties?: RecordFields
  readonly blocks: readonly SubjectDocBlock[]
}

/** One side of a comparison as plain data; `_tag` selects the lens. */
export type DiffSubject =
  | ({ readonly _tag: 'image' } & ImageSource)
  | ({ readonly _tag: 'pageSet' } & PageSetSide)
  | {
      readonly _tag: 'text'
      readonly text: string
      /** Default `lines`. */
      readonly shape?: TextShape
    }
  | {
      readonly _tag: 'code'
      readonly path: string
      readonly contents: string
      /** Overrides language inference from `path`. */
      readonly lang?: SupportedLanguages
    }
  | { readonly _tag: 'record'; readonly fields: RecordFields }
  | ({ readonly _tag: 'document' } & DocumentSubjectSnapshot)
  | { readonly _tag: 'tree'; readonly roots: TreeSnapshot }
  | ({ readonly _tag: 'trace' } & TraceData)
  | ({ readonly _tag: 'diagram' } & DiagramGraph)

/** Tag of a subject, i.e. which lens renders it. */
export type DiffSubjectTag = DiffSubject['_tag']

/** The subject variant with tag `T`. */
export type SubjectOf<T extends DiffSubjectTag> = Extract<DiffSubject, { readonly _tag: T }>

/** One input of `SemanticDiff`: its provenance plus the data. `null` means absent (added/removed). */
export interface DiffInput {
  readonly side: DiffSide
  readonly subject: DiffSubject | null
}

/** Narrow a subject to one tag. */
export const isSubject = <T extends DiffSubjectTag>(
  subject: DiffSubject | null,
  tag: T,
): subject is SubjectOf<T> => subject !== null && subject._tag === tag
