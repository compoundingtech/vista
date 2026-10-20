/**
 * Unit coverage for the canonical-URL decoupling (decision 0051 / SVC-R55):
 *   - the loopback RPC transport (`serviceUrl`) is a DISTINCT concern from the
 *     emitted, human-facing app URL (`urlFor`);
 *   - `urlFor` builds from the deploy-time `VISTA_PUBLIC_URL`, not the loopback;
 *   - an unset `VISTA_PUBLIC_URL` is fail-loud, unless `--local`/`VISTA_LOCAL`
 *     opts into emitting the loopback URL clearly marked non-canonical.
 *
 * Emission is driven purely by config (`ConfigProvider.fromEnvRecord`) — there is no
 * runtime resolver, subprocess, or network on Vista's emit path (decision 0051,
 * revised): Vista only ever emits its OWN URLs, plumbed at deploy time.
 */
import { it } from '@effect/vitest'
import { ConfigProvider, Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'

import { parseExactVersion, runPublish } from '../src/index.ts'
import {
  CanonicalUrlUnresolved,
  InvalidOwnerIdentity,
  ServiceUnreachable,
  VistaClient,
} from '../src/VistaClient.ts'

const LOOPBACK = 'http://127.0.0.1:1'
const CANONICAL_BASE = 'https://vista-test.test-tailnet.ts.net'

/** Build the VistaClient layer under a hermetic environment provider. */
const clientLayer = (env: Record<string, string>) =>
  VistaClient.Default.pipe(
    Layer.provide(
      ConfigProvider.layer(ConfigProvider.fromEnvRecord(env, { preserveEmptyStrings: true })),
    ),
  )

const canonicalEnv = {
  VISTA_URL: LOOPBACK,
  VISTA_PUBLIC_URL: CANONICAL_BASE,
  ST_AGENT: 'dev3.owner',
}

describe('canonical version selectors', () => {
  it('accepts only exact vN selectors', () => {
    expect(parseExactVersion('v1')).toBe(1)
    expect(parseExactVersion('v42')).toBe(42)
    expect(['1', 'V2', 'v0', 'v01', 'latest'].map(parseExactVersion)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})

describe('canonical app URL (decision 0051 / SVC-R55)', () => {
  it.effect('uses the service owner encoder for routes', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const versioned = yield* vista.urlFor('my-review', 'v1')
      expect(versioned.url).toBe(`${CANONICAL_BASE}/r/o-646576332e6f776e657221/my-review/v1/`)
    }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, ST_AGENT: 'dev3.owner!' }))),
  )

  it.effect('keeps the native subject exact in a reserved-character-free segment', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const versioned = yield* vista.urlFor('my-review', 'v1')
      expect(versioned.url).toBe(`${CANONICAL_BASE}/r/o-6167656e742f76697374612f617574686f72/my-review/v1/`)
    }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, ST_AGENT: 'agent/vista/author' }))),
  )

  it.effect('does not decode literal percent escapes in historical owner claims', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const versioned = yield* vista.urlFor('my-review', 'v1')
      expect(versioned.url).toBe(`${CANONICAL_BASE}/r/o-646576332e6167656e742532467669737461253246617574686f72/my-review/v1/`)
    }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, ST_AGENT: 'dev3.agent%2Fvista%2Fauthor' }))),
  )

  it.effect('builds the canonical URL from VISTA_PUBLIC_URL, not the loopback transport', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      // The transport target stays loopback — decoupled from the emitted URL.
      expect(vista.serviceUrl).toBe(LOOPBACK)

      const latest = yield* vista.urlFor('my-review')
      expect(latest).toEqual({
        url: `${CANONICAL_BASE}/r/o-646576332e6f776e6572/my-review/latest`,
        canonical: true,
      })

      const versioned = yield* vista.urlFor('my-review', 'v3')
      expect(versioned).toEqual({
        url: `${CANONICAL_BASE}/r/o-646576332e6f776e6572/my-review/v3/`,
        canonical: true,
      })
    }).pipe(Effect.provide(clientLayer(canonicalEnv))),
  )

  it.effect('tolerates a trailing slash on VISTA_PUBLIC_URL', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const latest = yield* vista.urlFor('my-review')
      expect(latest.url).toBe(`${CANONICAL_BASE}/r/o-646576332e6f776e6572/my-review/latest`)
    }).pipe(
      Effect.provide(clientLayer({ ...canonicalEnv, VISTA_PUBLIC_URL: `${CANONICAL_BASE}/` })),
    ),
  )

  it.effect('fails loud when no canonical URL is configured and local mode is not opted into', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const error = yield* Effect.flip(vista.urlFor('my-review'))
      expect(error).toBeInstanceOf(CanonicalUrlUnresolved)
      expect(error.message).toContain('VISTA_PUBLIC_URL')
    }).pipe(Effect.provide(clientLayer({ VISTA_URL: LOOPBACK, ST_AGENT: 'dev3.owner' }))),
  )

  it.effect('emits the loopback URL marked non-canonical under the --local opt-in', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const local = yield* vista.urlFor('my-review', 'v2', { local: true })
      expect(local).toEqual({ url: `${LOOPBACK}/r/o-646576332e6f776e6572/my-review/v2/`, canonical: false })
    }).pipe(Effect.provide(clientLayer({ VISTA_URL: LOOPBACK, ST_AGENT: 'dev3.owner' }))),
  )

  it.effect('honors VISTA_LOCAL=true as the env opt-in for non-canonical emission', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const local = yield* vista.urlFor('my-review')
      expect(local).toEqual({ url: `${LOOPBACK}/r/o-646576332e6f776e6572/my-review/latest`, canonical: false })
    }).pipe(
      Effect.provide(
        clientLayer({ VISTA_URL: LOOPBACK, VISTA_LOCAL: 'true', ST_AGENT: 'dev3.owner' }),
      ),
    ),
  )

  it.effect('prefers the canonical URL even when VISTA_LOCAL is set', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const url = yield* vista.urlFor('my-review')
      expect(url).toEqual({
        url: `${CANONICAL_BASE}/r/o-646576332e6f776e6572/my-review/latest`,
        canonical: true,
      })
    }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, VISTA_LOCAL: 'true' }))),
  )

  // The `publish` guard (`ensureUrlEmittable`) MUST fail exactly where `urlFor`'s
  // fail branch does — they share the `resolveEmission` predicate, so a divergence
  // (e.g. the guard admitting a config `urlFor` would later reject) is a bug. This
  // pins that agreement across all three config cases (canonical / local / neither).
  it.effect('ensureUrlEmittable agrees with urlFor: succeeds where urlFor emits', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      yield* vista.ensureUrlEmittable({ local: false })
      // Parity: urlFor emits (canonical) under the same config.
      const { canonical } = yield* vista.urlFor('my-review')
      expect(canonical).toBe(true)
    }).pipe(Effect.provide(clientLayer(canonicalEnv))),
  )

  it.effect('ensureUrlEmittable agrees with urlFor: succeeds under the --local opt-in', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      yield* vista.ensureUrlEmittable({ local: true })
      const { canonical } = yield* vista.urlFor('my-review', undefined, { local: true })
      expect(canonical).toBe(false)
    }).pipe(Effect.provide(clientLayer({ VISTA_URL: LOOPBACK, ST_AGENT: 'dev3.owner' }))),
  )

  it.effect('ensureUrlEmittable agrees with urlFor: fails loud where urlFor rejects', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const guardError = yield* Effect.flip(vista.ensureUrlEmittable({ local: false }))
      const urlError = yield* Effect.flip(vista.urlFor('my-review'))
      expect(guardError).toBeInstanceOf(CanonicalUrlUnresolved)
      expect(urlError).toBeInstanceOf(CanonicalUrlUnresolved)
    }).pipe(Effect.provide(clientLayer({ VISTA_URL: LOOPBACK, ST_AGENT: 'dev3.owner' }))),
  )
})

