/**
 * Hierarchy/location lens: keyed tree matching by stable id with moves, renames, splits and
 * unchanged-subtree folding, rendered with React Aria `Tree` (expand/collapse, keyboard
 * navigation, selection).
 *
 * Combined merges both trees: a moved node sits at its new location with a ghost at the
 * old one. Side by side shows the two literal trees; hovering or selecting a node
 * highlights its counterpart (same id, or split source/pieces) in both trees.
 */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  Link,
  ListLayout,
  Tooltip,
  TooltipTrigger,
  Tree,
  TreeItem,
  TreeItemContent,
  Virtualizer,
  type Key,
  type Selection,
} from 'react-aria-components'

import type {
  ChangeCounts,
  ChangeKind,
  DiffArrangement,
  DiffRelation,
  DiffSide,
} from './contract.ts'
import { changeKindStyles, DiffFrame, useDiffArrangement } from './DiffFrame.tsx'

/** One node of a hierarchy. Ids must be unique within each tree; sibling order is display order. */
export interface TreeNode {
  readonly id: string
  readonly name: string
  /**
   * Open node kind, e.g. `folder`, `page`, `pdf`, `image`, `database`. `folder` and `page`
   * get dedicated glyphs; other kinds render a file glyph plus the kind label.
   */
  readonly kind: string
  /** Where the node lives (e.g. a page URL); rendered as an "open" link. */
  readonly href?: string
  /** Short secondary line, e.g. `receipt-scan.pdf · 212 KB`. */
  readonly meta?: string
  /**
   * After side only: id of the before-side node this node was split out of. Several
   * nodes sharing one `splitFrom` form a split (one node → N new nodes).
   */
  readonly splitFrom?: string
  readonly children?: readonly TreeNode[]
}

/** Before and after may each have multiple top-level nodes. */
export type TreeSnapshot = readonly TreeNode[]

interface IndexedNode {
  readonly node: TreeNode
  readonly parentId: string | undefined
  readonly path: readonly string[]
}

/** Reference to a node elsewhere in the diff (link target). */
export interface TreeNodeRef {
  readonly id: string
  readonly name: string
  readonly path: readonly string[]
}

/** A node's role in a split: the source that was split, or one of the resulting pieces. */
export type TreeSplitRole =
  | { readonly _tag: 'source'; readonly pieces: readonly TreeNodeRef[] }
  | {
      readonly _tag: 'piece'
      readonly source: TreeNodeRef
      /** The piece carries the same `meta` (e.g. the same attachment) as its source. */
      readonly sharesSourceMeta: boolean
    }

/** One node's semantic change; rename is represented by `kind: 'changed'`. */
export interface TreeChange {
  readonly id: string
  readonly kind: ChangeKind
  readonly before?: TreeNode | undefined
  readonly after?: TreeNode | undefined
  readonly oldPath?: readonly string[] | undefined
  readonly newPath?: readonly string[] | undefined
  /** Name or kind differs. */
  readonly renamed: boolean
  /** True when this node, not merely one of its ancestors, has changed parents. */
  readonly directlyMoved: boolean
  readonly split?: TreeSplitRole | undefined
}

/** Old and new path for a directly moved node. */
export interface TreeMove {
  readonly id: string
  readonly name: string
  readonly from: readonly string[]
  readonly to: readonly string[]
}

/** One node split into N new nodes. */
export interface TreeSplit {
  readonly source: TreeNodeRef
  readonly pieces: readonly TreeNodeRef[]
}

/** A row of the merged tree. `ghost` is the old location of a moved node. */
export interface TreeRow {
  /** `new:<id>` for after-side rows, `old:<id>` for removed nodes and move ghosts. */
  readonly key: string
  readonly change: TreeChange
  readonly ghost: boolean
  readonly children: readonly TreeRow[]
  /** Count of changed rows below (move ghosts included: the parent lost a child). */
  readonly descendantChanges: number
}

/** Complete hierarchy diff, including rows for the merged view. */
export interface TreeDiffModel {
  readonly changes: ReadonlyMap<string, TreeChange>
  readonly rows: readonly TreeRow[]
  readonly moves: readonly TreeMove[]
  readonly splits: readonly TreeSplit[]
  /** Node-level counts; moves counted once at the new location, split sources as `changed`. */
  readonly counts: ChangeCounts
}

const indexTree = (roots: TreeSnapshot): ReadonlyMap<string, IndexedNode> => {
  const map = new Map<string, IndexedNode>()
  const walk = (
    nodes: readonly TreeNode[],
    parentId: string | undefined,
    path: readonly string[],
  ): void => {
    for (const node of nodes) {
      if (map.has(node.id)) throw new Error(`Duplicate tree node id: ${node.id}`)
      const nodePath = [...path, node.name]
      map.set(node.id, { node, parentId, path: nodePath })
      walk(node.children ?? [], node.id, nodePath)
    }
  }
  walk(roots, undefined, [])
  return map
}

const nodeRef = (id: string, entry: IndexedNode): TreeNodeRef => ({
  id,
  name: entry.node.name,
  path: entry.path,
})

const countChanges = (rows: readonly TreeRow[]): number =>
  rows.reduce(
    (sum, row) => sum + (row.change.kind === 'unchanged' ? 0 : 1) + row.descendantChanges,
    0,
  )

