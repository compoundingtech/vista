/**
 * The versioned self-describing contract (decision 0061 / VST-R66). One global
 * `apiVersion` versions the ENTIRE vista contract — control RPC, interview,
 * runtime-policy, and every persisted snapshot. Every wire payload and every
 * persisted envelope is wrapped in the one shared `{ apiVersion, payload }`
 * envelope so nothing is decoded blind, and a reader is FAIL-CLOSED: a
 * non-current version is a typed {@link VersionSkew}, never a silent mis-decode
 * or a coercion. There is deliberately NO migration/compat machinery
 * (migration-avoidance) — a bump is a cutover, not a migration, and snapshots
 * written under an older version become unsupported (written data-loss contract).
 */
import { Effect, Result, Schema } from 'effect'

/**
 * The single global vista contract version. Bump when ANY covered shape changes
 * (control RPC / interview / runtime-policy / persisted snapshot). A bump is an
 * operational event with a known blast radius — old-version snapshots become
 * unsupported — so it must be rare, deliberate, and called out in the PR.
 */
export const VISTA_API_VERSION = 2

/** Shared wire-safe non-negative integer schema. */
export const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

/** Shared non-empty string schema with no leading or trailing whitespace. */
export const NonEmptyTrimmedString = Schema.NonEmptyString.check(Schema.isTrimmed())

/** A reader saw a non-current `apiVersion` — on the wire or on a persisted read. */
export class VersionSkew extends Schema.TaggedError<VersionSkew>()('Vista.VersionSkew', {
  /** The version this build speaks. Version numbers are `Int`, like the envelope's own. */
  expected: Schema.Int,
  /** The version the payload or persisted envelope declared (read through the envelope's `Int`). */
  found: Schema.Int,
  /** Where the skew was seen (e.g. `meta.json`, `snapshot.json`, an RPC tag). */
  where: Schema.String,
}) {}

/**
 * The `{ apiVersion, payload }` envelope schema for a given payload. `apiVersion`
 * decodes leniently as an `Int` here (so a skew is a {@link VersionSkew}, not a
 * shape `ParseError` from a `Literal` mismatch); the current-version check is
 * applied by {@link decodeEnveloped}. Encoding always stamps {@link VISTA_API_VERSION}.
 */
export const Envelope = <A, I, R>(
  payload: Schema.Codec<A, I, R, R>,
): Schema.Struct<{ apiVersion: typeof Schema.Int; payload: Schema.Codec<A, I, R, R> }> =>
  Schema.Struct({ apiVersion: Schema.Int, payload }).annotate({ identifier: 'Vista.Envelope' })

/**
 * Encode a payload into the envelope at {@link VISTA_API_VERSION} — the single
 * stamp used on the wire and before any `JSON.stringify` to disk.
 */
export const encodeEnvelope = <A, I, R>(
  payload: Schema.Codec<A, I, R, R>,
): ((
  value: A,
) => Effect.Effect<
  { readonly apiVersion: number; readonly payload: I },
  Schema.SchemaError,
  R
>) => {
  const encode = Schema.encodeEffect(payload)
  return (value: A) =>
    Effect.map(encode(value), (p) => ({ apiVersion: VISTA_API_VERSION, payload: p }))
}

/**
 * Decode an enveloped `unknown` FAIL-CLOSED (decision 0061): a non-current
 * `apiVersion` short-circuits to a typed {@link VersionSkew} BEFORE the payload
 * shape is considered, so a version bump never surfaces as a confusing payload
 * `ParseError`. `where` labels the failure site.
 */
export const decodeEnveloped = <A, I, R>(
  payload: Schema.Codec<A, I, R, R>,
  where: string,
): ((input: unknown) => Effect.Effect<A, Schema.SchemaError | VersionSkew, R>) => {
  const decodeVersion = Schema.decodeUnknownEffect(Schema.Struct({ apiVersion: Schema.Int }))
  const decodePayload = Schema.decodeUnknownEffect(Envelope(payload))
  return (input: unknown) =>
    Effect.gen(function* () {
      const { apiVersion } = yield* decodeVersion(input)
      if (apiVersion !== VISTA_API_VERSION) {
        return yield* new VersionSkew({ expected: VISTA_API_VERSION, found: apiVersion, where })
      }
      const decoded = yield* decodePayload(input)
      return decoded.payload
    })
}

/**
 * The RAW wire envelope carried by every `VistaControlApi` RPC request/response
 * (Track C wire / decision 0061). The payload stays `Unknown` on the transport
 * ON PURPOSE: the version boundary must be checked BEFORE the payload shape, so
 * the RPC schema cannot decode the real payload eagerly (that would surface a
 * shape `ParseError` on a bump instead of a typed {@link VersionSkew}). The real
 * per-RPC payload/success Schema is restored by {@link decodeEnveloped} in the
 * handler (server) and the client wrapper — two-phase, version-first, fail-closed.
 */
export const WireEnvelope = Schema.Struct({
  apiVersion: Schema.Int,
  payload: Schema.Unknown,
}).annotate({ identifier: 'Vista.WireEnvelope' })
export type WireEnvelope = typeof WireEnvelope.Type

const EnvelopeShape = Schema.decodeUnknownResult(
  Schema.Struct({ apiVersion: Schema.Int, payload: Schema.Unknown }),
)

/** The three DISTINCT outcomes of reading a persisted `{ apiVersion, payload }` envelope. */
export type EnvelopeResult =
  | { readonly _tag: 'ok'; readonly payload: unknown }
  | { readonly _tag: 'skew'; readonly found: number }
  | { readonly _tag: 'malformed' }

/**
 * Sync, browser-safe, FAIL-CLOSED read of an already-parsed persisted envelope
 * (decision 0061). Unlike a `payload | null` unwrap, this keeps the three
 * outcomes DISTINCT so a caller can tell an absent persisted envelope (its own
 * concern — signalled by the import throwing) from a PRESENT-but-unreadable one: both
 * `skew` (a non-current `apiVersion`) and `malformed` (not a well-formed
 * envelope) must fail closed — never fall through to a live/default render
 * (OQ-FROZEN-SKEW-VISIBLE / decision 0068). The per-block success schema still
 * validates the actual `payload` downstream — this layer only enforces the
 * version boundary, not the payload shape.
 */
export const readEnvelope = (input: unknown): EnvelopeResult => {
  const decoded = EnvelopeShape(input)
  if (Result.isFailure(decoded)) return { _tag: 'malformed' }
  const { apiVersion, payload } = decoded.success
  return apiVersion === VISTA_API_VERSION
    ? { _tag: 'ok', payload }
    : { _tag: 'skew', found: apiVersion }
}

/**
 * Wrap an already-encoded `payload` in the `{ apiVersion, payload }` envelope at
 * {@link VISTA_API_VERSION} — the sync writer counterpart to {@link readEnvelope},
 * so one place owns the envelope key names and the version stamp before any
 * `JSON.stringify` to disk (decision 0061 / VST-R66).
 */
export const wrapEnvelope = <A>(
  payload: A,
): { readonly apiVersion: number; readonly payload: A } => ({
  apiVersion: VISTA_API_VERSION,
  payload,
})
