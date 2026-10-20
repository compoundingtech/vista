# Misc6 starts with packaged smoke and runtime-policy cleanup

Status: accepted (Vista misc6 alignment)

## Context

Vista misc5 proved the packaged service/CLI path, runtime import policy, and
telemetry island behavior through focused tests and manual smoke. Issue #1214 now
tracks the remaining hardening work, but decision 0047 makes VRS the source of
truth and the issue an execution index.

Two workstreams are tightly coupled:

- Packaged E2E smoke should become the confidence boundary for the Nix-packaged
  artifact, with isolated mutable roots outside the store.
- Runtime-policy cleanup should complete the decision 0044 direction: package
  composition owns dependencies/closure, Vista runtime metadata is projected from
  that composition, and first-party aliases/import rules do not drift as
  hand-maintained service state.

Doing either alone leaves a gap. A smoke harness without runtime-policy cleanup can
prove today's hardcoded list while preserving the drift source. Runtime-policy
cleanup without packaged smoke can look correct in source tests while failing in
the read-only packaged workspace.

## Decision

The first misc6 milestone couples **packaged Vista confidence** with
**runtime-policy contract hygiene**.

- Build or accept the packaged Vista artifact.
- Run the packaged `vista-service` and `vista` CLI against isolated writable roots
  for reviews, cache, and island store.
- Publish and browser-verify representative samples through the packaged runtime:
  scaffold/doctrine, frozen data, heavy kit, telemetry metric/trace/flamegraph,
  pinned `esm.sh`, and blocked dependency rejection.
- Make failures name the boundary they falsify: service reachability, immutable
  root / mutable-root alignment, runtime import policy, island artifact/pin,
  browser render, or provider freeze.
- Advance runtime-policy cleanup in the same milestone where feasible, especially
  replacing stale hand-authored policy/alias state with package-level metadata or
  explicit deltas when the full Genie projection remains too large.
- Capture experiment evidence under `context/vista/.experiments/` and keep #1214
  updated as an index.

## Options

| Option | Tradeoffs |
| --- | --- |
| Packaged smoke plus runtime-policy cleanup | Proves the real artifact while reducing the drift source; higher initial scope, but the two risks validate each other. |
| Packaged smoke only | Fastest protective harness, but can entrench hardcoded runtime-policy state. |
| Runtime-policy cleanup only | Improves contract hygiene, but leaves packaged read-only/runtime-root failures to manual rediscovery. |
| Block-system maturation first | Improves review quality, but does not address the most recent infra regressions. |

## Consequences

- The smoke harness should be developer-runnable first. CI ratcheting is a later
  decision once runtime and flake rate are measured.
- Smoke runs must use isolated roots so experiments do not pollute active review
  state or the working tree.
- The runtime-policy deltas remain visible until the implementation is actually
  projected from package composition; tests that only compare hardcoded arrays are
  not enough to close decision 0044.
- The epic should track the milestone status and link the decision/evidence, but
  durable conclusions belong in VRS.
