import { Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, expectTypeOf, test } from 'vitest'

import { extractSemanticProjection, useDataBinding } from './authoring.tsx'
import { bind, contract, Cursor, Operation, subscription } from './data-contract.ts'
import { isVistaDraftRoute } from './data-query.tsx'
import {
  AppRoot,
  AgentTimelineQuery,
  Decision,
  Evidence,
  MetricQuery,
  ProfileQuery,
  PullRequestFiles,
  PullRequestOverview,
  Ref,
  RuntimeIsland,
  Section,
  TraceQuery,
  TraceSearch,
  SemanticManifestSchema,
  extractSemanticManifest,
  validatePatch,
  type DecisionProps,
} from './index.ts'

const Review = () => (
  <AppRoot title="Direct React" template="architecture-review" scope="One source">
    <Section>
      <Evidence id="proof">measured</Evidence>
      <Decision id="choice" status="locked">
        <Ref target="proof" />
        <MetricQuery query="rate(http_requests_total[5m])" stepSeconds={60} points={30} />
      </Decision>
    </Section>
  </AppRoot>
)

const SubscriptionState = Schema.Struct({
  cursor: Schema.String,
  count: Schema.Finite,
})
const SubscriptionEvent = Schema.TaggedStruct('Synced', {
  state: SubscriptionState,
})
const SubscriptionApi = RpcGroup.make(
  Rpc.make('watch', {
    payload: {
      id: Schema.String,
      since: Schema.optionalKey(Cursor),
    },
    success: SubscriptionEvent,
    error: Schema.String,
    stream: true,
  }),
)
const subscriptionBase = contract({ id: 'subscription-authoring', group: SubscriptionApi })
const subscriptionOperation = subscription(subscriptionBase.ops.watch, {
  stateSchema: SubscriptionState,
  eventSchema: SubscriptionEvent,
  fold: (_state, event) => event.state,
  cursor: (state) => state.cursor,
})
const subscriptionArgs = { id: 'manifest-binding' }
Reflect.set(subscriptionArgs, 'since', undefined)
const manifestSubscriptionBinding = bind(subscriptionOperation, subscriptionArgs, {
  mode: 'subscription',
})
const ManifestSubscription = () => {
  useDataBinding(manifestSubscriptionBinding)
  return null
}

const DerivedApi = RpcGroup.make(
  Rpc.make('read', {
    payload: { id: Schema.String },
    success: Schema.String,
  }),
)
const derivedProvider = contract({ id: 'derived-authoring', group: DerivedApi })
const mappedParent = Operation.map(derivedProvider.ops.read, {
  id: 'derived.parent-map/v1',
  payloadSchema: Schema.Struct({ id: Schema.String }),
  successSchema: Schema.String,
  mapArgs: (args) => args,
  map: (value) => `${value}-mapped`,
})
const dependent = Operation.flatMap(
  mappedParent,
  (value) => bind(derivedProvider.ops.read, { id: value }),
  { id: 'derived.child/v1', successSchema: Schema.String },
)
const mappedDependent = Operation.map(dependent, {
  id: 'derived.result-map/v1',
  payloadSchema: Schema.Struct({ id: Schema.String }),
  successSchema: Schema.String,
  mapArgs: (args) => args,
  map: (value) => value,
})
const DerivedBinding = () => {
  useDataBinding(bind(mappedDependent, { id: 'parent' }))
  return null
}

test('extracts typed decisions, structural sections, references, and domain bindings', () => {
  expect(extractSemanticManifest(<Review />)).toEqual({
    schemaVersion: 2,
    app: {
      id: 'app',
      title: 'Direct React',
      template: 'architecture-review',
      scope: 'One source',
      status: { locked: 1, open: 0, awaiting: 0 },
    },
    nodes: [
      { id: 'app', kind: 'app', refs: [], bindings: [] },
      { id: 'proof', kind: 'evidence', parentId: 'app', refs: [], bindings: [] },
      {
        id: 'choice',
        kind: 'decision',
        parentId: 'app',
        status: 'locked',
        refs: ['proof'],
        bindings: [
          {
            provider: 'otel',
            operation: 'query',
            args: {
              promql: 'rate(http_requests_total[5m])',
              range: { kind: 'relative', last: '1h' },
              stepSeconds: 60,
              points: 30,
            },
            policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
          },
        ],
      },
    ],
  })
})

