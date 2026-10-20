import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import type {
  InspectorSnapshotFrame,
  InspectorWatchFrame,
  RpcDescriptorWire,
  RpcRecord,
} from '@overeng/effect-rpc-explorer'
import type { ExplorerClient } from '@overeng/effect-rpc-explorer'

import { AppShell } from '../AppShell.tsx'
import { AppRoot, Section } from '../authoring.tsx'
import { grafanaTraceUrl } from '../grafana-trace-url.ts'
import { makeAppFrameFilter } from '../rpc-explorer-filter.ts'
import { draftCapture, fullCapture } from './_app-source-fixtures.ts'

const channel = { projection: 'unavailable' as const }
const descriptors: readonly RpcDescriptorWire[] = [
  {
    descriptorId: 'vista:gh.checksStream',
    key: 'checksStream',
    tag: 'checksStream',
    title: 'GitHub check updates',
    kind: 'stream',
    observe: 'include',
    channels: {
      requestPayload: channel,
      success: channel,
      typedFailure: channel,
      defect: channel,
      streamElement: channel,
      streamError: channel,
      headers: channel,
    },
    terminal: channel,
  },
  {
    descriptorId: 'vista:pty.send',
    key: 'pty.send',
    tag: 'send',
    title: 'PTY send',
    kind: 'unary',
    observe: 'include',
    channels: {
      requestPayload: channel,
      success: channel,
      typedFailure: channel,
      defect: channel,
      streamElement: channel,
      streamError: channel,
      headers: channel,
    },
    terminal: channel,
  },
]
const at = (millis: number) => ({
  monotonicNanos: String(millis * 1_000_000),
  wallClockMillis: 1_795_027_210_000 + millis,
})
const record = (descriptorId: string, requestId: number, connectionId: string): RpcRecord => ({
  key: {
    observerSide: 'server',
    connectionId,
    direction: 'clientToServer',
    requestId: { _tag: 'Number', value: requestId },
  },
  descriptorId,
  state: 'succeeded',
  notification: false,
  startedAt: at(requestId * 400),
  lastAt: at(requestId * 400 + 125),
  send: 'sent',
  chunkEnvelopes: 0,
  streamValues: 0,
  retainedStreamValues: 0,
  events: requestId === 1 ? [1, 2] : [3, 4],
  evidence: [],
})
/** The stream call carries W3C trace context; the PTY send does not. */
const trace = { traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: '00f067aa0ba902b7' }
const storyGrafana = { baseUrl: 'https://grafana.example.test', tempoDatasourceUid: 'tempo' }
const snapshot: InspectorSnapshotFrame = {
  _tag: 'Snapshot',
  protocolVersion: 'rpc-explorer.v1',
  instanceId: 'vista-story',
  revision: 4,
  descriptorRevision: 0,
  descriptors,
  active: [],
  completed: [
    {
      ...record('vista:gh.checksStream', 1, 'vista.tests/demo/v3:0'),
      trace: { ...trace, sampled: true },
    },
    record('vista:pty.send', 2, 'vista.tests/demo/v3:0'),
  ],
  events: [
    {
      _tag: 'RequestObserved',
      eventId: 1,
      revision: 1,
      at: at(400),
      request: record('vista:gh.checksStream', 1, 'vista.tests/demo/v3:0').key,
      descriptorId: 'vista:gh.checksStream',
      notification: false,
      observations: [
        {
          channel: 'requestPayload',
          outcome: { _tag: 'Captured', mode: 'reveal', source: 'host' },
          captured: { _tag: 'String', value: 'schickling/dotfiles' },
        },
      ],
    },
    {
      _tag: 'TerminalObserved',
      eventId: 2,
      revision: 2,
      at: at(525),
      request: record('vista:gh.checksStream', 1, 'vista.tests/demo/v3:0').key,
      outcome: 'success',
      observations: [
        {
          channel: 'success',
          outcome: { _tag: 'Captured', mode: 'reveal', source: 'host' },
          captured: { _tag: 'String', value: 'checks up to date' },
        },
      ],
    },
    {
      _tag: 'RequestObserved',
      eventId: 3,
      revision: 3,
      at: at(800),
      request: record('vista:pty.send', 2, 'vista.tests/demo/v3:0').key,
      descriptorId: 'vista:pty.send',
      notification: false,
      observations: (
        [
          'requestPayload',
          'typedFailure',
          'defect',
          'streamElement',
          'streamError',
          'headers',
        ] as const
      ).map((captureChannel) => ({
        channel: captureChannel,
        outcome: { _tag: 'Omitted' as const, source: 'host' as const },
      })),
    },
    {
      _tag: 'TerminalObserved',
      eventId: 4,
      revision: 4,
      at: at(925),
      request: record('vista:pty.send', 2, 'vista.tests/demo/v3:0').key,
      outcome: 'success',
      observations: [{ channel: 'success', outcome: { _tag: 'Omitted', source: 'host' } }],
    },
  ],
  counters: {
    activeEvicted: 0,
    completedEvicted: 0,
    streamValuesTruncated: 0,
    subscriberResets: 0,
  },
}
let retainedSnapshot: InspectorSnapshotFrame = snapshot
const listeners = new Set<(frame: InspectorWatchFrame) => void>()
const fixtureClientFactory = (appIdentity?: string): ExplorerClient => {
  const filter = appIdentity === undefined ? undefined : makeAppFrameFilter(appIdentity)
  return {
    getSnapshot: async () =>
      filter === undefined ? retainedSnapshot : filter.snapshot(retainedSnapshot),
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        const queue: InspectorWatchFrame[] = []
        let receive: ((frame: InspectorWatchFrame) => void) | undefined
        const listener = (frame: InspectorWatchFrame) => {
          if (receive !== undefined) {
            const deliver = receive
            receive = undefined
            deliver(frame)
          } else queue.push(frame)
        }
        listeners.add(listener)
        try {
          while (true) {
            const queued = queue.shift()
            if (queued !== undefined) {
              yield queued._tag === 'Snapshot' && filter !== undefined
                ? filter.snapshot(queued)
                : queued
              continue
            }
            const { promise, resolve } = Promise.withResolvers<InspectorWatchFrame>()
            receive = resolve
            const frame = await promise
            yield frame._tag === 'Snapshot' && filter !== undefined ? filter.snapshot(frame) : frame
          }
        } finally {
          listeners.delete(listener)
        }
      },
    }),
    clearHistory: async () => {
      retainedSnapshot = {
        ...retainedSnapshot,
        revision: retainedSnapshot.revision + 1,
        active: [],
        completed: [],
        events: [],
      }
      const reset: InspectorWatchFrame = {
        _tag: 'Reset',
        protocolVersion: 'rpc-explorer.v1',
        reason: 'cleared',
        revision: retainedSnapshot.revision,
      }
      for (const listener of listeners) {
        listener(reset)
        listener(retainedSnapshot)
      }
      return { clearedRevision: retainedSnapshot.revision }
    },
  }
}

