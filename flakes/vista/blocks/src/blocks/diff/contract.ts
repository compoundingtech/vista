/**
 * Shared contract for the semantic diff family exported from `@vista/blocks`. Every
 * semantic diff (image, text, record, document, tree,
 * trace, diagram, code) renders inside one `DiffFrame` and reports its changes with the
 * same `ChangeKind` vocabulary so diffs compose: a document diff can nest an image diff
 * for an embedded file and a record diff for page properties.
 */
import type { ReactNode } from 'react'

/** Semantic change classification shared by every diff lens. */
export type ChangeKind = 'added' | 'removed' | 'changed' | 'moved' | 'unchanged'

/** One side of a comparison: what it is and where it comes from (provenance is load-bearing for review). */
export interface DiffSide {
  /** Short label, e.g. `Before`, `Live page`, `gen 79`. */
  readonly label: string
  /** Where this side came from, e.g. `Notion API block tree, 2026-09-25 20:10`. */
  readonly provenance?: string
  /** `observed` is real captured state; `projected` is a proposed/dry-run/mock end state. */
  readonly basis: 'observed' | 'projected'
}

/** Count of changes per kind; lenses compute this from their own model. */
export type ChangeCounts = Readonly<Partial<Record<ChangeKind, number>>>

/**
 * Primary arrangement every lens supports, named after `@pierre/diffs` `diffStyle`.
 * UI labels: `unified` = "Combined" (one merged view), `split` = "Side by side".
 */
export type DiffArrangement = 'unified' | 'split'

/** UI labels for the arrangement switch. */
export const arrangementLabel: Readonly<Record<DiffArrangement, string>> = {
  unified: 'Combined',
  split: 'Side by side',
}

/**
 * Lens-specific secondary mode, offered only where it adds meaning
 * (e.g. image combined modes: `overlay`, `swipe`, `difference`).
 */
export interface DiffMode {
  readonly id: string
  readonly label: string
  /** Arrangement this mode belongs to; the mode picker shows only modes of the active arrangement. */
  readonly arrangement: DiffArrangement
}

/**
 * How the two sides relate: `temporal` (before → after, the same thing over time) or
 * `peer` (A vs B, e.g. two candidates), which must not imply an order in time.
 */
export type DiffRelation = 'temporal' | 'peer'

/** Props for the chrome shared by every lens. */
export interface DiffFrameProps {
  readonly id?: string
  /** Heading for the comparison, e.g. a page title or file name. */
  readonly title: ReactNode
  /** What kind of thing is compared, shown as a small badge: `image`, `document`, `trace`… */
  readonly lens: string
  readonly before: DiffSide
  readonly after: DiffSide
  /** Defaults to `temporal`; `peer` renders `vs` instead of the before → after arrow. */
  readonly relation?: DiffRelation
  readonly counts?: ChangeCounts
  /**
   * Controlled arrangement. When omitted the frame is uncontrolled: it starts from
   * `defaultArrangement`, else inherits the nearest parent frame's arrangement, else `unified`.
   */
  readonly arrangement?: DiffArrangement
  readonly defaultArrangement?: DiffArrangement
  readonly onArrangementChange?: (arrangement: DiffArrangement) => void
  /** Lens-specific secondary modes; omit when the lens has none. */
  readonly modes?: readonly DiffMode[]
  readonly mode?: string
  readonly defaultMode?: string
  readonly onModeChange?: (mode: string) => void
  /** Controlled collapse; `defaultCollapsed` for uncontrolled. Collapsed shows header + summary only. */
  readonly collapsed?: boolean
  readonly defaultCollapsed?: boolean
  readonly onCollapsedChange?: (collapsed: boolean) => void
  /** Nested lenses render compact (no outer border, smaller header). */
  readonly nested?: boolean
  readonly children: ReactNode
}
