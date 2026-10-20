import type { Meta, StoryObj } from '@storybook/react'
import { Context, Effect, Layer, Schema, Stream } from 'effect'
import { HttpRouter } from 'effect/http'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { layerNdjson } from 'effect/rpc/RpcSerialization'
import * as RpcServer from 'effect/rpc/RpcServer'

import { AppRoot, Section } from '../authoring.tsx'
import {
  availableValue,
  bind,
  contract,
  DataRuntimeProvider,
  encodeBinding,
  type Snapshot,
  subscription,
  useBinding,
} from '../data-query.tsx'

const ClockState = Schema.Struct({
  cursor: Schema.String,
  ticks: Schema.Finite,
})
const ClockEvent = Schema.Union([
  Schema.TaggedStruct('Synced', {
    state: ClockState,
  }),
  Schema.TaggedStruct('Ticked', {
    cursor: Schema.String,
  }),
])
const ClockApi = RpcGroup.make(
  Rpc.make('ticks', {
    payload: {
      clock: Schema.String,
      since: Schema.optionalKey(Schema.String),
    },
    success: ClockEvent,
    error: Schema.String,
    stream: true,
  }),
)
const clockBase = contract({ id: 'clock', group: ClockApi })
const ticks = subscription(clockBase.ops.ticks, {
  stateSchema: ClockState,
  eventSchema: ClockEvent,
  fold: (state, event) =>
    event._tag === 'Synced' ? event.state : { cursor: event.cursor, ticks: state.ticks + 1 },
  cursor: (state) => state.cursor,
})
const ticksBinding = bind(ticks, { clock: 'storybook' }, { mode: 'subscription' })
const frozenAt = '2026-09-20T10:00:00.000Z'
const frozenClock = { cursor: 'clock-0', ticks: 40 }
const encodedBinding = Effect.runSync(encodeBinding(ticksBinding))
const snapshot: Snapshot = {
  apiVersion: 2,
  frozenAt,
  entries: {
    [encodedBinding.key]: {
      provider: ticks.providerId,
      operation: ticks.tag,
      encodedArgs: encodedBinding.encodedArgs,
      encodedValue: Schema.encodeSync(ticks.stateSchema)(frozenClock),
      capturedAt: frozenAt,
    },
  },
}

const scriptedHandler = HttpRouter.toWebHandler(
  RpcServer.layerHttp({ group: ClockApi, path: '/story/clock', protocol: 'http' }).pipe(
    Layer.provide(
      Layer.mergeAll(
        ClockApi.toLayer({
          ticks: () =>
            Stream.concat(
              Stream.fromEffect(
                Effect.sleep('150 millis').pipe(
                  Effect.as({
                    _tag: 'Synced' as const,
                    state: { cursor: 'clock-1', ticks: 41 },
                  }),
                ),
              ),
              Stream.concat(
                Stream.fromEffect(
                  Effect.sleep('500 millis').pipe(
                    Effect.as({
                      _tag: 'Ticked' as const,
                      cursor: 'clock-2',
                    }),
                  ),
                ),
                Stream.never,
              ),
            ),
        }),
        layerNdjson,
        HttpRouter.layer,
      ),
    ),
  ),
  { disableLogger: true },
)
const scriptedFetch: typeof globalThis.fetch = (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  return scriptedHandler.handler(request, Context.empty())
}

const ClockTicks = () => {
  const result = useBinding(ticksBinding)
  const resolved = availableValue(result)
  return (
    <article aria-label="Subscription-backed clock">
      <h3>Clock ticks</h3>
      <p data-testid="clock-phase">{resolved?._tag ?? result._tag}</p>
      <output data-testid="clock-ticks">{resolved?.value.ticks ?? 'Unavailable'}</output>
      <p>Cursor: {resolved?.value.cursor ?? 'none'}</p>
    </article>
  )
}

const SubscriptionBlock = () => (
  <DataRuntimeProvider
    appVersionId="storybook/clock/v1"
    snapshot={snapshot}
    dataBaseUrl="http://vista.story/story/"
    fetch={scriptedFetch}
  >
    <AppRoot title="Subscription clock" template="architecture-review" scope="storybook">
      <Section id="clock" label="Subscription clock">
        <ClockTicks />
      </Section>
    </AppRoot>
  </DataRuntimeProvider>
)

const meta = {
  title: 'Vista/Blocks/Data/Subscription Block',
  component: SubscriptionBlock,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SubscriptionBlock>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Renders the block under its streaming-tick simulation to exercise how successive live updates
 * are displayed.
 */
export const StreamingTicks: Story = {}
/**
 * Composes the subscription block's various states into one view, relying on the story-level
 * decorators to supply fixtures.
 */
export const AllStates: Story = {}
