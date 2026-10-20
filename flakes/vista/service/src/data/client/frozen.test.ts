import { describe, expect, it } from '@effect/vitest'
import {
  FrozenEntryMissing,
  SchemaMismatch,
  snapshotKey,
  type Snapshot,
  type SnapshotKey,
} from '@vista/blocks/internal/data-contract'
import { overview } from '@vista/blocks/internal/provider-contracts'
import { Effect } from 'effect'

import { readFrozen } from './frozen.ts'

const args = { repo: 'schickling/dotfiles', pr: 42 }
const value = {
  repo: args.repo,
  pr: args.pr,
  changedFiles: 3,
  additions: 12,
  deletions: 4,
  verdict: 'review',
}

const snapshotWith = (key: SnapshotKey, encodedValue: unknown): Snapshot => ({
  apiVersion: 2,
  frozenAt: '2026-09-19T00:00:00.000Z',
  entries: {
    [key]: {
      provider: overview.id,
      operation: overview.ops.get.tag,
      encodedArgs: args,
      encodedValue,
      capturedAt: '2026-09-19T00:00:00.000Z',
    },
  },
})

describe('readFrozen', () => {
  it.effect('reads an operation value from the direct Snapshot contract', () =>
    Effect.gen(function* () {
      const key = yield* snapshotKey(overview.ops.get, args)
      expect(yield* readFrozen(snapshotWith(key, value), overview.ops.get, args)).toEqual(value)
    }),
  )

  it.effect('distinguishes a missing seed from a current-version schema mismatch', () =>
    Effect.gen(function* () {
      const key = yield* snapshotKey(overview.ops.get, args)
      const mismatch = yield* Effect.flip(
        readFrozen(snapshotWith(key, { ...value, changedFiles: 'three' }), overview.ops.get, args),
      )
      expect(mismatch).toBeInstanceOf(SchemaMismatch)

      const missing = yield* Effect.flip(
        readFrozen(
          { apiVersion: 2, frozenAt: '2026-09-19T00:00:00.000Z', entries: {} },
          overview.ops.get,
          args,
        ),
      )
      expect(missing).toBeInstanceOf(FrozenEntryMissing)
    }),
  )
})
