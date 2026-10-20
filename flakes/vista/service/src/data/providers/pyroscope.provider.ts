/**
 * LIVE `pyroscope`/profiles provider (decisions 0026, 0027, 0041): the flamegraph
 * half of "wire live data sources". One rpc against a Pyroscope backend:
 *
 *  - `getProfile({ profileTypeId, labelSelector, from, until })` → a backend-faithful
 *    {@link ProfileResult} (the Pyroscope flamebearer). The Connect/gRPC-over-HTTP
 *    `QuerierService.SelectMergeStacktraces` POST returns a merged stacktrace tree
 *    as `{ flamegraph: { names, levels, total, maxSelf } }`; we Schema-decode it and
 *    carry the flamebearer through VERBATIM (decision 0041: the wire/freeze shape is
 *    backend-faithful — the flamebearer → `@grafana/flamegraph` nested-set DataFrame
 *    adaptation happens client-side at the island edge, not here).
 *
 * The flamebearer `levels` are BFS, each a flat `[offsetDelta, total, self, nameIdx]`
 * quad list; Pyroscope encodes the int64 counts as JSON STRINGS (protojson), so the
 * provider Schema coerces them to numbers (safe: profile counts/durations stay well
 * under 2^53, unlike trace epoch-nanos). The names table and level structure are
 * preserved exactly so the island reconstructs the tree faithfully.
 *
 * EFFECTFUL (decision 0031): running `core` reads live from Pyroscope over the
 * network, so the freeze auto-capture pass refuses a `flamegraph` block unless the
 * block explicitly acknowledges effectful capture.
 */
import {
  pyroscope,
  ProfileResult,
  PyroscopeApi,
  PyroscopeError,
} from '@vista/blocks/internal/provider-contracts'
import { Config, Effect, Schema, SchemaTransformation } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import * as HttpClientResponse from 'effect/http/HttpClientResponse'

import { implement, mountProvider } from '../provider.ts'
export { ProfileResult, PyroscopeApi, PyroscopeError }

/**
 * Pyroscope base; overridable for non-dev3 hosts/tests via the
 * `VISTA_PYROSCOPE_URL` env var, resolved through Effect `Config` (mirrors the
 * otel/trace providers / the `otelEndpointFromConfig` idiom in
 * `@overeng/utils/node/otel`). A LAZY config descriptor, only read when
 * `yield*`-ed inside the effectful fetch path (SSR), never at module eval — app
 * code imports this module for its schemas and a browser has no `process.env`
 * (decision 0046 browser-import safety). A malformed value at the edge is a defect
 * (`Effect.orDie`), keeping the request effect's error channel
 * `PyroscopeError`-only.
 */
const pyroscopeBase = Effect.orDie(
  Config.String('VISTA_PYROSCOPE_URL').pipe(Config.withDefault('http://127.0.0.1:42035')),
)

/**
 * Pyroscope encodes int64 counts as JSON strings (protojson); `total`/`maxSelf`
 * may arrive as either a number or a string. Coerce both to `number` (profile
 * counts/durations are well under 2^53, so JS `number` is faithful).
 */
const Int64 = Schema.Union([Schema.Finite, Schema.String]).pipe(
  Schema.decodeTo(
    Schema.Finite,
    SchemaTransformation.transform({
      decode: (v) => (typeof v === 'number' ? v : Number(v)),
      encode: (n) => n,
    }),
  ),
)
/**
 * One backend-faithful flamebearer (the `pyroscope` provider success shape, decision
 * 0041), and exactly what the island's `mountFlamegraph` reconstructs into a
 * `@grafana/flamegraph` nested-set DataFrame.
 */

/** The raw `SelectMergeStacktraces` wire shape (decoded by Schema, then projected). */
const RawLevel = Schema.Struct({ values: Schema.Array(Int64) })
/**
 * Schema describing the raw Pyroscope flamebearer payload, validating the symbol name list,
 * stacked level rows, and Int64 total/maxSelf counters before they are projected.
 */
export const RawFlamegraph = Schema.Struct({
  flamegraph: Schema.Struct({
    names: Schema.Array(Schema.String),
    levels: Schema.Array(RawLevel),
    total: Int64,
    maxSelf: Int64,
  }),
})

/** Project a decoded Pyroscope flamebearer into the provider's success shape. */
export const projectFlamegraph = (
  profileTypeId: string,
  labelSelector: string,
  decoded: typeof RawFlamegraph.Type,
): ProfileResult =>
  new ProfileResult({
    profileTypeId,
    labelSelector,
    names: decoded.flamegraph.names,
    levels: decoded.flamegraph.levels.map((l) => l.values),
    total: decoded.flamegraph.total,
    maxSelf: decoded.flamegraph.maxSelf,
  })

const getProfile = (
  profileTypeId: string,
  labelSelector: string,
  from: number,
  until: number,
): Effect.Effect<ProfileResult, PyroscopeError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ profileTypeId, labelSelector })
    // TraceQL-style selector requires a non-empty matcher; `{}` matches all.
    const selector = labelSelector.trim() === '' ? '{}' : labelSelector
    const base = yield* pyroscopeBase
    const url = `${base}/querier.v1.QuerierService/SelectMergeStacktraces`
    const req = HttpClientRequest.post(url).pipe(
      HttpClientRequest.bodyJsonUnsafe({
        profile_typeID: profileTypeId,
        label_selector: selector,
        start: from,
        end: until,
      }),
    )
    const client = yield* HttpClient.HttpClient
    const res = yield* client.execute(req)
    if (res.status < 200 || res.status >= 300) {
      return yield* new PyroscopeError({
        message: `Pyroscope SelectMergeStacktraces ${res.status} for ${profileTypeId}`,
      })
    }
    const decoded = yield* HttpClientResponse.schemaBodyJson(RawFlamegraph)(res)
    return projectFlamegraph(profileTypeId, selector, decoded)
  }).pipe(
    Effect.catchIf(
      (e) => !(e instanceof PyroscopeError),
      (e) =>
        Effect.fail(new PyroscopeError({ message: `pyroscope getProfile failed: ${String(e)}` })),
    ),
  )

/**
 * Effectful implementation of the pyroscope provider whose getProfile handler rejects a blank
 * profileTypeId with a PyroscopeError and otherwise delegates to getProfile.
 */
export const pyroscopeImplementation = implement(pyroscope, {
  purity: 'effectful',
  handlers: {
    getProfile: ({ profileTypeId, labelSelector, from, until }) =>
      profileTypeId.trim() === ''
        ? Effect.fail(new PyroscopeError({ message: 'empty profileTypeId' }))
        : getProfile(profileTypeId, labelSelector, from, until),
  },
})

export default mountProvider(pyroscopeImplementation, FetchHttpClient.layer)
