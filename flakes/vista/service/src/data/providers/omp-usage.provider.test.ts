import { it } from '@effect/vitest'
import {
  LensEnvelope,
  type LensRead,
  OmpUsageHealth,
} from '@vista/blocks/internal/provider-contracts'
import { Effect, Schema } from 'effect'
import { describe, expect } from 'vitest'

import {
  makeOmpUsageLayer,
  makeOmpUsageProvider,
  type OmpUsageSource,
} from './omp-usage.provider.ts'

const NOW = Date.parse('2026-09-20T12:00:00.000Z')
const WINDOW = '7d' as const

const envelope = ({
  lens = 'spend_by_project',
  accountShare = 0.99,
  rows = [],
}: {
  readonly lens?: string
  readonly accountShare?: number
  readonly rows?: ReadonlyArray<Readonly<Record<string, unknown>>>
} = {}) =>
  Schema.decodeSync(LensEnvelope)({
    lens,
    version: 8,
    window: WINDOW,
    computed_at: new Date(NOW).toISOString(),
    coverage: {
      ledger_rows: 100,
      ledger_usd: 42,
      attributed_share: accountShare,
      seat_share: 1,
      seat_identity_share: 0.5,
      account_share: accountShare,
      hosts: ['dev3'],
      first_ts: '2026-09-13T12:00:00.000Z',
      last_ts: '2026-09-20T12:00:00.000Z',
    },
    coverage_gate: 0.95,
    coverage_ok: accountShare >= 0.95,
    provenance: {
      pricing_source: 'omp-catalog@test',
      producer_build_version: 'test',
      ledger_schema: 6,
    },
    rows,
  })

const health = (computedAt = NOW) =>
  Schema.decodeSync(OmpUsageHealth)({
    status: 'ok',
    ledger_rows: 100,
    schema_version: 6,
    lens_version: 8,
    lenses_fresh: 1,
    computed_at: computedAt,
    generations: [
      {
        lens: 'spend_by_project',
        window: WINDOW,
        computed_at: computedAt,
        rows: 1,
      },
    ],
    quota: { status: 'ok' },
    discovery: { status: 'ok' },
    oracle: { status: 'ok' },
  })

const source = (read: LensRead, healthValue = health()): OmpUsageSource => ({
  health: Effect.succeed(healthValue),
  lens: () => Effect.succeed(read),
})

const checked = (read: LensRead, healthValue = health()) => {
  const layer = makeOmpUsageLayer(source(read, healthValue), Effect.succeed(NOW))
  return makeOmpUsageProvider(layer)
    .core.lensChecked({
      lens: 'spend_by_project',
      window: WINDOW,
    })
    .pipe(Effect.provide(layer))
}

describe('omp-usage lens provenance wire', () => {
  const strict = { onExcessProperty: 'error' } as const
  const decode = Schema.decodeUnknownEffect(LensEnvelope, strict)
  const provenance = { pricing_source: 'omp-catalog@test', ledger_schema: 6 }
  // Provenance contract bundled into retained published clients at 8c47ecd8.
  const oldFrozenClientProvenance = Schema.Struct({
    pricing_source: Schema.String,
    omp_version: Schema.String,
    ledger_schema: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  })
  const oldFrozenClientEnvelope = Schema.Struct({
    ...LensEnvelope.fields,
    provenance: oldFrozenClientProvenance,
  })
  const fixtures = [
    { name: 'legacy-only', versions: { omp_version: 'legacy' }, expected: 'legacy' },
    {
      name: 'canonical-only',
      versions: { producer_build_version: 'canonical' },
      expected: 'canonical',
    },
    {
      name: 'both, with canonical precedence',
      versions: { omp_version: 'legacy', producer_build_version: 'canonical' },
      expected: 'canonical',
    },
  ] as const

  for (const fixture of fixtures) {
    it.effect(`decodes ${fixture.name} into one producer build identity`, () =>
      Effect.gen(function* () {
        const result = yield* decode({
          ...envelope(),
          provenance: { ...provenance, ...fixture.versions },
        })
        expect(result.provenance).toEqual({
          ...provenance,
          producer_build_version: fixture.expected,
        })
        const encoded = yield* Schema.encodeEffect(Schema.toCodecJson(LensEnvelope), strict)(result)
        const frozenClientValue = yield* Schema.decodeUnknownEffect(
          oldFrozenClientEnvelope,
          strict,
        )(encoded)
        expect(frozenClientValue.provenance).toEqual({
          ...provenance,
          omp_version: fixture.expected,
        })
      }),
    )
  }

  it.effect('still requires a producer build identity', () =>
    decode({ ...envelope(), provenance }).pipe(Effect.flip, Effect.asVoid),
  )

  for (const fixture of fixtures) {
    it.effect(`rejects unrelated provenance properties for ${fixture.name}`, () =>
      decode({
        ...envelope(),
        provenance: { ...provenance, ...fixture.versions, unrelated: 'excess' },
      }).pipe(Effect.flip, Effect.asVoid),
    )
  }

  it.effect('does not fall back to the legacy field when the canonical field is invalid', () =>
    decode({
      ...envelope(),
      provenance: { ...provenance, omp_version: 'legacy', producer_build_version: 42 },
    }).pipe(Effect.flip, Effect.asVoid),
  )

  it.effect('still rejects unrelated envelope properties', () =>
    decode({ ...envelope(), unrelated: 'excess' }).pipe(Effect.flip, Effect.asVoid),
  )
})

