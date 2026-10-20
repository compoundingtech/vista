import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// oxlint-disable-next-line import/no-unassigned-import -- CSS side-effect import
import '../../foreign-dom.css'
import { Icon } from './icons.tsx'

/**
 * One mission step. `id`, `assignedTo` and `dependsOn` are the st MissionSchema step shape, so
 * declared steps pass straight through; `label` and `detail` are what the reader sees.
 */
export interface MissionStep {
  readonly id: string
  readonly assignedTo: string
  readonly dependsOn?: { readonly step: string; readonly state: string } | null
  readonly label?: string
  /** Shown when the step is selected. */
  readonly detail?: ReactNode
}

/**
 * A pause outside the mission DSL: an approval or evidence the runner does not enforce. It sits
 * in `lane` at the rank of step `at` and points to `to` (or follows `from`).
 */
export interface MissionGate {
  readonly id: string
  readonly lane: string
  readonly at: string
  readonly label: string
  readonly to?: string
  readonly from?: string
  /** `agent` for a gate another agent holds; the default is a human gate. */
  readonly actor?: 'human' | 'agent'
  readonly detail?: ReactNode
}

/** Review-only additions: lane labels keyed by `assignedTo`, and gates. */
export interface MissionOverlay {
  readonly lanes?: Readonly<Record<string, string>>
  readonly gates?: readonly MissionGate[]
}

/** Props for MissionGraph: the declared steps and an optional review overlay. */
export interface MissionGraphProps {
  readonly steps: readonly MissionStep[]
  readonly overlay?: MissionOverlay
}

type Direction = 'LR' | 'TB'

/** Node dimensions shared by deterministic placement and collision regressions. */
export const SIZE = { step: { w: 150, h: 62 }, gate: { w: 176, h: 34 } }
/** LR: rank columns after a lane-label column; TB: rank rows under a lane-label row, each lane wide enough for a gate. */
const LR = { rank: 184, head: 104, lane: { human: 64, agent: 92 } }
const TB = { rank: 92, head: 40, lane: { human: SIZE.gate.w + 28, agent: SIZE.gate.w + 20 } }

/** A lane is human when its seat is a `human/…` subject. */
const isHuman = (lane: string) => lane.startsWith('human/')

/** Placed lane, node and edge geometry; deterministic for a given mission and direction. */
export interface MissionLayout {
  readonly lanes: readonly {
    readonly id: string
    readonly label: string
    readonly human: boolean
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  }[]
  readonly nodes: readonly {
    readonly id: string
    readonly kind: 'step' | 'gate'
    readonly label: string
    readonly index: number
    readonly lane: string
    readonly rank: number
    readonly cx: number
    readonly cy: number
    readonly actor: 'human' | 'agent'
  }[]
  readonly edges: readonly {
    readonly id: string
    readonly source: string
    readonly target: string
    readonly kind: 'depends' | 'handoff' | 'gate' | 'agent-gate'
    readonly sides: readonly [Side, Side]
  }[]
  readonly width: number
  readonly height: number
}

type Side = 't' | 'r' | 'b' | 'l'

/**
 * Lane × rank layout without a layout engine. Lanes are seats (human lanes first, then first
 * appearance); a step's rank is its longest `dependsOn` path, and a gate takes its anchor's rank.
 */