/**
 * Compute node changes by stable id. Parent changes are moves; a descendant whose own
 * parent is unchanged stays unchanged even if an ancestor moved (the path travels with
 * that ancestor). A rename is `changed` unless the same node also moved; a split source
 * that is otherwise unchanged is `changed` (it lost content to its pieces).
 */
export const diffTrees = (before: TreeSnapshot, after: TreeSnapshot): TreeDiffModel => {
  const oldIndex = indexTree(before)
  const newIndex = indexTree(after)
  const changes = new Map<string, TreeChange>()
  const moves: TreeMove[] = []
  const counts: Partial<Record<ChangeKind, number>> = {}
  const count = (kind: ChangeKind) => {
    counts[kind] = (counts[kind] ?? 0) + 1
  }

  const piecesBySource = new Map<string, TreeNodeRef[]>()
  for (const [id, entry] of newIndex) {
    const sourceId = entry.node.splitFrom
    if (sourceId === undefined || !oldIndex.has(sourceId)) continue
    piecesBySource.set(sourceId, [...(piecesBySource.get(sourceId) ?? []), nodeRef(id, entry)])
  }
  const splits: TreeSplit[] = []
  for (const [sourceId, pieces] of piecesBySource) {
    const source = oldIndex.get(sourceId)
    if (source) splits.push({ source: nodeRef(sourceId, source), pieces })
  }
  const sourceSplit = (id: string): TreeSplitRole | undefined => {
    const pieces = piecesBySource.get(id)
    return pieces ? { _tag: 'source', pieces } : undefined
  }
  const pieceSplit = (node: TreeNode): TreeSplitRole | undefined => {
    const source = node.splitFrom === undefined ? undefined : oldIndex.get(node.splitFrom)
    if (!source || node.splitFrom === undefined) return undefined
    return {
      _tag: 'piece',
      source: nodeRef(node.splitFrom, source),
      sharesSourceMeta: node.meta !== undefined && node.meta === source.node.meta,
    }
  }

  for (const [id, oldNode] of oldIndex) {
    const newNode = newIndex.get(id)
    if (!newNode) {
      changes.set(id, {
        id,
        kind: 'removed',
        before: oldNode.node,
        oldPath: oldNode.path,
        renamed: false,
        directlyMoved: false,
        split: sourceSplit(id),
      })
      count('removed')
      continue
    }
    const directlyMoved = oldNode.parentId !== newNode.parentId
    const renamed =
      oldNode.node.name !== newNode.node.name || oldNode.node.kind !== newNode.node.kind
    const split = sourceSplit(id) ?? pieceSplit(newNode.node)
    const kind: ChangeKind = directlyMoved
      ? 'moved'
      : renamed || split?._tag === 'source'
        ? 'changed'
        : 'unchanged'
    changes.set(id, {
      id,
      kind,
      before: oldNode.node,
      after: newNode.node,
      oldPath: oldNode.path,
      newPath: newNode.path,
      renamed,
      directlyMoved,
      split,
    })
    count(kind)
    if (directlyMoved)
      moves.push({ id, name: newNode.node.name, from: oldNode.path, to: newNode.path })
  }
  for (const [id, newNode] of newIndex) {
    if (oldIndex.has(id)) continue
    changes.set(id, {
      id,
      kind: 'added',
      after: newNode.node,
      newPath: newNode.path,
      renamed: false,
      directlyMoved: false,
      split: pieceSplit(newNode.node),
    })
    count('added')
  }

  const build = (oldSiblings: TreeSnapshot, newSiblings: TreeSnapshot): readonly TreeRow[] => {
    const result: TreeRow[] = []
    const inNew = new Set(newSiblings.map((node) => node.id))
    const inOld = new Set(oldSiblings.map((node) => node.id))
    const appendOld = (node: TreeNode, ghost: boolean): void => {
      const change = changes.get(node.id)
      if (!change) return
      // A moved node's old descendants reappear at the new location. Its old row is
      // only a location marker; recursively rendering it here would double-count them.
      const children = ghost ? [] : build(node.children ?? [], [])
      result.push({
        key: `old:${node.id}`,
        change,
        ghost,
        children,
        descendantChanges: countChanges(children),
      })
    }
    // Emit after nodes in new order, inserting removed and moved-out nodes immediately
    // after the nearest preceding sibling that still exists in this sibling list.
    const pending = new Map<string | undefined, TreeNode[]>()
    let anchor: string | undefined
    for (const node of oldSiblings) {
      if (inNew.has(node.id)) {
        anchor = node.id
        continue
      }
      pending.set(anchor, [...(pending.get(anchor) ?? []), node])
    }
    const emitPending = (afterId: string | undefined) => {
      for (const node of pending.get(afterId) ?? []) appendOld(node, newIndex.has(node.id))
    }
    emitPending(undefined)
    for (const node of newSiblings) {
      const change = changes.get(node.id)
      if (!change) continue
      // Re-parented nodes compare their children at their new location. Added nodes
      // have no old children, so descendants with stable ids become moved-in rows.
      const children = build(oldIndex.get(node.id)?.node.children ?? [], node.children ?? [])
      result.push({
        key: `new:${node.id}`,
        change,
        ghost: false,
        children,
        descendantChanges: countChanges(children),
      })
      if (inOld.has(node.id)) emitPending(node.id)
    }
    return result
  }

  return { changes, rows: build(before, after), moves, splits, counts }
}

