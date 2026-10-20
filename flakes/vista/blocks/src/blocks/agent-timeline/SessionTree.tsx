/** Tree-structured labels and filters for the agent-session trace. */
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import {
  Button,
  Checkbox,
  Group,
  Input,
  Label,
  MenuTrigger,
  NumberField,
  Popover,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  TooltipTrigger,
  Tree,
  TreeItem,
  TreeItemContent,
} from 'react-aria-components'
import type { Key, Selection } from 'react-aria-components'

import { ChevronDownIcon, CollapseAllIcon, ExpandAllIcon } from '@overeng/agent-timeline/icons'
import { sessionLabel } from '@overeng/agent-timeline/labels'
import type { Lane } from '@overeng/agent-timeline/projection'

/** Height in pixels reserved for each session row. */
export const SESSION_ROW_HEIGHT = 34
/** Height in pixels reserved for the session-tree filter toolbar. */
export const SESSION_TREE_TOOLBAR_HEIGHT = 68
const TREE_INDENT = 12
const TREE_CONTENT_INSET = 4
const CHEVRON_WIDTH = 18

/** Flattened tree row with display metrics and hierarchy metadata for one session lane. */
export interface SessionTreeItem {
  readonly lane: Lane
  readonly depth: number
  readonly isAncestorOnly: boolean
  readonly hasChildren: boolean
  readonly wallDurationMs: number
  readonly activeDurationMs: number
  readonly stripeColor?: string
}

/** Filter state and callbacks shared by the session-tree toolbar and its host. */
export interface SessionTreeToolbarProps {
  readonly onExpandAll: () => void
  readonly onCollapseAll: () => void
  readonly filterText: string
  readonly onFilterTextChange: (value: string) => void
  readonly agentTypes: ReadonlyArray<string>
  readonly selectedAgentTypes: ReadonlySet<string>
  readonly onSelectedAgentTypesChange: (value: ReadonlySet<string>) => void
  readonly models: ReadonlyArray<string>
  readonly selectedModels: ReadonlySet<string>
  readonly onSelectedModelsChange: (value: ReadonlySet<string>) => void
  readonly roots: ReadonlyArray<string>
  readonly selectedRoots: ReadonlySet<string>
  readonly onSelectedRootsChange: (value: ReadonlySet<string>) => void
  readonly stateFilter: 'all' | 'active' | 'inactive' | 'exited'
  readonly onStateFilterChange: (value: 'all' | 'active' | 'inactive' | 'exited') => void
  readonly minimumUsd: number
  readonly onMinimumUsdChange: (value: number) => void
  readonly hasCompaction: boolean
  readonly onHasCompactionChange: (value: boolean) => void
  readonly onClearFilters: () => void
  readonly hasActiveFilters: boolean
  readonly matchingCount: number
  readonly totalCount: number
}

/** Session-tree data, virtualization geometry, selection, and toolbar controls. */
export interface SessionTreeProps extends SessionTreeToolbarProps {
  readonly items: ReadonlyArray<SessionTreeItem>
  readonly topSpacer: number
  readonly bottomSpacer: number
  readonly virtualized: boolean
  readonly expandedKeys: ReadonlySet<Key>
  readonly onExpandedChange: (keys: ReadonlySet<Key>) => void
  readonly selectedLaneId: string | null
  readonly onSelectedLaneIdChange: (laneId: string | null) => void
  readonly compact: boolean
  readonly scrollRef: React.RefObject<HTMLDivElement | null>
  readonly onScroll: (scrollTop: number) => void
  readonly onVirtualizedRowKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  readonly showToolbar?: boolean
  readonly columnHeaderHeight?: number
}

interface ModelLabel {
  readonly full: string
  readonly provider: string | null
  readonly short: string
}

const modelLabel = (model: string): ModelLabel => {
  const [providerOrModel = model, ...modelParts] = model.split('/')
  const provider = modelParts.length === 0 ? null : providerOrModel
  const full = modelParts.length === 0 ? providerOrModel : modelParts.join('/')
  const withoutDate = full.replace(/-\d{4}-\d{2}-\d{2}$/, '')
  return {
    full,
    provider,
    short: withoutDate.replace(/^claude-/, '').replace(/^(muse-[^-]+)(?:-\d.*)?$/, '$1'),
  }
}

