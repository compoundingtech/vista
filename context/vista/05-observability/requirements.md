# Observability Requirements

## Audience

For: humans, agents

| For | Why it exists for them | Surface | Optimizes for |
| --- | --- | --- | --- |
| Humans | Makes publishing and service health diagnosable through the shared observability plane | `dashboard:grafana` | operational clarity, connected traces, trustworthy health |
| Agents | Exposes CLI, service, and browser operations as connected queryable telemetry | `cli:gcx` | causal diagnosis, stable identity, low-cardinality metrics |

Owns tools: none

Cross-cutting requirements for Vista's observability — the operational telemetry that
spans both agent-facing surfaces, the `vista` CLI and the standing service. It is a
horizontal concern over the vertical subsystems: correct OTel bootstrap, service
identity/boundaries, connected traces, and operation metrics, all on the shared
house spine. System-level context, assumptions, and acceptable tradeoffs live in the
[root requirements](../requirements.md); terms in [ontology.md](../ontology.md).
Requirement IDs are **path-scoped** to this node (`OBS-R*`); each declares `refines:`
the charter requirement it specializes so the tree reads upward. There is no
observability-specific charter requirement, so these refine the infra-idiom charter
constraint (VST-R40): correct instrumentation via the shared helpers, exported from
the Nix service unit, is the observability instance of "follow our infra idioms".

## Requirements

### Must be observable on the shared spine

- **OBS-R69 OTel bootstrap:** Both the `vista` CLI and the standing service must emit
  OpenTelemetry through the shared house helpers (`@overeng/otel-contract` for
  schema-validated attributes/metrics, `@overeng/utils/node/otel`
  `withTelemetry`/`makeOtelCliLayer` for the bootstrap), exporting to the standing
  spine. Instrumentation must not be hand-rolled span constants or a bespoke SDK
  layer. Export must be configured in the Nix service unit
  (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`), so a correct layer actually
  exports (decision 0062).
  `refines: VST-R40`

### Must have correct identity and boundaries

- **OBS-R70 Service identity:** `service.name` must be `vista-cli` for the CLI,
  `vista-service` for the standing service, and `vista-browser` for an instrumented
  browser/runtime client. Providers run in-process under the service and are spans
  under `vista-service`, not a separate service. `service.version` must be the stable
  `machineVersion` from the build-versioning contract (AGT.CLI-R67, decision 0064)
  for every identity including `vista-browser`, never the human `displayVersion`
  (decision 0062).
  `refines: VST-R40`

### Must produce connected, useful telemetry

- **OBS-R71 Connected publish trace:** A `vista publish` must render as one connected
  trace across the CLI, the control RPC, and the freeze pass. The publish→freeze
  path must not bridge through `Effect.runPromise`/`runPromiseExit` in a way that
  fragments the operation into disconnected root traces; trace context must flow
  through one fiber (decision 0062).
  `refines: VST-R40`
- **OBS-R72 Operation metrics:** Meaningful operations must emit `OtelMetric`
  instruments — at minimum publish count, freeze-pass duration, provider-call
  latency, and control-RPC latency (decision 0062).
  `refines: VST-R40`
- **OBS-R73 Bounded CLI finalization:** Telemetry export finalization must be
  nonblocking for successful agent-facing commands and bounded on process exit;
  an unavailable or slow collector must not add an exporter-timeout-sized delay to
  each authoring iteration. Export failure remains observable without turning
  telemetry into authoring-path latency (decision 0077).
  `refines: VST-R64`
- **OBS-R74 Data-operation traces:** Live, Rpc transport, Provider handler,
  hydration, refresh, stream lifetime, freeze, and per-Block capture must form
  connected traces across `vista-browser` and `vista-service`. Effect Rpc envelope
  and W3C HTTP propagation must remain enabled; duplicate custom propagation must
  not be added while native propagation satisfies the contract.
  `refines: VST-R40`
- **OBS-R75 Bounded data attributes:** Data-plane telemetry must use bounded
  Provider/Rpc/outcome labels, represent binding arguments only as a lowercase
  SHA-256 hash on spans, and exclude raw arguments, argv, credentials, tokens,
  headers, bodies, snapshot keys, cursors, trace ids, and AppVersion ids from
  metric labels.
  `refines: VST-R40`
- **OBS-R76 Data-plane instruments:** The service must emit call count and duration,
  refresh and hydration counts, retries, timeouts, remaining quota, throttle wait,
  active subscriptions, stream events, and freeze-Block outcomes with the bounded
  label sets specified in the observability spec.
  `refines: VST-R40`
- **OBS-R77 Provider budget visibility:** Quota-aware Providers must bound
  concurrency, observe remaining/reset state, expose remaining quota and bounded
  throttle delay, and represent exhaustion as a bounded wait or typed degraded
  result. Live cadence must not bypass the service-wide Provider/account budget.
  `refines: VST-R40`
- **OBS-R78 Telemetry conformance:** Shared Provider infrastructure must have an
  otelite conformance proof for parent links, metric points, subscription
  acquire/release, and secret-canary absence. Individual Providers need not
  duplicate that infrastructure test.
  `refines: VST-R40`
