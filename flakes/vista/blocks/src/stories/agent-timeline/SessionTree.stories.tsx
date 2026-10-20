import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'
import type { Key } from 'react-aria-components'

import { projectAgentTimeline } from '@overeng/agent-timeline/projection'

import { SessionTree, type SessionTreeItem } from '../../blocks/agent-timeline/SessionTree.tsx'
import { agentTimelineFixtures } from './fixtures.ts'

const scene = projectAgentTimeline(agentTimelineFixtures['1h'])
const agentTypes = Array.from(
  new Set(scene.lanes.map((lane) => lane.session.agentType ?? lane.session.role)),
).toSorted()
const models = Array.from(
  new Set(scene.lanes.flatMap((lane) => lane.models.map((entry) => entry.model))),
).toSorted()
const roots = Array.from(new Set(scene.lanes.map((lane) => lane.rootId))).toSorted()
const items: ReadonlyArray<SessionTreeItem> = scene.lanes.map((lane) => ({
  lane,
  depth: lane.depth,
  isAncestorOnly: false,
  hasChildren: scene.forks.some((fork) => fork.parentSessionId === lane.session.id),
  wallDurationMs: lane.wallMs,
  activeDurationMs: lane.activeMs,
}))

const TreeCase = ({ compact }: { readonly compact: boolean }) => {
  const [expandedKeys, setExpandedKeys] = React.useState<ReadonlySet<Key>>(
    () => new Set(scene.lanes.map((lane) => lane.session.id)),
  )
  const [selectedLaneId, setSelectedLaneId] = React.useState<string | null>(
    scene.lanes[0]?.session.id ?? null,
  )
  const [filterText, setFilterText] = React.useState('')
  const [selectedAgentTypes, setSelectedAgentTypes] = React.useState<ReadonlySet<string>>(
    () => new Set(agentTypes),
  )
  const [selectedModels, setSelectedModels] = React.useState<ReadonlySet<string>>(
    () => new Set(models),
  )
  const [selectedRoots, setSelectedRoots] = React.useState<ReadonlySet<string>>(
    () => new Set(roots),
  )
  const [stateFilter, setStateFilter] = React.useState<'all' | 'active' | 'inactive' | 'exited'>(
    'all',
  )
  const [minimumUsd, setMinimumUsd] = React.useState(0)
  const [hasCompaction, setHasCompaction] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const normalizedFilter = filterText.trim().toLocaleLowerCase()
  const filteredItems = items.filter(
    ({ lane }) =>
      selectedAgentTypes.has(lane.session.agentType ?? lane.session.role) &&
      lane.models.some((entry) => selectedModels.has(entry.model)) &&
      selectedRoots.has(lane.rootId) &&
      (stateFilter === 'all' || stateFilter === lane.status._tag) &&
      lane.totalUsd >= minimumUsd &&
      (!hasCompaction || lane.compactions.length > 0) &&
      (normalizedFilter.length === 0 ||
        `${lane.session.name ?? ''} ${lane.session.task ?? ''} ${lane.models.map((entry) => entry.model).join(' ')}`
          .toLocaleLowerCase()
          .includes(normalizedFilter)),
  )
  const hasActiveFilters = filteredItems.length !== items.length
  const clearFilters = (): void => {
    setFilterText('')
    setSelectedAgentTypes(new Set(agentTypes))
    setSelectedModels(new Set(models))
    setSelectedRoots(new Set(roots))
    setStateFilter('all')
    setMinimumUsd(0)
    setHasCompaction(false)
  }

  return (
    <div {...stylex.props(styles.treeCase)}>
      <SessionTree
        items={filteredItems}
        topSpacer={0}
        bottomSpacer={0}
        virtualized={false}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
        selectedLaneId={selectedLaneId}
        onSelectedLaneIdChange={setSelectedLaneId}
        onExpandAll={() => setExpandedKeys(new Set(scene.lanes.map((lane) => lane.session.id)))}
        onCollapseAll={() => setExpandedKeys(new Set())}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        agentTypes={agentTypes}
        selectedAgentTypes={selectedAgentTypes}
        onSelectedAgentTypesChange={setSelectedAgentTypes}
        models={models}
        selectedModels={selectedModels}
        onSelectedModelsChange={setSelectedModels}
        roots={roots}
        selectedRoots={selectedRoots}
        onSelectedRootsChange={setSelectedRoots}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        minimumUsd={minimumUsd}
        onMinimumUsdChange={setMinimumUsd}
        hasCompaction={hasCompaction}
        onHasCompactionChange={setHasCompaction}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        matchingCount={filteredItems.length}
        totalCount={items.length}
        compact={compact}
        scrollRef={scrollRef}
        onScroll={() => undefined}
        onVirtualizedRowKeyDown={() => undefined}
      />
    </div>
  )
}
const storyScrollRef = React.createRef<HTMLDivElement>()

const meta = {
  title: 'Vista/Blocks/Agents/Agent Timeline/Session Tree',
  component: SessionTree,
  args: {
    items,
    topSpacer: 0,
    bottomSpacer: 0,
    virtualized: false,
    expandedKeys: new Set(scene.lanes.map((lane) => lane.session.id)),
    onExpandedChange: () => undefined,
    selectedLaneId: null,
    onSelectedLaneIdChange: () => undefined,
    onExpandAll: () => undefined,
    onCollapseAll: () => undefined,
    filterText: '',
    onFilterTextChange: () => undefined,
    agentTypes,
    selectedAgentTypes: new Set(agentTypes),
    onSelectedAgentTypesChange: () => undefined,
    models,
    selectedModels: new Set(models),
    onSelectedModelsChange: () => undefined,
    roots,
    selectedRoots: new Set(roots),
    onSelectedRootsChange: () => undefined,
    stateFilter: 'all',
    onStateFilterChange: () => undefined,
    minimumUsd: 0,
    onMinimumUsdChange: () => undefined,
    hasCompaction: false,
    onHasCompactionChange: () => undefined,
    onClearFilters: () => undefined,
    hasActiveFilters: false,
    matchingCount: items.length,
    totalCount: items.length,
    compact: false,
    scrollRef: storyScrollRef,
    onScroll: () => undefined,
    onVirtualizedRowKeyDown: () => undefined,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SessionTree>

export default meta
type Story = StoryObj<typeof meta>

/** Compare expanded and compact session-tree density. */
export const AllStates: Story = {
  render: () => (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.case)}>
        <h2 {...stylex.props(styles.heading)}>Expanded</h2>
        <TreeCase compact={false} />
      </section>
      <section {...stylex.props(styles.case)}>
        <h2 {...stylex.props(styles.heading)}>Compact</h2>
        <TreeCase compact />
      </section>
    </main>
  ),
}

const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    minWidth: 0,
    margin: 0,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-foreground'],
  },
  case: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  heading: {
    position: 'absolute',
    zIndex: 2,
    right: scale.space2,
    bottom: scale.space2,
    margin: 0,
    paddingBlock: scale.space1,
    paddingInline: scale.space2,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    backgroundColor: tokens['--ds-background-200'],
    color: tokens['--ds-gray-800'],
    fontSize: '0.7rem',
    fontWeight: 600,
    pointerEvents: 'none',
  },
  treeCase: {
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
})
