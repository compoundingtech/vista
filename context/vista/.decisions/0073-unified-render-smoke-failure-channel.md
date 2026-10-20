# One render-smoke failure channel: publish aborts, never orphans a version

Status: accepted

## Context

Decision 0058 added the per-review browser mount smoke: after a version is populated
but before it acquires the `latest` pointer, its canonical URL is headless-loaded and
the publish fails if it does not mount. A publish reaches that smoke by two paths —
`publishWithFreeze` (the freeze path) and the plain `publish` (a pure doctrine app
with no frozen blocks). Previously those paths reported a smoke failure with two
different error models: the freeze path returned `aborted`, while the no-freeze path
surfaced `PublishFailed`. One condition, two failure shapes for the caller to handle.

## Evidence and Argument

A review that fails to mount is a single condition and should have a single outcome —
"nothing published, reproducible-or-nothing" (VST-R64/0057: a blank-on-publish is a
ceremony failure, not merely a bug). The right seam to unify at is the RPC boundary:
`publish()` is the low-level primitive and can throw a typed `RenderSmokeError`;
`publishWithFreeze` is the only RPC-facing entry and can translate that into the same
`aborted` outcome the freeze path already returns, so the failure never surfaces as
`PublishFailed` on one path and `PublishAborted` on the other.

Two failure edges must not leak a half-published version. A render-smoke browser that
cannot even launch is a *smoke result* (`{_tag:'failed'}`, fail-closed), not a thrown
error — so it aborts, not crashes. And a smoke that *throws* unexpectedly (rather than
returning) must still tear the claimed `vN` down, or `scanApp` would later treat a
half-published, never-render-proven version as real.

## Decision

- **One outcome on both paths.** A review that fails the render proof is `aborted` →
  `Vista.PublishAborted` on both the freeze and the plain no-freeze publish path.
- **Primitive throws, orchestrator translates.** `publish()` throws
  `RenderSmokeError`; `publishWithFreeze` (the only RPC-facing entry) catches it and
  returns `aborted`.
- **Unlaunchable browser is a `failed` smoke, not a throw** — it fails closed to
  `{_tag:'failed'}`, aborting the publish.
- **Teardown on any failure or throw.** The claimed `vN` is torn down on any smoke
  failure *or* throw, across both publish paths, so a half-published version is never
  orphaned and `vN` stays reusable.
- **Refines 0058.** Corrects its no-freeze path from `PublishFailed` to the unified
  `PublishAborted` model.

## Consequences

- `RenderSmokeError` is an internal primitive-level signal; `PublishAborted` is the
  sole RPC-facing failure for a non-mounting review — the caller handles one shape.
- A version that fails any publish edge (capture abort, projection gate, island pin,
  render smoke, or an unexpected throw) is torn down uniformly, so `vN` is never
  orphaned — freeze symmetry across every teardown (0031 abort policy, 0043 island
  pin, 0058 render proof).
- Cross-references: 0058 (render proof — refined), 0057/VST-R64 (reproducible-or-
  nothing), 0031 (abort-policy teardown symmetry), SVC-R58 (render guarantee).
