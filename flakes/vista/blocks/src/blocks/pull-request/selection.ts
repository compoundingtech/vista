/** Modifiers shared by list-selection surfaces. */
export interface SelectionModifiers {
  readonly shift: boolean
  readonly meta: boolean
  readonly alt: boolean
}

/**
 * Carries the inputs the shared selection reducer needs: the previous set, the item order, the
 * clicked item, the range anchor, and the active pointer modifiers.
 */
export interface NextSelectionInput<TItem> {
  readonly prev: ReadonlySet<TItem>
  readonly order: readonly TItem[]
  readonly clicked: TItem
  readonly anchor: TItem | undefined
  readonly modifiers: SelectionModifiers
}

/**
 * Apply the review kit's shared pointer-selection convention.
 *
 * A plain click replaces the selection, shift selects the contiguous anchor range
 * (unioning it with the previous selection when cmd/ctrl is also held), cmd/ctrl
 * toggles one item, option/alt excludes it, and option/alt+shift solos it.
 */
export const nextSelection = <TItem>({
  prev,
  order,
  clicked,
  anchor,
  modifiers,
}: NextSelectionInput<TItem>): { next: ReadonlySet<TItem>; anchor: TItem } => {
  if (modifiers.alt) {
    if (modifiers.shift) return { next: new Set([clicked]), anchor: clicked }
    const next = new Set(prev)
    next.delete(clicked)
    return { next, anchor: clicked }
  }

  if (!modifiers.shift && !modifiers.meta) {
    return { next: new Set([clicked]), anchor: clicked }
  }

  if (modifiers.shift) {
    const anchorIndex = anchor === undefined ? -1 : order.indexOf(anchor)
    const clickedIndex = order.indexOf(clicked)
    if (anchorIndex === -1 || clickedIndex === -1) {
      return { next: new Set([clicked]), anchor: clicked }
    }
    const start = Math.min(anchorIndex, clickedIndex)
    const end = Math.max(anchorIndex, clickedIndex)
    const next = modifiers.meta ? new Set(prev) : new Set<TItem>()
    for (let index = start; index <= end; index += 1) next.add(order[index]!)
    return { next, anchor: anchor ?? clicked }
  }

  const next = new Set(prev)
  if (next.has(clicked)) next.delete(clicked)
  else next.add(clicked)
  return { next, anchor: clicked }
}
