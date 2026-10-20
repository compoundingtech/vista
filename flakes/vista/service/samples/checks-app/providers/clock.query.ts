import { contract, Cursor, subscription } from '@vista/blocks/query'
import { Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'

/**
 * Schema validating clock state as a cursor plus natural-numbered tick count, rejecting unknown
 * properties; the exported type is its inferred representation.
 */
export const ClockState = Schema.Struct({
  cursor: Cursor,
  ticks: Schema.Natural,
}).annotate({
  identifier: 'Vista.Samples.ClockState',
})
export type ClockState = typeof ClockState.Type

/**
 * Schema union of the clock stream events, either a full Synced state or an incremental Tick,
 * rejecting unknown properties.
 */
export const ClockEvent = Schema.Union([
  Schema.TaggedStruct('Synced', { state: ClockState }),
  Schema.TaggedStruct('Tick', {
    cursor: Cursor,
    ticks: Schema.Natural,
  }),
]).annotate({
  identifier: 'Vista.Samples.ClockEvent',
})
export type ClockEvent = typeof ClockEvent.Type

/**
 * Tagged error carrying a human-readable message, used as the failure channel for clock RPC
 * operations.
 */
export class ClockError extends Schema.TaggedError<ClockError>()('ClockError', {
  message: Schema.String,
}) {}

/**
 * RPC group declaring clockStream, a streaming method that delivers clock events for a lane,
 * optionally resuming from a supplied cursor.
 */
export const ClockApi = RpcGroup.make(
  Rpc.make('clockStream', {
    payload: {
      lane: Schema.String,
      since: Schema.optionalKey(Cursor),
    },
    success: ClockEvent,
    error: ClockError,
    stream: true,
  }),
)

const base = contract({ id: 'clock', group: ClockApi })
/**
 * Adapts the raw clockStream RPC into a resumable subscription that folds Synced and Tick events
 * into a cursor-addressed ClockState.
 */
export const clockStream = subscription(base.ops.clockStream, {
  stateSchema: ClockState,
  eventSchema: ClockEvent,
  fold: (_state, event) =>
    event._tag === 'Synced' ? event.state : { cursor: event.cursor, ticks: event.ticks },
  cursor: (state) => state.cursor,
})
/**
 * Clock provider built from the base provider with its clockStream op overridden by the
 * cursor-resumable subscription adapter.
 */
export const clock = { ...base, ops: { ...base.ops, clockStream } }
