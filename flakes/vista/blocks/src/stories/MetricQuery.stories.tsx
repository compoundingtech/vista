import type { Meta, StoryObj } from '@storybook/react'
import { Context, Effect, Layer, Schema } from 'effect'
import { HttpRouter } from 'effect/http'
import { layerJson } from 'effect/rpc/RpcSerialization'
import * as RpcServer from 'effect/rpc/RpcServer'
import { expect, waitFor, within } from 'storybook/test'

import { AppRoot, Evidence } from '../authoring.tsx'
import { MetricQuery, type MetricQueryProps } from '../data-components.tsx'
import { bind, DataRuntimeProvider, encodeBinding, type Snapshot } from '../data-query.tsx'
import {
  MetricSnapshot,
  otel,
  OtelApi,
  QueryResult,
  Sample,
  Series,
} from '../provider-contracts.ts'

const frozenAt = '2026-09-20T10:00:00.000Z'
const range = { kind: 'relative', last: '5m' } as const
const makeMetricValue = (capturedAt: number) =>
  Schema.decodeSync(MetricSnapshot)({
    capturedAt,
    requestedRange: range,
    resolvedRange: { kind: 'absolute', start: capturedAt - 300, end: capturedAt },
    query: 'up',
    stepSeconds: 60,
    points: 6,
    result: new QueryResult({
      query: 'up',
      series: [
        new Series({
          metric: 'up',
          labels: { job: 'vista-fixture' },
          samples: [
            new Sample({ t: capturedAt - 300, v: 1 }),
            new Sample({ t: capturedAt - 180, v: 0.8 }),
            new Sample({ t: capturedAt, v: 1 }),
          ],
        }),
      ],
    }),
  })
const metricValue = makeMetricValue(1_789_898_400)
const liveMetricValue = makeMetricValue(1_789_898_460)
const snapshotBinding = bind(otel.ops.query, {
  promql: 'up',
  range,
  stepSeconds: 60,
  points: 6,
})
const encoded = Effect.runSync(encodeBinding(snapshotBinding))
const snapshot: Snapshot = {
  apiVersion: 2,
  frozenAt,
  entries: {
    [encoded.key]: {
      provider: 'otel',
      operation: 'query',
      encodedArgs: encoded.encodedArgs,
      encodedValue: Schema.encodeSync(MetricSnapshot)(metricValue),
      capturedAt: frozenAt,
    },
  },
}

const liveHandler = HttpRouter.toWebHandler(
  RpcServer.layerHttp({ group: OtelApi, path: '/story/otel', protocol: 'http' }).pipe(
    Layer.provide(
      Layer.mergeAll(
        OtelApi.toLayer({
          query: () => Effect.succeed(liveMetricValue),
        }),
        layerJson,
        HttpRouter.layer,
      ),
    ),
  ),
  { disableLogger: true },
)
const storyFetch: typeof globalThis.fetch = (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  return liveHandler.handler(request, Context.empty())
}

const MetricStory = (props: MetricQueryProps) => (
  <DataRuntimeProvider
    appVersionId="storybook/metric-query/v1"
    snapshot={snapshot}
    dataBaseUrl="http://vista.test/story/"
    fetch={storyFetch}
  >
    <AppRoot title="Metric query" template="telemetry-exploration" scope="story">
      <Evidence id="metric-query">
        <MetricQuery {...props} />
      </Evidence>
    </AppRoot>
  </DataRuntimeProvider>
)

const meta = {
  title: 'Vista/Blocks/Telemetry/MetricQuery',
  component: MetricQuery,
  args: { query: 'up', range, stepSeconds: 60, points: 6 },
  render: (args) => <MetricStory {...args} />,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MetricQuery>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Freezes the query at a pinned window and asserts via interaction that the resolved/sample
 * timestamps and point-in-time copy badge render.
 */
export const Frozen: Story = {
  args: { mode: 'frozen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        /requested last 5m · resolved 2026-09-20T09:55:00\.000Z → 2026-09-20T10:00:00\.000Z · samples 2026-09-20T09:55:00\.000Z → 2026-09-20T10:00:00\.000Z/,
      ),
    ).toBeVisible()
    await waitFor(
      () => expect(canvas.getByTitle('point-in-time copy captured at publish')).toBeVisible(),
      { timeout: 10_000 },
    )
  },
}
/**
 * Runs the query in live mode with a ten-second refresh and asserts the just-fetched badge and
 * advancing window bounds appear.
 */
export const Live: Story = {
  args: { mode: 'live', refreshEvery: 10_000 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(
      () => expect(canvas.getByTitle('fetched from the live provider just now')).toBeVisible(),
      { timeout: 10_000 },
    )
    await expect(
      canvas.getByText(
        /resolved 2026-09-20T09:56:00\.000Z → 2026-09-20T10:01:00\.000Z · samples 2026-09-20T09:56:00\.000Z → 2026-09-20T10:01:00\.000Z/,
      ),
    ).toBeVisible()
  },
}
/** Stacks frozen and live modes in one grid so both refresh behaviors can be reviewed side by side. */
export const AllStates: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 24 }}>
      <MetricStory {...args} mode="frozen" />
      <MetricStory {...args} mode="live" refreshEvery={10_000} />
    </div>
  ),
}