export const layoutMission = (
  steps: readonly MissionStep[],
  overlay: MissionOverlay | undefined,
  direction: Direction,
): MissionLayout => {
  const byId = new Map(steps.map((step) => [step.id, step]))
  const ranks = new Map<string, number>()
  const rankOf = (id: string, seen: ReadonlySet<string>): number => {
    const known = ranks.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) throw new Error(`MissionGraph: dependsOn cycle at ${id}`)
    const dependency = byId.get(id)?.dependsOn
    const rank =
      dependency != null && byId.has(dependency.step)
        ? rankOf(dependency.step, new Set([...seen, id])) + 1
        : 0
    ranks.set(id, rank)
    return rank
  }
  for (const step of steps) rankOf(step.id, new Set())
  const gates = overlay?.gates ?? []
  const seats = [
    ...new Set([...steps.map((step) => step.assignedTo), ...gates.map((gate) => gate.lane)]),
  ]
  const laneIds = [...seats.filter(isHuman), ...seats.filter((seat) => !isHuman(seat))]
  const geometry = direction === 'LR' ? LR : TB
  // Parallel work and gates can share a lane × rank cell. Pack that cell across
  // the lane, ordered by id, and grow the lane to fit its busiest rank.
  const cells = new Map<string, Map<number, { id: string; size: number }[]>>()
  const crossSize = (kind: 'step' | 'gate') => (direction === 'LR' ? SIZE[kind].h : SIZE[kind].w)
  for (const item of [
    ...steps.map((step) => ({
      id: step.id,
      lane: step.assignedTo,
      rank: ranks.get(step.id) ?? 0,
      size: crossSize('step'),
    })),
    ...gates.map((gate) => ({
      id: gate.id,
      lane: gate.lane,
      rank: ranks.get(gate.at) ?? 0,
      size: crossSize('gate'),
    })),
  ]) {
    let laneCells = cells.get(item.lane)
    if (laneCells === undefined) cells.set(item.lane, (laneCells = new Map()))
    let members = laneCells.get(item.rank)
    if (members === undefined) laneCells.set(item.rank, (members = []))
    members.push(item)
  }
  const extents = new Map<string, number>()
  const crossOffsets = new Map<string, number>()
  for (const lane of laneIds) {
    let laneExtent = geometry.lane[isHuman(lane) ? 'human' : 'agent']
    for (const members of cells.get(lane)?.values() ?? []) {
      members.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      const packed =
        members.reduce((total, member) => total + member.size, 0) + (members.length - 1) * 16
      laneExtent = Math.max(laneExtent, packed + 20)
      let cursor = -packed / 2
      for (const member of members) {
        crossOffsets.set(member.id, cursor + member.size / 2)
        cursor += member.size + 16
      }
    }
    extents.set(lane, laneExtent)
  }
  const extent = (lane: string) => extents.get(lane)!
  const offsets = new Map<string, number>()
  let across = 0
  for (const lane of laneIds) {
    offsets.set(lane, across)
    across += extent(lane)
  }
  const maxRank = Math.max(0, ...ranks.values())
  const span = geometry.head + (maxRank + 1) * geometry.rank
  const centre = (id: string, lane: string, rank: number) => {
    const along = geometry.head + rank * geometry.rank + geometry.rank / 2
    const side = (offsets.get(lane) ?? 0) + extent(lane) / 2 + (crossOffsets.get(id) ?? 0)
    return direction === 'LR' ? { x: along, y: side } : { x: side, y: along }
  }
  const nodes: MissionLayout['nodes'][number][] = [
    ...steps.map((step, index) => {
      const rank = ranks.get(step.id) ?? 0
      const { x, y } = centre(step.id, step.assignedTo, rank)
      return {
        id: step.id,
        kind: 'step' as const,
        label: step.label ?? step.id,
        index: index + 1,
        lane: step.assignedTo,
        rank,
        cx: x,
        cy: y,
        actor: 'agent' as const,
      }
    }),
    ...gates.map((gate) => {
      const rank = ranks.get(gate.at) ?? 0
      const { x, y } = centre(gate.id, gate.lane, rank)
      return {
        id: gate.id,
        kind: 'gate' as const,
        label: gate.label,
        index: 0,
        lane: gate.lane,
        rank,
        cx: x,
        cy: y,
        actor: gate.actor ?? ('human' as const),
      }
    }),
  ]
  const position = new Map(nodes.map((node) => [node.id, node]))
  const sides = (source: string, target: string): readonly [Side, Side] => {
    const a = position.get(source)
    const b = position.get(target)
    if (a === undefined || b === undefined) return ['r', 'l']
    if (Math.abs(b.cx - a.cx) >= Math.abs(b.cy - a.cy))
      return b.cx >= a.cx ? ['r', 'l'] : ['l', 'r']
    return b.cy >= a.cy ? ['b', 't'] : ['t', 'b']
  }
  const edges: MissionLayout['edges'][number][] = []
  for (const step of steps) {
    const from = step.dependsOn == null ? undefined : byId.get(step.dependsOn.step)
    if (from === undefined) continue
    edges.push({
      id: `${from.id}->${step.id}`,
      source: from.id,
      target: step.id,
      kind: from.assignedTo === step.assignedTo ? 'depends' : 'handoff',
      sides: sides(from.id, step.id),
    })
  }
  for (const gate of gates) {
    const kind = gate.actor === 'agent' ? 'agent-gate' : 'gate'
    if (gate.to !== undefined && position.has(gate.to)) {
      edges.push({
        id: `${gate.id}->${gate.to}`,
        source: gate.id,
        target: gate.to,
        kind,
        sides: sides(gate.id, gate.to),
      })
    }
    if (gate.from !== undefined && position.has(gate.from)) {
      edges.push({
        id: `${gate.from}->${gate.id}`,
        source: gate.from,
        target: gate.id,
        kind,
        sides: sides(gate.from, gate.id),
      })
    }
  }
  const lanes = laneIds.map((lane) => ({
    id: lane,
    label: overlay?.lanes?.[lane] ?? lane.split('/').at(-1) ?? lane,
    human: isHuman(lane),
    x: direction === 'LR' ? 0 : (offsets.get(lane) ?? 0),
    y: direction === 'LR' ? (offsets.get(lane) ?? 0) : 0,
    w: direction === 'LR' ? span : extent(lane),
    h: direction === 'LR' ? extent(lane) : span,
  }))
  return {
    lanes,
    nodes,
    edges,
    width: direction === 'LR' ? span : across,
    height: direction === 'LR' ? across : span,
  }
}

