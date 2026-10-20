# Renderer — Intuition

*For: why canonical React rendering corresponds to a semantic manifest · Assumes: the
medium composition ([../intuition.md](../intuition.md)) and the authoring contract
([../01-authoring/intuition.md](../01-authoring/intuition.md)) · Covers: the render
contract every semantic component satisfies.*

The renderer's job is to render canonical React source while preserving stable-ID
correspondence with the minimal semantic manifest. The curated
block library, its packaging, and its heavy model-backed members live next door in
[05-blocks](../05-blocks/intuition.md); this node is the thin seam they all satisfy.

**React/manifest equivalence (MED-R02 → MED.REND-R02).** Semantic primitives emit
stable manifest IDs and matching `data-vista-id` DOM targets. Data and runtime
bindings follow one policy in draft and frozen views.

**Resolve-by-key keeps semantics portable (MED.REND-R03/R04).** Manifest records
name data/runtime bindings by stable key and carry stable IDs, letting doctrine,
indexing, freezing, and feedback share the same nonvisual seam.

**The contract is deliberately thin.** Everything block-*specific* — how a treemap
lays out, how the telemetry island isolates its own React instance, how the library is versioned
and catalogued in Storybook — is a *realization* concern and lives in
[05-blocks](../05-blocks/intuition.md). Rendering is ordinary React composition;
there is no tagged-block renderer or component registry to satisfy.