describe('service-owned AppSource resolution', () => {
  it.effect('sends only owner and slug without requiring client-side sources configuration', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const errors = yield* Effect.all(
        [
          vista.newApp('my-review'),
          vista.publishPreview('my-review'),
          vista.publish('my-review', 'summary'),
          vista.rehydrate('my-review'),
          vista.publishPlan('my-review'),
        ].map(Effect.flip),
        { concurrency: 'unbounded' },
      )
      for (const error of errors) expect(error).toBeInstanceOf(ServiceUnreachable)
    }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, ST_AGENT: 'dev3.owner' }))),
  )

  it.effect('rejects invalid owners only when an owner-scoped operation runs', () =>
    Effect.gen(function* () {
      for (const owner of ['..', 'dev3.', 'dev3..', 'dev3...', 'dev/3.owner', 'agent/', 'agent/a//b', 'agent/a/../b', 'agent/A/b', 'agent%2Fvista%2Fauthor']) {
        const error = yield* Effect.flip(
          Effect.gen(function* () {
            const vista = yield* VistaClient
            yield* vista.newApp('my-review')
          }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, ST_AGENT: owner }))),
        )
        expect(error).toBeInstanceOf(InvalidOwnerIdentity)
      }
    }),
  )

  it.effect('constructs an owner-free client without ST_AGENT and requires it only on demand', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      expect(vista.serviceUrl).toBe(LOOPBACK)
      const ownerFreeError = yield* Effect.flip(vista.serviceInfo())
      expect(ownerFreeError).toBeInstanceOf(ServiceUnreachable)
      const error = yield* Effect.flip(vista.newApp('my-review'))
      expect(String(error)).toContain('ST_AGENT')
    }).pipe(Effect.provide(clientLayer({ VISTA_URL: LOOPBACK }))),
  )

  it.effect('ignores a bogus ST_AGENT for owner-free operations', () =>
    Effect.gen(function* () {
      const vista = yield* VistaClient
      const errors = yield* Effect.all(
        [vista.list(), vista.serviceInfo(), vista.runtimePolicy(), vista.diagnoseImport('react')]
          .map(Effect.flip),
        { concurrency: 'unbounded' },
      )
      for (const error of errors) expect(error).toBeInstanceOf(ServiceUnreachable)
    }).pipe(Effect.provide(clientLayer({ ...canonicalEnv, ST_AGENT: 'bogus' }))),
  )
})