// ---------------------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------------------

/**
 * How moves render. `ghost`: a ghost at the old location plus the node at the new one;
 * `list`: only the node at its new location plus an `old path → new path` list;
 * `both`: ghost and list.
 */
export type TreeMovePresentation = 'ghost' | 'list' | 'both'

/** How subtrees without any change render: `collapsed` (with a count) or `dimmed` (expanded). */
export type TreeUnchangedPresentation = 'collapsed' | 'dimmed'

/** Props for {@link TreeDiff}. */
export interface TreeDiffProps {
  readonly id?: string
  readonly title?: React.ReactNode
  readonly before: TreeSnapshot
  readonly after: TreeSnapshot
  readonly beforeSide: DiffSide
  readonly afterSide: DiffSide
  readonly arrangement?: DiffArrangement
  /** Defaults to `temporal`; `peer` presents the sides as A vs B. */
  readonly relation?: DiffRelation
  readonly defaultArrangement?: DiffArrangement
  readonly nested?: boolean
  readonly defaultCollapsed?: boolean
  /** Default `both`. */
  readonly moves?: TreeMovePresentation
  /** Default `collapsed`. */
  readonly unchanged?: TreeUnchangedPresentation
}

const pathLabel = (parts: readonly string[]): string => parts.join(' / ')

/** Where a node is shown: its old location (ghost / before tree) or its current one. */
type NodeLocation = 'old' | 'new'

/** Selected node plus which of its locations the reviewer asked for. */
interface NodeTarget {
  readonly id: string
  readonly location: NodeLocation
}

/** Ids highlighted together with `id`: itself plus its split source or pieces. */
const linkedIds = (model: TreeDiffModel, id: string | undefined): ReadonlySet<string> => {
  if (id === undefined) return new Set()
  const split = model.changes.get(id)?.split
  if (split?._tag === 'piece') return new Set([id, split.source.id])
  if (split?._tag === 'source') return new Set([id, ...split.pieces.map((piece) => piece.id)])
  return new Set([id])
}

/** Precomputed per-model subtree stats keep collapsed rows cheap even in deep trees. */
interface SideStats {
  readonly size: number
  readonly quiet: boolean
}

const indexSide = (
  nodes: readonly TreeNode[],
  changes: ReadonlyMap<string, TreeChange>,
): WeakMap<TreeNode, SideStats> => {
  const stats = new WeakMap<TreeNode, SideStats>()
  const visit = (node: TreeNode): SideStats => {
    let size = 1
    let quiet = changes.get(node.id)?.kind === 'unchanged'
    for (const child of node.children ?? []) {
      const childStats = visit(child)
      size += childStats.size
      quiet = quiet && childStats.quiet
    }
    const result = { size, quiet }
    stats.set(node, result)
    return result
  }
  for (const node of nodes) visit(node)
  return stats
}

const indexMerged = (
  rows: readonly TreeRow[],
  moves: TreeMovePresentation,
): WeakMap<TreeRow, number> => {
  const sizes = new WeakMap<TreeRow, number>()
  const visit = (row: TreeRow): number => {
    let size = 1
    for (const child of visibleRows(row.children, moves)) size += visit(child)
    sizes.set(row, size)
    return size
  }
  for (const row of visibleRows(rows, moves)) visit(row)
  return sizes
}

/** Highlighting lives outside React: moving the pointer changes only mounted row attributes. */
class LinkedRows {
  private readonly elements = new Map<string, Set<HTMLDivElement>>()
  private hovered: string | undefined
  private selected: string | undefined
  private hoveredIds: ReadonlySet<string> = new Set()
  private selectedIds: ReadonlySet<string> = new Set()

  private readonly model: TreeDiffModel
  constructor(model: TreeDiffModel) {
    this.model = model
  }

  private isLinked(id: string): boolean {
    return this.hoveredIds.has(id) || this.selectedIds.has(id)
  }

  register(id: string, element: HTMLDivElement): void {
    let rows = this.elements.get(id)
    if (!rows) this.elements.set(id, (rows = new Set()))
    rows.add(element)
    element.toggleAttribute('data-linked', this.isLinked(id))
  }

  unregister(id: string, element: HTMLDivElement): void {
    const rows = this.elements.get(id)
    rows?.delete(element)
    if (rows?.size === 0) this.elements.delete(id)
  }

  private update(affected: ReadonlySet<string>): void {
    for (const id of affected) {
      const linked = this.isLinked(id)
      for (const element of this.elements.get(id) ?? [])
        element.toggleAttribute('data-linked', linked)
    }
  }

  setHovered(id: string | undefined): void {
    if (this.hovered === id) return
    const next = linkedIds(this.model, id)
    const affected = new Set([...this.hoveredIds, ...next])
    this.hovered = id
    this.hoveredIds = next
    this.update(affected)
  }

  setSelected(id: string | undefined): void {
    if (this.selected === id) return
    const next = linkedIds(this.model, id)
    const affected = new Set([...this.selectedIds, ...next])
    this.selected = id
    this.selectedIds = next
    this.update(affected)
  }
}

