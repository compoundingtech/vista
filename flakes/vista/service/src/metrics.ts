/**
 * Service-side OTel metrics (Track G4 / OBS-R72). Effect-`Metric` singletons —
 * the repo idiom: declare once here, tag per-call at the emit site — exported
 * through the already-wired `withTelemetry` (decision 0062). No new dependency:
 * these are the same `Metric` primitives as `vista_cli_invocations` (CLI) and
 * `vista_version_skew` (wire). Counters carry NO `_total` suffix (the OTLP →
 * Prometheus bridge adds it); duration histograms are milliseconds (`Metric.timer`).
 */
import { Clock, Duration, Effect, Metric } from 'effect'

/** Publish operations, tagged `outcome` = published | aborted | failed. */
export const publishOperations = Metric.counter('vista_publish_operations', {
  description: 'vista publish operations over the control plane, tagged by outcome',
})
/** Wall-clock duration of a publish (freeze + emit), all outcomes. */
export const publishDuration = Metric.timer('vista_publish_duration_ms', {
  description: 'vista publish duration',
})

/** Freeze-capture passes (one per publish that has frozen blocks). */
export const freezeOperations = Metric.counter('vista_freeze_operations', {
  description: 'vista freeze-capture passes',
})
/** Wall-clock duration of a freeze-capture pass. */
export const freezeDuration = Metric.timer('vista_freeze_duration_ms', {
  description: 'vista freeze-capture duration',
})
/** Per-block freeze outcome, tagged `outcome` = captured | failed | secret-blocked | effectful-refused. */
export const freezeBlocks = Metric.counter('vista_freeze_blocks', {
  description: 'vista freeze per-block capture outcomes, tagged by outcome',
})

/** Provider calls, tagged by provider, rpc, path (live|capture), and outcome. */
export const dataCalls = Metric.counter('vista_data_calls', {
  description: 'vista data provider calls',
})
/** Duration of one unary provider call, tagged by provider, rpc, and path. */
export const dataCallDuration = Metric.timer('vista_data_call_duration_ms', {
  description: 'vista data provider call duration',
})
/** Snapshot hydration attempts, tagged by outcome (success|error). */
export const dataHydrations = Metric.counter('vista_data_hydrations', {
  description: 'vista snapshot hydration attempts',
})
/** Explicit and cadenced data refresh attempts, tagged by outcome (success|error). */
export const dataRefreshes = Metric.counter('vista_data_refreshes', {
  description: 'vista data refresh attempts',
})
/** Provider retry attempts, excluding the initial attempt. */
export const providerRetries = Metric.counter('vista_provider_retries', {
  description: 'vista provider retry attempts',
})
/** Provider attempts that reached their timeout. */
export const providerTimeouts = Metric.counter('vista_provider_timeouts', {
  description: 'vista provider timeouts',
})
/** Last observed upstream quota, tagged by provider and resource. */
export const providerRateLimitRemaining = Metric.gauge('vista_provider_rate_limit_remaining', {
  description: 'vista provider upstream calls remaining',
})
/** Active downstream subscription viewers, tagged by provider and rpc. */
export const streamSubscriptions = Metric.gauge('vista_stream_subscriptions', {
  description: 'vista active stream subscription viewers',
})
/** Accepted subscription events, tagged by provider and rpc. */
export const streamEvents = Metric.counter('vista_stream_events', {
  description: 'vista accepted live subscription events',
})
/** Active upstream pollers or subscribable streams, tagged by provider. */
export const livePollers = Metric.gauge('vista_live_pollers', {
  description: 'vista active live provider upstreams',
})
/** Live binding hibernation attempts, tagged by outcome. */
export const liveHibernations = Metric.counter('vista_live_hibernations', {
  description: 'vista live binding hibernations',
})
/** Provider budget delay in milliseconds, tagged by provider and resource. */
export const providerThrottleWait = Metric.histogram('vista_provider_throttle_wait_ms', {
  description: 'vista provider rate limiter delay',
  boundaries: Metric.linearBoundaries({ start: 1, width: 50, count: 20 }),
})

/**
 * COUNT of currently-dark published versions: a scanned published version whose
 * frozen `snapshot.json` fails closed — either `skew` (a non-current `apiVersion`
 * after a contract bump) or `malformed` (present but not a well-formed envelope) —
 * renders `unsupported` (SVC-R15 / decisions 0061, 0069, 0072). A GAUGE, not a
 * counter: it is STATE (how many published versions are dark right now), not an
 * event count. It is recomputed and `set` each scan, tagged by `reason`
 * (`skew` | `malformed`) ONLY — the loud, server-side counterpart of the wire
 * `vista_version_skew`. Authored identity (meta.json) is deliberately NOT gated,
 * so it is never dark.
 *
 * BOTH reasons are `set` every scan (to `0` when none), so a reason that drops back
 * to zero is explicitly reset rather than lingering — no stale series survives an
 * app being retired, and cardinality is bounded to exactly two series. The
 * per-version detail (WHICH version is dark) lives in a structured warn log at the
 * scan seam, not in metric labels, so `slug`/`version` never inflate cardinality.
 */
export const snapshotSkew = Metric.gauge('vista_snapshot_skew', {
  description:
    'vista count of currently-dark published versions (frozen snapshot.json unsupported), set each scan, tagged by reason (skew|malformed)',
})

/** Control-plane RPC requests, tagged `rpc` (the RPC tag) + `outcome` = ok | error. */
export const rpcRequests = Metric.counter('vista_rpc_requests', {
  description: 'vista control-plane RPC requests, tagged by rpc and outcome',
})
/** Control-plane RPC handler duration, tagged `rpc`. */
export const rpcDuration = Metric.timer('vista_rpc_duration_ms', {
  description: 'vista control-plane RPC handler duration',
})

/** Record elapsed monotonic time for both successful and failed effects. */
export const trackDuration =
  (metric: Metric.Histogram<Duration.Duration>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Clock.monotonicTimeNanos.pipe(
      Effect.flatMap((startedAt) =>
        effect.pipe(
          Effect.ensuring(
            Clock.monotonicTimeNanos.pipe(
              Effect.flatMap((endedAt) => Metric.update(metric, Duration.nanos(endedAt - startedAt))),
            ),
          ),
        ),
      ),
    )