/**
 * P2 (PR #1218): `publish` FREEZES the draft + moves `latest` (irreversible), so
 * a URL-config error surfacing AFTER a successful publish would leave a version
 * behind and a `--local` retry would double-publish. `runPublish` must therefore
 * fail the URL precondition BEFORE reaching `publish`.
 *
 * The ordering is proven WITHOUT mocking (house no-mocking discipline) by the
 * error TAG: `publish` crosses the RPC transport, so if it were ever reached with
 * a closed transport it would surface `Vista.ServiceUnreachable`. A
 * `CanonicalUrlUnresolved` therefore means the freeze was never attempted; a
 * `ServiceUnreachable` (only under `--local`, once the guard admits emission)
 * means `publish` WAS reached — the two cases straddle the guard and pin its order.
 */
describe('publish freezes only after the app URL is guaranteed emittable (P2 ordering)', () => {
  // A definitely-closed transport target: reaching `publish` (the irreversible
  // freeze) here would refuse the connection → `ServiceUnreachable`.
  const CLOSED_TRANSPORT = 'http://127.0.0.1:1'

  it.effect(
    'fails CanonicalUrlUnresolved BEFORE publish when no canonical URL and no --local',
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          runPublish({
            localSlug: 'my-review',
            message: 'summary',
            local: false,
            json: true,
            dryRun: false,
          }),
        )
        // A URL error, NOT ServiceUnreachable → the transport was never touched →
        // publish/freeze was never attempted, so nothing is left behind to retry.
        expect(error).toBeInstanceOf(CanonicalUrlUnresolved)
      }).pipe(Effect.provide(clientLayer({ VISTA_URL: CLOSED_TRANSPORT, ST_AGENT: 'dev3.owner' }))),
  )

  it.effect('reaches publish (transport error, not a URL error) once --local admits emission', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        runPublish({
          localSlug: 'my-review',
          message: 'summary',
          local: true,
          json: true,
          dryRun: false,
        }),
      )
      // The guard admitted local emission, so publish WAS reached; the closed
      // transport then surfaces ServiceUnreachable — proving publish is downstream
      // of the guard, not upstream.
      expect(error).toBeInstanceOf(ServiceUnreachable)
    }).pipe(
      Effect.provide(
        clientLayer({ VISTA_URL: CLOSED_TRANSPORT, ST_AGENT: 'dev3.owner' }),
      ),
    ),
  )
})