test('excludes subscription since hints before manifest payload encoding', () => {
  const manifest = extractSemanticManifest(
    <AppRoot title="Subscription manifest" template="architecture-review" scope="test">
      <Evidence id="subscription">
        <ManifestSubscription />
      </Evidence>
    </AppRoot>,
  )
  const evidence = manifest.nodes.find(({ id }) => id === 'subscription')

  expect(evidence?.bindings).toEqual([
    {
      provider: 'subscription-authoring',
      operation: 'watch',
      args: { id: 'manifest-binding' },
      policy: { mode: 'subscription' },
    },
  ])
})

test('records flatMap dependencies beneath map and maps the parent before selection', () => {
  const projection = extractSemanticProjection(
    <AppRoot title="Derived manifest" template="architecture-review" scope="test">
      <Evidence id="derived">
        <DerivedBinding />
      </Evidence>
    </AppRoot>,
  )
  const binding = projection.manifest.nodes.find(({ id }) => id === 'derived')?.bindings[0]
  expect(binding?.dependency).toEqual(
    expect.objectContaining({
      _tag: 'flatMap',
      id: 'derived.child/v1',
    }),
  )
  const edge = binding?.dependency?.edge
  expect(edge).toBeTypeOf('string')
  if (edge === undefined) return
  const selector = projection.capturePlan.flatMapSelectors.get(edge)
  expect(selector?.('raw').args).toEqual({ id: 'raw-mapped' })
})

test('optional labels reach the manifest and the DOM without breaking older apps', () => {
  const Labelled = () => (
    <AppRoot title="Labelled" template="architecture-review" scope="One source">
      <Section id="lineage" label="Where this came from">
        <Evidence id="proof" label="Measured proof">
          measured
        </Evidence>
        <Decision id="choice" status="open" label="Transport" />
        <RuntimeIsland id="live" label="Live trace" />
      </Section>
    </AppRoot>
  )

  const manifest = extractSemanticManifest(<Labelled />)
  expect(manifest.nodes.map((node) => [node.id, Reflect.get(node, 'label')])).toEqual([
    ['app', undefined],
    ['lineage', 'Where this came from'],
    ['proof', 'Measured proof'],
    ['choice', 'Transport'],
    ['live', 'Live trace'],
  ])

  const html = renderToStaticMarkup(<Labelled />)
  expect(html).toContain('id="lineage" data-vista-id="lineage" data-vista-kind="section"')
  expect(html).toContain('data-vista-label="Where this came from"')
  expect(html).toContain('data-vista-label="Live trace"')

  // Labels remain optional in the current manifest generation.
  const unlabelled = {
    ...manifest,
    nodes: manifest.nodes.map(({ label: _label, ...node }) => node),
  }
  expect(Schema.decodeSync(SemanticManifestSchema)(unlabelled).nodes).toHaveLength(5)
})

test('semantic labels derive heading rank from nesting depth and expose chrome hooks', () => {
  const Ranked = () => (
    <AppRoot title="Ranked" template="architecture-review" scope="Depth is structure">
      <Section id="top" label="Top">
        <p>Measured prose.</p>
        <Section id="nested" label="Nested">
          <Evidence id="deep" label="Deep">
            evidence
          </Evidence>
          <Decision id="signed" status="locked" label="Nested sign-off">
            agreed
          </Decision>
        </Section>
      </Section>
      <Decision id="verdict" status="open" label="Top-level verdict">
        pending
      </Decision>
    </AppRoot>
  )

  const html = renderToStaticMarkup(<Ranked />)
  expect(html).toContain('<header data-vista-app-header="">')
  expect(html).toContain('<h1 data-vista-app-title="">Ranked</h1>')
  expect(html).toMatch(
    /<h2 data-vista-node-label="section" data-vista-heading-level="2">Top<\/h2>/u,
  )
  expect(html).toMatch(
    /<h3 data-vista-node-label="section" data-vista-heading-level="3">Nested<\/h3>/u,
  )
  expect(html).toMatch(/<h4 data-vista-node-label="node" data-vista-heading-level="4">Deep<\/h4>/u)
  expect(html).toContain('data-vista-depth="0"')
  expect(html).toContain('data-vista-depth="1"')
  expect(html).toMatch(
    /<h2 data-vista-decision-title="" data-vista-heading-level="2">Top-level verdict<\/h2>/u,
  )
  expect(html).toMatch(
    /<h4 data-vista-decision-title="" data-vista-heading-level="4">Nested sign-off<\/h4>/u,
  )
})

