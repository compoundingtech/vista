import type { Meta, StoryObj } from '@storybook/react'

import { DiagramDiff, type DiagramGraph } from '../../blocks/diff/DiagramDiff.tsx'
import { DiffFrame } from '../../blocks/diff/DiffFrame.tsx'
import { TraceDiff } from '../../blocks/diff/TraceDiff.tsx'
import type { TraceData, TraceSpan } from '../../model.ts'

const observed = {
  label: 'Before',
  basis: 'observed' as const,
  provenance: 'Synthetic capture · morning',
}
const projected = {
  label: 'After',
  basis: 'projected' as const,
  provenance: 'Synthetic migration rehearsal',
}

const ms = (value: number) => String(BigInt(value) * 1_000_000n)
const span = (
  spanId: string,
  parentSpanId: string,
  serviceName: string,
  name: string,
  start: number,
  end: number,
  extra: Partial<TraceSpan> = {},
): TraceSpan => ({
  spanId,
  parentSpanId,
  serviceName,
  name,
  startTimeUnixNano: ms(start),
  endTimeUnixNano: ms(end),
  ...extra,
})

const requestBefore: TraceData = {
  traceId: 'synthetic-request-before',
  spans: [
    span('root-a', '', 'gateway', 'GET /catalog', 0, 150),
    span('auth-a', 'root-a', 'identity', 'check session', 7, 25),
    span('query-a', 'root-a', 'catalog', 'SELECT products', 30, 100, {
      attributes: [
        { key: 'db.system', value: 'postgres' },
        { key: 'db.rows', value: '8' },
      ],
    }),
    span('render-a', 'root-a', 'gateway', 'render response', 110, 140),
  ],
}
const requestAfter: TraceData = {
  traceId: 'synthetic-request-after',
  spans: [
    span('root-b', '', 'gateway', 'GET /catalog', 0, 360),
    span('auth-b', 'root-b', 'identity', 'check session', 7, 26),
    span('cache-b', 'root-b', 'cache', 'GET product index', 27, 38),
    span('query-b', 'root-b', 'catalog', 'SELECT products', 42, 320, {
      attributes: [
        { key: 'db.system', value: 'postgres' },
        { key: 'db.rows', value: '158' },
      ],
    }),
    span('render-b', 'root-b', 'gateway', 'render response', 325, 350),
  ],
}
const requestError: TraceData = {
  traceId: 'synthetic-request-error',
  spans: requestAfter.spans.map((s) =>
    s.name === 'SELECT products'
      ? {
          ...s,
          statusCode: 'STATUS_CODE_ERROR',
          events: [{ name: 'timeout', timeUnixNano: ms(320) }],
        }
      : s,
  ),
}
const requestTiny: TraceData = {
  traceId: 'synthetic-request-tiny',
  spans: requestBefore.spans.map((s) =>
    s.name === 'SELECT products' ? { ...s, endTimeUnixNano: ms(101) } : s,
  ),
}
const requestMoved: TraceData = {
  traceId: 'synthetic-request-moved',
  spans: requestBefore.spans.map((s) =>
    s.name === 'SELECT products' ? { ...s, parentSpanId: 'auth-a' } : s,
  ),
}

const traceMeta = {
  title: 'Vista/Blocks/Diff/TraceDiagram',
  component: TraceDiff,
  args: {
    id: 'trace-default',
    title: 'Catalog request',
    before: observed,
    after: projected,
    beforeTrace: requestBefore,
    afterTrace: requestAfter,
  },
} satisfies Meta<typeof TraceDiff>
export default traceMeta

type TraceStory = StoryObj<typeof traceMeta>

/** Query duration regresses; the cache span appears and one attribute changes. */
export const RequestRegression: TraceStory = {}
/** Two row-aligned waterfalls on a shared time axis. */
export const SplitWaterfalls: TraceStory = {
  args: { id: 'trace-split', defaultArrangement: 'split' },
}
/** Sorted by regression and filtered to changed spans only: the largest regressions first. */
export const LargestRegression: TraceStory = {
  args: { id: 'trace-sorted', defaultSort: 'regression', defaultChangedOnly: true },
}
/** The `SELECT products` span comes back as an error with a timeout event. */
export const ErrorIntroduced: TraceStory = {
  args: { id: 'trace-error', title: 'Query failure', afterTrace: requestError },
}
/** Same trace on both sides, so nothing is marked and the lens stays quiet. */
export const Identical: TraceStory = {
  args: { id: 'trace-identical', afterTrace: requestBefore, after: observed },
}
/** A 1 ms duration tweak that falls under the regression threshold and is filtered out. */
export const BelowThreshold: TraceStory = {
  args: { id: 'trace-small-change', afterTrace: requestTiny },
}
/** No before trace at all: every after span reads as added. */
export const AddedOnly: TraceStory = {
  args: {
    id: 'trace-added-only',
    beforeTrace: { traceId: 'empty', spans: [] },
    afterTrace: requestAfter,
  },
}
/** No after trace at all: every before span reads as removed. */
export const RemovedOnly: TraceStory = {
  args: {
    id: 'trace-removed-only',
    beforeTrace: requestBefore,
    afterTrace: { traceId: 'empty', spans: [] },
  },
}
/** The `SELECT products` span is reparented under the session check. */
export const ReparentedSpan: TraceStory = {
  args: { id: 'trace-reparented', afterTrace: requestMoved },
}