const Document = () => (
  <AppRoot title="RPC review" template="architecture-review" scope="RPC activity">
    <Section id="context" label="Context">
      <p>Inspect the RPC calls beside the current Vista document.</p>
    </Section>
  </AppRoot>
)

const meta = {
  title: 'Vista/Blocks/RPC Explorer',
  component: AppShell,
  args: {
    title: 'RPC review',
    children: <Document />,
    selfSource: fullCapture,
    rpcExplorerClientFactory: fixtureClientFactory,
    navigation: {
      apps: [],
      currentOwner: 'vista.tests',
      currentSlug: 'demo',
      currentVersion: 'v3',
    },
  },
  render: (args, context) => (
    <AppShell {...args} theme={context.globals.theme === 'light' ? 'light' : 'dark'} />
  ),
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>

export default meta

type Story = StoryObj<typeof meta>

/** Populated app-scoped view, including a terminal-safe PtyApi call. */
export const ReviewFrame: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Inspect RPC activity' }))
    const rpcPanel = await canvas.findByRole(
      'button',
      { name: 'RPC Explorer' },
      { timeout: 30_000 },
    )
    const fpsPanel = await canvas.findByRole('button', { name: 'FPS' })
    await userEvent.click(fpsPanel)
    await expect(await canvas.findByRole('region', { name: 'FPS' })).toBeVisible()
    await userEvent.click(rpcPanel)
    await expect(await canvas.findByRole('region', { name: 'RPC Explorer' })).toBeVisible()
    await expect(
      await canvas.findByRole(
        'button',
        { name: 'This app: vista.tests/demo/v3 ×' },
        { timeout: 10_000 },
      ),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(await canvas.findByRole('option', { name: /send.*Succeeded/ })).toBeVisible()
    // No Grafana configured: the traced row names its trace but links nowhere.
    const traced = await canvas.findByRole('option', { name: /trace linked/ })
    await expect(within(traced).queryByRole('link')).toBeNull()
  },
}

