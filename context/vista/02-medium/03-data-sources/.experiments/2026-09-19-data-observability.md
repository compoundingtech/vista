# Query observability and rate-limit derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/o11y/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Which spans, attributes, metrics, propagation rules, and rate-limit signals the data plane requires.

## Method

A real Effect RPC/HTTP and GitHub slice used otelite to assert parent links, metric points, labels, secret canaries, retries, throttling, hydration, refresh, stream events, and capture.

## Result

Built-in Effect propagation connects browser/client, HTTP, RPC, Provider, and external spans; the proposed bounded telemetry contract exposes operation health without leaking raw arguments.

## Conclusion

Built-in Effect propagation connects browser/client, HTTP, RPC, Provider, and external spans; the proposed bounded telemetry contract exposes operation health without leaking raw arguments.

## VRS Impact

Adopt the exact span, attribute, metric, propagation, stream, rate-limit, and conformance contracts in the observability spec.

## Source Report

# Query observability and rate-limit derisk

## Result

The query shape supports full server/provider telemetry without making telemetry an app-author responsibility. The recommended seam is the two-module split from the client-split derisk: `*.query.ts` owns schemas and RPC identity; `*.provider.ts` supplies handlers and policy. `implement(...)` derives `vista.provider.<id>.<tag>` spans, hashed argument identity, call count/duration metrics, and the RPC handler layer for every operation. Client helpers own live/hydrate/refresh spans; freeze owns capture/block spans.

The working slice is in this directory. It has a real `gh` implementation through Effect `ChildProcess`/`ChildProcessSpawner`, an app-local provider, Effect RPC over HTTP, schema-backed telemetry contracts, semaphore admission, quota observation, delay and typed-degrade branches, a simulated `gh-checks.checksStream`, and an otelite integration test.

## Effect levers exercised

- **Lever 8, observability/rate limits:** exercised end to end and is the subject of this slice.
- **Lever 1, services/Layers:** `GhCommand` is a service; tests replace its real `ChildProcessSpawner` implementation with an alternate Layer, not a mock function patched into production code.
- **Lever 4, typed outcomes:** quota exhaustion is a typed degraded success and remains schema-valid across RPC.
- **Lever 7, subscriptions:** reused the realtime sibling's settled `gh-checks.checksStream` identity to prove subscription/event telemetry. The actual subscription transport stays owned by that slice.
- Query composition and dependent-query collection were not re-exercised. Instrumentation wraps a descriptor operation without changing its identity, schemas, composition behavior, or snapshot value.

## Evidence

Run from `tmp/vista-data-bakeoff/derisk/o11y/`:

```sh
# Plain shells do not have otelite on PATH on this host; build it without installing globally.
nix build --no-link --print-out-paths ../../../../repos/effect-utils#otelite
# /nix/store/r2cfr6qdz3s41i3ly943hcaqjlj21cfp-otelite-0.0.0

OTELITE_BIN=/nix/store/r2cfr6qdz3s41i3ly943hcaqjlj21cfp-otelite-0.0.0/bin/otelite \
  ../../../../node_modules/.bin/vitest run o11y.test.ts
# Test Files  1 passed (1)
# Tests       1 passed (1)

../../../../node_modules/.bin/tsc --noEmit -p tsconfig.json
# exit 0

bun real-gh-smoke.ts
# {"_tag":"ok","repository":"schickling/dotfiles","number":2910,
#  "title":"feat(vista): border-draggable split divider, treemap fills its pane",
#  "rateLimitRemaining":5000,"rateLimitResetAt":"2026-09-19T15:04:07.000Z"}
```

The test uses the typed `@overeng/utils-dev/otelite` harness and a real HTTP RPC boundary. It asserts:

- connected parent links: `vista-browser.request` → `vista.data.live.gh.pullRequest` → Effect HTTP client → Effect HTTP server → `vista.rpc.gh.pullRequest` → `vista.provider.gh.pullRequest` → `gh`;
- the named spans share one trace id across the `vista-browser` and `vista-service` resource identities;
- `vista-service.publish` → `vista.freeze.capture` → `vista.freeze.block.capture` → `vista.provider.local.readNote` is one trace/fiber chain;
- provider/rpc attributes, 64-hex `args.hash`, and `span.label` on every Vista-authored span;
- exact counter/gauge values for one successful live call, one retry, one refresh, one hydration, two stream events, one captured block, zero quota remaining, and zero active subscriptions; histogram points exist for call duration and throttle wait;
- a `sk-do-not-leak/repository` live argument and `sk-freeze-canary` capture argument do not occur anywhere in serialized otelite span attributes or metric labels;
- the low-quota alternate policy delays 5 ms and emits a throttle histogram point; a second alternate policy returns typed `{ _tag: 'rate-limited', resetAt }` as success.

