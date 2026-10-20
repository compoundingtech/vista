# Observability Spec

This document specifies Vista's OpenTelemetry contract across the CLI, browser
data runtime, standing service, Provider calls, and publication. It builds on
[requirements.md](./requirements.md), the root [spec.md](../spec.md), and
[../ontology.md](../ontology.md).

## Status

Active.

## Scope

Instrumentation is derived at shared seams. App and Provider authors do not
name transport spans or recreate RED metrics. Provider implementations may add
domain spans and bounded semantic attributes below the shared operation span.

## Bootstrap

- **CLI:** `makeOtelCliLayer("vista-cli", { version: machineVersion })` is
  merged into the CLI base Layer.
- **Service:** the service `withTelemetry` Layer owns control RPC, publish,
  freeze, mounted Provider, and data-route spans.
- **Browser:** an instrumented data runtime uses `vista-browser` and exports
  through the governed browser exporter or service proxy.
- **Contracts:** attributes, spans, and metrics are declared with
  `@overeng/otel-contract` schemas. `span.label` marks the primary operation
  label on every Vista-authored span.

The Nix service unit supplies `OTEL_EXPORTER_OTLP_ENDPOINT` and
`OTEL_SERVICE_NAME=vista-service`. Export finalization follows OBS-R73 and is
bounded independently of the authoring result.

## Resource attributes

| Resource | `service.name` | `service.version` |
| --- | --- | --- |
| CLI | `vista-cli` | `machineVersion` |
| Service | `vista-service` | `machineVersion` |
| Instrumented browser/runtime client | `vista-browser` | `machineVersion` |

Providers run in-process under `vista-service`; they never manufacture a
service identity. AppVersion and Provider identity are span attributes, not
resource service names.

## Span inventory

| Span | Owner / placement | Required parent | `span.label` |
| --- | --- | --- | --- |
| `VistaClient.*` | CLI client call | initiating CLI command | stable method label |
| `vista.control.*` | standing-service control handler | inbound control transport | stable control method |
| `vista.data.live.<provider>.<rpc>` | browser/Node data client | initiating UI/action span | `<provider>.<rpc>` |
| `vista.data.subscription.<provider>.<rpc>` | browser subscription lifetime | initiating Block/action | `<provider>.<rpc>` |
| `vista.rpc.<provider>.<rpc>` | Effect Rpc server transport | inbound HTTP transport | `<provider>.rpc` |
| `vista.provider.<provider>.<rpc>` | `implement`; wraps every handler | server Rpc span or freeze block | `<provider>.<rpc>` |
| `vista.data.hydrate` | strict Snapshot decode | render/load operation | `snapshot.decode` |
| `vista.data.refresh` | explicit refresh helper | initiating UI action | `<provider>.<rpc>` |
| `vista.freeze.capture` | complete freeze pass | publish/control operation | `freeze.capture` |
| `vista.freeze.block.capture` | one bound Block in the same fiber | freeze capture | stable SemanticNode id |
| `vista.live.<provider>.<rpc>` | service SubscriptionHub subscription lifetime | inbound stream Rpc | `<provider>.<rpc>` |
| `vista.live.hibernate` | SubscriptionHub entry finalizer | subscription lifetime or AppVersion Scope | `live.hibernate` |
| `vista.live.wake` | SubscriptionHub entry acquisition | inbound stream Rpc | `live.wake` |
| curated external call, such as `gh` | Provider-owned command/HTTP operation | Provider operation | curated operation, never argv |
| `http.client <method>` / `http.server <method>` | Effect HTTP runtime | live/server wire context | runtime-generated exception |

The runtime-generated HTTP spans are the only spans not required to carry
`span.label`; Vista does not duplicate them merely to add a label.

## Connected traces and propagation (OBS-R71)

Publish executes as one Effect fiber:

```text
VistaClient.publish
  -> HTTP/control Rpc
    -> vista.control.publish
      -> vista.freeze.capture
        -> vista.freeze.block.capture
          -> vista.provider.<provider>.<rpc>
```

The browser data path remains connected:

```text
vista-browser action
  -> vista.data.live.<provider>.<rpc>
    -> http.client POST
      -> http.server POST
        -> vista.rpc.<provider>.<rpc>
          -> vista.provider.<provider>.<rpc>
            -> external call
```

