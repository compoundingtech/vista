/**
 * The control-RPC WIRE envelope seam (Track C wire / decision 0061 / VST-R66).
 *
 * Every `VistaControlApi` request and response travels as the raw
 * {@link WireEnvelope} (`{ apiVersion, payload: Unknown }`). These helpers restore
 * the real per-RPC typing with the two-phase, version-first {@link decodeEnveloped}
 * so a version-skewed call FAILS CLOSED as a typed {@link VersionSkew} — never a
 * silent mis-decode and never a payload `ParseError` (the version boundary is
 * checked before the payload shape). A malformed envelope (not a skew) is a
 * protocol defect, not a domain error.
 *
 * The LOUD half (OQ-FROZEN-SKEW-VISIBLE): every skew seen at a read seam emits a
 * warn log + increments {@link versionSkewTotal} (tagged by `where`), reusing the
 * already-wired `withTelemetry` — no new dependency.
 */
import { Effect, Metric, Schema } from 'effect'

import { decodeEnveloped, encodeEnvelope, VersionSkew, type WireEnvelope } from './api-version.ts'
import { rpcDuration, rpcRequests, trackDuration } from './metrics.ts'

/** The stand-in payload for a no-argument RPC (still version-gated both ways). */
export const NoPayload = Schema.Null

/**
 * Loud-half counter (decision 0061 / OQ-FROZEN-SKEW-VISIBLE): a typed
 * {@link VersionSkew} seen at any read seam increments this, tagged by `where`
 * (the RPC request/response site, or a persisted artifact). Exported so a test
 * can read a tagged value.
 */
export const versionSkewTotal = Metric.counter('vista_version_skew', {
  description: 'vista contract version-skew events seen at a read seam, tagged by where',
})

/**
 * {@link decodeEnveloped} + the LOUD half: on a typed {@link VersionSkew}, emit a
 * warn log and increment {@link versionSkewTotal} (tagged `where`) before
 * re-failing. A `ParseError` (malformed, not skewed) passes through untouched.
 */
export const decodeEnvelopedLoud = <A, I, R>(
  payload: Schema.Codec<A, I, R, R>,
  where: string,
): ((input: unknown) => Effect.Effect<A, Schema.SchemaError | VersionSkew, R>) => {
  const decode = decodeEnveloped(payload, where)
  return (input) =>
    decode(input).pipe(
      Effect.tapError((e) =>
        e instanceof VersionSkew
          ? Effect.logWarning(
              `vista contract version skew at ${where}: expected ${e.expected}, found ${e.found}`,
            ).pipe(
              Effect.andThen(
                Metric.update(Metric.withAttributes(versionSkewTotal, { where }), 1),
              ),
            )
          : Effect.void,
      ),
    )
}

/**
 * Build a `VistaControlApi` handler that speaks the wire envelope: decode the
 * request envelope (typed {@link VersionSkew} on skew, defect on a malformed
 * envelope), run the real handler `fn` on the restored typed input, and
 * re-envelope the success. The RPC's declared `error` MUST include
 * {@link VersionSkew}; a `where`-labelled skew is the only new expected failure.
 */
export const wireHandler =
  <PA, PI, PR, SA, SI, SR, E, R>(
    tag: string,
    payload: Schema.Codec<PA, PI, PR, PR>,
    success: Schema.Codec<SA, SI, SR, SR>,
    fn: (input: PA) => Effect.Effect<SA, E, R>,
  ) =>
  (env: WireEnvelope): Effect.Effect<WireEnvelope, E | VersionSkew, PR | SR | R> =>
    Effect.gen(function* () {
      const input = yield* decodeEnvelopedLoud(payload, `${tag}.request`)(env).pipe(
        Effect.catchIf(
          (e) => !(e instanceof VersionSkew),
          (e) => Effect.die(e),
        ),
      )
      const result = yield* fn(input)
      return yield* Effect.orDie(encodeEnvelope(success)(result))
    }).pipe(
      // RPC-latency histogram + request counter (Track G4 / OBS-R72), tagged by
      // the RPC tag. Duration is recorded for every outcome; the counter's
      // `outcome` distinguishes a handler success from a (skew/domain) failure.
      trackDuration(Metric.withAttributes(rpcDuration, { rpc: tag })),
      Effect.tap(() =>
        Metric.update(Metric.withAttributes(rpcRequests, { rpc: tag, outcome: 'ok' }), 1),
      ),
      Effect.tapError(() =>
        Metric.update(
          Metric.withAttributes(rpcRequests, { rpc: tag, outcome: 'error' }),
          1,
        ),
      ),
    )

/**
 * Client-side counterpart: envelope the request, call the raw RPC, and decode the
 * response envelope with the LOUD, version-first, fail-closed seam. `VersionSkew`
 * surfaces ABOVE any `RpcClientError → ServiceUnreachable` mapping (distinct tag),
 * so a skew is never reclassified as unreachable.
 */
export const wireCall =
  <PA, PI, PR, SA, SI, SR>(
    tag: string,
    payload: Schema.Codec<PA, PI, PR, PR>,
    success: Schema.Codec<SA, SI, SR, SR>,
  ) =>
  <E, R>(
    rawCall: (env: WireEnvelope) => Effect.Effect<WireEnvelope, E, R>,
    input: PA,
  ): Effect.Effect<SA, E | VersionSkew, PR | SR | R> =>
    Effect.gen(function* () {
      const env = yield* Effect.orDie(encodeEnvelope(payload)(input))
      const respEnv = yield* rawCall(env)
      return yield* decodeEnvelopedLoud(success, `${tag}.response`)(respEnv).pipe(
        Effect.catchIf(
          (e) => !(e instanceof VersionSkew),
          (e) => Effect.die(e),
        ),
      )
    })
