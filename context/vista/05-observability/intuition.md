# Observability — Intuition

Observability is Vista's one **horizontal** node. Every other subsystem is a vertical
slice — the service serves, the medium renders, the agent interface drives. Telemetry
cuts across all of them: it is how we see what the running CLI and service actually
did, not what the design says they should do.

The guiding intuition is **don't hand-roll it**. Vista emits OTel through the shared
house helpers (`@overeng/otel-contract` for schema-validated attributes and metrics,
`@overeng/utils/node/otel` for the bootstrap), to the same standing spine every other
system reports to. Bespoke span constants or a private SDK layer would be a second
source of truth that drifts and can't be validated. This is why observability
ultimately refines the charter's infra-idiom constraint (VST-R40): correct
instrumentation *is* following our infra idioms.

Two things matter most for the telemetry to be useful rather than merely present:

- **Identity is clean.** `vista-cli` and `vista-service` are distinct services;
  providers run in-process under the service and are spans *within* it, not a third
  service. The version stamped on every span is the stable `machineVersion` from the
  build-versioning contract, so telemetry joins cleanly across builds.

- **A publish is one trace.** The most important operation, `vista publish`, must
  render as a single connected trace from the CLI through the control RPC into the
  freeze pass — not a spray of disconnected root traces. That forces one fiber and
  `traceparent` propagation across the CLI↔service boundary, which is the same
  discipline that makes the freeze pass correct. Correctness and trace integrity
  converge.