const truncate = (value: string, maximum: number): string =>
  value.length <= maximum ? value : `${value.slice(0, Math.max(1, maximum - 1))}…`

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactTokens = (value: number): string => {
  if (value < 1_000) return Math.round(value).toString()
  const unit = value < 1_000_000 ? { value: 1_000, suffix: 'k' } : { value: 1_000_000, suffix: 'M' }
  const scaled = value / unit.value
  const rounded = scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled)
  return `${rounded}${unit.suffix}`
}

const compactDuration = (milliseconds: number): string => {
  if (milliseconds < 60_000) return '<1m'
  const minutes = Math.round(milliseconds / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

const FilterCheckboxList = ({
  label,
  options,
  selected,
  onChange,
}: {
  readonly label: string
  readonly options: ReadonlyArray<string>
  readonly selected: ReadonlySet<string>
  readonly onChange: (next: ReadonlySet<string>) => void
}) => (
  <section {...stylex.props(styles.filterSection)}>
    <h3 {...stylex.props(styles.filterHeading)}>{label}</h3>
    <div role="group" aria-label={`${label} filters`} {...stylex.props(styles.filterList)}>
      {options.map((option) => (
        <Checkbox
          key={option}
          isSelected={selected.has(option)}
          onChange={(isSelected) => {
            const next = new Set(selected)
            if (isSelected) next.add(option)
            else next.delete(option)
            onChange(next)
          }}
          {...stylex.props(styles.filterOption)}
        >
          {({ isSelected }) => (
            <>
              <span {...stylex.props(styles.checkboxBox)} aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
              <span {...stylex.props(styles.filterOptionText)}>{option}</span>
            </>
          )}
        </Checkbox>
      ))}
    </div>
  </section>
)

const ToolbarButton = ({
  label,
  icon,
  onPress,
}: {
  readonly label: string
  readonly icon: React.ReactNode
  readonly onPress: () => void
}) => (
  <TooltipTrigger delay={300}>
    <Button
      aria-label={label}
      onPress={onPress}
      className={({ isHovered, isPressed, isFocusVisible }) =>
        stylex.props(
          styles.iconButton,
          isHovered && styles.controlHovered,
          isPressed && styles.controlPressed,
          isFocusVisible && styles.focused,
        ).className ?? ''
      }
    >
      {icon}
    </Button>
    <Tooltip {...stylex.props(styles.tooltip)}>{label}</Tooltip>
  </TooltipTrigger>
)

/** Render controls for expanding and filtering the visible session hierarchy. */
export const SessionTreeToolbar = ({
  onExpandAll,
  onCollapseAll,
  filterText,
  onFilterTextChange,
  agentTypes,
  selectedAgentTypes,
  onSelectedAgentTypesChange,
  models,
  selectedModels,
  onSelectedModelsChange,
  roots,
  selectedRoots,
  onSelectedRootsChange,
  stateFilter,
  onStateFilterChange,
  minimumUsd,
  onMinimumUsdChange,
  hasCompaction,
  onHasCompactionChange,
  onClearFilters,
  hasActiveFilters,
  matchingCount,
  totalCount,
}: SessionTreeToolbarProps): React.ReactNode => {
  const activeFilterCount =
    Number(selectedAgentTypes.size !== agentTypes.length) +
    Number(selectedModels.size !== models.length) +
    Number(selectedRoots.size !== roots.length) +
    Number(stateFilter !== 'all') +
    Number(minimumUsd > 0) +
    Number(hasCompaction)

  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.toolbarRow)}>
        <ToolbarButton label="Expand all" icon={<ExpandAllIcon />} onPress={onExpandAll} />
        <ToolbarButton label="Collapse all" icon={<CollapseAllIcon />} onPress={onCollapseAll} />
        <MenuTrigger>
          <Button
            aria-label={`Filters, ${activeFilterCount} active`}
            className={({ isHovered, isPressed, isFocusVisible }) =>
              stylex.props(
                styles.filterTrigger,
                isHovered && styles.controlHovered,
                isPressed && styles.controlPressed,
                isFocusVisible && styles.focused,
              ).className ?? ''
            }
          >
            <span {...stylex.props(styles.filterLabel)}>Filters</span>
            <ChevronDownIcon />
            <span {...stylex.props(styles.filterBadge)}>{activeFilterCount}</span>
          </Button>
          <Popover placement="bottom end" {...stylex.props(styles.filterPopover)}>
            <div {...stylex.props(styles.filterPopoverContent)}>
              <FilterCheckboxList
                label="Agent type"
                options={agentTypes}
                selected={selectedAgentTypes}
                onChange={onSelectedAgentTypesChange}
              />
              <FilterCheckboxList
                label="Model"
                options={models}
                selected={selectedModels}
                onChange={onSelectedModelsChange}
              />
              <FilterCheckboxList
                label="Seat / root"
                options={roots}
                selected={selectedRoots}
                onChange={onSelectedRootsChange}
              />
              <section {...stylex.props(styles.filterSection)}>
                <h3 {...stylex.props(styles.filterHeading)}>State</h3>
                <ToggleButtonGroup
                  aria-label="Session state"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([stateFilter])}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys, String)[0]
                    if (
                      key === 'all' ||
                      key === 'active' ||
                      key === 'inactive' ||
                      key === 'exited'
                    ) {
                      onStateFilterChange(key)
                    }
                  }}
                  {...stylex.props(styles.toggleGroup)}
                >
                  {(['all', 'active', 'inactive', 'exited'] as const).map((value) => (
                    <ToggleButton
                      key={value}
                      id={value}
                      aria-label={`${value} sessions`}
                      {...stylex.props(styles.toggle)}
                    >
                      {value}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </section>
              <section {...stylex.props(styles.filterSection, styles.lastFilterLine)}>
                <NumberField
                  aria-label="Minimum spend in US dollars"
                  value={minimumUsd}
                  minValue={0}
                  step={0.01}
                  onChange={onMinimumUsdChange}
                  {...stylex.props(styles.numberField)}
                >
                  <Label>Min $</Label>
                  <Group>
                    <Input {...stylex.props(styles.numberInput)} />
                  </Group>
                </NumberField>
                <Checkbox
                  isSelected={hasCompaction}
                  onChange={onHasCompactionChange}
                  {...stylex.props(styles.checkbox)}
                >
                  {({ isSelected }) => (
                    <>
                      <span {...stylex.props(styles.checkboxBox)}>{isSelected ? '✓' : ''}</span>
                      Compaction
                    </>
                  )}
                </Checkbox>
              </section>
              <footer {...stylex.props(styles.filterFooter)}>
                <span {...stylex.props(styles.activeFilterSummary)}>
                  {activeFilterCount} active
                </span>
                <Button
                  isDisabled={!hasActiveFilters}
                  onPress={onClearFilters}
                  className={({ isHovered, isPressed, isFocusVisible }) =>
                    stylex.props(
                      styles.clearButton,
                      isHovered && styles.controlHovered,
                      isPressed && styles.controlPressed,
                      isFocusVisible && styles.focused,
                    ).className ?? ''
                  }
                >
                  Clear
                </Button>
              </footer>
            </div>
          </Popover>
        </MenuTrigger>
        <span {...stylex.props(styles.matchCount)}>
          {matchingCount}
          {matchingCount === totalCount ? '' : `/${totalCount}`}
        </span>
      </div>
      <div {...stylex.props(styles.searchRow)}>
        <SearchField
          value={filterText}
          onChange={onFilterTextChange}
          aria-label="Filter sessions by task, name, type, or model"
          {...stylex.props(styles.search)}
        >
          <Input placeholder="Filter sessions…" {...stylex.props(styles.searchInput)} />
        </SearchField>
      </div>
    </header>
  )
}

const SessionTreeRow = ({
  item,
  compact,
  isExpanded,
  onSelect,
  children,
}: {
  readonly item: SessionTreeItem
  readonly compact: boolean
  readonly isExpanded: boolean
  readonly onSelect: () => void
  readonly children?: React.ReactNode
}) => {
  const label = sessionLabel(item.lane.session)
  const model = modelLabel(item.lane.currentModel)
  const modelChanges = Math.max(0, item.lane.models.length - 1)
  const wall = compactDuration(item.wallDurationMs)
  const active = compactDuration(item.activeDurationMs)
  const spend = money.format(item.lane.totalUsd)
  const totalTokens = compactTokens(item.lane.tokens.total)
  const tokenBreakdown = `Tokens ${totalTokens} (input ${compactTokens(item.lane.tokens.input)} / cache read ${compactTokens(item.lane.tokens.cacheRead)} / cache write ${compactTokens(item.lane.tokens.cacheWrite)} / output ${compactTokens(item.lane.tokens.output)})`
  const tooltipLabel = [
    label.task ?? label.full,
    `${label.full}${label.type ? ` ‹${label.type}›` : ''}`,
    `Model ${model.full}`,
    `Provider ${model.provider ?? 'not reported'}`,
    modelChanges === 0 ? 'Model unchanged' : `changed ×${modelChanges}`,
    item.lane.status._tag,
    `Wall ${wall}`,
    `Active ${active}`,
    spend,
    tokenBreakdown,
  ].join(' · ')
  const indent = TREE_CONTENT_INSET + item.depth * TREE_INDENT
  const tooltipTriggerRef = React.useRef<HTMLButtonElement>(null)

  return (
    <TreeItem
      id={item.lane.session.id}
      data-session-id={item.lane.session.id}
      textValue={tooltipLabel}
      hasChildItems={item.hasChildren}
      aria-level={item.depth + 1}
      {...(item.hasChildren ? { 'aria-expanded': isExpanded } : {})}
      className={({ isSelected, isFocusVisible, isHovered }) =>
        stylex.props(
          styles.treeRow,
          item.isAncestorOnly && styles.ancestorRow,
          isHovered && styles.treeRowHovered,
          isSelected && styles.treeRowSelected,
          isFocusVisible && styles.treeRowFocused,
        ).className ?? ''
      }
    >
      <TreeItemContent>
        {({ hasChildItems }) => (
          <div {...stylex.props(styles.rowContent)}>
            {item.stripeColor === undefined ? null : (
              <span {...stylex.props(styles.typeStripe(item.stripeColor))} />
            )}
            {hasChildItems ? (
              <Button
                slot="chevron"
                aria-label={isExpanded ? `Collapse ${tooltipLabel}` : `Expand ${tooltipLabel}`}
                {...stylex.props(styles.chevronButton, styles.chevronIndent(indent))}
              >
                <span
                  {...stylex.props(styles.chevron, isExpanded && styles.chevronExpanded)}
                  aria-hidden="true"
                >
                  ›
                </span>
              </Button>
            ) : null}
            <TooltipTrigger key={item.lane.session.id}>
              <Button
                ref={tooltipTriggerRef}
                aria-label={tooltipLabel}
                onPress={onSelect}
                {...stylex.props(styles.labelButton, compact && styles.compactColumns)}
              >
                <span
                  data-session-column="identity"
                  {...stylex.props(styles.taskCell, styles.taskIndent(indent + CHEVRON_WIDTH))}
                >
                  <span
                    {...stylex.props(
                      styles.statusDot,
                      item.lane.status._tag === 'active' && styles.statusDotActive,
                      item.lane.status._tag === 'inactive' && styles.statusDotInactive,
                      item.lane.status._tag === 'exited' && styles.statusDotExited,
                    )}
                    aria-hidden="true"
                  />
                  <span {...stylex.props(styles.labelText)}>
                    <strong {...stylex.props(styles.identityName)} title={label.full}>
                      {truncate(label.primary, 24)}
                      {label.type ? ` ‹${label.type}›` : ''}
                    </strong>
                    <span {...stylex.props(styles.taskSummary)}>
                      {truncate(label.task ?? label.type ?? 'Task not reported', 42)}
                    </span>
                  </span>
                </span>
                <span
                  data-session-column="model-cost"
                  {...stylex.props(styles.modelCell, compact && styles.compactHidden)}
                >
                  <span {...stylex.props(styles.modelLine)}>
                    <span {...stylex.props(styles.cellOverflow)}>{model.short}</span>
                    {modelChanges === 0 ? null : (
                      <span
                        {...stylex.props(styles.modelChanged)}
                        aria-hidden="true"
                        data-model-changed
                      >
                        ◆
                      </span>
                    )}
                  </span>
                  <span data-model-spend-tokens {...stylex.props(styles.spendLine)}>
                    {spend} · {totalTokens}
                  </span>
                </span>
                <span
                  data-session-column="duration"
                  {...stylex.props(styles.durationCell, compact && styles.compactDurationCell)}
                >
                  {item.wallDurationMs === item.activeDurationMs ? (
                    <span data-duration-equal>{wall}</span>
                  ) : (
                    <>
                      <span data-duration-wall>{wall}</span>
                      <span
                        aria-hidden="true"
                        {...stylex.props(
                          styles.durationSeparator,
                          compact && styles.compactDurationSeparator,
                        )}
                      >
                        {' / '}
                      </span>
                      <span data-duration-active>{active}</span>
                    </>
                  )}
                </span>
              </Button>
              <Tooltip {...stylex.props(styles.tooltip)}>{tooltipLabel}</Tooltip>
            </TooltipTrigger>
          </div>
        )}
      </TreeItemContent>
      {children}
    </TreeItem>
  )
}

/** Controlled session tree keeps filtering, expansion, selection, and virtual scroll aligned with spans. */
export const SessionTree = ({
  items,
  topSpacer,
  bottomSpacer,
  virtualized,
  expandedKeys,
  onExpandedChange,
  selectedLaneId,
  onSelectedLaneIdChange,
  onExpandAll,
  onCollapseAll,
  filterText,
  onFilterTextChange,
  agentTypes,
  selectedAgentTypes,
  onSelectedAgentTypesChange,
  models,
  selectedModels,
  onSelectedModelsChange,
  roots,
  selectedRoots,
  onSelectedRootsChange,
  stateFilter,
  onStateFilterChange,
  minimumUsd,
  onMinimumUsdChange,
  hasCompaction,
  onHasCompactionChange,
  onClearFilters,
  hasActiveFilters,
  matchingCount,
  totalCount,
  compact,
  scrollRef,
  onScroll,
  onVirtualizedRowKeyDown,
  showToolbar = true,
  columnHeaderHeight = 28,
}: SessionTreeProps): React.ReactNode => {
  const selection = React.useMemo(
    (): ReadonlySet<Key> => new Set(selectedLaneId === null ? [] : [selectedLaneId]),
    [selectedLaneId],
  )
  // Stable row elements let a selection or filter-input change skip re-rendering every row.
  const treeRows = React.useMemo(() => {
    const renderRow = (item: SessionTreeItem, children?: React.ReactNode): React.ReactNode => (
      <SessionTreeRow
        key={item.lane.session.id}
        item={item}
        compact={compact}
        isExpanded={expandedKeys.has(item.lane.session.id)}
        onSelect={() => onSelectedLaneIdChange(item.lane.session.id)}
      >
        {children}
      </SessionTreeRow>
    )
    if (virtualized) return items.map((item) => renderRow(item))
    const itemIds = new Set(items.map((item) => item.lane.session.id))
    const childrenByParent = new Map<string | null, SessionTreeItem[]>()
    for (const item of items) {
      const candidate = item.lane.session.parentId
      const parentId = candidate !== null && itemIds.has(candidate) ? candidate : null
      const siblings = childrenByParent.get(parentId) ?? []
      siblings.push(item)
      childrenByParent.set(parentId, siblings)
    }
    const renderChildren = (parentId: string | null): React.ReactNode =>
      (childrenByParent.get(parentId) ?? []).map((item) =>
        renderRow(item, renderChildren(item.lane.session.id)),
      )
    return renderChildren(null)
  }, [compact, expandedKeys, items, onSelectedLaneIdChange, virtualized])

  return (
    <aside {...stylex.props(styles.root)} aria-label="Agent session tree and filters">
      {showToolbar ? (
        <SessionTreeToolbar
          onExpandAll={onExpandAll}
          onCollapseAll={onCollapseAll}
          filterText={filterText}
          onFilterTextChange={onFilterTextChange}
          agentTypes={agentTypes}
          selectedAgentTypes={selectedAgentTypes}
          onSelectedAgentTypesChange={onSelectedAgentTypesChange}
          models={models}
          selectedModels={selectedModels}
          onSelectedModelsChange={onSelectedModelsChange}
          roots={roots}
          selectedRoots={selectedRoots}
          onSelectedRootsChange={onSelectedRootsChange}
          stateFilter={stateFilter}
          onStateFilterChange={onStateFilterChange}
          minimumUsd={minimumUsd}
          onMinimumUsdChange={onMinimumUsdChange}
          hasCompaction={hasCompaction}
          onHasCompactionChange={onHasCompactionChange}
          onClearFilters={onClearFilters}
          hasActiveFilters={hasActiveFilters}
          matchingCount={matchingCount}
          totalCount={totalCount}
        />
      ) : null}
      <div
        data-session-tree-header
        {...stylex.props(styles.columnHeader, styles.columnHeaderHeight(columnHeaderHeight))}
      >
        <div {...stylex.props(styles.columnLabels, compact && styles.compactColumns)}>
          <span data-session-column="identity" {...stylex.props(styles.headerCell)}>
            <span>Agent</span>
            <span>task</span>
          </span>
          <span
            data-session-column="model-cost"
            {...stylex.props(
              styles.headerCell,
              styles.rightAlignedHeaderCell,
              styles.modelHeader,
              compact && styles.compactHidden,
            )}
          >
            <span>Model</span>
            <span>$ · tokens</span>
          </span>
          <span
            data-session-column="duration"
            {...stylex.props(styles.headerCell, styles.rightAlignedHeaderCell)}
          >
            <span>Wall</span>
            <span>active</span>
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        {...stylex.props(styles.scroller)}
        onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
        onKeyDownCapture={onVirtualizedRowKeyDown}
      >
        {topSpacer > 0 ? <div style={{ height: topSpacer }} /> : null}
        <Tree
          aria-label="Agent sessions"
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={selection}
          expandedKeys={expandedKeys}
          onExpandedChange={(keys) => onExpandedChange(new Set(keys))}
          onSelectionChange={(keys: Selection) => {
            const key = keys === 'all' ? undefined : Array.from(keys)[0]
            onSelectedLaneIdChange(key === undefined ? null : String(key))
          }}
          {...stylex.props(styles.tree)}
        >
          {treeRows}
        </Tree>
        {bottomSpacer > 0 ? <div style={{ height: bottomSpacer }} /> : null}
        {matchingCount === 0 ? (
          <div {...stylex.props(styles.emptyState)}>
            <strong>No matching sessions</strong>
            <span>Clear a filter or lower the minimum spend.</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    gridColumn: 1,
    gridRow: '1 / 5',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    backgroundColor: tokens['--ds-background-100'],
  },
  header: {
    flex: '0 0 auto',
    height: SESSION_TREE_TOOLBAR_HEIGHT,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    backgroundColor: tokens['--ds-gray-100'],
  },
  toolbarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    width: '100%',
    height: 32,
    minWidth: 0,
    boxSizing: 'border-box',
    paddingInline: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: 36,
    minWidth: 0,
    boxSizing: 'border-box',
    paddingInline: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
  },
  columnHeader: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    boxSizing: 'border-box',
    paddingInline: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: tokens['--ds-gray-100'],
  },
  columnHeaderHeight: (height: number) => ({ height }),
  columnLabels: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) 76px 70px',
      '@container (max-width: 19rem)': 'minmax(0, 1fr) 68px',
      '@container (max-width: 14rem)': 'minmax(0, 1fr) 60px',
    },
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    color: tokens['--ds-gray-700'],
    fontSize: '0.58rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  headerCell: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
    overflow: 'hidden',
    lineHeight: 1.15,
    textOverflow: 'ellipsis',
  },
  rightAlignedHeaderCell: {
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  compactColumns: {
    gridTemplateColumns: 'minmax(0, 1fr) 60px',
  },
  compactHidden: {
    display: 'none',
  },
  modelHeader: {
    display: { default: 'flex', '@container (max-width: 19rem)': 'none' },
  },
  iconButton: {
    flex: '0 0 auto',
    display: 'inline-grid',
    placeItems: 'center',
    width: 24,
    height: 24,
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: scale.radiusSm,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    outline: 'none',
  },
  controlHovered: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  controlPressed: { backgroundColor: tokens['--ds-gray-alpha-200'] },
  focused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -2,
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
    fontSize: '0.68rem',
    outline: 'none',
  },
  search: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    height: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
  },
  searchInput: {
    width: '100%',
    minWidth: 0,
    height: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-foreground'],
    paddingInline: scale.space2,
    font: 'inherit',
    fontSize: '0.65rem',
    outline: 'none',
    textOverflow: 'ellipsis',
  },
  filterTrigger: {
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: scale.space1,
    height: 24,
    paddingInline: scale.space1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-900'],
    font: 'inherit',
    fontSize: '0.62rem',
    cursor: 'pointer',
    outline: 'none',
  },
  filterLabel: { display: { default: 'inline', '@container (max-width: 12rem)': 'none' } },
  filterBadge: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: scale.space4,
    height: scale.space4,
    paddingInline: 2,
    borderRadius: scale.radiusFull,
    backgroundColor: tokens['--ds-gray-alpha-200'],
    color: tokens['--ds-foreground'],
    fontFamily: scale.fontMono,
    fontSize: '0.55rem',
    fontVariantNumeric: 'tabular-nums',
  },
  matchCount: {
    display: { default: 'inline', '@container (max-width: 12rem)': 'none' },
    flex: '0 0 auto',
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    fontSize: '0.58rem',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  filterPopover: {
    width: 300,
    maxWidth: 'calc(100vw - 16px)',
    maxHeight: 'min(520px, calc(100vh - 24px))',
    overflow: 'auto',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-200'],
    boxShadow: tokens['--ds-shadow-medium'],
    outline: 'none',
  },
  filterPopoverContent: { display: 'flex', flexDirection: 'column', padding: scale.space2 },
  filterSection: {
    minWidth: 0,
    paddingBlock: scale.space2,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-alpha-300'],
  },
  filterHeading: {
    marginBlockStart: 0,
    marginBlockEnd: scale.space1,
    color: tokens['--ds-gray-700'],
    fontSize: '0.58rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  filterList: { display: 'flex', flexDirection: 'column', gap: scale.space1 },
  filterOption: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space2,
    minHeight: 24,
    color: tokens['--ds-gray-900'],
    fontSize: '0.68rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  filterOptionText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toggleGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    height: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
  },
  toggle: {
    minWidth: 0,
    borderWidth: 0,
    borderLeftWidth: { default: 1, ':first-child': 0 },
    borderLeftStyle: 'solid',
    borderLeftColor: tokens['--ds-gray-alpha-400'],
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': tokens['--ds-gray-alpha-100'],
      ':is([data-selected])': tokens['--ds-gray-alpha-200'],
    },
    color: { default: tokens['--ds-gray-800'], ':is([data-selected])': tokens['--ds-foreground'] },
    paddingInline: 1,
    font: 'inherit',
    fontSize: '0.56rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  lastFilterLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale.space2,
  },
  numberField: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    minWidth: 0,
    color: tokens['--ds-gray-800'],
    fontSize: '0.62rem',
  },
  numberInput: {
    width: 52,
    height: 22,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    paddingInline: scale.space1,
    fontFamily: scale.fontMono,
    fontSize: '0.62rem',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: scale.space1,
    minHeight: 22,
    color: tokens['--ds-gray-900'],
    fontSize: '0.62rem',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  checkboxBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 13,
    height: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-500'],
    borderRadius: 3,
    color: tokens['--ds-blue-900'],
  },
  filterFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale.space2,
    paddingBlockStart: scale.space2,
  },
  activeFilterSummary: {
    color: tokens['--ds-gray-700'],
    fontSize: '0.62rem',
    fontVariantNumeric: 'tabular-nums',
  },
  clearButton: {
    height: 24,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
    font: 'inherit',
    fontSize: '0.62rem',
    cursor: 'pointer',
    outline: 'none',
    opacity: { default: 1, ':disabled': 0.45 },
  },
  scroller: {
    flex: '1 1 auto',
    minHeight: 0,
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'none',
  },
  tree: { display: 'block', minWidth: 0, outline: 'none' },
  treeRow: {
    height: SESSION_ROW_HEIGHT,
    minWidth: 0,
    color: tokens['--ds-foreground'],
    backgroundColor: { default: 'transparent', ':hover': tokens['--ds-gray-alpha-100'] },
    outline: 'none',
    cursor: 'default',
  },
  ancestorRow: { opacity: 0.42 },
  treeRowHovered: { backgroundColor: tokens['--ds-gray-alpha-100'] },
  treeRowSelected: {
    backgroundColor: `color-mix(in srgb, ${tokens['--ds-blue-700']} 10%, transparent)`,
  },
  treeRowFocused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: -2,
  },
  rowContent: {
    position: 'relative',
    height: SESSION_ROW_HEIGHT,
    minWidth: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  chevronButton: {
    position: 'absolute',
    zIndex: 2,
    top: 5,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: CHEVRON_WIDTH,
    height: 24,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: tokens['--ds-gray-700'],
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  chevronIndent: (left: number) => ({ left }),
  chevron: { display: 'inline-block', fontSize: '1rem', lineHeight: 1, transform: 'rotate(0deg)' },
  chevronExpanded: { transform: 'rotate(90deg)' },
  statusDot: {
    flex: '0 0 auto',
    width: 6,
    height: 6,
    marginBlockStart: scale.space1,
    borderRadius: scale.radiusFull,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-600'],
    backgroundColor: 'transparent',
  },
  statusDotActive: {
    borderColor: tokens['--ds-green-900'],
    backgroundColor: tokens['--ds-green-900'],
  },
  statusDotInactive: { borderStyle: 'dashed', opacity: 0.62 },
  statusDotExited: {
    borderColor: tokens['--ds-gray-700'],
    backgroundColor: tokens['--ds-gray-700'],
  },
  typeStripe: (color: string) => ({
    position: 'absolute',
    zIndex: 1,
    insetBlock: 0,
    left: 0,
    width: 3,
    backgroundColor: color,
  }),
  labelButton: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) 76px 70px',
      '@container (max-width: 19rem)': 'minmax(0, 1fr) 68px',
      '@container (max-width: 14rem)': 'minmax(0, 1fr) 60px',
    },
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    height: SESSION_ROW_HEIGHT,
    boxSizing: 'border-box',
    paddingBlock: 0,
    paddingInline: scale.space2,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    outline: { default: 'none', ':focus-visible': `2px solid ${tokens['--ds-focus-color']}` },
  },
  taskCell: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: scale.space2,
    minWidth: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  taskIndent: (paddingLeft: number) => ({ paddingLeft }),
  labelText: {
    display: 'flex',
    flex: '1 1 auto',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    lineHeight: 1.15,
  },
  identityName: {
    overflow: 'hidden',
    color: tokens['--ds-foreground'],
    fontSize: '0.68rem',
    fontWeight: 600,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  taskSummary: {
    overflow: 'hidden',
    color: tokens['--ds-gray-700'],
    fontSize: '0.6rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  modelCell: {
    display: { default: 'flex', '@container (max-width: 19rem)': 'none' },
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 0,
    overflow: 'hidden',
    color: tokens['--ds-gray-700'],
    fontFamily: scale.fontMono,
    fontSize: '0.52rem',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
  },
  modelLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    width: '100%',
    minWidth: 0,
  },
  cellOverflow: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  modelChanged: {
    flex: '0 0 auto',
    color: tokens['--ds-purple-900'],
    fontSize: '0.42rem',
  },
  spendLine: {
    color: tokens['--ds-foreground'],
    width: '100%',
    textAlign: 'right',
  },
  durationCell: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@container (max-width: 14rem)': 'row',
    },
    alignItems: {
      default: 'flex-end',
      '@container (max-width: 14rem)': 'center',
    },
    justifyContent: 'center',
    gap: {
      default: 0,
      '@container (max-width: 14rem)': 2,
    },
    minWidth: 0,
    overflow: 'hidden',
    color: tokens['--ds-gray-800'],
    fontFamily: scale.fontMono,
    fontSize: '0.56rem',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.15,
    textAlign: 'right',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  compactDurationCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  durationSeparator: {
    display: { default: 'none', '@container (max-width: 14rem)': 'inline' },
    color: tokens['--ds-gray-600'],
  },
  compactDurationSeparator: {
    display: 'inline',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale.space1,
    height: 120,
    paddingInline: scale.space2,
    color: tokens['--ds-gray-800'],
    fontSize: '0.68rem',
    textAlign: 'center',
  },
})
