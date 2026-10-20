# Provider telemetry is derived at the provider seam, not hand-added per method

Status: accepted

## Context

The observability spec names provider spans `vista.provider.<name>.*` (OBS-R72,
decision 0062). The rejected alternative is for each provider to hand-wrap its own
`core` method in `Effect.withSpan` (e.g. `gh.provider`'s `runGh` declaring
`vista.provider.gh.changedFiles` + `span.label` + attrs inline) and hand-supply
`handlers: group.toLayer(core)` (decision 0027). Hand-wrapping is two blind spots:
a new provider or a new rpc can silently ship with no span at all, and the span
name/label can drift from the `<id>.<rpcTag>` convention by a typo — neither is
caught by types.

## Evidence and Argument

Telemetry coverage is exactly the kind of cross-cutting concern that should be
derived once at a framework seam, not re-authored per call site — the same reason
`meta.json`'s version stance and the freeze pass are centralized. Every provider
already carries the two facts a span needs: its `id` and its rpc tags (off the
`RpcGroup` schema spine). So the span name (`vista.provider.<id>.<rpcTag>`) and its
primary label (`<id>.<rpcTag>`) are *derivable* — authoring them by hand only
introduces drift and gaps. The one thing a method genuinely knows that the seam does
not is its *curated per-call attributes* (a `repo`/`pr`), which it can contribute to
the ambient span without re-declaring the span itself.

`handlers` is likewise not an authoring decision: it is mechanically
`group.toLayer(core)`. Letting the author write it is a second way to get
`core`/`handlers` out of sync for no benefit.

## Decision

- **`defineProvider` is the seam that derives telemetry.** It wraps every `core`
  method so each rpc gets a span `vista.provider.<id>.<rpcTag>` with `span.label` =
  `<id>.<rpcTag>`, derived from the provider `id` + rpc tag — no per-method
  `Effect.withSpan`.
- **Curated attributes via `annotateCurrentSpan`.** A method contributes its own
  per-call attributes (e.g. `repo`/`pr`) onto the ambient derived span, rather than
  re-declaring the span.
- **`handlers` is computed by the seam, not author-supplied.** `defineProvider`
  computes the handler Layer over the wrapped `core`; a provider author supplies only
  `id`, `purity`, `group`, and `core`.

## Consequences

- Uniform coverage: no provider and no rpc can ship without a span, and the
  name/label cannot drift — both are mechanically derived. One place owns the
  provider telemetry shape (`span.label` per the otel-contract convention, 0062).
- Amends the provider shape of decision 0027: `handlers` is derived, not the
  author-written `group.toLayer(core)`; the `03-data-sources` spec's provider-shape
  note is updated to match. Providers drop their inline `Effect.withSpan` and their
  `handlers` field.
- The span *inventory* (naming scheme) is unchanged — only the mechanism moves to the
  seam; the OBS-R72 span names are exactly what the derivation produces.
- Cross-references: 0062 (OTel bootstrap / `span.label`), 0027 (provider shape —
  amended), OBS-R72 (span inventory).
