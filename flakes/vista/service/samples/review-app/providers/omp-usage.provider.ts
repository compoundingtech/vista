import { LensEnvelope, OmpUsageHealth } from '@vista/blocks/internal/provider-contracts'
import {
  makeOmpUsageLayer,
  makeOmpUsageProvider,
  OmpUsageError,
  type OmpUsageSource,
} from '@vista/data/providers/omp-usage.provider'
import { Effect, Schema } from 'effect'

const NOW = Date.parse('2026-09-20T12:00:00.000Z')
/**
 * Well-known symbol on globalThis used as a counter key so tests can count invocations of the
 * review OMP usage provider.
 */
export const reviewUsageCalls = Symbol.for('vista.samples.review.usageCalls')

const health = Schema.decodeSync(OmpUsageHealth, { onExcessProperty: 'error' })({
  status: 'ok',
  ledger_rows: 100,
  schema_version: 6,
  lens_version: 8,
  lenses_fresh: 2,
  computed_at: NOW,
  generations: [
    {
      lens: 'spend_by_project',
      window: '7d',
      computed_at: NOW,
      rows: 2,
    },
    {
      lens: 'spend_by_worktree',
      window: '7d',
      computed_at: NOW,
      rows: 2,
    },
  ],
  quota: { status: 'ok' },
  discovery: { status: 'ok' },
  oracle: { status: 'ok' },
})

const source: OmpUsageSource = {
  health: Effect.succeed(health),
  lens: (args) =>
    Effect.gen(function* () {
      const previous = Reflect.get(globalThis, reviewUsageCalls)
      const revision = typeof previous === 'number' ? previous + 1 : 1
      Reflect.set(globalThis, reviewUsageCalls, revision)
      const envelope = yield* Schema.decodeEffect(LensEnvelope, { onExcessProperty: 'error' })({
        lens: args.lens,
        version: 8,
        window: args.window,
        computed_at: new Date(NOW).toISOString(),
        coverage: {
          ledger_rows: 100,
          ledger_usd: 42,
          attributed_share: 0.99,
          seat_share: 1,
          seat_identity_share: 1,
          account_share: 0.99,
          hosts: ['dev3'],
          first_ts: '2026-09-13T12:00:00.000Z',
          last_ts: '2026-09-20T12:00:00.000Z',
        },
        coverage_gate: 0.95,
        coverage_ok: true,
        provenance: {
          pricing_source: 'fixture',
          omp_version: 'fixture',
          ledger_schema: 6,
        },
        rows:
          args.lens === 'spend_by_worktree'
            ? [
                {
                  key: 'schickling/dotfiles@main',
                  repo: 'schickling/dotfiles',
                  branch: 'main',
                  usd: 10 + revision,
                  requests: 20 + revision,
                },
                {
                  key: 'schickling/axe@main',
                  repo: 'schickling/axe',
                  branch: 'main',
                  usd: 5,
                  requests: 10,
                },
              ]
            : [
                {
                  key: 'schickling/dotfiles',
                  rank: 1,
                  usd: 10 + revision,
                  requests: 20 + revision,
                },
                { key: 'schickling/axe', rank: 2, usd: 5, requests: 10 },
              ],
      }).pipe(
        Effect.mapError(
          (cause) =>
            new OmpUsageError({
              reason: 'decode',
              message: `sample OMP Usage lens schema failed: ${String(cause)}`,
              transient: false,
            }),
        ),
      )
      return { _tag: 'materialized' as const, envelope }
    }),
}

export default makeOmpUsageProvider(makeOmpUsageLayer(source, Effect.succeed(NOW)))
