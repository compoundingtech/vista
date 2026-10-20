# Observability: OTel bootstrap over the shared spine, one connected publish trace

Status: accepted

## Context

Vista's instrumentation is well-designed but dark. Spans are named consistently
and hierarchically (`vista.control.*`, `VistaClient.*`, `vista.provider.*`,
`vista.freeze.*`) with `span.label` + typed attrs, but there is no tracer/SDK
layer on either the CLI or the service, no `OTEL_*` export env in the Nix unit,
and no metrics — so every span resolves against Effect's no-op tracer and nothing
is exported. Separately, the publish→freeze path bridges through
`Effect.runPromise`/`runPromiseExit`, fragmenting one publish into 3+ disconnected
root traces even once a tracer is added. Vista's VRS had no observability
requirement, so this gap was invisible to the VRS.

## Evidence and Argument

An OTel gap audit (`/sk-otel`) confirmed: no production OTel dependency, layer, or
bootstrap anywhere; the only OTel-adjacent import is `otelite` in a test. The
audit also confirmed the freeze-pass fragmentation is structural and survives
bootstrap. The repo already has a house pattern for schema-based OTel
(`@overeng/otel-contract` + `@overeng/utils/node/otel` `withTelemetry` /
`makeOtelCliLayer`) and a standing LGTM spine (dev3). Host decision 0060 makes the
service Effect-native at the request boundary, giving a real runtime layer to
provide the tracer into — the missing substrate.

## Options

| Option | Tradeoffs |
| --- | --- |
| Bootstrap via the shared `otel-contract`/`withTelemetry` helpers (chosen) | One house idiom; schema-validated attrs/metrics; rides the existing spine. Requires the 0060 runtime layer + `OTEL_*` env in the unit. |
| Hand-rolled SDK per binary | Bespoke span constants / `Otlp.layerJson` per surface; diverges from the repo pattern; more to maintain. Rejected. |
| Leave dark | Zero cost; but the standing service is unobservable and the well-named spans are wasted. Rejected. |

## Decision

Vista adopts OpenTelemetry as a first-class capability, specified in the
`05-observability` subsystem:

- **Bootstrap via the shared helpers.** The CLI builds `makeOtelCliLayer('vista-cli', …)`
  merged into its base layer; the service provides `withTelemetry` into the 0060
  Effect runtime layer that hosts the request handler, freeze, and provider mount.
  Attrs/metrics use `@overeng/otel-contract` schemas, not hand-rolled constants.
- **`service.name` boundaries:** `vista-cli` (client) and `vista-service` (server).
  Providers run in-process via `ssrLoadModule` and are spans *under* `vista-service`,
  not their own service. `vista-browser` is reserved for a future instrumented island.
- **`service.version` = `machineVersion`** (stable, from the build-versioning
  contract 0064), never the human `displayVersion`.
- **One connected publish trace.** The publish→freeze path is composed as a single
  Effect (no `runPromise`/`runPromiseExit` bridges), so `vista.control.publish` →
  `vista.freeze.capture` → per-block spans share one fiber and one trace. (This is
  the same change as the freeze-pass Effect rewrite; observability and correctness
  converge on it.)
- **Traceparent across boundaries:** the CLI↔service control-RPC carries trace
  context so a `vista publish` is one connected trace end to end.
- **Initial metrics (`OtelMetric`):** publish count, freeze-pass duration,
  provider-call latency, control-RPC latency. Coverage completes the unspanned
  meaningful effects (`gh.provider` `runGh`, `client/datasource` `callLive`).
- **Export is configured in the Nix unit:** `OTEL_EXPORTER_OTLP_ENDPOINT` (+
  `OTEL_SERVICE_NAME`) on both the systemd and launchd unit blocks.

## Consequences

- The standing service becomes observable on the shared spine; the existing
  well-named spans finally export.
- Observability rides the 0060 runtime layer — one more reason the host is
  Effect-native.
- The freeze-pass single-Effect rewrite is now doubly-motivated (trace integrity +
  the irreversibility fix in the refactor epic).
- New `05-observability` subsystem owns the requirements + spec; `service.version`
  couples to 0064.
