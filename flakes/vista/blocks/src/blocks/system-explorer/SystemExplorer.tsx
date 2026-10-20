import * as stylex from '@stylexjs/stylex'
import type { StyleXStylesWithout } from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  type Edge,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
/** React Flow + elkjs over a directly supplied typed graph. */
import { useEffect, useMemo, useState } from 'react'

// oxlint-disable-next-line import/no-unassigned-import -- CSS side-effect import
import '../../foreign-dom.css'
import type { SystemAspect, SystemLens, SystemModel } from '../../model.ts'
import { useTheme } from '../../theme.ts'
import { layoutScene, type Positioned } from './layout.ts'
import { project, type SceneNode } from './projection.ts'

const ALL_ASPECTS: readonly SystemAspect[] = ['dataflow', 'controlflow', 'ownership', 'telemetry']

/** Rich custom node body: badges + drill affordance (impossible in a regen SVG). */
const SystemNodeView = ({ data }: NodeProps<Node<{ scene: SceneNode; hasChildren: boolean }>>) => {
  const { scene, hasChildren } = data
  const { node, muted, focused } = scene
  return (
    <div
      {...stylex.props(
        styles.node,
        nodeLevelStyles[node.level],
        muted && styles.nodeMuted,
        focused && styles.nodeFocused,
      )}
      data-level={node.level}
    >
      <Handle {...stylex.props(styles.handle)} type="target" position={Position.Left} />
      <div {...stylex.props(styles.nodeHead)}>
        <span {...stylex.props(styles.nodeLabel)}>{node.label}</span>
        {hasChildren ? (
          <span {...stylex.props(styles.nodeDrill)} title="Has children" aria-label="Has children">
            +
          </span>
        ) : null}
      </div>
      <div {...stylex.props(styles.nodeBadges)}>
        <span {...stylex.props(styles.badge, styles.levelBadge)}>{node.level}</span>
        {node.lifecycle ? <span {...stylex.props(styles.badge)}>{node.lifecycle}</span> : null}
        {node.trust ? <span {...stylex.props(styles.badge)}>{node.trust}</span> : null}
      </div>
      <Handle {...stylex.props(styles.handle)} type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { system: SystemNodeView }

const Inner = ({
  model,
  lenses,
  defaultLensId,
}: {
  model: SystemModel
  lenses: readonly SystemLens[]
  defaultLensId?: string | undefined
}) => {
  const theme = useTheme()
  const { fitView } = useReactFlow()
  const initial = lenses.find((l) => l.id === defaultLensId) ?? lenses[0]!
  const [aspects, setAspects] = useState<readonly SystemAspect[]>(initial.aspects)
  const [focus, setFocus] = useState<string | undefined>(initial.focus)
  const [expanded, setExpanded] = useState<readonly string[]>(initial.expanded ?? [])
  const [positions, setPositions] = useState<readonly Positioned[]>([])

  const lens = useMemo<SystemLens>(
    () => ({
      id: initial.id,
      maxLevel: initial.maxLevel,
      layout: initial.layout,
      ...(initial.muteBy ? { muteBy: initial.muteBy } : {}),
      aspects,
      expanded,
      ...(focus ? { focus } : {}),
    }),
    [initial, aspects, focus, expanded],
  )
  const scene = useMemo(() => project({ model, lens }), [model, lens])
  const childParents = useMemo(
    () => new Set(model.nodes.flatMap((n) => (n.parent ? [n.parent] : []))),
    [model],
  )

  // elk relayout only when the structural signature changes (semantic zoom).
  useEffect(() => {
    let cancelled = false
    void layoutScene({ scene, layout: lens.layout }).then((p) => {
      if (!cancelled) setPositions(p)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.layoutSignature])

  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions])

  // Re-fit after elk positions land (initial `fitView` fires before layout
  // resolves) and on any structural relayout, so the whole scene stays visible.
  useEffect(() => {
    if (positions.length === 0) return
    const frames: number[] = []
    frames.push(
      requestAnimationFrame(() => {
        frames.push(
          requestAnimationFrame(() => {
            void fitView({ padding: 0.16, duration: 200 })
          }),
        )
      }),
    )
    return () => frames.forEach((frame) => cancelAnimationFrame(frame))
  }, [positions, fitView])

  const rfNodes: Node[] = useMemo(
    () =>
      scene.nodes.map((sn) => {
        const p = posById.get(sn.node.id)
        return {
          id: sn.node.id,
          type: 'system',
          position: { x: p?.x ?? 0, y: p?.y ?? 0 },
          data: { scene: sn, hasChildren: childParents.has(sn.node.id) },
        }
      }),
    [scene.nodes, posById, childParents],
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      scene.edges.map((se, i) => {
        const edgeStyleProps = stylex.props(
          styles.edge,
          edgeAspectStyles[se.edge.aspect],
          se.muted && styles.edgeMuted,
        )
        return {
          id: `${se.edge.id}-${i}`,
          source: se.edge.source,
          target: se.edge.target,
          label: se.edge.label,
          animated: !se.muted && se.edge.aspect === 'dataflow',
          ...(edgeStyleProps.className ? { className: edgeStyleProps.className } : {}),
        }
      }),
    [scene.edges],
  )

  const toggleAspect = (a: SystemAspect) =>
    setAspects((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))

  return (
    <div {...stylex.props(styles.root)} data-theme={theme} data-vista-system-explorer="">
      <div {...stylex.props(styles.controls)}>
        <div
          {...stylex.props(styles.aspectGroup)}
          role="group"
          aria-label="Visible relationship aspects"
        >
          <span {...stylex.props(styles.controlsLabel)}>Aspects</span>
          <div {...stylex.props(styles.aspectList)}>
            {ALL_ASPECTS.map((a) => {
              const active = aspects.includes(a)
              return (
                <button
                  key={a}
                  type="button"
                  {...stylex.props(styles.aspect, active && aspectStyles[a])}
                  aria-pressed={active}
                  aria-label={`${active ? 'Hide' : 'Show'} ${a} aspect`}
                  onClick={() => toggleAspect(a)}
                >
                  <span
                    {...stylex.props(
                      styles.aspectSwatch,
                      active ? aspectSwatchStyles[a] : styles.aspectSwatchInactive,
                    )}
                    aria-hidden="true"
                  />
                  <span {...stylex.props(styles.aspectLabel)}>{a}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div {...stylex.props(styles.actions)} role="group" aria-label="System explorer actions">
          {focus ? (
            <button
              type="button"
              {...stylex.props(styles.clear)}
              aria-label="Clear focused node"
              onClick={() => setFocus(undefined)}
            >
              Clear focus
            </button>
          ) : null}
          {childParents.size > 0 ? (
            <button
              type="button"
              {...stylex.props(styles.clear)}
              aria-label={expanded.length ? 'Collapse all child nodes' : 'Expand all child nodes'}
              onClick={() => setExpanded((e) => (e.length ? [] : [...childParents]))}
            >
              {expanded.length ? 'Collapse all' : 'Expand all'}
            </button>
          ) : null}
        </div>
      </div>
      <div {...stylex.props(styles.canvas)}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          // oxlint-disable-next-line overeng/named-args -- React Flow `onNodeClick(event, node)` signature
          onNodeClick={(_, n) => setFocus((cur) => (cur === n.id ? undefined : n.id))}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color={tokens['--ds-gray-alpha-400']}
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}

/**
 * Props for the system explorer, identifying it, supplying the model and lens list plus a default
 * lens, and allowing an optional caption and container style.
 */
export interface SystemExplorerProps {
  readonly id: string
  readonly model: SystemModel
  readonly lenses: readonly SystemLens[]
  readonly defaultLensId?: string
  readonly caption?: string
  readonly style?: StyleXStylesWithout<{ containerName: string; containerType: string }>
}

// oxlint-disable-next-line overeng/exports-first -- public component composed from local views
/**
 * Renders the model through the selected system lens, degrading to an inline missing-lenses
 * message when the configured lens list is empty.
 */
export const SystemExplorer = ({
  id,
  model,
  lenses,
  defaultLensId,
  caption,
  style,
}: SystemExplorerProps) => {
  if (lenses.length === 0) {
    return (
      <div {...stylex.props(styles.missing, style)}>
        system-explorer: no lenses defined for "{id}"
      </div>
    )
  }
  return (
    <figure {...stylex.props(styles.figure, style)} id={id}>
      <ReactFlowProvider>
        <Inner model={model} lenses={lenses} defaultLensId={defaultLensId} />
      </ReactFlowProvider>
      {caption ? <figcaption {...stylex.props(styles.caption)}>{caption}</figcaption> : null}
    </figure>
  )
}

const aspectStyles = stylex.create({
  dataflow: {
    borderColor: tokens['--ds-blue-700'],
    color: tokens['--ds-blue-700'],
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-700) 10%, var(--ds-background-100))',
  },
  controlflow: {
    borderColor: tokens['--ds-amber-900'],
    color: tokens['--ds-amber-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-amber-900) 10%, var(--ds-background-100))',
  },
  ownership: {
    borderColor: tokens['--ds-green-900'],
    color: tokens['--ds-green-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-green-900) 10%, var(--ds-background-100))',
  },
  telemetry: {
    borderColor: tokens['--ds-red-900'],
    color: tokens['--ds-red-900'],
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 10%, var(--ds-background-100))',
  },
})

const aspectSwatchStyles = stylex.create({
  dataflow: { backgroundColor: tokens['--ds-blue-700'] },
  controlflow: { backgroundColor: tokens['--ds-amber-900'] },
  ownership: { backgroundColor: tokens['--ds-green-900'] },
  telemetry: { backgroundColor: tokens['--ds-red-900'] },
})

const edgeAspectStyles = stylex.create({
  dataflow: { stroke: tokens['--ds-blue-700'] },
  controlflow: { stroke: tokens['--ds-amber-900'] },
  ownership: { stroke: tokens['--ds-green-900'] },
  telemetry: { stroke: tokens['--ds-red-900'] },
})

const nodeLevelStyles = stylex.create({
  context: { borderLeftColor: tokens['--ds-blue-700'], borderLeftWidth: 3 },
  container: { borderLeftColor: tokens['--ds-amber-900'], borderLeftWidth: 3 },
  component: {},
})

const styles = stylex.create({
  figure: {
    containerType: 'inline-size',
    margin: 0,
  },
  root: {
    '--xy-background-color': tokens['--ds-background-100'],
    '--xy-node-border-default': 'transparent',
    '--xy-edge-stroke-default': tokens['--ds-gray-800'],
    '--xy-attribution-background-color-default': 'transparent',
    backgroundColor: tokens['--ds-background-200'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    borderStyle: 'solid',
    borderWidth: 1,
    overflow: 'hidden',
  },
  controls: {
    alignItems: 'center',
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderBottomColor: tokens['--ds-gray-alpha-400'],
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    paddingBlock: '0.5rem',
    paddingInline: '0.6rem',
  },
  aspectGroup: {
    alignItems: 'center',
    display: 'flex',
    flex: '1 1 24rem',
    gap: '0.45rem',
    minWidth: 0,
  },
  controlsLabel: {
    color: tokens['--ds-gray-800'],
    flex: '0 0 auto',
    fontSize: '0.72rem',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  aspectList: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    minWidth: 0,
  },
  aspect: {
    alignItems: 'center',
    backgroundColor: tokens['--ds-background-200'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-gray-900'],
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: '0.75rem',
    gap: '0.35rem',
    minHeight: '1.55rem',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: {
      default: null,
      ':focus-visible': 2,
    },
    outlineStyle: 'solid',
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
    paddingBlock: '0.18rem',
    paddingInline: '0.5rem',
    transition: {
      default: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  aspectSwatch: {
    borderRadius: scale.radiusFull,
    height: '0.48rem',
    opacity: 0.65,
    width: '0.48rem',
  },
  aspectSwatchInactive: {
    backgroundColor: tokens['--ds-gray-alpha-400'],
  },
  aspectLabel: {
    whiteSpace: 'nowrap',
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },
  clear: {
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-background-200'],
    },
    borderColor: {
      default: tokens['--ds-gray-alpha-400'],
      ':hover': tokens['--ds-gray-800'],
    },
    borderRadius: scale.radiusSm,
    borderStyle: 'dashed',
    borderWidth: 1,
    color: {
      default: tokens['--ds-gray-800'],
      ':hover': tokens['--ds-gray-900'],
    },
    cursor: 'pointer',
    fontSize: '0.72rem',
    minHeight: '1.55rem',
    outlineColor: tokens['--ds-focus-color'],
    outlineOffset: {
      default: null,
      ':focus-visible': 2,
    },
    outlineStyle: 'solid',
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
    paddingBlock: '0.18rem',
    paddingInline: '0.5rem',
  },
  canvas: {
    backgroundColor: tokens['--ds-background-100'],
    height: 'clamp(20rem, 56cqw, 26rem)',
    minWidth: 0,
  },
  caption: {
    color: tokens['--ds-gray-800'],
    fontSize: '0.82rem',
    marginTop: '0.5rem',
  },
  node: {
    backgroundColor: tokens['--ds-background-200'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusDefault,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-foreground'],
    fontSize: '0.8rem',
    minWidth: '11rem',
    paddingBlock: '0.45rem',
    paddingInline: '0.6rem',
    transition: {
      default: 'opacity 0.15s ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  nodeMuted: {
    opacity: 0.38,
  },
  nodeFocused: {
    borderColor: tokens['--ds-blue-700'],
    boxShadow: '0 0 0 2px var(--ds-focus-color)',
  },
  handle: {
    backgroundColor: tokens['--ds-gray-800'],
    borderColor: tokens['--ds-background-200'],
  },
  nodeHead: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'space-between',
  },
  nodeLabel: {
    fontWeight: 650,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  nodeDrill: {
    alignItems: 'center',
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-900) 4%, var(--ds-background-100))',
    borderColor: 'color-mix(in srgb, var(--ds-blue-700) 14%, var(--ds-gray-alpha-400))',
    borderRadius: scale.radiusFull,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-blue-700'],
    display: 'inline-flex',
    flex: '0 0 auto',
    fontSize: '0.82rem',
    height: '1rem',
    justifyContent: 'center',
    lineHeight: 1,
    width: '1rem',
  },
  nodeBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    marginTop: '0.3rem',
  },
  badge: {
    backgroundColor: tokens['--ds-gray-alpha-100'],
    borderColor: tokens['--ds-gray-alpha-400'],
    borderRadius: scale.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    color: tokens['--ds-gray-900'],
    fontSize: '0.62rem',
    letterSpacing: 0,
    paddingBlock: '0.05rem',
    paddingInline: '0.3rem',
    textTransform: 'uppercase',
  },
  levelBadge: {
    backgroundColor: 'color-mix(in srgb, var(--ds-blue-900) 4%, var(--ds-background-100))',
    color: tokens['--ds-blue-700'],
  },
  edge: {
    opacity: 0.9,
    strokeWidth: 1.5,
  },
  edgeMuted: {
    opacity: 0.3,
  },
  missing: {
    backgroundColor: 'color-mix(in srgb, var(--ds-red-900) 4%, var(--ds-background-100))',
    borderColor: tokens['--ds-red-900'],
    borderRadius: scale.radiusDefault,
    borderStyle: 'dashed',
    borderWidth: 1,
    color: tokens['--ds-red-900'],
    fontSize: '0.88rem',
    paddingBlock: '0.5rem',
    paddingInline: '0.75rem',
  },
})
