# System Explorer — Spec

Specifies the `system-explorer` model — a typed multi-dimensional graph projected
through lenses, the heavier of the two model-backed exploration blocks. Builds on
[requirements.md](./requirements.md); the React/semantic-manifest boundary is
[../../02-renderer/spec.md](../../02-renderer/spec.md). Requirement IDs are
path-scoped in `./requirements.md`.

## Status

Draft.

## System-explorer model

A large system is one typed graph: `SystemNode {level, parent, domain, lifecycle,
trust}` + `SystemEdge {aspect}` with parallel edges keyed by aspect (the
multi-dimensionality). A **lens** ([../glossary.md](../glossary.md)) is a pure
serializable projection `(model, lens) -> scene`. Rendered with React Flow + elkjs
(a persistent scene restyles free on aspect-toggle/focus; only structural zoom
relayouts); mechanisms: focus+context, aspect-toggle, semantic zoom (decision 0018,
MED.BLK.SYSX-R42–MED.BLK.SYSX-R44). Exposed as a `system-explorer` block resolving
its model by key (MED.REND-R04); aligns with the `axe vrs` graph-JSON extractor.

The lens/scene projection pattern established here (a persistent scene that restyles
for free and relayouts only on a structural change) is inherited by the
[treemap](../04-treemap/spec.md) block for value hierarchies.

When placed in a resizable BlockViewport, `system-explorer` declares `canvas`
content semantics. Viewport safety and authored bounds still apply, but there
is no UsefulExtent cap: additional area remains useful for graph layout,
navigation, and focus context.