/**
 * With a Grafana configured, a record's trace ID opens Grafana Explore on that trace (row and
 * detail); a record without trace context has no link.
 */
export const TraceLinks: Story = {
  args: { grafana: storyGrafana },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Inspect RPC activity' }))
    const expected = grafanaTraceUrl({ grafana: storyGrafana, ...trace })
    const traced = await canvas.findByRole('option', { name: /trace linked/ }, { timeout: 10_000 })
    const rowLink = within(traced).getByRole('link', { name: 'trace' })
    await expect(rowLink).toHaveAttribute('href', expected)
    await expect(rowLink).toHaveAttribute('target', '_blank')
    await expect(rowLink).toHaveAttribute('rel', 'noreferrer')
    const untraced = await canvas.findByRole('option', { name: /no trace/ })
    await expect(within(untraced).queryByRole('link')).toBeNull()
    await userEvent.click(untraced)
    await userEvent.click(await canvas.findByRole('tab', { name: 'Trace' }))
    await expect(await canvas.findByText('No trace context observed')).toBeVisible()
    await expect(canvas.queryByRole('link', { name: trace.traceId })).toBeNull()
    await userEvent.click(traced)
    await userEvent.click(await canvas.findByRole('tab', { name: 'Trace' }))
    await expect(await canvas.findByRole('link', { name: trace.traceId })).toHaveAttribute(
      'href',
      expected,
    )
  },
}

/** Published and draft routes expose the same shell tool. */
export const Published: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const source = await canvas.findByRole('button', { name: 'Inspect source' })
    const rpc = await canvas.findByRole('button', { name: 'Inspect RPC activity' })
    await expect(rpc).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(rpc)
    await expect(rpc).toHaveAttribute('aria-expanded', 'true')
    await expect(source).toHaveAttribute('aria-expanded', 'false')
    const filter = await canvas.findByRole(
      'button',
      { name: 'This app: vista.tests/demo/v3 ×' },
      { timeout: 10_000 },
    )
    await expect(filter).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(filter)
    await expect(await canvas.findByRole('button', { name: 'All apps' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await userEvent.click(rpc)
    await expect(rpc).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('button', { name: 'FPS' })).toBeNull()
  },
}

/** Draft routes use the same shell control and a draft-version app filter. */
export const Draft: Story = {
  args: {
    selfSource: draftCapture,
    navigation: {
      apps: [],
      currentOwner: 'vista.tests',
      currentSlug: 'demo',
      currentVersion: 'draft',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Inspect RPC activity' }))
    await expect(
      await canvas.findByRole(
        'button',
        { name: 'This app: vista.tests/demo/draft ×' },
        { timeout: 10_000 },
      ),
    ).toHaveAttribute('aria-pressed', 'true')
  },
}
