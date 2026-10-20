# Provider contract is backend-faithful; adapt to DataFrame at the island edge

Status: accepted (data-sources telemetry interview Q2)

## Context

Telemetry blocks render through Grafana components (decision 0040), which consume
`@grafana/data` `DataFrame`. The providers run server-side (Effect), and `freeze()`
captures their output as an immutable snapshot inlined into the published version
(MED.DATA-R29) — a durable, long-lived artifact. The question: what shape do providers emit
and freeze — backend-faithful standard formats, or DataFrame directly?

## Decision

Providers emit **standard, effect-`Schema`-validated, backend-faithful** shapes,
and that is what freezes:

- **traces** — OTLP-JSON (as returned by Tempo `/api/traces/{id}`).
- **metrics** — PromQL `matrix` result (as returned by Mimir `query_range`).

The `OTLP → Jaeger Trace model` and `PromQL `matrix` result → DataFrame` adaptation
happens **client-side, at the island boundary**, immediately before the Grafana
component. "DataFrame throughout" means throughout the render layer, not on the
wire or in the frozen snapshot.

## Consequences

- Freeze snapshots stay durable and library-agnostic: OTLP and PromQL outlast any
  UI-library schema. A `@grafana/data` DataFrame schema change cannot break decoding
  of previously-published frozen snapshots.
- The Effect server contract is not coupled to a JS UI library's internal format.
  **Correction (2026-06-27, empirically grounded):** the providers do NOT reuse
  `@overeng/otel-contract` branded scalars (`OtelSpanName`/`OtelServiceName`/
  `OtelAttributeKey`/`OtelMetricName`) for queried field identifiers, and
  `otel-contract` is not added as a vista dependency. Those are the *emission*
  contract with strict authoring rules (e.g. `OtelAttributeKey` requires a
  letter-led key); the providers decode *queried-back* telemetry from heterogeneous
  instrumentation, which legitimately violates them — verified: of 361 live Mimir
  label keys, `__name__` is not letter-led, so the strict scalar would reject real
  data. The consuming/rendering side therefore validates leniently (`Schema.String`
  for queried keys/values); strict scalars stay producing-side only. This is the
  producing-vs-consuming distinction that motivated the backend-faithful contract.
- The adapters live next to the island (client-only), co-located with the component
  that needs them. The OTLP→Jaeger adapter's fiddly conversions (ns→µs,
  `parentSpanId`→`CHILD_OF` references, per-service `processID` map) are documented
  in the feasibility experiment.
- A first-party renderer could later consume the same OTLP/matrix snapshot without
  a contract change — the wire format is not a Grafana commitment.
