import type { ELK, ElkNode } from 'elkjs/lib/elk-api.js'
/**
 * elkjs layout for the system-explorer scene. Layout runs only when the visible
 * node-set signature changes (structural zoom) — aspect toggles, focus, and mute
 * restyle the persistent scene without a relayout (the spike's measured finding).
 */
import * as ElkModule from 'elkjs/lib/elk.bundled.js'

import type { SystemLayout } from '../../model.ts'
import type { ProjectedScene } from './projection.ts'

// elkjs ships a UMD bundle whose CJS export IS the constructor. Under NodeNext
// the namespace import surfaces it as `.default`; the `.d.ts` types that default
// with a `new` signature, so construct through it.
const ElkConstructor = (ElkModule as unknown as { default: new () => ELK }).default

// Lazily constructed on first layout: `new ELK()` spins up a (fake) worker, which
// throws at import time in a non-browser realm. Deferring it keeps merely
// IMPORTING the kit barrel side-effect-free, so Node/Bun consumers (e.g. the
// `vista` CLI) can load the package without triggering elk's worker.
let elkInstance: ELK | undefined
const getElk = (): ELK => (elkInstance ??= new ElkConstructor())

const NODE_W = 200
const NODE_H = 64

// Edge-label sizing. React Flow paints nodes above edges, so a label centered on
// a short between-layer edge is occluded by the adjacent node. We hand elk each
// label's measured box and place it centered on the edge; elk then reserves the
// horizontal room (between-layer spacing grows to fit), keeping labels in the gap
// rather than under a node. Width is estimated from the glyph count at the label
// font-size (0.7rem ≈ 11px, ~6.2px/char) plus the chip's horizontal padding.
const EDGE_LABEL_CHAR_W = 5.6
const EDGE_LABEL_PAD = 12
const EDGE_LABEL_H = 18
const edgeLabelWidth = (label: string): number =>
  Math.ceil(label.length * EDGE_LABEL_CHAR_W) + EDGE_LABEL_PAD

/** A node's computed position in the laid-out scene. */
export interface Positioned {
  readonly id: string
  readonly x: number
  readonly y: number
}

const directionOf = (layout: SystemLayout): string => (layout === 'layered-down' ? 'DOWN' : 'RIGHT')

/** Compute node positions for the scene's visible nodes via elk's layered layout. */
export const layoutScene = async ({
  scene,
  layout,
}: {
  scene: ProjectedScene
  layout: SystemLayout
}): Promise<readonly Positioned[]> => {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': directionOf(layout),
      'elk.spacing.nodeNode': '24',
      // Wider base gap so labeled edges have room; elk grows it further per
      // edge from the label boxes below.
      'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.spacing.edgeLabel': '6',
      'elk.edgeLabels.placement': 'CENTER',
    },
    children: scene.nodes.map((n) => ({ id: n.node.id, width: NODE_W, height: NODE_H })),
    edges: scene.edges.map((e, i) => ({
      id: `e${i}`,
      sources: [e.edge.source],
      targets: [e.edge.target],
      ...(e.edge.label
        ? {
            labels: [
              { text: e.edge.label, width: edgeLabelWidth(e.edge.label), height: EDGE_LABEL_H },
            ],
          }
        : {}),
    })),
  }
  const laid = await getElk().layout(graph)
  return (laid.children ?? []).map((c: ElkNode) => ({ id: c.id, x: c.x ?? 0, y: c.y ?? 0 }))
}

export { NODE_W, NODE_H }
