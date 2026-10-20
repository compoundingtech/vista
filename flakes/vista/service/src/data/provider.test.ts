import { it } from '@effect/vitest'
import { contract } from '@vista/blocks/internal/data-contract'
import { Effect, Layer, Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { expect } from 'vitest'

import { implement, materializeProvider, mountProvider } from './provider.ts'

const DatePayload = Schema.Struct({ at: Schema.DateFromString })
const DateApi = RpcGroup.make(
  Rpc.make('read', {
    payload: DatePayload,
    success: Schema.String,
  }),
)
const dateContract = contract({ id: 'date', group: DateApi })
const dateProvider = mountProvider(
  implement(dateContract, {
    purity: 'pure',
    handlers: {
      read: ({ at }) => Effect.succeed(at.toISOString()),
    },
  }),
  Layer.empty,
)

it.effect('schema-encodes a decoded Date payload before provider instrumentation hashes it', () =>
  Effect.gen(function* () {
    const mounted = yield* materializeProvider(dateProvider)
    const at = new Date('2026-09-20T08:00:00.000Z')

    const value = yield* mounted.call('read', { at }, 'live')

    expect(value).toBe(at.toISOString())
  }).pipe(Effect.scoped),
)