interface FlowData extends Record<string, unknown> {
  readonly label: string
  readonly index: number
  readonly human: boolean
  readonly actor: 'human' | 'agent'
  readonly direction: Direction
  readonly selected: boolean
  readonly onSelect: (id: string) => void
}

const positions: Record<Side, Position> = {
  t: Position.Top,
  r: Position.Right,
  b: Position.Bottom,
  l: Position.Left,
}

/** Invisible anchors on every side, so each edge leaves and enters on the side facing its peer. */
const Handles = () =>
  (['t', 'r', 'b', 'l'] as const).flatMap((side) => [
    <Handle
      key={`s${side}`}
      id={`s${side}`}
      type="source"
      position={positions[side]}
      isConnectable={false}
      {...stylex.props(styles.handle)}
    />,
    <Handle
      key={`t${side}`}
      id={`t${side}`}
      type="target"
      position={positions[side]}
      isConnectable={false}
      {...stylex.props(styles.handle)}
    />,
  ])

const StepNode = ({ id, data }: NodeProps<Node<FlowData>>) => (
  <>
    <Handles />
    <button
      type="button"
      className="nodrag nopan"
      {...stylex.props(styles.step, data.selected && styles.selected)}
      aria-pressed={data.selected}
      aria-label={`Step ${data.index}: ${data.label}`}
      onClick={() => data.onSelect(id)}
    >
      <span {...stylex.props(styles.stepIndex)}>{String(data.index).padStart(2, '0')}</span>
      <span {...stylex.props(styles.stepLabel)}>{data.label}</span>
    </button>
  </>
)

const GateNode = ({ id, data }: NodeProps<Node<FlowData>>) => (
  <>
    <Handles />
    <button
      type="button"
      className="nodrag nopan"
      {...stylex.props(
        styles.gate,
        data.actor === 'agent' && styles.gateAgent,
        data.selected && styles.selected,
      )}
      aria-pressed={data.selected}
      aria-label={`Gate: ${data.label}`}
      onClick={() => data.onSelect(id)}
    >
      <Icon name={data.actor === 'agent' ? 'bot' : 'hand'} size={13} />
      <span {...stylex.props(styles.gateLabel)}>{data.label}</span>
    </button>
  </>
)

const LaneNode = ({ data }: NodeProps<Node<FlowData>>) => (
  <div
    {...stylex.props(
      styles.lane,
      data.human && styles.laneHuman,
      data.direction === 'TB' && styles.laneColumn,
    )}
  >
    <span {...stylex.props(styles.laneLabel, data.human && styles.laneLabelHuman)}>
      <Icon name={data.human ? 'user' : 'bot'} size={13} />
      {data.label}
    </span>
  </div>
)

const nodeTypes = { step: StepNode, gate: GateNode, lane: LaneNode }

const edgeStyles: Record<
  MissionLayout['edges'][number]['kind'],
  { readonly stroke: string; readonly dashed: boolean }
> = {
  depends: { stroke: 'var(--ds-gray-700)', dashed: false },
  handoff: { stroke: 'var(--ds-gray-900)', dashed: false },
  gate: { stroke: 'var(--tone-you)', dashed: true },
  'agent-gate': { stroke: 'var(--ds-gray-700)', dashed: true },
}

/** The viewport that fits the whole layout into the canvas; computed, not measured, so a direction flip cannot fit against a stale pane size. */
type View = { readonly x: number; readonly y: number; readonly zoom: number }