describe('omp-usage provider trust outcomes', () => {
  it.effect('returns ok for a fresh generation above the account coverage gate', () =>
    Effect.gen(function* () {
      const result = yield* checked({ _tag: 'materialized', envelope: envelope() })
      expect(result._tag).toBe('ok')
    }),
  )

  it.effect('returns below-gate at 94.9% account coverage', () =>
    Effect.gen(function* () {
      const result = yield* checked({
        _tag: 'materialized',
        envelope: envelope({ accountShare: 0.949 }),
      })
      expect(result._tag).toBe('below-gate')
      if (result._tag === 'below-gate') expect(result.accountShare).toBe(0.949)
    }),
  )

  it.effect('returns stale when a 7d generation is eight days old', () =>
    Effect.gen(function* () {
      const computedAt = NOW - 8 * 24 * 60 * 60 * 1_000
      const result = yield* checked(
        { _tag: 'materialized', envelope: envelope() },
        health(computedAt),
      )
      expect(result._tag).toBe('stale')
    }),
  )

  it.effect('returns stale when health has no exact lens/window generation', () =>
    Effect.gen(function* () {
      const healthWithoutGeneration = yield* Schema.decodeEffect(OmpUsageHealth)({
        ...health(),
        generations: [],
      })
      const result = yield* checked(
        { _tag: 'materialized', envelope: envelope() },
        healthWithoutGeneration,
      )
      expect(result._tag).toBe('stale')
    }),
  )

  it.effect('returns unmaterialized without turning a 503-equivalent read into an error', () =>
    Effect.gen(function* () {
      const result = yield* checked({
        _tag: 'unmaterialized',
        lens: 'spend_by_project',
        window: WINDOW,
      })
      expect(result).toEqual({
        _tag: 'unmaterialized',
        lens: 'spend_by_project',
        window: WINDOW,
      })
    }),
  )

  it.effect('rejects a materialized envelope whose identity differs from the request', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        checked({
          _tag: 'materialized',
          envelope: envelope({ lens: 'usage_over_time' }),
        }),
      )
      expect(error.reason).toBe('decode')
      expect(error.message).toContain('usage_over_time@7d for spend_by_project@7d')
    }),
  )
})

describe('omp-usage project drilldown', () => {
  it.effect('matches worktrees by owner-scoped repository instead of basename', () => {
    const projectEnvelope = envelope({
      rows: [
        { key: 'schickling/dotfiles', rank: 1, usd: 30, requests: 12 },
        { key: 'other/dotfiles', rank: 2, usd: 10, requests: 3 },
      ],
    })
    const worktreeEnvelope = envelope({
      lens: 'spend_by_worktree',
      rows: [
        {
          key: 'schickling/dotfiles@main',
          repo: 'dotfiles',
          branch: 'main',
          usd: 20,
          requests: 8,
        },
      ],
    })
    const testSource: OmpUsageSource = {
      health: Effect.succeed(
        Schema.decodeSync(OmpUsageHealth)({
          ...health(),
          generations: [
            ...health().generations,
            { lens: 'spend_by_worktree', window: WINDOW, computed_at: NOW, rows: 1 },
          ],
        }),
      ),
      lens: (args) =>
        Effect.succeed({
          _tag: 'materialized',
          envelope: args.lens === 'spend_by_project' ? projectEnvelope : worktreeEnvelope,
        }),
    }
    const layer = makeOmpUsageLayer(testSource, Effect.succeed(NOW))
    return Effect.gen(function* () {
      const result = yield* makeOmpUsageProvider(layer)
        .core.projectDrilldown({ window: WINDOW })
        .pipe(Effect.provide(layer))
      expect(result.unDrilled).toEqual(['other/dotfiles'])
      expect(result.projects[0]?.status).toBe('drilled')
      expect(result.projects[1]?.status).toBe('un-drilled')
    })
  })

  it.effect('fails instead of silently omitting malformed project or worktree rows', () => {
    const testSource: OmpUsageSource = {
      health: Effect.succeed(
        Schema.decodeSync(OmpUsageHealth)({
          ...health(),
          generations: [
            ...health().generations,
            { lens: 'spend_by_worktree', window: WINDOW, computed_at: NOW, rows: 1 },
          ],
        }),
      ),
      lens: (args) =>
        Effect.succeed({
          _tag: 'materialized',
          envelope: envelope({
            lens: args.lens,
            rows:
              args.lens === 'spend_by_project'
                ? [{ key: 'schickling/dotfiles', rank: 1, usd: 'invalid', requests: 12 }]
                : [
                    {
                      key: 'schickling/dotfiles@main',
                      repo: 'dotfiles',
                      branch: 'main',
                      usd: 20,
                      requests: 8,
                    },
                  ],
          }),
        }),
    }
    const layer = makeOmpUsageLayer(testSource, Effect.succeed(NOW))
    return Effect.gen(function* () {
      const error = yield* makeOmpUsageProvider(layer)
        .core.projectDrilldown({ window: WINDOW })
        .pipe(Effect.provide(layer), Effect.flip)
      expect(error.reason).toBe('decode')
      expect(error.message).toContain('project rows failed schema decoding')
    })
  })
})