## Authored surface

The provider/query author writes a browser-safe descriptor:

```ts
// providers/gh.query.ts
export const gh = defineQueries({
  id: 'gh',
  operations: {
    pullRequest: operation({
      payloadSchema: PullRequestArgs,
      successSchema: PullRequestResult,
      errorSchema: GhError,
    }),
  },
})
```

The server half supplies behavior and policy; it does not type span names or metric labels:

```ts
// providers/gh.provider.ts
export const ghProvider = makeGhProvider(
  makeRateLimitPolicy({
    concurrency: 2,
    threshold: 100,
    onExhausted: 'degrade',
    maxWaitMs: 1_000,
  }),
)

// Factory ends in:
implement<typeof gh.contracts, GhCommand>(gh, {
  purity: 'effectful',
  appVersionId: 'o11y-bakeoff-v1',
  handlers: { pullRequest },
})
```

App code imports only `gh.query.ts` and calls `callLive(url, gh.ops.pullRequest, args)`. The app-local `local.query.ts` / `local.provider.ts` pair uses the same shape; there is no second convention.

## Propagation finding

No custom `RpcMiddleware`, header injection, or `HttpTraceContext` extraction is needed in Effect 4.0.0-rc.112:

1. `RpcClient.makeNoSerialization` creates the `vista.data.live.<id>.<tag>` client span and serializes its `traceId`, `spanId`, and `sampled` fields into the RPC request envelope.
2. `RpcServer` reads those envelope fields and supports an `externalSpan` parent unless `disableSpanPropagation` is set.
3. The HTTP client additionally creates `http.client POST` and injects W3C `traceparent`; the HTTP server extracts it and creates `http.server POST`.
4. In the observed otelite tree, the active HTTP transport spans are the direct wire parents: client live → HTTP client → HTTP server → RPC server. The RPC envelope fields are still present, but the active server HTTP context wins direct parentage. This is a connected trace and is preferable to adding a duplicate middleware.

The proof uses a Node-side client because a real browser needs a web OTel SDK lifecycle plus OTLP receiver CORS or a service proxy route. Client and service use independent OTel layers/resource identities and communicate only through HTTP, though the deterministic test hosts those runtimes in one OS process. A browser exporter/proxy is therefore not proven here.

## Telemetry contract proposal

### Span inventory

| Span | Owner / placement | Required parent | `span.label` |
| --- | --- | --- | --- |
| `vista.data.live.<provider>.<rpc>` | browser/Node query client; derived from descriptor | initiating UI/action span | `<provider>.<rpc>` |
| `vista.rpc.<provider>.<rpc>` | Effect RPC server transport | inbound HTTP transport span | `<provider>.rpc` |
| `vista.provider.<provider>.<rpc>` | `implement(...)`; wraps every handler | server RPC span, or freeze block for in-process capture | `<provider>.<rpc>` |
| `vista.data.hydrate` | frozen snapshot decode | render/load operation | `snapshot.decode` |
| `vista.data.refresh` | explicit refresh helper | initiating UI action | `<provider>.<rpc>` |
| `vista.freeze.capture` | freeze pass | publish/control operation | `freeze.capture` |
| `vista.freeze.block.capture` | each block; same fiber | freeze capture | stable semantic block id |
| `gh` | provider external command | provider operation | `pr.view`, `api.rate_limit`, etc.; never argv |
| `http.client <method>` / `http.server <method>` | Effect HTTP runtime | live/server wire contexts | Runtime-generated; see limitation below |
| `vista.data.live.gh-checks.checksStream` | stream subscription lifetime | initiating island/action | `gh-checks.checksStream` |

### Attribute contract

