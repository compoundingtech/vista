/**
 * Two AppIndex invariants at the disk-scan seam:
 *
 *  - Identity is exact-owner and fail-closed: a JSON-valid `meta.json` keeps its
 *    authored identity when only a re-derivable projection field is corrupt, but
 *    a version without valid owner/slug/version identity is excluded.
 *  - Frozen-snapshot DARKNESS is DETECTABLE (loud half of decisions 0061/0069): a
 *    published version whose direct `Snapshot` fails closed — `skew` (non-current
 *    `apiVersion`) or `malformed` (current version with an invalid body) — is
 *    reported by {@link scanSkew}, and the scan-seam emission `set`s the
 *    `vista_snapshot_skew` gauge to the per-`reason` COUNT of dark versions, for both
 *    reasons every scan (0 when none). A draft (no snapshot) / current version is not.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect, Metric } from 'effect'

import { VISTA_API_VERSION } from './api-version.ts'
import { snapshotSkew } from './metrics.ts'
import { encodeOwner, scanAll, scanApp, scanSkew } from './registry.ts'

// Point the AppIndex at an isolated apps dir BEFORE any scan runs. `appsDir()` is
// `once`-memoized and lazy (only invoked at scan time, never at import), so setting
// the env here — before the first `scanApp`/`scanSkew` call — is sufficient.
const APPS = mkdtempSync(join(tmpdir(), 'vista-skew-apps-'))
process.env.VISTA_APPS = APPS
const OWNER = 'vista.tests'

/** Seed one finalized version dir plus optional identity and frozen snapshot. */
const seedVersion = (
  slug: string,
  v: number,
  files: { readonly meta?: string; readonly snapshot?: string },
  owner: string = OWNER,
): void => {
  const dir = join(APPS, '_owned', encodeOwner(owner), slug, `v${v}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), '<div id="root"></div>')
  writeFileSync(join(dir, 'publication.json'), '{}')
  if (files.meta !== undefined) writeFileSync(join(dir, 'meta.json'), files.meta)
  if (files.snapshot !== undefined) writeFileSync(join(dir, 'snapshot.json'), files.snapshot)
}

// Identity that omits `parent` and `status` entirely — a legacy/partial file.
seedVersion('ident', 1, {
  meta: JSON.stringify({
    owner: OWNER,
    slug: 'ident',
    version: 1,
    author: 'alice',
    timestamp: '2026-01-01T00:00:00Z',
    changeSummary: 'first cut',
  }),
})
// Valid AUTHORED identity but a CORRUPT projection (`status` fails `StatusCounts`):
// the full `VersionMeta` decode must fail and fall back to identity-only, keeping
// author/parent while dropping the bad projection (decision 0071).
seedVersion('corrupt-proj', 2, {
  meta: JSON.stringify({
    slug: 'corrupt-proj',
    owner: OWNER,
    version: 2,
    author: 'carol',
    timestamp: '2026-02-02T00:00:00Z',
    changeSummary: 'bad projection',
    parent: 1,
    status: { locked: -1 },
  }),
})
// Genuinely non-JSON: invalid identity means the version is excluded.
seedVersion('broken', 1, { meta: 'not json {' })

const authored = (slug: string): string =>
  JSON.stringify({
    owner: OWNER,
    slug,
    version: 1,
    author: 'bob',
    timestamp: '',
    changeSummary: '',
  })

// A skewed published snapshot, a malformed one, a current one, and a draft (no snapshot).
seedVersion('skewed', 1, {
  meta: authored('skewed'),
  snapshot: JSON.stringify({ apiVersion: VISTA_API_VERSION + 1 }),
})
seedVersion('malformed', 1, {
  meta: authored('malformed'),
  // The version is current, but the direct Snapshot body fails strict decoding.
  snapshot: JSON.stringify({ apiVersion: VISTA_API_VERSION, notASnapshot: true }),
})
seedVersion('current', 1, {
  meta: authored('current'),
  snapshot: JSON.stringify({
    apiVersion: VISTA_API_VERSION,
    frozenAt: '2026-01-01T00:00:00.000Z',
    entries: {},
  }),
})
seedVersion('draft', 1, { meta: authored('draft') })

describe('AppIndex identity is exact-owner and projection-lenient', () => {
  it('roundtrips native subjects and literal percent owners without namespace aliases', () => {
    for (const owner of ['agent/vista/author', 'agent/author', 'agent/vista/team/author', 'dev3.agent%2Fvista%2Fauthor', 'dev3.owner!']) {
      const encoded = encodeOwner(owner)
      expect(decodeURIComponent(encoded)).toBe(owner)
      seedVersion('exact-owner', 1, {
        meta: JSON.stringify({ owner, slug: 'exact-owner', version: 1 }),
      }, owner)
      const scanned = scanAll().get(`${encoded}/exact-owner`)
      expect(scanned?.owner).toBe(owner)
      expect(scanned?.versions[0]?.owner).toBe(owner)
    }
    const noncanonical = join(APPS, '_owned', 'agent%2fvista%2fauthor', 'exact-owner', 'v1')
    mkdirSync(noncanonical, { recursive: true })
    writeFileSync(join(noncanonical, 'meta.json'), JSON.stringify({
      owner: 'agent/vista/author', slug: 'exact-owner', version: 1,
    }))
    expect(scanAll().has('agent%2fvista%2fauthor/exact-owner')).toBe(false)
  })

  it('a meta.json missing parent/status keeps its authored identity', () => {
    const st = scanApp(OWNER, 'ident')
    expect(st).not.toBeNull()
    const meta = st!.versions.find((m) => m.version === 1)!
    // Authored values survive the projection fallback.
    expect(meta.author).toBe('alice')
    expect(meta.changeSummary).toBe('first cut')
    // The absent `parent` key defaults to null — the decode did NOT reject the file.
    expect(meta.parent).toBeNull()
  })

  it('a corrupt projection field keeps AUTHORED identity and drops the projection', () => {
    const st = scanApp(OWNER, 'corrupt-proj')
    expect(st).not.toBeNull()
    const meta = st!.versions.find((m) => m.version === 2)!
    // Identity survives the identity-only fallback.
    expect(meta.author).toBe('carol')
    // A non-null parent proves the authored identity survived.
    expect(meta.parent).toBe(1)
    // The load-bearing assertion: the corrupt projection is DROPPED, proving the
    // fallback decoded identity-only rather than the full record.
    expect(meta.status).toBeUndefined()
  })

  it('excludes genuinely malformed identity instead of synthesizing it', () => {
    const st = scanApp(OWNER, 'broken')
    expect(st).not.toBeNull()
    expect(st!.versions).toEqual([])
  })
})

describe('AppIndex snapshot-darkness scan (loud half of decisions 0061/0069)', () => {
  it('scanSkew reports skewed AND malformed published versions and ignores current/draft', () => {
    const dark = scanSkew([...scanAll().values()])

    const skew = dark.find((s) => s.slug === 'skewed')
    expect(skew).toBeDefined()
    expect(skew!.version).toBe(1)
    expect(skew!.reason).toBe('skew')

    const malformed = dark.find((s) => s.slug === 'malformed')
    expect(malformed).toBeDefined()
    expect(malformed!.reason).toBe('malformed')

    // A current-version snapshot and a draft (no snapshot) are NOT dark.
    expect(dark.some((s) => s.slug === 'current')).toBe(false)
    expect(dark.some((s) => s.slug === 'draft')).toBe(false)
  })

  it.effect(
    'the scan-seam emission sets vista_snapshot_skew to the per-reason count, resetting both to 0 when none',
    () =>
      Effect.gen(function* () {
        // The count-gauge expression the apps.list handler runs: `set` BOTH reasons from
        // the dark list, always — so a reason with zero dark versions is reset to 0.
        const emit = (dark: ReadonlyArray<{ readonly reason: 'skew' | 'malformed' }>) => {
          const skewN = dark.filter((d) => d.reason === 'skew').length
          const malformedN = dark.filter((d) => d.reason === 'malformed').length
          return Effect.forEach(
            [
              ['skew', skewN],
              ['malformed', malformedN],
            ] as const,
            ([reason, count]) =>
              Metric.update(Metric.withAttributes(snapshotSkew, { reason }), count),
            { discard: true },
          )
        }

        // `reason`-keyed views of the one gauge — each is a distinct series (2 total).
        const skewSeries = Metric.withAttributes(snapshotSkew, { reason: 'skew' })
        const malformedSeries = Metric.withAttributes(snapshotSkew, { reason: 'malformed' })

        // The seed has exactly one skewed and one malformed dark published version
        // (the identity fixtures carry no snapshot, so contribute nothing).
        yield* emit(scanSkew([...scanAll().values()]))
        expect((yield* Metric.value(skewSeries)).value).toBe(1)
        expect((yield* Metric.value(malformedSeries)).value).toBe(1)

        // The load-bearing assertion: a subsequent scan with NO dark versions resets
        // BOTH series to 0 — there is no lingering stale series.
        yield* emit([])
        expect((yield* Metric.value(skewSeries)).value).toBe(0)
        expect((yield* Metric.value(malformedSeries)).value).toBe(0)
      }),
  )
})
