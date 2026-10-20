/**
 * Find the collapsed ancestor that remains visible for a lane. When nested ancestors are collapsed,
 * the outermost collapsed ancestor owns every hidden descendant because inner rows are hidden too.
 */
export const nearestVisibleCollapsedAncestorId = (
  laneId: string,
  parentIdByLaneId: ReadonlyMap<string, string | null>,
  expandedKeys: ReadonlySet<string | number>,
): string | null => {
  let parentId = parentIdByLaneId.get(laneId) ?? null
  let visibleCollapsedAncestorId: string | null = null
  while (parentId !== null) {
    if (!expandedKeys.has(parentId)) visibleCollapsedAncestorId = parentId
    parentId = parentIdByLaneId.get(parentId) ?? null
  }
  return visibleCollapsedAncestorId
}