/** Stable item props; mutable hover/selection never pass through the collection builder. */
interface ItemContext {
  readonly model: TreeDiffModel
  readonly moves: TreeMovePresentation
  readonly unchanged: TreeUnchangedPresentation
  readonly sideStats: WeakMap<TreeNode, SideStats>
  readonly mergedSizes: WeakMap<TreeRow, number>
  readonly linked: LinkedRows
  readonly onHover: (id: string | undefined) => void
  /** Select a node in every tree it appears in and scroll the requested location into view. */
  readonly onJump: (target: NodeTarget) => void
}

const NodeIcon = ({ kind }: { readonly kind: string }): React.ReactNode => (
  <span
    aria-hidden
    {...stylex.props(
      styles.icon,
      kind === 'folder' ? styles.folder : kind === 'page' ? styles.page : styles.file,
    )}
  />
)

const JumpChip = ({
  label,
  tooltip,
  onPress,
}: {
  readonly label: string
  readonly tooltip: string
  readonly onPress: () => void
}): React.ReactNode => (
  <TooltipTrigger delay={300}>
    <Button onPress={onPress} {...stylex.props(styles.chip)}>
      {label}
    </Button>
    <Tooltip {...stylex.props(styles.tooltip)}>{tooltip}</Tooltip>
  </TooltipTrigger>
)

/** Row content shared by the merged and the per-side trees. */
const NodeLine = ({
  node,
  change,
  kind,
  location,
  quiet,
  hiddenCount,
  isExpanded,
  hasChildItems,
  side = false,
  level,
  ctx,
}: {
  readonly node: TreeNode
  readonly change: TreeChange
  /** Change kind shown on this row (per side in the split arrangement). */
  readonly kind: ChangeKind
  /** `old`: this row is where the node used to be (ghost / before tree); `new`: where it is now. */
  readonly location: NodeLocation
  /** Side trees keep single-line rows so their virtualizer can use a fixed row size. */
  readonly side?: boolean
  readonly quiet: boolean
  readonly hiddenCount: number
  readonly isExpanded: boolean
  readonly hasChildItems: boolean
  readonly level: number
  readonly ctx: ItemContext
}): React.ReactNode => {
  const elementRef = React.useRef<HTMLDivElement | null>(null)
  const register = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (elementRef.current) ctx.linked.unregister(change.id, elementRef.current)
      elementRef.current = element
      if (element) ctx.linked.register(change.id, element)
    },
    [change.id, ctx.linked],
  )
  const ghost = location === 'old' && change.kind === 'moved'
  const split = change.split
  const oldName =
    location === 'new' && change.renamed && change.before && change.after
      ? change.before
      : undefined
  return (
    <div
      ref={register}
      {...stylex.props(
        styles.line,
        side && styles.sideLine,
        changeKindStyles[kind],
        ghost && styles.ghost,
        quiet && ctx.unchanged === 'dimmed' && styles.dimmed,
        styles.linked,
        styles.indent(level - 1),
      )}
    >
      {hasChildItems ? (
        <Button
          slot="chevron"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          {...stylex.props(styles.chevron)}
        >
          <span
            aria-hidden
            {...stylex.props(styles.chevronGlyph, isExpanded && styles.chevronOpen)}
          >
            ›
          </span>
        </Button>
      ) : (
        <span aria-hidden {...stylex.props(styles.chevronSpacer)} />
      )}
      <NodeIcon kind={node.kind} />
      <span {...stylex.props(styles.nodeName, (ghost || kind === 'removed') && styles.struck)}>
        {node.name}
      </span>
      {node.kind === 'folder' || node.kind === 'page' ? null : (
        <span {...stylex.props(styles.kindLabel)}>{node.kind}</span>
      )}
      {node.href ? (
        <Link
          href={node.href}
          target="_blank"
          aria-label={`Open ${node.name}`}
          {...stylex.props(styles.open)}
        >
          ↗
        </Link>
      ) : null}
      {oldName ? (
        <span {...stylex.props(styles.muted)}>
          was <span {...stylex.props(styles.struck)}>{oldName.name}</span>
          {oldName.kind === node.kind ? null : ` (${oldName.kind})`}
        </span>
      ) : null}
      {split?._tag === 'piece' ? (
        <JumpChip
          label={`↳ split from ${split.source.name}`}
          tooltip={`${pathLabel(split.source.path)}${split.sharesSourceMeta ? ` · same ${node.meta ?? 'content'}` : ''}`}
          onPress={() => ctx.onJump({ id: split.source.id, location: 'old' })}
        />
      ) : null}
      {node.meta && !(split?._tag === 'piece' && split.sharesSourceMeta) ? (
        <span {...stylex.props(styles.muted)}>{node.meta}</span>
      ) : null}
      {split?._tag === 'source' ? (
        <JumpChip
          label={`split into ${split.pieces.length}`}
          tooltip={split.pieces.map((piece) => piece.name).join(' · ')}
          onPress={() => {
            const first = split.pieces[0]
            if (first) ctx.onJump({ id: first.id, location: 'new' })
          }}
        />
      ) : null}
      {change.directlyMoved && change.oldPath && change.newPath ? (
        <JumpChip
          label={location === 'old' ? 'moved out →' : '← moved in'}
          tooltip={
            location === 'old'
              ? `now at ${pathLabel(change.newPath)}`
              : `was at ${pathLabel(change.oldPath)}`
          }
          onPress={() =>
            ctx.onJump({ id: change.id, location: location === 'old' ? 'new' : 'old' })
          }
        />
      ) : null}
      {hiddenCount > 0 && !isExpanded ? (
        <span {...stylex.props(styles.muted)}>{hiddenCount} unchanged inside</span>
      ) : null}
    </div>
  )
}