const Flow = ({
  layout,
  direction,
  view,
  selected,
  onSelect,
}: {
  readonly layout: MissionLayout
  readonly direction: Direction
  readonly view: View
  readonly selected: string | null
  readonly onSelect: (id: string) => void
}) => {
  const { setViewport } = useReactFlow()
  const nodes = useMemo<Node<FlowData>[]>(
    () => [
      ...layout.lanes.map((lane) => ({
        id: `lane:${lane.id}`,
        type: 'lane',
        position: { x: lane.x, y: lane.y },
        width: lane.w,
        height: lane.h,
        zIndex: -1,
        selectable: false,
        draggable: false,
        focusable: false,
        data: {
          label: lane.label,
          index: 0,
          human: lane.human,
          actor: 'agent' as const,
          direction,
          selected: false,
          onSelect,
        },
      })),
      ...layout.nodes.map((node) => {
        const size = SIZE[node.kind]
        return {
          id: node.id,
          type: node.kind,
          position: { x: node.cx - size.w / 2, y: node.cy - size.h / 2 },
          width: size.w,
          height: size.h,
          selectable: false,
          draggable: false,
          focusable: false,
          data: {
            label: node.label,
            index: node.index,
            human: isHuman(node.lane),
            actor: node.actor,
            direction,
            selected: selected === node.id,
            onSelect,
          },
        }
      }),
    ],
    [layout, direction, selected, onSelect],
  )
  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => {
        const look = edgeStyles[edge.kind]
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: `s${edge.sides[0]}`,
          targetHandle: `t${edge.sides[1]}`,
          type: 'smoothstep',
          style: {
            stroke: look.stroke,
            strokeWidth: 1.5,
            ...(look.dashed ? { strokeDasharray: '4 4' } : {}),
          },
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: look.stroke },
          focusable: false,
          selectable: false,
        }
      }),
    [layout],
  )
  useEffect(() => {
    void setViewport(view)
  }, [setViewport, view])
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      defaultViewport={view}
      minZoom={Math.min(0.3, view.zoom)}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      zoomOnScroll={false}
      panOnScroll={false}
      preventScrolling={false}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
      style={{ backgroundColor: 'transparent' }}
      aria-label="Mission graph"
    />
  )
}

const FitButton = ({ view }: { readonly view: View }) => {
  const { setViewport } = useReactFlow()
  return (
    <button
      type="button"
      {...stylex.props(styles.fit)}
      aria-label="Fit graph"
      title="Fit graph"
      onClick={() => void setViewport(view, { duration: 200 })}
    >
      <Icon name="maximize" size={14} />
    </button>
  )
}

/**
 * A mission as a lane × rank graph: one lane per seat, steps ranked by their dependencies, and
 * gates as rounded pauses. Dependencies are solid; gates the runner does not enforce are dashed.
 * Selecting a node reveals its details below the graph.
 */
export const MissionGraph = ({ steps, overlay }: MissionGraphProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry?.contentRect.width ?? 0)),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const wide = useMemo(() => layoutMission(steps, overlay, 'LR'), [steps, overlay])
  const tall = useMemo(() => layoutMission(steps, overlay, 'TB'), [steps, overlay])
  // Lanes run left to right while the graph stays legible (at least 3/4 scale), else top to bottom.
  const direction: Direction = width >= wide.width * 0.75 ? 'LR' : 'TB'
  const layout = direction === 'LR' ? wide : tall
  const scale = width > 0 ? Math.min(1, (width - 8) / layout.width) : 1
  const view = useMemo<View>(
    () => ({ x: Math.max(4, (width - layout.width * scale) / 2), y: 8, zoom: scale }),
    [width, layout, scale],
  )
  const onSelect = useCallback(
    (id: string) => setSelected((current) => (current === id ? null : id)),
    [],
  )
  const step = steps.find((candidate) => candidate.id === selected)
  const gate = overlay?.gates?.find((candidate) => candidate.id === selected)
  const laneLabels = Object.fromEntries(layout.lanes.map((lane) => [lane.id, lane.label]))
  const after =
    step?.dependsOn == null
      ? undefined
      : steps.find((candidate) => candidate.id === step.dependsOn?.step)
  return (
    <div {...stylex.props(styles.root)} data-vista-tones="" data-vista-mission-graph="">
      <div
        ref={ref}
        {...stylex.props(styles.canvas)}
        style={{ height: Math.ceil(layout.height * scale + 16) }}
        data-direction={direction}
      >
        {width > 0 ? (
          <ReactFlowProvider>
            <Flow
              layout={layout}
              direction={direction}
              view={view}
              selected={selected}
              onSelect={onSelect}
            />
            <FitButton view={view} />
          </ReactFlowProvider>
        ) : null}
      </div>
      {step === undefined && gate === undefined ? null : (
        <section
          {...stylex.props(styles.inspector)}
          aria-label="Selected node"
          data-vista-mission-selection=""
        >
          <div {...stylex.props(styles.inspectorHead)}>
            <h3 {...stylex.props(styles.inspectorTitle)}>
              {step?.label ?? step?.id ?? gate?.label}
            </h3>
            <button
              type="button"
              {...stylex.props(styles.close)}
              aria-label="Close details"
              onClick={() => setSelected(null)}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <p {...stylex.props(styles.inspectorMeta)}>
            {step !== undefined
              ? `${laneLabels[step.assignedTo]}${after === undefined ? '' : ` · after ${after.label ?? after.id}`}`
              : `${gate?.actor === 'agent' ? 'Agent gate' : 'Your gate'} · ${laneLabels[gate?.lane ?? '']}`}
          </p>
          {step?.detail ?? gate?.detail ?? null}
        </section>
      )}
    </div>
  )
}

