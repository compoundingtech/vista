/** Categorical facet and hierarchical checkbox filters for the treemap block. */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components'

import type { Theme, TreemapModel, TreemapNode } from '../../model.ts'
import { nextSelection, type SelectionModifiers } from '../pull-request/selection.ts'
import { CheckRow, CheckRowActions } from './CheckRow.tsx'
import { ChevronDown } from './icons.tsx'
import { collectLeafIds, type ModelIndex } from './projection.ts'

type Tri = 'checked' | 'indeterminate' | 'unchecked'

interface FacetFilterValue {
  readonly value: string
  readonly leafIds: readonly string[]
}

interface FacetFilterGroup {
  readonly key: string
  readonly values: readonly FacetFilterValue[]
}

const displayFacetLabel = (value: string): string =>
  value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`

const styles = stylex.create({
  filterButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-900'],
    font: 'inherit',
    fontSize: '0.74rem',
    paddingBlock: '0.3rem',
    paddingInline: '0.55rem',
    cursor: 'pointer',
    outline: 'none',
  },
  filterButtonHovered: { color: tokens['--ds-foreground'] },
  filterButtonActive: {
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-blue-700'],
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 12%, var(--ds-background-100))',
  },
  focused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: 1,
  },
  caret: { width: '0.7rem', height: '0.7rem', flex: '0 0 auto' },
  badge: {
    fontSize: '0.64rem',
    fontVariantNumeric: 'tabular-nums',
    borderRadius: scale.radiusSm,
    paddingBlock: '0.05rem',
    paddingInline: '0.3rem',
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 20%, var(--ds-background-100))',
    color: tokens['--ds-blue-700'],
  },
  popover: { zIndex: 60, outline: 'none' },
  dialog: {
    width: '22rem',
    maxWidth: '90vw',
    maxHeight: '26rem',
    display: 'flex',
    flexDirection: 'column',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
    outline: 'none',
    overflow: 'hidden',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    paddingBlock: '0.5rem',
    paddingInline: '0.7rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: tokens['--ds-gray-800'],
  },
  tabular: { fontVariantNumeric: 'tabular-nums' },
  facets: {
    flex: '0 1 auto',
    overflowY: 'auto',
    paddingBlock: '0.3rem',
    paddingInline: '0.3rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  facetGroup: { display: 'flex', flexDirection: 'column' },
  facetHeading: {
    paddingBlock: '0.2rem',
    paddingInline: '0.4rem',
    color: tokens['--ds-gray-800'],
    fontSize: '0.62rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  tree: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0.3rem' },
  empty: { margin: 0, padding: '0.5rem', color: tokens['--ds-gray-800'], fontSize: '0.74rem' },
})

const collectFacetFilterGroups = (
  leafIds: readonly string[],
  fullIndex: ModelIndex,
): readonly FacetFilterGroup[] => {
  const idsByKeyAndValue = new Map<string, Map<string, string[]>>()
  for (const leafId of leafIds) {
    const facets = fullIndex.byId.get(leafId)?.node.facets
    if (facets === undefined) continue
    for (const [key, value] of Object.entries(facets)) {
      let idsByValue = idsByKeyAndValue.get(key)
      if (idsByValue === undefined) {
        idsByValue = new Map()
        idsByKeyAndValue.set(key, idsByValue)
      }
      const ids = idsByValue.get(value)
      if (ids === undefined) idsByValue.set(value, [leafId])
      else ids.push(leafId)
    }
  }
  return [...idsByKeyAndValue]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, idsByValue]) => ({
      key,
      values: [...idsByValue]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([value, ids]) => ({ value, leafIds: ids })),
    }))
}

/**
 * Renders the hide/show facet filter panel against a treemap model and its pre-exclusion index,
 * reporting the new excluded-id set whenever the user toggles rows.
 */
export const FilterPanel = ({
  model,
  fullIndex,
  excludedIds,
  onChange,
  formatValue,
  theme,
  trigger,
  renderValue,
}: {
  model: TreemapModel
  fullIndex: ModelIndex
  excludedIds: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
  formatValue: (n: number) => string
  theme: Theme
  trigger?: ReactNode
  renderValue?: ((node: TreemapNode, leafCount: number) => ReactNode) | undefined
}) => {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set())
  const selectionAnchorRef = useRef<string | undefined>(undefined)
  const allLeafIds = useMemo(() => [...collectLeafIds(model.root)], [model])
  const totalLeaves = fullIndex.byId.get(fullIndex.root.id)?.leafCount ?? 0
  const hiddenLeaves = excludedIds.size
  const facetFilterGroups = useMemo(
    () => collectFacetFilterGroups(allLeafIds, fullIndex),
    [allLeafIds, fullIndex],
  )

  const stateById = useMemo(() => {
    const states = new Map<string, Tri>()
    const visit = (node: TreemapNode): Tri => {
      if (!node.children || node.children.length === 0) {
        const state: Tri = excludedIds.has(node.id) ? 'unchecked' : 'checked'
        states.set(node.id, state)
        return state
      }
      let allUnchecked = true
      let allChecked = true
      for (const child of node.children) {
        const state = visit(child)
        if (state !== 'unchecked') allUnchecked = false
        if (state !== 'checked') allChecked = false
      }
      const state: Tri = allUnchecked ? 'unchecked' : allChecked ? 'checked' : 'indeterminate'
      states.set(node.id, state)
      return state
    }
    visit(model.root)
    return states
  }, [model, excludedIds])

  const stateForLeafIds = (leafIds: readonly string[]): Tri => {
    let included = 0
    for (const leafId of leafIds) {
      if (!excludedIds.has(leafId)) included += 1
    }
    return included === 0 ? 'unchecked' : included === leafIds.length ? 'checked' : 'indeterminate'
  }

  const toggleFacetValue = (facet: FacetFilterValue): void => {
    const include = stateForLeafIds(facet.leafIds) !== 'checked'
    const next = new Set(excludedIds)
    for (const leafId of facet.leafIds) {
      if (include) next.delete(leafId)
      else next.add(leafId)
    }
    onChange(next)
  }

  /**
   * A plain click toggles the filter checkbox, while commit rows select only.
   * Both surfaces share shift range, cmd/ctrl toggle, option exclude, and
   * option+shift solo through `nextSelection`.
   */
  const toggleNode = (node: TreemapNode, modifiers: SelectionModifiers): void => {
    const leaves = [...collectLeafIds(node)]
    if (leaves.length === 0) return

    const nextChecked = (stateById.get(node.id) ?? 'checked') === 'unchecked'
    const selected = new Set(allLeafIds.filter((id) => !excludedIds.has(id)))
    let nextSelected: ReadonlySet<string>

    if (leaves.length === 1) {
      const plain = !modifiers.shift && !modifiers.meta && !modifiers.alt
      const result = nextSelection({
        prev: selected,
        order: allLeafIds,
        clicked: leaves[0]!,
        anchor: selectionAnchorRef.current,
        // Plain click is a checkbox toggle, which is the helper's cmd/ctrl action.
        modifiers: plain ? { ...modifiers, meta: true } : modifiers,
      })
      nextSelected = result.next
      selectionAnchorRef.current = result.anchor
    } else if (modifiers.shift && !modifiers.alt) {
      const lastLeaf = leaves.at(-1)!
      const lastIndex = allLeafIds.indexOf(lastLeaf)
      const anchorIndex =
        selectionAnchorRef.current === undefined
          ? -1
          : allLeafIds.indexOf(selectionAnchorRef.current)
      const clicked = anchorIndex > lastIndex ? leaves[0]! : lastLeaf
      const result = nextSelection({
        prev: selected,
        order: allLeafIds,
        clicked,
        anchor: selectionAnchorRef.current,
        modifiers,
      })
      nextSelected = result.next
      selectionAnchorRef.current = result.anchor
    } else {
      const next = modifiers.alt && modifiers.shift ? new Set<string>() : selected
      if (modifiers.alt && !modifiers.shift) {
        for (const leafId of leaves) next.delete(leafId)
      } else if (modifiers.alt || nextChecked) {
        for (const leafId of leaves) next.add(leafId)
      } else {
        for (const leafId of leaves) next.delete(leafId)
      }
      nextSelected = next
      selectionAnchorRef.current = leaves[0]
    }

    const nextExcluded = new Set(allLeafIds)
    for (const leafId of nextSelected) nextExcluded.delete(leafId)
    onChange(nextExcluded)
  }

  const toggleExpand = (id: string): void => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderRow = (node: TreemapNode, depth: number): ReactNode => {
    const hasChildren = !!node.children && node.children.length > 0
    const expanded = expandedIds.has(node.id)
    const state = stateById.get(node.id) ?? 'checked'
    const entry = fullIndex.byId.get(node.id)
    return (
      <div key={node.id}>
        <CheckRow
          checked={state === 'checked' ? true : state === 'indeterminate' ? 'mixed' : false}
          depth={depth}
          {...(hasChildren
            ? {
                expandable: {
                  expanded,
                  label: `${expanded ? 'Collapse' : 'Expand'} ${node.label}`,
                  onToggle: () => toggleExpand(node.id),
                },
              }
            : {})}
          label={node.label}
          value={
            renderValue === undefined ? (
              <>
                <span>{formatValue(entry?.value ?? 0)}</span>
                {hasChildren ? <span>{entry?.leafCount ?? 0}</span> : null}
              </>
            ) : (
              renderValue(node, entry?.leafCount ?? 0)
            )
          }
          ariaLabel={`Include ${node.label}`}
          onToggle={(modifiers) => toggleNode(node, modifiers)}
        />
        {hasChildren && expanded
          ? node.children!.map((child) => renderRow(child, depth + 1))
          : null}
      </div>
    )
  }

  return (
    <DialogTrigger>
      {trigger ?? (
        <Button
          className={({ isHovered, isFocusVisible }) =>
            stylex.props(
              styles.filterButton,
              isHovered && styles.filterButtonHovered,
              hiddenLeaves > 0 && styles.filterButtonActive,
              isFocusVisible && styles.focused,
            ).className ?? ''
          }
          aria-label="Filter tree"
        >
          <ChevronDown rootStyle={styles.caret} />
          <span>Filter</span>
          {hiddenLeaves > 0 ? (
            <span {...stylex.props(styles.badge)}>{hiddenLeaves} hidden</span>
          ) : null}
        </Button>
      )}
      <Popover {...stylex.props(styles.popover)} placement="bottom start" data-theme={theme}>
        <Dialog {...stylex.props(styles.dialog)} aria-label="Filter tree">
          <div {...stylex.props(styles.head)}>
            <span {...stylex.props(styles.tabular)}>
              {hiddenLeaves} hidden / {totalLeaves} total
            </span>
            <CheckRowActions
              onAll={() => {
                selectionAnchorRef.current = undefined
                onChange(new Set())
              }}
              onNone={() => {
                selectionAnchorRef.current = undefined
                onChange(new Set(allLeafIds))
              }}
            />
          </div>
          {facetFilterGroups.length === 0 ? null : (
            <div {...stylex.props(styles.facets)} role="group" aria-label="Filter facets">
              {facetFilterGroups.map((group) => (
                <div
                  key={group.key}
                  role="group"
                  aria-label={`Filter by ${displayFacetLabel(group.key)}`}
                  {...stylex.props(styles.facetGroup)}
                >
                  <div {...stylex.props(styles.facetHeading)}>{displayFacetLabel(group.key)}</div>
                  {group.values.map((facet) => {
                    const label = displayFacetLabel(facet.value)
                    const count = facet.leafIds.length
                    const state = stateForLeafIds(facet.leafIds)
                    return (
                      <CheckRow
                        key={facet.value}
                        checked={
                          state === 'checked' ? true : state === 'indeterminate' ? 'mixed' : false
                        }
                        label={label}
                        value={`${count.toLocaleString()} ${count === 1 ? 'file' : 'files'}`}
                        ariaLabel={`Include ${label}`}
                        onToggle={() => toggleFacetValue(facet)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}
          <div {...stylex.props(styles.tree)} role="group" aria-label="Filter hierarchy">
            {(model.root.children ?? []).map((child) => renderRow(child, 0))}
            {(model.root.children ?? []).length === 0 ? (
              <p {...stylex.props(styles.empty)}>Nothing to filter.</p>
            ) : null}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