The streaming path adds the viewer- and hub-owned lifetimes:

```text
vista.data.subscription.<provider>.<rpc>
  -> http.client POST
    -> http.server POST
      -> vista.rpc.<provider>.<rpc>
        -> vista.live.wake
        -> vista.live.<provider>.<rpc>
          -> LiveDriver / external call
```

Effect Rpc carries its external parent in the request envelope and Effect HTTP
injects/extracts W3C `traceparent`. Both remain enabled. While that behavior is
present, Vista adds no custom propagation middleware or duplicate transport
spans. A semantic conformance test, rather than implementation coupling, locks
the cross-resource parent chain.

## Semantic attribute policy

| Attribute | Type | Cardinality | Privacy | Metric-label policy |
| --- | --- | --- | --- | --- |
| `span.label` | bounded string, target <40 chars | Provider/Rpc/Block vocabulary | no arguments, URL query, body, or credentials | never copied automatically |
| `provider.id` | string | bounded | public | allowed as `provider` |
| `rpc.tag` | string | bounded | public | allowed as `rpc` |
| `args.hash` | lowercase 64-hex SHA-256 | high | derived identifier; raw arguments forbidden | never |
| `outcome` | bounded enum | low | public | allowed |
| `result.tag` | success Schema `_tag` | Schema-bounded | public contract tag | not initially |
| `snapshot.key` | opaque hash | high | correlatable identifier; contains no raw arguments | never |
| `app.version.id` | stable AppVersion identity | deployment-window bounded | public | never on per-call metrics |
| `rate_limit.resource` | bounded resource name | bounded | public | allowed as `resource` |
| `rate_limit.remaining` | integer | numeric | operational quota | gauge value only |
| `rate_limit.reset_at` | RFC 3339 string | high | operational timestamp | never |
| `process.command` | literal executable name | low | public | never |
| `process.operation` | curated enum-like operation | bounded | public | never initially |

Raw arguments, argv, repository identifiers supplied as arguments, credentials,
tokens, headers, URL query strings, and bodies are absent from span attributes
and metric labels. High-cardinality keys, traces, cursors, versions, timestamps,
and Block ids are never labels. Privacy is documented in this table and
enforced by secret-canary tests until the contract library represents privacy
metadata directly.