const itemClass = ({
  isSelected,
  isFocusVisible,
}: {
  isSelected: boolean
  isFocusVisible: boolean
}): string =>
  stylex.props(styles.item, isSelected && styles.itemSelected, isFocusVisible && styles.itemFocused)
    .className ?? ''

const visibleRows = (rows: readonly TreeRow[], moves: TreeMovePresentation): readonly TreeRow[] =>
  moves === 'list' ? rows.filter((row) => !row.ghost) : rows

const isQuietRow = (row: TreeRow): boolean =>
  row.change.kind === 'unchanged' && row.descendantChanges === 0

const MergedItem: React.NamedExoticComponent<{ readonly row: TreeRow; readonly ctx: ItemContext }> =
  React.memo(
    ({ row, ctx }: { readonly row: TreeRow; readonly ctx: ItemContext }): React.ReactNode => {
      const node = row.ghost ? row.change.before : (row.change.after ?? row.change.before)
      if (!node) return null
      const children = visibleRows(row.children, ctx.moves)
      const quiet = isQuietRow(row)
      return (
        <TreeItem
          id={row.key}
          textValue={node.name}
          data-node-key={row.key}
          onHoverStart={() => ctx.onHover(row.change.id)}
          onHoverEnd={() => ctx.onHover(undefined)}
          className={itemClass}
        >
          <TreeItemContent>
            {({ isExpanded, hasChildItems, level }) => (
              <NodeLine
                node={node}
                change={row.change}
                kind={row.ghost ? 'moved' : row.change.kind}
                location={row.key.startsWith('old:') ? 'old' : 'new'}
                quiet={quiet}
                hiddenCount={quiet ? (ctx.mergedSizes.get(row) ?? 1) - 1 : 0}
                isExpanded={isExpanded}
                hasChildItems={hasChildItems}
                level={level}
                ctx={ctx}
              />
            )}
          </TreeItemContent>
          {children.map((child) => (
            <MergedItem key={child.key} row={child} ctx={ctx} />
          ))}
        </TreeItem>
      )
    },
  )

const sideKind = (change: TreeChange, side: 'before' | 'after'): ChangeKind => {
  if (change.kind === 'moved') return 'moved'
  if (change.kind === 'removed') return side === 'before' ? 'removed' : 'unchanged'
  if (change.kind === 'added') return side === 'after' ? 'added' : 'unchanged'
  return change.kind
}

const SideItem: React.NamedExoticComponent<{
  readonly node: TreeNode
  readonly side: 'before' | 'after'
  readonly ctx: ItemContext
}> = React.memo(
  ({
    node,
    side,
    ctx,
  }: {
    readonly node: TreeNode
    readonly side: 'before' | 'after'
    readonly ctx: ItemContext
  }): React.ReactNode => {
    const change = ctx.model.changes.get(node.id)
    if (!change) return null
    const children = node.children ?? []
    const quiet = ctx.sideStats.get(node)?.quiet === true
    const key = `${side}:${node.id}`
    return (
      <TreeItem
        id={key}
        textValue={node.name}
        data-node-key={key}
        onHoverStart={() => ctx.onHover(node.id)}
        onHoverEnd={() => ctx.onHover(undefined)}
        className={itemClass}
      >
        <TreeItemContent>
          {({ isExpanded, hasChildItems, level }) => (
            <NodeLine
              node={node}
              change={change}
              kind={sideKind(change, side)}
              side
              location={side === 'before' ? 'old' : 'new'}
              quiet={quiet}
              hiddenCount={quiet ? (ctx.sideStats.get(node)?.size ?? 1) - 1 : 0}
              isExpanded={isExpanded}
              hasChildItems={hasChildItems}
              level={level}
              ctx={ctx}
            />
          )}
        </TreeItemContent>
        {children.map((child) => (
          <SideItem key={child.id} node={child} side={side} ctx={ctx} />
        ))}
      </TreeItem>
    )
  },
)

const mergedExpandedKeys = (
  rows: readonly TreeRow[],
  moves: TreeMovePresentation,
  unchanged: TreeUnchangedPresentation,
): readonly string[] => {
  const keys: string[] = []
  const collect = (level: readonly TreeRow[]) => {
    for (const row of visibleRows(level, moves)) {
      if (row.children.length > 0 && (unchanged === 'dimmed' || !isQuietRow(row))) {
        keys.push(row.key)
      }
      collect(row.children)
    }
  }
  collect(rows)
  return keys
}

const sideExpandedKeys = (
  nodes: readonly TreeNode[],
  side: 'before' | 'after',
  stats: WeakMap<TreeNode, SideStats>,
  unchanged: TreeUnchangedPresentation,
): readonly string[] =>
  nodes.flatMap((node) => {
    const children = node.children ?? []
    const quiet = stats.get(node)?.quiet === true
    return [
      ...(children.length > 0 && (unchanged === 'dimmed' || !quiet) ? [`${side}:${node.id}`] : []),
      ...sideExpandedKeys(children, side, stats, unchanged),
    ]
  })

