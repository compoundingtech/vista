# Grafana-style metric modes on the real otel path — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk2/metrics-live/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Whether frozen, live, and subscription modes cover real Grafana-style metric panels.

## Method

A real Mimir Provider exercised relative-range resolution, snapshot capture, live polling, subscription delivery, folding, cursors, and bounded point sets.

## Result

All three author-declared modes fit one RPC-first operation; live and subscription ship a snapshot first, while frozen remains byte/time stable.

## Conclusion

All three author-declared modes fit one RPC-first operation; live and subscription ship a snapshot first, while frozen remains byte/time stable.

## VRS Impact

Include all three BindingModes and retain explicit requested and resolved ranges in metric-domain values.

## Source Report

# Grafana-style metric modes on the real otel path

## Result

The slice proves the three author-declared modes against the reachable Mimir endpoint used by Vista's real provider path. `VISTA_MIMIR_URL` was unset, so the existing default `http://127.0.0.1:42030` applied. A direct Prometheus query returned a successful scalar and `query_range` returned a non-empty `alloy_build_info` matrix. No scripted Layer or `axe otel gcx metrics query` fallback was needed.

The implementation is RPC-first: `queryRpc = Rpc.make('query', ...)`, `otel = contract({ id: 'otel', group: RpcGroup.make(queryRpc) })`, and `OtelImplementation = implement(otel, ...)`. `MimirLive` is the server-only service Layer. `mountProvider(OtelImplementation, MimirLive)` provides the dependency once at the provider boundary. The browser imports the derived operation descriptor, never Mimir/config/server code. The working UI uses minimal SVG and HTML rather than the telemetry island.

## Honest range schema

```ts
type TimeRange =
  | { readonly kind: 'relative'; readonly last: '30s' | '1m' | '5m' | '15m' | '1h' | '6h' | '24h' }
  | { readonly kind: 'absolute'; readonly start: number; readonly end: number }

type MetricQueryArgs = {
  readonly promql: string
  readonly range: TimeRange
  readonly stepSeconds: number
  readonly points: number
}

type MetricSnapshot = {
  readonly schemaVersion: 1
  readonly capturedAt: number
  readonly requestedRange: TimeRange
  readonly resolvedRange: { readonly kind: 'absolute'; readonly start: number; readonly end: number }
  readonly query: string
  readonly stepSeconds: number
  readonly points: number
  readonly result: MetricResult
}
```

Yes: `{ kind: 'relative', last: '1h' }` belongs in authored args and the resolved absolute range belongs in the snapshot value. Replacing the authored relative value with absolutes would lose author intent; storing only the relative value would make a frozen artifact irreproducible and its label dishonest.

`resolveRange(args, at)` is pure. It first resolves the requested range at the supplied capture/poll instant. It then applies the explicit point cap: `start = max(requestedStart, end - (points - 1) * stepSeconds)`. Thus an undersized point cap cannot silently claim to show a full hour: the UI displays both `requested last 1h` and the actual absolute `resolvedRange`. The demo's point counts cover the full requested hour.

Frozen capture calls this once with the publication clock and persists the result. Live/subscription calls it for every poll, so `last 1h` advances. No `Date.now()` is hidden inside schema/key construction.

## RPC-first provider and live driver signatures

```ts
const queryRpc = Rpc.make('query', {
  payload: MetricQueryArgs,
  success: MetricSnapshot,
  error: MimirError,
})

interface MimirShape {
  readonly query: (request: {
    readonly promql: string
    readonly range: AbsoluteRange
    readonly stepSeconds: number
  }) => Effect.Effect<readonly Series[], MimirError>
}

interface MetricDriver<R> {
  readonly initial: (
    args: MetricQueryArgs,
    at: number,
  ) => Effect.Effect<MetricSnapshot, MimirError, R>
  readonly poll: (
    args: MetricQueryArgs,
    since: number,
    at: number,
  ) => Effect.Effect<MetricDelta, MimirError, R>
  readonly fold: (state: MetricSnapshot, event: MetricDelta) => MetricSnapshot
  readonly cursor: (state: MetricSnapshot) => number
}
```

`cursor` is the latest sample timestamp, not the poll time. `poll` asks Mimir only for `[max(newWindow.start, cursor + step), newWindow.end]`. `fold` deduplicates by series id and timestamp, appends new samples, drops samples older than the new absolute window, and enforces `points`. The unit test proves append/drop and cursor behavior.

`MetricHub` owns one state per `snapshotKey`. The live HTTP path calls `hub.poll`; the subscription path registers an NDJSON subscriber on the same entry and starts the same `metricDriver.poll → fold → cursor` loop. Subscription is therefore a delivery mode over the pollable driver, not a second data implementation. In production this entry belongs in the lifecycle prototype's AppVersion-scoped `RcMap`; the throwaway uses an in-process `Map` only to isolate metric semantics.

## Public author surface and client result

```ts
type MetricQueryProps = {
  readonly query: string
  readonly range?: TimeRange                 // default { kind: 'relative', last: '1h' }
  readonly stepSeconds?: number
  readonly points?: number
  readonly mode?: 'frozen' | 'live' | 'subscription' // default frozen
  readonly refreshEvery?: number             // required/used for live + subscription
  readonly title?: string
  readonly caption?: string
}

const binding = bind(otel.ops.query, args, {
  mode: 'live',
  refreshEvery: 10_000,
})

type Resolved<A> =
  | { readonly _tag: 'Frozen'; readonly value: A; readonly at: number }
  | { readonly _tag: 'CatchingUp'; readonly value: A; readonly at: number }
  | { readonly _tag: 'Live'; readonly value: A; readonly at: number }
```

