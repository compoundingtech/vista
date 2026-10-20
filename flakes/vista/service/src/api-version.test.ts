/**
 * The versioned self-describing contract (decision 0061 / VST-R66; Track C). One
 * global `apiVersion` versions the vista contract; a reader is FAIL-CLOSED — a
 * non-current version is a typed {@link VersionSkew}, never a silent mis-decode. The
 * data-loss class is the DISPOSABLE frozen snapshot; authored IDENTITY (`meta.json`)
 * is durable (SVC-R15). These tests lock the envelope boundary:
 *
 *  - `decodeEnveloped` short-circuits a skewed version to `VersionSkew` BEFORE the
 *    payload shape is considered (proven with a payload that would ALSO fail);
 *  - `readEnvelope` is a sync, fail-closed read with three DISTINCT outcomes
 *    (`ok`/`skew`/`malformed`) so a present-but-skewed envelope is never conflated
 *    with an absent one (OQ-FROZEN-SKEW-VISIBLE / decision 0068);
 *  - `encodeEnvelope` round-trips through `decodeEnveloped`;
 *  - the on-disk AppIndex seam (`scanApp`) reads a plain `meta.json` in full
 *    (identity durable) and falls back only on a genuinely malformed file.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { afterAll, beforeAll, describe, expect, vi } from 'vitest'

import {
  decodeEnveloped,
  encodeEnvelope,
  readEnvelope,
  VISTA_API_VERSION,
  VersionSkew,
} from './api-version.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OWNER = 'vista.tests'

describe('versioned self-describing contract (decision 0061 / VST-R66)', () => {
  it.effect('decodeEnveloped decodes a current-version envelope to the payload', () =>
    Effect.gen(function* () {
      const payload = { repo: 'cli/cli', pr: 42 }
      const decode = decodeEnveloped(
        Schema.Struct({ repo: Schema.String, pr: Schema.Finite }),
        'wire',
      )
      const out = yield* decode({ apiVersion: VISTA_API_VERSION, payload })
      expect(out).toEqual(payload)
    }),
  )

  it.effect(
    'decodeEnveloped fails a non-current version as VersionSkew, NOT a payload ParseError',
    () =>
      Effect.gen(function* () {
        // The payload here would ALSO fail the schema (`"not-a-number"` is not a
        // Finite) — so getting a `VersionSkew` back proves the version boundary is
        // checked BEFORE the payload shape (the fail-closed short-circuit).
        const decode = decodeEnveloped(Schema.Finite, 'snapshot.json')
        const err = yield* Effect.flip(decode({ apiVersion: 3, payload: 'not-a-number' }))
        expect(err._tag).toBe('Vista.VersionSkew')
        expect(err).toBeInstanceOf(VersionSkew)
        const skew = err as VersionSkew
        expect(skew.expected).toBe(VISTA_API_VERSION)
        expect(skew.found).toBe(3)
        expect(skew.where).toBe('snapshot.json')
        // It is explicitly NOT the payload's ParseError.
        expect(Schema.isSchemaError(err)).toBe(false)
      }),
  )

  it('readEnvelope returns { _tag: "ok", payload } for a current-version envelope', () => {
    const payload = { a: 1, b: 'x' }
    expect(readEnvelope({ apiVersion: VISTA_API_VERSION, payload })).toEqual({
      _tag: 'ok',
      payload,
    })
  })

  it('readEnvelope keeps the three fail-closed outcomes DISTINCT (skew vs malformed)', () => {
    // A present-but-skewed artifact is `skew` (carrying the found version), NEVER
    // conflated with an absent one — this distinction is what stops a skewed
    // PUBLISHED snapshot from silently rendering live (OQ-FROZEN-SKEW-VISIBLE / 0068).
    expect(readEnvelope({ apiVersion: 3, payload: { a: 1 } })).toEqual({ _tag: 'skew', found: 3 })
    expect(readEnvelope({ payload: { a: 1 } })).toEqual({ _tag: 'malformed' })
    expect(readEnvelope({ apiVersion: 'nope', payload: {} })).toEqual({ _tag: 'malformed' })
    expect(readEnvelope(null)).toEqual({ _tag: 'malformed' })
    expect(readEnvelope('raw')).toEqual({ _tag: 'malformed' })
  })

  it.effect('encodeEnvelope round-trips through decodeEnveloped', () =>
    Effect.gen(function* () {
      const schema = Schema.Struct({ slug: Schema.String, n: Schema.Finite })
      const value = { slug: 'demo', n: 7 }
      const enveloped = yield* encodeEnvelope(schema)(value)
      expect(enveloped.apiVersion).toBe(VISTA_API_VERSION)
      const back = yield* decodeEnveloped(schema, 'roundtrip')(enveloped)
      expect(back).toEqual(value)
    }),
  )
})

/**
 * `meta.json` is authored IDENTITY, NOT a disposable snapshot — so it is plain (not
 * envelope-version-gated) and must keep resolving across a global-apiVersion bump
 * (SVC-R15/0004; the 0061 data-loss is scoped to frozen snapshots, not identity; see
 * OQ-META-ENVELOPE). The AppIndex `scanApp` projection decodes it through the
 * `VersionMeta` schema (B2): a valid version's identity is read in full; a
 * genuinely malformed file is excluded because exact owner/slug/version identity
 * cannot be established.
 */
describe('meta.json identity is durable (SVC-R15), malformed still skipped', () => {
  let dir: string

  const writeVersion = (slug: string, v: number, metaFileContents: string): void => {
    const vdir = join(dir, 'apps', '_owned', OWNER, slug, `v${v}`)
    mkdirSync(vdir, { recursive: true })
    // Every version needs index.html or scanApp `continue`s past it entirely.
    writeFileSync(join(vdir, 'index.html'), '<div id="root"></div>')
    writeFileSync(join(vdir, 'meta.json'), metaFileContents)
  }

  beforeAll(() => {
    mkdirSync(join(HERE, '..', 'tmp'), { recursive: true })
    dir = mkdtempSync(join(HERE, '..', 'tmp', 'vista-apiversion-'))
    process.env.VISTA_APPS = join(dir, 'apps')
    process.env.VISTA_CACHE = join(dir, '.vista-cache')
  })

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('reads a plain meta.json in full (identity durable); a malformed one is skipped', async () => {
    // `paths.ts` reads `VISTA_APPS` at import — reset the module graph so the
    // freshly-set env is honored (mirrors derive-projection.test.ts).
    vi.resetModules()
    const { scanApp } = await import('./registry.ts')

    const realMeta = {
      owner: OWNER,
      slug: 'idapp',
      version: 1,
      author: 'tester',
      timestamp: '2026-01-01T00:00:00Z',
      changeSummary: 'first',
      parent: null,
      title: 'Durable title',
      template: 'architecture-review',
    }
    // v1: a valid PLAIN meta.json — its identity must survive (never gated).
    writeVersion('idapp', 1, JSON.stringify(realMeta))
    // v2: a genuinely malformed meta.json (bad JSON) — the fail-closed skip case.
    writeVersion('idapp', 2, '{ this is not valid json')

    const st = scanApp(OWNER, 'idapp')
    expect(st).not.toBeNull()
    const v1 = st!.versions.find((x) => x.version === 1)!
    const v2 = st!.versions.find((x) => x.version === 2)

    // v1: full identity + projection read (durable).
    expect(v1.author).toBe('tester')
    expect(v1.title).toBe('Durable title')
    expect(v1.template).toBe('architecture-review')

    // v2: malformed identity is excluded rather than synthesized.
    expect(v2).toBeUndefined()
  })
})
