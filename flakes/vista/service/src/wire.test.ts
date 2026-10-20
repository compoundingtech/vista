import { describe, expect, it } from '@effect/vitest'
import { Effect, Metric, Schema } from 'effect'

import { VISTA_API_VERSION, VersionSkew } from './api-version.ts'
import { decodeEnvelopedLoud, versionSkewTotal } from './wire.ts'

/**
 * The LOUD half of the versioned contract (Track C / OQ-FROZEN-SKEW-VISIBLE):
 * every typed {@link VersionSkew} seen at a read seam must not just fail closed,
 * it must be OBSERVABLE — a warn log + a `vista_version_skew` counter increment
 * (tagged by `where`) through the already-wired telemetry, so a skew after a
 * contract bump is loud, not silent.
 */
describe('wire loud-half (Track C / OQ-FROZEN-SKEW-VISIBLE)', () => {
  it.effect('a skew increments vista_version_skew (tagged where) AND fails VersionSkew', () =>
    Effect.gen(function* () {
      const where = 'test.loud.seam'
      const tagged = Metric.withAttributes(versionSkewTotal, { where })
      const before = yield* Metric.value(tagged)

      // A non-current apiVersion, valid payload shape → the version boundary fires
      // first (two-phase), so this is a VersionSkew, not a payload ParseError.
      const skewed = { apiVersion: VISTA_API_VERSION + 1, payload: 42 }
      const error = yield* Effect.flip(decodeEnvelopedLoud(Schema.Finite, where)(skewed))

      expect(error).toBeInstanceOf(VersionSkew)
      expect(error._tag).toBe('Vista.VersionSkew')

      const after = yield* Metric.value(tagged)
      // The loud counter fired exactly once for this seam.
      expect(after.count).toBe(before.count + 1)
    }),
  )

  it.effect('a current-version envelope decodes to the payload and does NOT fire the counter', () =>
    Effect.gen(function* () {
      const where = 'test.loud.ok'
      const tagged = Metric.withAttributes(versionSkewTotal, { where })
      const before = yield* Metric.value(tagged)

      const value = yield* decodeEnvelopedLoud(Schema.Finite, where)({
        apiVersion: VISTA_API_VERSION,
        payload: 7,
      })
      expect(value).toBe(7)

      const after = yield* Metric.value(tagged)
      expect(after.count).toBe(before.count)
    }),
  )
})
