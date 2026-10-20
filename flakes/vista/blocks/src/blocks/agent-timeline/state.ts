import { Atom } from 'effect/reactivity'

import { sessionLabel } from '@overeng/agent-timeline/labels'
import type { AgentTimelineScene, Lane } from '@overeng/agent-timeline/projection'
import type { TraceCursor, TraceFilters, TraceViewport } from '@overeng/agent-timeline/types'

import { nearestVisibleCollapsedAncestorId } from './collapse.ts'
import { clampTraceViewport, MIN_TRACE_VIEWPORT_MS } from './navigation.ts'
import { followTraceWindow, shownValues } from './refresh.ts'
import type { TimelineHoverPoint } from './SpanHover.tsx'

/** Height in pixels of one session row, shared by the tree and the timeline. */
export const TRACE_ROW_HEIGHT = 34
/** Row windowing starts above this many filtered sessions. */
const VIRTUALIZE_AFTER = 100
/** Rows rendered above and below the scrolled window. */
const WINDOW_OVERSCAN = 12

/** Public expansion state: every resident session or the explicit expanded IDs. */
export type Expansion = 'all' | ReadonlySet<string>

/**
 * A projected lane and the descendants drawn as rollup marks on its span. It is independent of
 * the viewport so zoom and pan never rebuild the row list; rows derive viewport state themselves.
 */
export interface VisibleLane {
  readonly lane: Lane
  readonly isAncestorOnly: boolean
  readonly findMatch: boolean
  readonly rolledUpChildren: ReadonlyArray<Lane>
}

/** Materialize the current expanded IDs without changing the expansion preference. */
export const expandedSessionIds = (
  keys: Expansion,
  scene: AgentTimelineScene,
): ReadonlySet<string> =>
  keys === 'all' ? new Set(scene.lanes.map((lane) => lane.session.id)) : keys

/** A Tree change against 'all' becomes an explicit snapshot; subsequent sessions stay collapsed. */
export const nextExpansion = (
  previous: Expansion,
  next: ReadonlySet<string>,
  scene: AgentTimelineScene,
): Expansion => (previous === 'all' && next.size === scene.lanes.length ? 'all' : new Set(next))

