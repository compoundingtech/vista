# Telemetry island FOD model is Vista-local with Evergreen refresh

Status: accepted (Vista misc6 alignment)

## Context

The telemetry island is a pre-built self-contained chunk (decision 0046) that
Vista serves as one runtime-policy alias and pins into frozen reviews through the
content-addressed island store (decision 0043). Building that artifact depends on
the normal pnpm/Nix packaging path, so stale fixed-output derivations can surface
while proving packaged Vista.

Two concerns are easy to conflate:

- Vista owns the semantic model: one pre-built island artifact, content-addressed
  version pins, no host/importer dual-React routing.
- Evergreen owns stale lock/FOD/hash repair mechanics for the repo.

## Decision

Keep the telemetry island artifact model Vista-local. Vista documents and tests
that frozen reviews pin the built island chunk by content hash, and that packaged
smoke runs through mutable `VISTA_ISLAND_STORE` outside the Nix store.

Do not add Vista-specific FOD/hash repair logic to the Vista service, CLI, or smoke
harness. If a local or CI proof hits a fixed-output derivation mismatch, follow the
repo Evergreen workflow (`/sk-evergreen`, smallest rung) and then rerun the same
Vista proof.

The packaged smoke remains the integration proof for this boundary: it builds or
accepts `.#vista`, publishes island-bearing reviews, and renders trace,
flamegraph, and metric islands through the packaged service.

## Consequences

- Vista keeps the island contract small: built artifact + runtime-policy alias +
  content-addressed pin.
- Stale FOD repair stays centralized in Evergreen, consistent with repo policy.
- Future work may add a general first-class "auxiliary generated artifact/FOD"
  model to Genie/Evergreen, but Vista should consume that shared model rather than
  inventing a one-off island refresh path.