| Attribute | Type | Cardinality | Privacy | Metric-label policy |
| --- | --- | --- | --- | --- |
| `span.label` | string, <40 chars target | bounded by provider/rpc/block vocabulary | public operational identity; no args, URL query, body, or credentials | never copied automatically |
| `provider.id` | string | bounded | public | allowed as `provider` |
| `rpc.tag` | string | bounded | public | allowed as `rpc` |
| `args.hash` | lowercase SHA-256 hex | high/unbounded | derived identifier; raw args forbidden | never |
| `outcome` | enum (`ok`, `error`, `rate-limited`, capture outcomes) | low | public | allowed |
| `result.tag` | typed success `_tag` | bounded by result schema | public contract tag only | not initially; use `outcome` on metrics |
| `snapshot.key` | opaque hashed key | high/unbounded | may correlate one snapshot entry; must not embed raw args | never |
| `app.version.id` | stable app/build identity | bounded per deployment window | public | not on per-call metrics; use resource `service.version` for fleet queries |
| `rate_limit.resource` | string (`core`, `graphql`, …) | bounded | public | allowed as `resource` |
| `rate_limit.remaining` | integer | numeric | public operational quota; trace only as value | gauge value, never label |
| `rate_limit.reset_at` | RFC 3339 string | high | public operational timestamp | never |
| `process.command` | literal `gh` | low | public | never needed |
| `process.operation` | curated enum-like string | bounded | public; argv forbidden | never initially |
| raw args/argv/repo/token/header/body | absent | unbounded | potentially secret/private | forbidden |

`telemetry.ts` declares the encoded attribute and label shapes with `OtelAttr`, `OtelAttrs`, `OtelSpan`, and `OtelMetric`. `@overeng/otel-contract` currently machine-enforces key, encoding, cardinality, and metric-label eligibility, but its metadata has no privacy field. Privacy is therefore documented and tested with a secret canary, not yet represented in the schema metadata.

### Metric instruments

Counters deliberately omit `_total` because the existing Vista Effect/OTLP bridge adds the Prometheus suffix. Durations use milliseconds to match the explicit Vista `metrics.ts` idiom and requested contract, despite the general Prometheus preference for base-unit seconds.

| Instrument | Kind | Labels | Unit / value contract |
| --- | --- | --- | --- |
| `vista_data_calls` | counter | `provider`, `rpc`, `path=live|capture`, `outcome` | calls |
| `vista_data_call_duration_ms` | histogram | `provider`, `rpc`, `path` | milliseconds |
| `vista_data_refreshes` | counter | `provider`, `rpc` | refreshes |
| `vista_data_hydrations` | counter | `outcome=ok|error` | decodes |
| `vista_provider_retries` | counter | `provider`, `rpc` | retry attempts, not initial attempts |
| `vista_provider_timeouts` | counter | `provider`, `rpc` | timed-out attempts |
| `vista_provider_rate_limit_remaining` | gauge | `provider`, `resource` | last observed remaining calls |
| `vista_provider_throttle_wait_ms` | histogram | `provider` | milliseconds; histogram count is throttle-wait count |
| `vista_stream_subscriptions` | gauge | `provider`, `rpc` | active subscriptions; set on acquire/release |
| `vista_stream_events` | counter | `provider`, `rpc` | delivered events |
| `vista_freeze_blocks` | counter | `outcome=captured|failed|secret-blocked|effectful-refused` | blocks |

All labels are schema-bounded. There are no repo, PR, block id, snapshot key, trace id, app version, cursor, reset timestamp, or argument labels.

## Rate-limit policy proposal

Production API shape:

```ts
interface ProviderRateLimitPolicy {
  readonly limiter: Semaphore
  readonly threshold: number
  readonly onExhausted: 'delay' | 'degrade'
  readonly maxWaitMs: number
}

declare const withRateLimit: <A, E, R>(
  provider: string,
  policy: ProviderRateLimitPolicy,
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E, R>

type RateLimited = { readonly _tag: 'rate-limited'; readonly resetAt: string }
```

The prototype uses `Semaphore` to bound concurrent `gh` calls. After the domain call it executes real `gh api rate_limit --jq .resources.core`, sets the gauge, and annotates the provider span. Below threshold:

- `delay`: records `vista_provider_throttle_wait_ms`, sleeps `min(reset-now, maxWaitMs)`, then returns the already-fetched typed result;
- `degrade`: returns typed `RateLimited` success immediately, so blocks branch on `_tag` rather than string errors.

The production version should read `x-ratelimit-remaining`/`reset` from the same `gh api -i` response when the domain operation is already an API call, avoiding the extra quota request. The explicit `rate_limit` request is useful here because `gh pr view` does not expose headers. Effect 4 also ships `effect/unstable/persistence/RateLimiter`, but its store-backed token model solves shared multi-process quotas. Vista currently has one standing service, so a semaphore plus observed upstream quota is the smaller correct mechanism; adopt the persistent limiter only if provider execution becomes multi-process.

## Snapshot consequences

