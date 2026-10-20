import type { CodeViewFileItem } from '@pierre/diffs'

import type { SemanticManifest } from '../semantic.ts'

/**
 * Pure model + projection for the `source-inspector` block (decisions q1/q2/q5):
 * a read-only, whole-file counterpart to the pull-request review surface.
 *
 * The authored shape is Vista's own; `@pierre/diffs` stays an implementation
 * detail behind `projectAppSource`, exactly as `pull-request.ts` wraps the
 * diff viewer. File items need no patch parsing — a `CodeViewFileItem` carries
 * the contents directly — so unlike a pull request there is no unrenderable
 * state: every captured file reaches the pane.
 */

/** One AppSource file, captured frozen at publish time. */
export interface AppSourceFile {
  readonly path: string
  /** Full frozen contents. */
  readonly contents: string
  /** Explicit Shiki language; otherwise inferred from the path. */
  readonly lang?: string | undefined
}

/**
 * Blocks-owned receipt projection. The service maps its PublicationReceipt
 * into this shape at capture time — the block never imports service types,
 * and the projection carries no inventory: a capture cannot contain the
 * receipt whose inventory covers the capture itself.
 */
export interface AppSourceReceipt {
  readonly version: number
  readonly basePath: string
  readonly semanticsSha256: string
  readonly fileCount: number
  readonly byteTotal: number
}

/** One step of the authoring trail, shipped by the CLI journal and frozen at publish. */
export interface AppSourceTrailStep {
  readonly command: string
  readonly detail: string
}

/** A whole Vista AppSource as a static, serializable self-inspection payload. */
export interface AppSourceData {
  readonly owner: string
  readonly slug: string
  readonly version: number | 'draft'
  /**
   * The AppSource directory as seen at capture time. Machine-local by nature
   * (it names the author's checkout or seat) — present so a reader can locate
   * and copy the path, not as a portable address. Absent for hand-authored
   * drafts that were never captured.
   */
  readonly sourceDir?: string | undefined
  readonly files: readonly AppSourceFile[]
  /** Present in publish-captured payloads; absent for hand-authored drafts. */
  readonly semantics?: SemanticManifest | undefined
  /** Present in publish-captured payloads; absent for hand-authored drafts. */
  readonly receipt?: AppSourceReceipt | undefined
  /** Present when the CLI journal ships entries; otherwise absent. */
  readonly trail?: readonly AppSourceTrailStep[] | undefined
}

/** A projected file: its nav-rail facts plus the `CodeView` item. */
export interface AppSourceFileEntry {
  /** Stable `CodeView` item id; also the nav-rail ↔ code-pane join key. */
  readonly id: string
  readonly path: string
  readonly lines: number
  readonly bytes: number
}

/** The whole projection: nav-rail entries, `CodeView` items, and byte total. */
export interface AppSourceProjection {
  readonly entries: readonly AppSourceFileEntry[]
  /** Renderable items, in authored order, ready for `CodeView`'s `items`. */
  readonly items: readonly CodeViewFileItem<undefined>[]
  readonly byteTotal: number
}

/** `CodeView` item id for a path. Paths are unique within a capture. */
export const sourceFileItemId = (viewerId: string, path: string): string => `${viewerId}::${path}`

const countLines = (contents: string): number => {
  if (contents.length === 0) return 0
  const parts = contents.split('\n')
  return contents.endsWith('\n') ? parts.length - 1 : parts.length
}

/** Pure projection from the authored capture to `@pierre/diffs` file items. */
export const projectAppSource = (viewerId: string, source: AppSourceData): AppSourceProjection => {
  const entries: AppSourceFileEntry[] = source.files.map((file) => ({
    id: sourceFileItemId(viewerId, file.path),
    path: file.path,
    lines: countLines(file.contents),
    bytes: file.contents.length,
  }))
  const items: CodeViewFileItem<undefined>[] = source.files.map((file) => ({
    id: sourceFileItemId(viewerId, file.path),
    type: 'file',
    file: {
      name: file.path,
      contents: file.contents,
      ...(file.lang === undefined ? {} : { lang: file.lang }),
    },
  }))
  return { entries, items, byteTotal: entries.reduce((total, entry) => total + entry.bytes, 0) }
}