/** Text matched by the session filter, find, and the tree's type-ahead. */
export const searchText = (lane: Lane): string => {
  const label = sessionLabel(lane.session)
  return [
    label.task,
    label.primary,
    label.type,
    lane.session.actorId,
    lane.currentModel,
    ...lane.models.map((entry) => entry.model),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}

const ancestorsFor = (scene: AgentTimelineScene, ids: ReadonlySet<string>): ReadonlySet<string> => {
  const byId = new Map(scene.lanes.map((lane) => [lane.session.id, lane]))
  const ancestors = new Set<string>()
  for (const id of ids) {
    let parentId = byId.get(id)?.session.parentId ?? null
    while (parentId !== null) {
      if (ancestors.has(parentId)) break
      ancestors.add(parentId)
      parentId = byId.get(parentId)?.session.parentId ?? null
    }
  }
  return ancestors
}

const sumLanes = (lanes: ReadonlyArray<Lane>) => {
  let roots = 0
  let usd = 0
  let turns = 0
  let compactions = 0
  let active = 0
  let inactive = 0
  let exited = 0
  for (const lane of lanes) {
    roots += Number(lane.session.role === 'main')
    usd += lane.totalUsd
    turns += lane.agentTurns
    compactions += lane.compactionCount
    active += Number(lane.status._tag === 'active')
    inactive += Number(lane.status._tag === 'inactive')
    exited += Number(lane.status._tag === 'exited')
  }
  return { agents: lanes.length, roots, usd, turns, compactions, active, inactive, exited }
}

/** One identity-scoped source/derived atom graph for the trace viewer. */
export const makeTraceState = (
  initialScene: AgentTimelineScene,
  initialViewport?: TraceViewport,
  minimumViewportMs = MIN_TRACE_VIEWPORT_MS,
  initialExpansion: Expansion = new Set(),
) => {
  const scene = Atom.make(initialScene)
  const viewport = Atom.make(
    clampTraceViewport(
      initialViewport ?? {
        start: initialScene.model.windowStart,
        end: initialScene.model.windowEnd,
      },
      { start: initialScene.model.windowStart, end: initialScene.model.windowEnd },
      minimumViewportMs,
    ),
  )
  const hiddenAgentTypes = Atom.make(new Set<string>())
  const hiddenModels = Atom.make(new Set<string>())
  const hiddenRoots = Atom.make(new Set<string>())
  const stateFilter = Atom.make<TraceFilters['state']>('all')
  const minimumUsd = Atom.make(0)
  const hasCompaction = Atom.make(false)
  const find = Atom.make('')
  const findIndex = Atom.make(0)
  const filterText = Atom.make('')
  const expansion = Atom.make<Expansion>(initialExpansion)
  const expanded = Atom.readable((get) => expandedSessionIds(get(expansion), get(scene)))
  const treeWidth = Atom.make(320)
  const detailsHeight = Atom.make(280)
  const treeMaximum = Atom.make(640)
  const detailsMaximum = Atom.make(560)
  const compactTree = Atom.make(false)
  const selectedLaneId = Atom.make<string | null>(null)
  const cursor = Atom.make<TraceCursor | null>(null)
  const hoverPoint = Atom.make<TimelineHoverPoint | null>(null)
  const scrollTop = Atom.make(0)
  const viewportHeight = Atom.make(520)
  const options = Atom.readable((get) => {
    const lanes = get(scene).lanes
    return {
      agentTypes: Array.from(
        new Set(lanes.map((lane) => lane.session.agentType ?? lane.session.role)),
      ).toSorted(),
      models: Array.from(
        new Set(lanes.flatMap((lane) => lane.models.map((entry) => entry.model))),
      ).toSorted(),
      roots: Array.from(new Set(lanes.map((lane) => lane.rootId))).toSorted(),
    }
  })
  const selected = Atom.readable((get) => {
    const available = get(options)
    return {
      agentTypes: shownValues(available.agentTypes, get(hiddenAgentTypes)),
      models: shownValues(available.models, get(hiddenModels)),
      roots: shownValues(available.roots, get(hiddenRoots)),
    }
  })
  const directIds = Atom.readable((get) => {
    const current = get(scene)
    const values = get(selected)
    const state = get(stateFilter)
    const minUsd = get(minimumUsd)
    const compacted = get(hasCompaction)
    const text = get(filterText).trim().toLocaleLowerCase()
    return new Set(
      current.lanes
        .filter(
          (lane) =>
            values.agentTypes.has(lane.session.agentType ?? lane.session.role) &&
            lane.models.some((entry) => values.models.has(entry.model)) &&
            values.roots.has(lane.rootId) &&
            (state === 'all' || state === lane.status._tag) &&
            lane.totalUsd >= minUsd &&
            (!compacted || lane.compactionCount > 0) &&
            (text.length === 0 || searchText(lane).includes(text)),
        )
        .map((lane) => lane.session.id),
    )
  })
  const filtered = Atom.readable((get) => {
    const current = get(scene)
    const ids = get(directIds)
    const query = get(find).trim().toLocaleLowerCase()
    const ancestorIds = ancestorsFor(current, ids)
    const beforeCollapse: ReadonlyArray<VisibleLane> = current.lanes.flatMap((lane) => {
      const isDirect = ids.has(lane.session.id)
      const isAncestorOnly = !isDirect && ancestorIds.has(lane.session.id)
      if (!isDirect && !isAncestorOnly) return []
      return [
        {
          lane,
          isAncestorOnly,
          findMatch: query.length > 0 && searchText(lane).includes(query),
          rolledUpChildren: [],
        },
      ]
    })
    return { directIds: ids, beforeCollapse }
  })
  const visible = Atom.readable((get): ReadonlyArray<VisibleLane> => {
    const current = get(scene)
    const before = get(filtered).beforeCollapse
    const expandedKeys = get(expanded)
    const parents = new Map(
      current.lanes.map((lane) => [lane.session.id, lane.session.parentId] as const),
    )
    const rollups = new Map<string, Lane[]>()
    for (const item of before) {
      const ancestor = nearestVisibleCollapsedAncestorId(
        item.lane.session.id,
        parents,
        expandedKeys,
      )
      if (ancestor === null) continue
      const children = rollups.get(ancestor) ?? []
      children.push(item.lane)
      rollups.set(ancestor, children)
    }
    return before
      .filter(
        (item) =>
          nearestVisibleCollapsedAncestorId(item.lane.session.id, parents, expandedKeys) === null,
      )
      .map((item) => ({
        lane: item.lane,
        isAncestorOnly: item.isAncestorOnly,
        findMatch: item.findMatch,
        rolledUpChildren: rollups.get(item.lane.session.id) ?? [],
      }))
  })
  // Primitive projections: atoms notify on every recomputation unless the value is primitive,
  // so components that only need a count or a range subscribe to these instead.
  const findMatchCount = Atom.readable(
    (get) => get(visible).filter((item) => item.findMatch).length,
  )
  const virtualized = Atom.readable((get) => get(filtered).beforeCollapse.length > VIRTUALIZE_AFTER)
  const firstRow = Atom.readable((get) =>
    get(virtualized)
      ? Math.max(0, Math.floor(get(scrollTop) / TRACE_ROW_HEIGHT) - WINDOW_OVERSCAN)
      : 0,
  )
  const lastRow = Atom.readable((get) =>
    get(virtualized)
      ? Math.min(
          get(visible).length,
          Math.ceil((get(scrollTop) + get(viewportHeight)) / TRACE_ROW_HEIGHT) + WINDOW_OVERSCAN,
        )
      : get(visible).length,
  )
  const hasActiveFilters = Atom.readable((get) => {
    const available = get(options)
    const shown = get(selected)
    return (
      get(filterText).length > 0 ||
      shown.agentTypes.size !== available.agentTypes.length ||
      shown.models.size !== available.models.length ||
      shown.roots.size !== available.roots.length ||
      get(stateFilter) !== 'all' ||
      get(minimumUsd) > 0 ||
      get(hasCompaction)
    )
  })
  const allTotals = Atom.readable((get) => sumLanes(get(scene).lanes))
  const totals = Atom.readable((get) => {
    const current = get(scene)
    const ids = get(directIds)
    const included = current.lanes.filter((lane) => ids.has(lane.session.id))
    return {
      shown: sumLanes(included),
      all: get(allTotals),
      matching: current.model.coverage.matchingSessions ?? current.lanes.length,
    }
  })
  const applyScene = (
    previous: AgentTimelineScene,
    next: AgentTimelineScene,
    currentViewport: TraceViewport,
  ) =>
    followTraceWindow({
      viewport: currentViewport,
      previousWindow: { start: previous.model.windowStart, end: previous.model.windowEnd },
      nextWindow: { start: next.model.windowStart, end: next.model.windowEnd },
      minimumViewportMs,
    })
  return {
    scene,
    viewport,
    hiddenAgentTypes,
    hiddenModels,
    hiddenRoots,
    stateFilter,
    minimumUsd,
    hasCompaction,
    find,
    findIndex,
    filterText,
    expansion,
    treeWidth,
    detailsHeight,
    treeMaximum,
    detailsMaximum,
    compactTree,
    selectedLaneId,
    cursor,
    hoverPoint,
    scrollTop,
    viewportHeight,
    options,
    selected,
    directIds,
    filtered,
    visible,
    findMatchCount,
    virtualized,
    firstRow,
    lastRow,
    hasActiveFilters,
    expanded,
    allTotals,
    totals,
    applyScene,
  }
}

/** The atom graph of one mounted trace viewer. */
export type TraceState = ReturnType<typeof makeTraceState>