const focusRing = {
  outlineColor: {
    default: 'transparent',
    ':focus-visible': tokens['--ds-focus-color'],
  },
  outlineOffset: 2,
  outlineStyle: 'solid',
  outlineWidth: 2,
} as const

const styles = stylex.create({
  root: {
    display: 'grid',
    gap: '0.625rem',
    color: tokens['--ds-gray-1000'],
  },
  canvas: {
    position: 'relative',
    width: '100%',
  },
  handle: {
    opacity: 0,
    pointerEvents: 'none',
    width: 1,
    height: 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 0,
  },
  lane: {
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingBlock: '0.5rem',
    paddingInline: '0.625rem',
    borderRadius: '0.3125rem',
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: tokens['--ds-background-100'],
  },
  laneColumn: {
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  laneHuman: {
    backgroundColor: 'color-mix(in oklab, var(--tone-you) 8%, var(--ds-background-100))',
  },
  laneLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3125rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: tokens['--ds-gray-900'],
  },
  laneLabelHuman: {
    color: 'var(--tone-you-ink)',
  },
  // React Flow disables pointer events on non-selectable node wrappers; the buttons own selection.
  step: {
    ...focusRing,
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '0.3125rem',
    paddingBlock: '0.4375rem',
    paddingInline: '0.5625rem',
    textAlign: 'left',
    font: 'inherit',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: tokens['--ds-gray-alpha-500'],
      ':hover': tokens['--ds-gray-900'],
    },
    borderRadius: '0.375rem',
    cursor: 'pointer',
    pointerEvents: 'auto',
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
  },
  stepIndex: {
    fontSize: '0.625rem',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    color: tokens['--ds-gray-900'],
  },
  stepLabel: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    lineHeight: '1rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  gate: {
    ...focusRing,
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    paddingBlock: 0,
    paddingInline: '0.5rem',
    font: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'color-mix(in oklab, var(--tone-you) 48%, var(--ds-background-100))',
    borderRadius: '999px',
    cursor: 'pointer',
    pointerEvents: 'auto',
    color: 'var(--tone-you-ink)',
    backgroundColor: tokens['--ds-background-100'],
  },
  gateAgent: {
    color: tokens['--ds-gray-900'],
    borderColor: tokens['--ds-gray-alpha-500'],
  },
  gateLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  selected: {
    outlineColor: tokens['--ds-gray-1000'],
  },
  fit: {
    ...focusRing,
    position: 'absolute',
    right: '0.25rem',
    bottom: '0.25rem',
    zIndex: 5,
    display: 'grid',
    placeItems: 'center',
    width: '1.75rem',
    height: '1.75rem',
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-300'],
    borderRadius: '0.3125rem',
    cursor: 'pointer',
    color: tokens['--ds-gray-900'],
    backgroundColor: tokens['--ds-background-100'],
  },
  inspector: {
    paddingBlock: '0.875rem',
    paddingInline: '1.125rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: '0.5rem',
    backgroundColor: tokens['--ds-gray-alpha-100'],
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  inspectorHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  inspectorTitle: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  inspectorMeta: {
    marginBlock: '0.125rem 0.5rem',
    fontSize: '0.75rem',
    color: tokens['--ds-gray-900'],
  },
  close: {
    ...focusRing,
    display: 'grid',
    placeItems: 'center',
    width: '1.75rem',
    height: '1.75rem',
    padding: 0,
    borderWidth: 0,
    borderRadius: '0.375rem',
    cursor: 'pointer',
    color: tokens['--ds-gray-900'],
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-200'],
    },
  },
})