Snapshot identity remains `provider + rpc + args`, but the prototype makes the argument component a 64-hex SHA-256 rather than canonical raw JSON. That prevents secret-bearing arguments from leaking through `snapshot.key` telemetry and makes key size fixed. It gives up human-readable keys; debugging must pivot from a block/query binding to the computed key, not reverse a hash. Telemetry adds zero bytes to encoded values. The prototype's snapshot entry was not published, so no representative whole-file byte delta was measured.

## What did not work / limitations

- The first Vitest run under Node failed because the disposable test server used `Bun.serve`. The final test uses `node:http` and passes with the required root Vitest binary.
- A real browser OTLP exporter was not wired. Direct browser → otelite may be blocked by CORS, and a durable browser SDK needs explicit flush/finalization. The Node-side HTTP client proof is the allowed fallback.
- Effect's automatically generated `http.client POST` and `http.server POST` spans do not carry `span.label`, and the public span-name/reference knobs do not expose an attribute hook. All Vista-authored and external `gh` spans have labels; runtime HTTP spans are the exception. Production can either accept that external-runtime exception or add an upstream Effect hook rather than duplicate the HTTP spans.
- The deterministic propagation proof uses distinct OTel runtimes and resource identities in one OS process, not two spawned processes. Since parentage crosses an actual serialized HTTP request and independent runtime contexts, it proves propagation rather than in-fiber inheritance, but process isolation itself was not tested.
- The managed Tempo readback was optional and was not run. Primary proof is the local otelite capture as required.
- The prototype's `delay` branch caps waiting for testability. Production policy must choose a bounded UI/service latency budget; sleeping until a far-away reset is not acceptable.
- The test simulates `gh-checks.checksStream` using the realtime sibling's settled provider/tag (`gh-checks.checksStream`) and two events. It proves metric/span semantics, not transport catch-up; that remains the realtime slice's proof.

## Changes proposed for `context/vista/05-observability/spec.md`

Add these rows/sections without changing existing OBS-R69–R73 intent:

1. **Resource attributes:** add `vista-browser` for an instrumented island/Node client and require `service.version=machineVersion`; providers remain in-process under `vista-service`.
2. **Span inventory:** replace the generic `vista.datasource.callLive` row with `vista.data.live.<provider>.<rpc>` and add hydrate, refresh, provider, external call, stream subscription, and freeze-block rows from the table above.
3. **Connected data trace:** specify the observed wire chain, automatic Effect RPC envelope propagation, automatic W3C HTTP propagation, and forbid custom duplicate middleware while rc.112 behavior holds.
4. **Semantic attributes:** add the attribute-policy table, especially hashed-only arguments and the ban on raw args/argv/header/body labels.
5. **Metrics:** replace the initial dotted conceptual names with the exact Effect instrument names/labels in the metric table; define counters without `_total` and timers in ms as the Vista bridge convention.
6. **Rate limits:** add provider admission/quota/degrade policy, typed `RateLimited`, gauge/span annotation, retry/timeout/throttle instruments, and bounded-delay rule.
7. **Streams:** add acquire/release subscription gauge, event counter, and the `gh-checks.checksStream` lifetime span. A future lag instrument needs a cursor/time semantic from the realtime contract before naming it.
8. **Conformance proof:** require otelite parent-link, metric-point, and secret-canary tests for provider infrastructure; do not require one test per provider.

## Concrete contract to carry into Vista

1. `defineQueries` remains client-safe; `implement` is the only provider telemetry seam and derives server span/RED metrics for every descriptor op.
2. `callLive`, `hydrate`, `refresh`, and freeze own their respective client/lifecycle spans; provider authors never duplicate them.
3. Effect RPC + HTTP propagation stays enabled by default. A semantic test locks one cross-resource trace; custom propagation is added only if that test breaks after an Effect upgrade.
4. Only schema-declared bounded values become labels. Arguments are SHA-256-only on spans, never labels; raw arguments and external argv are forbidden from all telemetry.
5. The exact span, attribute, and metric tables above are one `@overeng/otel-contract` registry contribution, not per-provider constants.
6. Every quota-aware provider exposes a policy equivalent to:

```ts
withRateLimit(
  provider,
  { limiter, threshold, onExhausted: 'delay' | 'degrade', maxWaitMs },
  operation,
)
```

It MUST bound concurrency, observe remaining/reset, set `vista_provider_rate_limit_remaining`, annotate the provider span, count retries/timeouts, record throttle waits, and represent quota exhaustion as either a bounded delay or typed degraded success.