The prototype includes `updates` and a failure carrying the last value for observable proof. The production `DataError<E>` should retain that same last-success behavior. `DataRuntimeProvider` owns the binding-store registry per mounted AppVersion; there are no module-global client caches. `useBinding(binding)` uses `useSyncExternalStore`. Frozen never starts I/O; live starts viewer-scoped polling; subscription opens one NDJSON stream and paints the snapshot before catch-up.

## Snapshot identity and schema evolution

The exact key is:

```text
otel::query::VistaMetrics.MetricSnapshot.v1::<canonical full MetricQueryArgs>
```

Canonical args include `promql`, the relative/absolute range value, `stepSeconds`, and `points`. The test creates four distinct keys for the base query, a step change, a points change, and a range change. Cursor, capture time, resolved absolute range, mode, and refresh interval are deliberately excluded: they are captured value or delivery policy, not logical query identity.

`VistaMetrics.MetricSnapshot.v1` is part of the key and each entry repeats `schemaId`. A breaking success-schema change must publish `v2`, so old durable live state and frozen snapshots cannot decode as the new shape. An AppVersion persistence key should be `(appVersionId, schemaId, snapshotKey)`, matching the lifecycle report. Changing only mode can share one captured query entry; changing step/points cannot alias even when PromQL and the human label match.

## Captured size per panel

Real Mimir capture at `2026-09-19T15:45:49Z`:

| panel | query | step / cap | samples | encoded value bytes |
| --- | --- | ---: | ---: | ---: |
| frozen | `time()` | 60 s / 61 | 61 | 2,254 |
| live initial snapshot | `time()` | 1 s / 3,601 | 3,601 | 115,535 |
| subscription initial snapshot | `time() + 1000` | 2 s / 1,801 | 1,801 | 57,949 |

These are JSON bytes for each `MetricSnapshot.value`, measured by `TextEncoder`; container indentation/key overhead is excluded. Size is bounded by current folded state, not update history. This also shows why production should choose a display-aware step/cap rather than shipping a one-second hour by default.

## Browser evidence

`playwright-cli` loaded the built app and observed:

```json
{
  "frozen": {
    "status": "frozen · as of 2026-09-19T15:45:49.000Z",
    "range": "2026-09-19T14:45:49.000Z — 2026-09-19T15:45:49.000Z",
    "points": "61",
    "cursor": "1789832749",
    "updates": "0"
  },
  "live": {
    "status": "live · observed 2026-09-19T15:46:38.000Z · 22 updates",
    "range": "2026-09-19T14:46:38.000Z — 2026-09-19T15:46:38.000Z",
    "points": "3601",
    "cursor": "1789832798",
    "updates": "22"
  },
  "subscription": {
    "status": "live · observed 2026-09-19T15:46:38.000Z · 11 updates",
    "range": "2026-09-19T14:46:38.000Z — 2026-09-19T15:46:38.000Z",
    "points": "1801",
    "cursor": "1789832798",
    "updates": "11"
  }
}
```

A second Playwright sample over 3.2 seconds proved behavior rather than labels:

```json
{
  "before": {
    "frozen": { "cursor": "1789832749", "updates": "0" },
    "live": { "cursor": "1789832815", "updates": "39" },
    "subscription": { "cursor": "1789832814", "updates": "19" }
  },
  "after": {
    "frozen": { "cursor": "1789832749", "updates": "0" },
    "live": { "cursor": "1789832818", "updates": "42" },
    "subscription": { "cursor": "1789832818", "updates": "21" }
  }
}
```

Frozen stayed byte/time-stable while live polling and hub streaming advanced independently. Browser console: zero messages. Screenshot: `metrics-modes.png`.

## Vitest and build evidence

```text
../../../../node_modules/.bin/vitest run src/metrics.unit.test.ts --reporter=verbose
Test Files  1 passed (1)
Tests       4 passed (4)

../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
# exit 0

../../../../node_modules/.bin/vite build
# 211 modules transformed; built successfully
```

The four tests cover deterministic relative-to-absolute resolution, append/drop fold semantics and cursor, frozen/live encode-decode symmetry through the exact `MetricSnapshot` success schema, and key separation plus derivation of `otel.ops.query` from the `Rpc.make` descriptor.

## Adoption notes for existing Vista `MetricQuery`

1. `flakes/vista/blocks/src/data-components.tsx` currently hardcodes `requestedMode: 'frozen'`, omits a range, and builds `{ promql, stepSeconds, points }`. Add `range`, `mode`, and `refreshEvery`, then call `bind(otel.ops.query, args, policy)`. Keep frozen as the default.
2. `flakes/vista/service/src/data/providers/otel.provider.ts` currently computes `end = Date.now()` and derives start only from step/points. Move clock resolution into capture/live orchestration and pass explicit absolutes to `Mimir.query`. Return `MetricSnapshot`, not a bare `QueryResult`, so provenance cannot be detached from samples.
3. Keep `otel.query.ts` client-safe with `Rpc.make`, Schemas, contract, operation, binding types, and pure fold. Keep Mimir config, fetch, Layer, handler, hub, and persistence in `otel.provider.ts`. This preserves the established two-module check.
4. The telemetry island should remain optional visualization only. Feed it `Resolved<MetricSnapshot>` or the decoded series; do not let it own fetch, timers, relative-time resolution, snapshot keys, or stream lifecycle. The minimal SVG proves those semantics without React-18 island coupling.
5. Wire the metric driver into the lifecycle prototype's viewer-counted `RcMap`, idle TTL, budget broker, and persisted `(state, cursor, observedAt)`. The hub in this slice establishes the metric-specific state transition, not the production ownership policy.
6. Preserve the frozen snapshot as instant paint for both live modes. A live panel is snapshot plus overlay, never an empty client fetch on mount.
