/**
 * Pure projection for the system-explorer (decision 0018, spike model).
 *
 * `(model, lens) -> ProjectedScene` never mutates the model. The aspect toggle
 * is `edges.filter(e => active.has(e.aspect))` over a persistent node-set;
 * focus+context and attribute-mute are render hints (faded), NOT structural —
 * so toggling them holds the elk layout constant. Only the visible node-set
 * (semantic zoom: `maxLevel` floor + per-node `expanded` drill) is structural
 * and changes the layout signature.
 */
import type {
  SystemAspect,
  SystemEdge,
  SystemLevel,
  SystemLens,
  SystemModel,
  SystemNode,
} from '../../model.ts'

const LEVEL_RANK: Record<SystemLevel, number> = { context: 0, container: 1, component: 2 }

/** A node placed into the scene with its render hints resolved. */
export interface SceneNode {
  readonly node: SystemNode
  /** Faded by focus+context or attribute-mute (a render hint, not structural). */
  readonly muted: boolean
  /** The focused node itself (bright, emphasized). */
  readonly focused: boolean
}

/** An edge placed into the scene with its mute hint resolved. */
export interface SceneEdge {
  readonly edge: SystemEdge
  readonly muted: boolean
}

/** The resolved scene a lens projects from a model: visible nodes + edges. */
export interface ProjectedScene {
  readonly nodes: readonly SceneNode[]
  readonly edges: readonly SceneEdge[]
  /**
   * Stable signature of the visible node-set + layout direction. elk relayout
   * runs only when this changes (structural zoom), not on aspect/focus/mute.
   */
  readonly layoutSignature: string
}

/**
 * The set of nodes visible at this zoom: every node at or above the `maxLevel`
 * floor, plus the children of any explicitly `expanded` node (local drill). A
 * node is shown unless a visible ancestor hides it below the floor.
 */
const visibleNodeIds = ({
  model,
  lens,
}: {
  model: SystemModel
  lens: SystemLens
}): ReadonlySet<string> => {
  const byId = new Map(model.nodes.map((n) => [n.id, n]))
  const expanded = new Set(lens.expanded ?? [])
  const floor = LEVEL_RANK[lens.maxLevel]
  const visible = new Set<string>()
  for (const node of model.nodes) {
    const rank = LEVEL_RANK[node.level]
    if (rank <= floor) {
      visible.add(node.id)
      continue
    }
    // Below the floor: shown only if every ancestor up to a visible one is expanded.
    let cursor: SystemNode | undefined = node
    let drilled = true
    while (cursor?.parent) {
      const parent = byId.get(cursor.parent)
      if (!parent) break
      if (LEVEL_RANK[parent.level] <= floor) {
        // The nearest above-floor ancestor must be expanded to reveal this node.
        if (!expanded.has(parent.id)) drilled = false
        break
      }
      if (!expanded.has(parent.id)) {
        drilled = false
        break
      }
      cursor = parent
    }
    if (drilled) visible.add(node.id)
  }
  return visible
}

/**
 * Reroute an edge whose endpoint is hidden up to its nearest visible ancestor,
 * so a container-level overview still shows cross-container relationships.
 * Returns null if either end has no visible representative.
 */
const liftEndpoint = ({
  visible,
  byId,
  nodeId,
}: {
  visible: ReadonlySet<string>
  byId: ReadonlyMap<string, SystemNode>
  nodeId: string
}): string | null => {
  let cursor: SystemNode | undefined = byId.get(nodeId)
  while (cursor) {
    if (visible.has(cursor.id)) return cursor.id
    cursor = cursor.parent ? byId.get(cursor.parent) : undefined
  }
  return null
}

/** The focus neighborhood: the focused node plus its direct graph neighbors. */
const focusNeighborhood = ({
  edges,
  focus,
}: {
  edges: readonly SceneEdge[]
  focus: string
}): ReadonlySet<string> => {
  const near = new Set<string>([focus])
  for (const { edge } of edges) {
    if (edge.source === focus) near.add(edge.target)
    if (edge.target === focus) near.add(edge.source)
  }
  return near
}

/** Project a `(model, lens)` pair into a renderable, pure `ProjectedScene`. */
export const project = ({
  model,
  lens,
}: {
  model: SystemModel
  lens: SystemLens
}): ProjectedScene => {
  const byId = new Map(model.nodes.map((n) => [n.id, n]))
  const visible = visibleNodeIds({ model, lens })
  const active = new Set<SystemAspect>(lens.aspects)

  // Aspect toggle + endpoint lifting → a deduped set of scene edges.
  const seen = new Set<string>()
  const rawEdges: SceneEdge[] = []
  for (const edge of model.edges) {
    if (!active.has(edge.aspect)) continue
    const source = liftEndpoint({ visible, byId, nodeId: edge.source })
    const target = liftEndpoint({ visible, byId, nodeId: edge.target })
    if (source === null || target === null || source === target) continue
    const key = `${source}->${target}:${edge.aspect}`
    if (seen.has(key)) continue
    seen.add(key)
    rawEdges.push({ edge: { ...edge, source, target }, muted: false })
  }

  // Focus+context and attribute-mute are render hints over the persistent scene.
  const near = lens.focus ? focusNeighborhood({ edges: rawEdges, focus: lens.focus }) : null
  const isMuted = (node: SystemNode): boolean => {
    if (near && !near.has(node.id)) return true
    if (lens.muteBy) {
      const value = node[lens.muteBy.key]
      if (value !== lens.muteBy.keep) return true
    }
    return false
  }

  const nodes: SceneNode[] = [...visible]
    .map((id) => byId.get(id))
    .filter((n): n is SystemNode => n !== undefined)
    .map((node) => ({ node, muted: isMuted(node), focused: lens.focus === node.id }))

  const edges: SceneEdge[] = rawEdges.map((se) => ({
    edge: se.edge,
    muted: isMuted(byId.get(se.edge.source)!) || isMuted(byId.get(se.edge.target)!),
  }))

  const layoutSignature = `${lens.layout}|${[...visible].toSorted().join(',')}`
  return { nodes, edges, layoutSignature }
}