type ExpansionTree = 'merged' | 'before' | 'after'

/** Expanded keys of each of the three trees (merged, before, after). */
type Expansion = Readonly<Record<ExpansionTree, ReadonlySet<string>>>

const MovesAndSplits = ({
  model,
  showMoves,
  onJump,
}: {
  readonly model: TreeDiffModel
  readonly showMoves: boolean
  readonly onJump: (target: NodeTarget) => void
}): React.ReactNode => {
  const moves = showMoves ? model.moves : []
  if (moves.length === 0 && model.splits.length === 0) return null
  return (
    <section aria-label="Moves and splits" {...stylex.props(styles.summary)}>
      {moves.length > 0 ? (
        <>
          <h3 {...stylex.props(styles.summaryTitle)}>Moves · {moves.length}</h3>
          <ul {...stylex.props(styles.summaryList)}>
            {moves.map((move) => (
              <li key={move.id} {...stylex.props(styles.summaryItem)}>
                <Button
                  onPress={() => onJump({ id: move.id, location: 'new' })}
                  {...stylex.props(styles.summaryName)}
                >
                  {move.name}
                </Button>
                <span {...stylex.props(styles.struck, styles.muted)}>{pathLabel(move.from)}</span>
                <span aria-hidden>→</span>
                <span>{pathLabel(move.to)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {model.splits.length > 0 ? (
        <>
          <h3 {...stylex.props(styles.summaryTitle)}>Splits · {model.splits.length}</h3>
          <ul {...stylex.props(styles.summaryList)}>
            {model.splits.map((split) => (
              <li key={split.source.id} {...stylex.props(styles.summaryItem)}>
                <Button
                  onPress={() => onJump({ id: split.source.id, location: 'old' })}
                  {...stylex.props(styles.summaryName)}
                >
                  {split.source.name}
                </Button>
                <span aria-hidden>→</span>
                <span>{split.pieces.map((piece) => piece.name).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

const treeLayoutOptions = { estimatedRowSize: 34, gap: 2 }

const TreeBody = ({
  model,
  before,
  after,
  beforeSide,
  afterSide,
  moves,
  unchanged,
}: {
  readonly model: TreeDiffModel
  readonly before: TreeSnapshot
  readonly after: TreeSnapshot
  readonly beforeSide: DiffSide
  readonly afterSide: DiffSide
  readonly moves: TreeMovePresentation
  readonly unchanged: TreeUnchangedPresentation
}): React.ReactNode => {
  const arrangement = useDiffArrangement()
  const linked = React.useMemo(() => new LinkedRows(model), [model])
  const [selected, setSelected] = React.useState<NodeTarget | undefined>(undefined)
  const container = React.useRef<HTMLDivElement>(null)
  const sideStats = React.useMemo(() => {
    const stats = indexSide(before, model.changes)
    // A node can appear in both snapshots; its structural stats may differ.
    const afterStats = indexSide(after, model.changes)
    return { before: stats, after: afterStats }
  }, [before, after, model])
  const mergedSizes = React.useMemo(() => indexMerged(model.rows, moves), [model, moves])

  /** Row key of a target in one tree; merged falls back to the current location when no old row is shown. */
  const keyFor = React.useCallback(
    ({ id, location }: NodeTarget, tree: 'merged' | 'before' | 'after'): string => {
      if (tree !== 'merged') return `${tree}:${id}`
      const change = model.changes.get(id)
      const hasOldRow = change?.kind === 'removed' || (change?.kind === 'moved' && moves !== 'list')
      return (location === 'old' && hasOldRow) || !change?.after ? `old:${id}` : `new:${id}`
    },
    [model, moves],
  )
  // A page arrangement change must not invalidate every collection item.
  const arrangementRef = React.useRef(arrangement)
  arrangementRef.current = arrangement
  const defaultExpanded = React.useMemo<Expansion>(
    () => ({
      merged: new Set(mergedExpandedKeys(model.rows, moves, unchanged)),
      before: new Set(sideExpandedKeys(before, 'before', sideStats.before, unchanged)),
      after: new Set(sideExpandedKeys(after, 'after', sideStats.after, unchanged)),
    }),
    [model, moves, unchanged, before, after, sideStats],
  )
  // Controlled trees: the reviewer's folds live here, keyed to the defaults they started from, so
  // new data or presentation re-seeds every tree and an arrangement switch keeps the folds.
  const [expansion, setExpansion] = React.useState<{
    readonly seed: Expansion
    readonly keys: Expansion
  }>(() => ({ seed: defaultExpanded, keys: defaultExpanded }))
  const expanded = expansion.seed === defaultExpanded ? expansion.keys : defaultExpanded
  const onExpandedChange = (tree: ExpansionTree, keys: Set<Key>): void =>
    setExpansion((previous) => ({
      seed: defaultExpanded,
      keys: {
        ...(previous.seed === defaultExpanded ? previous.keys : defaultExpanded),
        [tree]: new Set([...keys].map(String)),
      },
    }))
  // `onJump` stays stable (it is part of every item's context) and reads the latest render.
  const jumpTreeRef = React.useRef({ model, moves, before, after, beforeSide, afterSide, expanded })
  jumpTreeRef.current = { model, moves, before, after, beforeSide, afterSide, expanded }
  const onJump = React.useCallback(
    (target: NodeTarget): void => {
      linked.setSelected(target.id)
      setSelected(target)
      const keys =
        arrangementRef.current === 'split'
          ? target.location === 'old'
            ? [keyFor(target, 'before'), keyFor(target, 'after')]
            : [keyFor(target, 'after'), keyFor(target, 'before')]
          : [keyFor(target, 'merged')]
      const element = keys
        .map((key) => container.current?.querySelector(`[data-node-key="${CSS.escape(key)}"]`))
        .find((found) => found != null)
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
        return
      }
      // A virtual row has no DOM element until it approaches the viewport.
      const tree =
        arrangementRef.current === 'split'
          ? target.location === 'old'
            ? 'before'
            : 'after'
          : 'merged'
      const state = jumpTreeRef.current
      const order: string[] = []
      if (tree === 'merged') {
        const visit = (rows: readonly TreeRow[]): void => {
          for (const row of visibleRows(rows, state.moves)) {
            order.push(row.key)
            if (state.expanded.merged.has(row.key)) visit(row.children)
          }
        }
        visit(state.model.rows)
      } else {
        const visit = (nodes: readonly TreeNode[]): void => {
          for (const node of nodes) {
            const key = `${tree}:${node.id}`
            order.push(key)
            if (state.expanded[tree].has(key)) visit(node.children ?? [])
          }
        }
        visit(tree === 'before' ? state.before : state.after)
      }
      const index = order.indexOf(keyFor(target, tree))
      if (index < 0) return // A manually collapsed ancestor still hides its children.
      const label =
        tree === 'merged'
          ? 'Merged hierarchy'
          : `${(tree === 'before' ? state.beforeSide : state.afterSide).label} hierarchy`
      const treeElement = [
        ...(container.current?.querySelectorAll<HTMLElement>('[role="treegrid"]') ?? []),
      ].find((candidate) => candidate.getAttribute('aria-label') === label)
      if (!treeElement) return
      window.scrollTo({
        top:
          treeElement.getBoundingClientRect().top +
          window.scrollY +
          ((index + 0.5) / order.length) * treeElement.scrollHeight -
          window.innerHeight / 2,
      })
      requestAnimationFrame(() => {
        container.current
          ?.querySelector(`[data-node-key="${CSS.escape(order[index] ?? '')}"]`)
          ?.scrollIntoView({ block: 'nearest' })
      })
    },
    [keyFor, linked],
  )
  const ctx: ItemContext = React.useMemo(
    () => ({
      model,
      moves,
      unchanged,
      linked,
      sideStats: sideStats.before,
      mergedSizes,
      onHover: (id) => linked.setHovered(id),
      onJump,
    }),
    [model, moves, unchanged, linked, sideStats, mergedSizes, onJump],
  )
  const afterCtx: ItemContext = React.useMemo(
    () => ({ ...ctx, sideStats: sideStats.after }),
    [ctx, sideStats],
  )
  const mergedItems = React.useMemo(
    () =>
      visibleRows(model.rows, moves).map((row) => <MergedItem key={row.key} row={row} ctx={ctx} />),
    [model, moves, ctx],
  )
  const beforeItems = React.useMemo(
    () => before.map((node) => <SideItem key={node.id} node={node} side="before" ctx={ctx} />),
    [before, ctx],
  )
  const afterItems = React.useMemo(
    () => after.map((node) => <SideItem key={node.id} node={node} side="after" ctx={afterCtx} />),
    [after, afterCtx],
  )

  const onSelectionChange = (keys: Selection): void => {
    const key = keys === 'all' ? undefined : [...keys][0]
    if (key === undefined) {
      linked.setSelected(undefined)
      return setSelected(undefined)
    }
    const text = String(key)
    const separator = text.indexOf(':')
    const prefix = text.slice(0, separator)
    linked.setSelected(text.slice(separator + 1))
    setSelected({
      id: text.slice(separator + 1),
      location: prefix === 'old' || prefix === 'before' ? 'old' : 'new',
    })
  }
  const selection = (tree: 'merged' | 'before' | 'after'): readonly string[] =>
    selected === undefined ? [] : [keyFor(selected, tree)]

  const empty = (label: string) => <p {...stylex.props(styles.muted)}>{label} has no nodes.</p>

  return (
    <div ref={container}>
      {arrangement === 'split' ? (
        <div {...stylex.props(styles.split)}>
          {(['before', 'after'] as const).map((side) => {
            const nodes = side === 'before' ? before : after
            const label = (side === 'before' ? beforeSide : afterSide).label
            return (
              <section key={side} aria-label={label} {...stylex.props(styles.pane)}>
                <h3 {...stylex.props(styles.paneHeading)}>{label}</h3>
                {nodes.length === 0 ? (
                  empty(label)
                ) : (
                  <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions}>
                    <Tree
                      aria-label={`${label} hierarchy`}
                      selectionMode="single"
                      selectedKeys={selection(side)}
                      onSelectionChange={onSelectionChange}
                      onExpandedChange={(keys) => onExpandedChange(side, keys)}
                      expandedKeys={expanded[side]}
                      {...stylex.props(styles.tree)}
                    >
                      {side === 'before' ? beforeItems : afterItems}
                    </Tree>
                  </Virtualizer>
                )}
              </section>
            )
          })}
        </div>
      ) : model.rows.length === 0 ? (
        empty('Neither side')
      ) : (
        <Virtualizer layout={ListLayout} layoutOptions={treeLayoutOptions} shouldObserveItemSize>
          <Tree
            aria-label="Merged hierarchy"
            selectionMode="single"
            selectedKeys={selection('merged')}
            onSelectionChange={onSelectionChange}
            onExpandedChange={(keys) => onExpandedChange('merged', keys)}
            expandedKeys={expanded.merged}
            {...stylex.props(styles.tree)}
          >
            {mergedItems}
          </Tree>
        </Virtualizer>
      )}
      <MovesAndSplits model={model} showMoves={moves !== 'ghost'} onJump={onJump} />
    </div>
  )
}

/** Hierarchy lens: merged tree (combined) or two linked trees (side by side), plus moves and splits. */
export const TreeDiff = (props: TreeDiffProps): React.ReactNode => {
  const model = React.useMemo(
    () => diffTrees(props.before, props.after),
    [props.before, props.after],
  )
  return (
    <DiffFrame
      {...(props.id === undefined ? {} : { id: props.id })}
      title={props.title ?? 'Hierarchy'}
      lens="tree"
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
      <TreeBody
        model={model}
        before={props.before}
        after={props.after}
        beforeSide={props.beforeSide}
        afterSide={props.afterSide}
        moves={props.moves ?? 'both'}
        unchanged={props.unchanged ?? 'collapsed'}
      />
    </DiffFrame>
  )
}

const styles = stylex.create({
  tree: {
    minWidth: 0,
    outline: 'none',
    fontSize: '0.85rem',
    color: tokens['--ds-foreground'],
  },
  item: {
    outline: 'none',
    borderRadius: scale.radiusSm,
    cursor: 'default',
  },
  itemSelected: {
    boxShadow: `inset 0 0 0 1px ${tokens['--ds-blue-700']}`,
  },
  itemFocused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -2,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: scale.space3,
    '@media (max-width: 600px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  pane: {
    minWidth: 0,
    overflowX: 'auto',
  },
  paneHeading: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: tokens['--ds-gray-900'],
    marginBlock: `0 ${scale.space2}`,
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: scale.space2,
    rowGap: '2px',
    minHeight: '1.9rem',
    paddingInline: scale.space1,
    paddingBlock: '2px',
    borderRadius: scale.radiusSm,
    borderWidth: 0,
    borderInlineStartWidth: 3,
    borderInlineStartStyle: 'solid',
    borderColor: 'transparent',
  },
  sideLine: {
    height: '34px',
    minHeight: '34px',
    flexWrap: 'nowrap',
  },
  indent: (depth: number) => ({ marginInlineStart: `${depth * 1.2}rem` }),
  ghost: {
    opacity: 0.62,
    borderInlineStartStyle: 'dashed',
  },
  dimmed: { opacity: 0.55 },
  linked: {
    boxShadow: {
      default: 'none',
      ':is([data-linked])': `0 0 0 2px ${tokens['--ds-blue-700']}`,
    },
  },
  chevron: {
    appearance: 'none',
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
  chevronSpacer: { display: 'inline-block', width: '1.1rem', flexShrink: 0 },
  icon: {
    flexShrink: 0,
    display: 'inline-block',
    width: '0.78rem',
    height: '0.7rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-900'],
    borderRadius: '2px',
  },
  folder: {
    backgroundColor: tokens['--ds-amber-300'],
    borderColor: tokens['--ds-amber-700'],
    borderTopLeftRadius: '4px',
  },
  page: {
    width: '0.6rem',
    height: '0.82rem',
    backgroundColor: tokens['--ds-background-100'],
  },
  file: {
    width: '0.6rem',
    height: '0.82rem',
    backgroundColor: tokens['--ds-gray-alpha-200'],
    borderTopRightRadius: '5px',
  },
  nodeName: {
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  kindLabel: {
    fontFamily: scale.fontMono,
    fontSize: '0.66rem',
    paddingInline: scale.space1,
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-gray-900'],
  },
  open: {
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
    textDecorationLine: 'none',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  chip: {
    appearance: 'none',
    fontSize: '0.68rem',
    lineHeight: 1.4,
    color: tokens['--ds-blue-900'],
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    paddingInline: scale.space1,
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  tooltip: {
    maxWidth: 320,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-foreground'],
    fontSize: '0.72rem',
    outline: 'none',
  },
  muted: {
    color: tokens['--ds-gray-900'],
    fontSize: '0.72rem',
  },
  struck: {
    textDecorationLine: 'line-through',
    textDecorationColor: tokens['--ds-red-900'],
  },
  summary: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-alpha-400'],
    marginTop: scale.space3,
    paddingTop: scale.space2,
  },
  summaryTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBlock: `${scale.space1} ${scale.space2}`,
    color: tokens['--ds-gray-900'],
  },
  summaryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space1,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  summaryItem: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: scale.space2,
    fontSize: '0.78rem',
    color: tokens['--ds-gray-1000'],
  },
  summaryName: {
    appearance: 'none',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontWeight: 600,
    fontSize: 'inherit',
    color: tokens['--ds-blue-900'],
    cursor: 'pointer',
    textDecorationLine: { default: 'none', ':hover': 'underline' },
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
})
