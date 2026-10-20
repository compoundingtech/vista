import { contract } from '@vista/blocks/internal/data-contract'
import { Duration, Effect, Layer, Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'
import { describe, expect, it } from 'vitest'

import type { ProviderBudget } from './live-hub.ts'
import { implement, materializeProvider, mountProvider } from './provider.ts'

const BudgetApi = RpcGroup.make(
  Rpc.make('read', {
    payload: { id: Schema.String },
    success: Schema.String,
  }),
)
const budgetContract = contract({ id: 'budgeted', group: BudgetApi })
const budgetImplementation = implement(budgetContract, {
  purity: 'pure',
  handlers: {
    read: ({ id }) => Effect.succeed(`value:${id}`),
  },
})
const budgetProvider = mountProvider(budgetImplementation, Layer.empty)

describe('mounted Provider live admission', () => {
  it('accounts a live unary request through the shared ProviderBudget', async () => {
    let admissions = 0
    const budget: ProviderBudget = {
      run: (_provider, effect) =>
        Effect.sync(() => {
          admissions += 1
        }).pipe(Effect.andThen(effect)),
      pollInterval: (_provider, _viewers, interval) =>
        Effect.succeed(Duration.millis(Duration.toMillis(interval.min))),
    }

    const [live, captured] = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const mounted = yield* materializeProvider(budgetProvider, undefined, budget)
          const live = yield* mounted.call('read', { id: 'live' }, 'live')
          const captured = yield* mounted.call('read', { id: 'capture' }, 'capture')
          return [live, captured] as const
        }),
      ),
    )

    expect(live).toBe('value:live')
    expect(captured).toBe('value:capture')
    expect(admissions).toBe(1)
  })
})