test('rejects duplicate IDs, dangling references, and unknown decision statuses', () => {
  const Invalid = () => (
    <AppRoot title="Invalid" template="architecture-review" scope="red control">
      <Decision id="same" status="open" refs={['missing']} />
      <Evidence id="same" />
    </AppRoot>
  )
  expect(() => extractSemanticManifest(<Invalid />)).toThrow(/duplicate semantic id/)

  const invalidManifest = extractSemanticManifest(<Review />)
  const decision = invalidManifest.nodes.find((node) => node.kind === 'decision')!
  expect(() =>
    Schema.decodeSync(SemanticManifestSchema)({
      ...invalidManifest,
      nodes: invalidManifest.nodes.map((node) =>
        node === decision ? Object.assign({}, node, { status: 'settled' }) : node,
      ),
    }),
  ).toThrow()
  expectTypeOf<{
    readonly id: string
    readonly status: 'settled'
  }>().not.toMatchTypeOf<DecisionProps>()
})

test('every shipped provider operation has a typed domain-owned binding', () => {
  const DataReview = () => (
    <AppRoot title="Provider contracts" template="telemetry-exploration" scope="typed domain props">
      <Evidence id="providers">
        <PullRequestOverview repo="schickling/dotfiles" pr={1506} />
        <PullRequestFiles repo="schickling/dotfiles" pr={1506} />
        <MetricQuery query="up" />
        <AgentTimelineQuery horizon="1h" />
        <TraceQuery traceId="abc123" />
        <TraceSearch query="{ resource.service.name = `vista` }" limit={5} />
        <ProfileQuery
          profileTypeId="process_cpu:cpu:nanoseconds:cpu:nanoseconds"
          from={1_000}
          until={2_000}
        />
      </Evidence>
    </AppRoot>
  )
  const providers = extractSemanticManifest(<DataReview />).nodes.find(
    (node) => node.id === 'providers',
  )!
  expect(providers.bindings).toEqual([
    {
      provider: 'overview',
      operation: 'get',
      args: { repo: 'schickling/dotfiles', pr: 1506 },
      policy: { mode: 'frozen' },
    },
    {
      provider: 'gh',
      operation: 'changedFiles',
      args: { repo: 'schickling/dotfiles', pr: 1506 },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    },
    {
      provider: 'otel',
      operation: 'query',
      args: { promql: 'up', range: { kind: 'relative', last: '1h' }, stepSeconds: 60, points: 61 },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    },
    {
      provider: 'agent-timeline',
      operation: 'load',
      args: { horizon: '1h' },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    },
    {
      provider: 'trace',
      operation: 'getTrace',
      args: { traceId: 'abc123' },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    },
    {
      provider: 'trace',
      operation: 'searchTraces',
      args: { query: '{ resource.service.name = `vista` }', limit: 5 },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    },
    {
      provider: 'pyroscope',
      operation: 'getProfile',
      args: {
        profileTypeId: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds',
        labelSelector: '{}',
        from: 1_000,
        until: 2_000,
      },
      policy: { mode: 'frozen', effectfulCapture: 'acknowledged' },
    },
  ])
})

test('permits live Provider calls only on owner-scoped draft routes', () => {
  expect(isVistaDraftRoute('/r/dev3.agent/review/draft/')).toBe(true)
  expect(isVistaDraftRoute('/r/dev3.agent/review/draft/@id/virtual:vista-draft-entry.tsx')).toBe(
    true,
  )
  expect(isVistaDraftRoute('/r/dev3.agent/review/latest')).toBe(false)
  expect(isVistaDraftRoute('/r/dev3.agent/review/v2/')).toBe(false)
  expect(isVistaDraftRoute('/r/review/draft/')).toBe(false)
})

test('validates hand-authored unified diff hunk lengths', () => {
  expect(validatePatch('@@ -1 +1 @@\n-old\n+new\n')).toEqual([])
  expect(validatePatch('@@ -1,2 +1 @@\n-old\n+new\n')).toEqual([
    expect.objectContaining({ _tag: 'hunk-count-mismatch', side: 'old' }),
  ])
})