The [viewer RPC diagnostics stream](../01-service/spec.md#viewer-rpc-diagnostics-svc-r17)
is an ephemeral inspection surface, not a telemetry exporter. Its service-wide
event buffer and per-viewer delivery are bounded; a slow consumer must not
retain unlimited events or delay the RPC it observes. Diagnostics instrumentation
may record bounded operation/outcome counts and dropped-event counts, but must
not turn event payloads, app-local identifiers, header values, request bodies,
or `PtyApi` traffic into OTel attributes or metric labels. The inspector's
current-App filter is a browser presentation filter, not a change to capture
scope or to the service's telemetry cardinality policy.

## Metric instruments (OBS-R72)

Counters omit `_total`; the Vista Effect/OTLP bridge adds the Prometheus suffix.
Durations use milliseconds consistently with Vista's metrics contract.

| Instrument | Kind | Labels | Value contract |
| --- | --- | --- | --- |
| `vista_publish_count` | counter | `template`, `outcome` | publication attempts |
| `vista_freeze_duration_ms` | histogram | `outcome` | whole freeze wall time |
| `vista_control_rpc_duration_ms` | histogram | `rpc`, `outcome` | control Rpc milliseconds |
| `vista_data_calls` | counter | `provider`, `rpc`, `path=live|capture`, `outcome` | calls |
| `vista_data_call_duration_ms` | histogram | `provider`, `rpc`, `path` | milliseconds |
| `vista_data_refreshes` | counter | `provider`, `rpc` | refreshes |
| `vista_data_hydrations` | counter | `outcome=ok|error` | Snapshot decodes |
| `vista_provider_retries` | counter | `provider`, `rpc` | retry attempts excluding initial attempt |
| `vista_provider_timeouts` | counter | `provider`, `rpc` | timed-out attempts |
| `vista_provider_rate_limit_remaining` | gauge | `provider`, `resource` | last observed remaining calls |
| `vista_provider_throttle_wait_ms` | histogram | `provider`, `resource` | bounded wait milliseconds |
| `vista_stream_subscriptions` | gauge | `provider`, `rpc` | active subscriptions, set on acquire/release |
| `vista_stream_events` | counter | `provider`, `rpc` | decoded delivered events |
| `vista_live_pollers` | gauge | `provider` | active upstream pollers or subscribable streams |
| `vista_live_hibernations` | counter | `outcome=persisted|failed|corrupt-discarded` | live binding persistence and invalid-record discard outcomes |
| `vista_freeze_blocks` | counter | `outcome=captured|failed|secret-blocked|effectful-refused` | Blocks |
| `vista_snapshot_skew` | gauge | `reason=skew|malformed` | currently dark published versions; set to zero when none |

A stream-lag instrument is not named until a Provider-independent cursor/time
semantic exists. AppVersion and binding lifecycle metrics may count bounded
states, but never label individual keys or cursors.

## Provider admission and rate limits

Every quota-aware Provider applies shared admission at the Provider boundary:

```ts
interface ProviderRateLimitPolicy {
  readonly limiter: RateLimiter | Semaphore
  readonly threshold: number
  readonly onExhausted: "delay" | "degrade"
  readonly maxWaitMs: number
}
```

The service-wide broker bounds concurrency, observes remaining/reset values from
the same upstream response when possible, updates
`vista_provider_rate_limit_remaining`, annotates the Provider span, counts
retries and timeouts, and records throttle waits. `delay` is bounded by
`maxWaitMs`; it never sleeps until an arbitrarily distant reset. `degrade`
returns a typed domain result such as `RateLimited`, not a string or transport
failure. `RateLimiter`/`HttpClient.withRateLimiter` governs remote account
quotas; Semaphore is sufficient for local process/service concurrency.

LiveDriver cadence reacts to viewer count; the shared limiter turns remaining
quota into admission delay and telemetry. Every AppVersion borrows from the
same service-wide Provider/account budget.

## Streams and live runtime

`vista.data.subscription.<provider>.<rpc>` is the browser semantic
subscription operation; `vista.live.<provider>.<rpc>` covers the corresponding
service SubscriptionHub lifetime. The latter carries `provider.id`, `rpc.tag`,
and `args.hash`, but never raw arguments or cursors. Built-in Effect HTTP and
Rpc spans remain between those semantic boundaries. Unary clients continue to
use `vista.data.live.<provider>.<rpc>`.

Acquiring and releasing a viewer updates
`vista_stream_subscriptions{provider,rpc}`; every accepted, strictly decoded
event increments `vista_stream_events{provider,rpc}`. Starting and stopping a
shared upstream worker updates `vista_live_pollers{provider}` independently of
viewer count, so two viewers of one key report two subscriptions and one
poller. Gauges return to zero when the AppVersion Scope closes.

`vista.live.hibernate` surrounds strict overlay persistence and increments
`vista_live_hibernations{outcome}`. `vista.live.wake` surrounds load, strict
decode, discard/resync when invalid, and cursor-relative driver resume.
The bounded outcomes are `persisted`, `failed`, and `corrupt-discarded`;
record keys, AppVersion ids, snapshot keys, state, cursors, and timestamps are
absent from metric labels. Reconnect and cursor catch-up are child spans or
events on the subscription operation where transport lifetime permits.

## Conformance

Provider infrastructure has one otelite conformance suite, not one suite per
Provider. It asserts:

1. parent links across distinct `vista-browser` and `vista-service` resources,
   including HTTP, Rpc, Provider, and external-call spans;
2. the connected publish/freeze/provider fiber chain;
3. required `span.label`, bounded attributes, and 64-hex `args.hash`;
4. exact counter/gauge values and presence of duration/throttle histogram
   points for success, retry, timeout, refresh, hydration, subscription events,
   shared pollers, hibernation outcomes, and capture;
5. viewer acquire/release and AppVersion teardown return subscription and
   poller gauges to zero, with `vista.live.*`, `vista.live.hibernate`, and
   `vista.live.wake` spans carrying their required labels;
6. planted secret arguments and argv canaries occur nowhere in serialized span
   attributes or metric labels.