const graphBefore: DiagramGraph = {
  nodes: [
    { id: 'edge', label: 'API gateway', group: 'edge' },
    { id: 'catalog', label: 'Catalog API', group: 'services' },
    { id: 'store', label: 'Product store', group: 'storage' },
  ],
  edges: [
    { from: 'edge', to: 'catalog', label: 'HTTP' },
    { from: 'catalog', to: 'store', label: 'query' },
  ],
}
const graphAfter: DiagramGraph = {
  nodes: [
    { id: 'edge', label: 'API gateway', group: 'edge' },
    { id: 'catalog', label: 'Catalog API', group: 'services' },
    { id: 'cache', label: 'Query cache', group: 'services' },
    { id: 'store', label: 'Product store', group: 'storage' },
  ],
  edges: [
    { from: 'edge', to: 'catalog', label: 'HTTP' },
    { from: 'catalog', to: 'cache', label: 'query' },
    { from: 'cache', to: 'store', label: 'miss' },
  ],
}
const graphChanged: DiagramGraph = {
  nodes: graphBefore.nodes.map((node) =>
    node.id === 'catalog' ? { ...node, label: 'Inventory API', group: 'compute' } : node,
  ),
  edges: graphBefore.edges,
}

/** Composable story: both nested lenses inherit the outer frame's side-by-side arrangement. */
export const NestedDiagramInTrace: TraceStory = {
  render: (args) => (
    <DiffFrame
      id="nested-trace-diagram"
      title="Synthetic request and deployment topology"
      lens="review"
      before={observed}
      after={projected}
      defaultArrangement="split"
    >
      <TraceDiff {...args} id="nested-trace" nested title="Request waterfall" />
      <DiagramDiff
        id="nested-diagram"
        nested
        title="Service topology"
        before={observed}
        after={projected}
        beforeGraph={graphBefore}
        afterGraph={graphAfter}
      />
    </DiffFrame>
  ),
}

/** Independent diagram stories share this file while keeping the required title hierarchy. */
export const DiagramAddedService = () => (
  <DiagramDiff
    id="diagram-added"
    title="Catalog service topology"
    before={observed}
    after={projected}
    beforeGraph={graphBefore}
    afterGraph={graphAfter}
  />
)
DiagramAddedService.storyName = 'Diagram · added service and reroute'

/** The added-cache-node topology in split arrangement, for comparing both graphs at once. */
export const DiagramSplit = () => (
  <DiagramDiff
    id="diagram-split"
    title="Catalog service topology"
    before={observed}
    after={projected}
    beforeGraph={graphBefore}
    afterGraph={graphAfter}
    defaultArrangement="split"
  />
)
DiagramSplit.storyName = 'Diagram · side by side'

/** The catalog node is renamed and moved to another group; edges are untouched. */
export const DiagramChangedNode = () => (
  <DiagramDiff
    id="diagram-changed"
    title="Service rename and regroup"
    before={observed}
    after={projected}
    beforeGraph={graphBefore}
    afterGraph={graphChanged}
  />
)
DiagramChangedNode.storyName = 'Diagram · changed node'

/** Identical graph on both sides: no marks, used as the diagram baseline. */
export const DiagramIdentical = () => (
  <DiagramDiff
    id="diagram-identical"
    title="No topology change"
    before={observed}
    after={observed}
    beforeGraph={graphBefore}
    afterGraph={graphBefore}
  />
)
DiagramIdentical.storyName = 'Diagram · identical'

/** Empty before graph: gateway, catalog and store all read as newly added. */
export const DiagramAddedOnly = () => (
  <DiagramDiff
    id="diagram-add-only"
    title="New topology"
    before={observed}
    after={projected}
    beforeGraph={{ nodes: [], edges: [] }}
    afterGraph={graphBefore}
  />
)
DiagramAddedOnly.storyName = 'Diagram · added only'

/** Empty after graph: the whole topology reads as decommissioned. */
export const DiagramRemovedOnly = () => (
  <DiagramDiff
    id="diagram-remove-only"
    title="Decommissioned topology"
    before={observed}
    after={projected}
    beforeGraph={graphBefore}
    afterGraph={{ nodes: [], edges: [] }}
  />
)
DiagramRemovedOnly.storyName = 'Diagram · removed only'
