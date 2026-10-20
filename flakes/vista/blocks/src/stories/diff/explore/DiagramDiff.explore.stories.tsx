/**
 * Diagram lens exploration (`/sk-explore-variants`). Use the frame's Combined / Side by side
 * switch alongside the pickers; select a change in the list to highlight it in the graph.
 *
 * - C change styling: C1 tinted fill, C2 accent stroke + `+`/`−`/`~` label badge,
 *   C3 accent stroke with unchanged nodes and edges dimmed. Current default: C2.
 * - L change list: L1 beside the graph, L2 below it as a grid, L3 none (header counts only).
 *   Current default: L1.
 */
import type { Meta, StoryObj } from '@storybook/react'
import * as React from 'react'

import {
  DiagramDiff,
  type DiagramChangeList,
  type DiagramChangeStyle,
  type DiagramGraph,
} from '../../../blocks/diff/DiagramDiff.tsx'
import { type Variant, VariantPanel, VariantPicker } from '../../../explore.tsx'

type StyleId = 'C1' | 'C2' | 'C3'
type ListId = 'L1' | 'L2' | 'L3'

const styleVariants: readonly Variant<StyleId>[] = [
  { id: 'C1', description: 'Tinted node fill per change kind; thin accent stroke.' },
  {
    id: 'C2',
    description: 'Thick accent stroke plus a +/−/~ badge in the label (survives grayscale).',
  },
  { id: 'C3', description: 'Accent stroke on changes; everything unchanged fades back.' },
]
const listVariants: readonly Variant<ListId>[] = [
  { id: 'L1', description: 'Selectable change list in a column beside the graph.' },
  { id: 'L2', description: 'Change list below the graph as a grid; graph gets full width.' },
  { id: 'L3', description: 'No list; the frame header counts are the only summary.' },
]

const changeStyle: Readonly<Record<StyleId, DiagramChangeStyle>> = {
  C1: 'fill',
  C2: 'stroke',
  C3: 'dim',
}
const changeList: Readonly<Record<ListId, DiagramChangeList>> = {
  L1: 'side',
  L2: 'below',
  L3: 'none',
}

const topologyBefore: DiagramGraph = {
  nodes: [
    { id: 'web', label: 'Web app', group: 'edge' },
    { id: 'gw', label: 'API gateway', group: 'edge' },
    { id: 'auth', label: 'Auth service', group: 'services' },
    { id: 'catalog', label: 'Catalog API', group: 'services' },
    { id: 'stock', label: 'Stock service', group: 'services' },
    { id: 'db', label: 'Postgres', group: 'storage' },
    { id: 'queue', label: 'Event queue', group: 'messaging' },
    { id: 'search', label: 'Search indexer', group: 'jobs' },
  ],
  edges: [
    { from: 'web', to: 'gw', label: 'HTTPS' },
    { from: 'gw', to: 'auth', label: 'verify' },
    { from: 'gw', to: 'catalog', label: 'HTTP' },
    { from: 'catalog', to: 'db', label: 'query' },
    { from: 'catalog', to: 'stock', label: 'gRPC' },
    { from: 'stock', to: 'db', label: 'query' },
    { from: 'catalog', to: 'queue', label: 'publish' },
    { from: 'queue', to: 'search', label: 'consume' },
  ],
}

const topologyAfter: DiagramGraph = {
  nodes: [
    { id: 'web', label: 'Web app', group: 'edge' },
    { id: 'gw', label: 'API gateway', group: 'edge' },
    { id: 'auth', label: 'Auth service', group: 'services' },
    { id: 'catalog', label: 'Catalog API', group: 'services' },
    { id: 'stock', label: 'Inventory service', group: 'services' },
    { id: 'cache', label: 'Query cache', group: 'services' },
    { id: 'db', label: 'Postgres', group: 'storage' },
    { id: 'queue', label: 'Event queue', group: 'messaging' },
    { id: 'worker', label: 'Projection worker', group: 'jobs' },
  ],
  edges: [
    { from: 'web', to: 'gw', label: 'HTTPS' },
    { from: 'gw', to: 'auth', label: 'verify' },
    { from: 'gw', to: 'catalog', label: 'HTTP' },
    { from: 'catalog', to: 'cache', label: 'query' },
    { from: 'cache', to: 'db', label: 'miss' },
    { from: 'catalog', to: 'stock', label: 'gRPC' },
    { from: 'stock', to: 'db', label: 'query' },
    { from: 'catalog', to: 'queue', label: 'publish' },
    { from: 'queue', to: 'worker', label: 'consume' },
  ],
}

const DiagramExploration = () => {
  const [style, setStyle] = React.useState<StyleId>('C2')
  const [list, setList] = React.useState<ListId>('L1')
  return (
    <div>
      <VariantPanel>
        <VariantPicker
          label="Change styling"
          variants={styleVariants}
          value={style}
          onChange={setStyle}
        />
        <VariantPicker
          label="Change list"
          variants={listVariants}
          value={list}
          onChange={setList}
        />
      </VariantPanel>
      <DiagramDiff
        id="explore-diagram"
        title="Catalog platform topology"
        before={{
          label: 'Current',
          basis: 'observed',
          provenance: 'Synthetic service map · prod 2026-09-25',
        }}
        after={{
          label: 'Proposed',
          basis: 'projected',
          provenance: 'Synthetic RFC-118 target topology',
        }}
        beforeGraph={topologyBefore}
        afterGraph={topologyAfter}
        changeStyle={changeStyle[style]}
        changeList={changeList[list]}
      />
    </div>
  )
}

const meta = {
  title: 'Vista/Blocks/Diff/Explore/DiagramDiff',
  component: DiagramExploration,
} satisfies Meta
export default meta

/** Pick C/L variants above the live diagram lens. */
export const Exploration: StoryObj = { render: () => <DiagramExploration /> }
