# Blocks — Intuition

*For: why the curated block library is its own realization layer · Assumes: the
medium composition ([../intuition.md](../intuition.md)) and the render contract
([../02-renderer/intuition.md](../02-renderer/intuition.md)) · Covers: the
compounding-block thesis, packaging, and where heavy blocks earn a subsystem.*

A **block** is a *curated* semantic React component — one of Vista's shipped, typed
library members. The contracts next door say what a block must satisfy: the
[renderer](../02-renderer/intuition.md) requires React/manifest identity correspondence,
[data-sources](../03-data-sources/intuition.md) says a data-backed block
resolves its data by key, [doctrine](../04-doctrine/intuition.md) says the app it
composes must lead with an ask. This node is where those contracts are *realized* as
an actual library — and where the value compounds.

**Apps compound because blocks compound.** Every block a coding agent proves once
becomes a reusable, typed, catalogued block the next app gets for free. The escape
hatch keeps that loop open: an app-local semantic component can be curated into the
shared catalog without gaining privileged projection power. The block library is
the compounding asset of Vista.

**The library owns the cross-cutting concerns, not the renderer.** One versioned
pnpm-workspace package (MED.BLK-R01/R27), one shared Storybook that is both the
incubation surface and the visual-critique surface (MED.BLK-R26), Geist-native
theming across every block including the third-party seams (MED.BLK-R07/R10/R48).
These span *all* blocks, so they live at the composite over all blocks — not at the
thin render contract, which stays about React/manifest correspondence.

**Heavy blocks earn their own subsystem.** Most blocks are a flat roster entry. Six
carry enough model, mechanism, and decisions to be their own node: `code`
(diff+file-tree), `mermaid`, `system-explorer`, `treemap`, `telemetry`, and `fork`.
Each is a *vertical* subsystem that refines whichever *horizontal* contracts it
uses — `system-explorer` and `treemap` refine the interactive-exploration charter,
`telemetry` refines both the data and render contracts, `fork` refines doctrine.
That is the whole point of the contract/realization split (decision 0067): a block's
complexity is contained in its own node, and adding a heavy block is a local,
additive operation that never touches a contract or the top glossary.

**Interactivity is a scarce resource.** The two model-backed exploration blocks —
`system-explorer` (a typed multi-dimensional graph projected through lenses) and
`treemap` (a value-proportioned hierarchy) — follow the doctrine's rule: start from
a sensible zero-interaction default, add a control only where it changes what the
reviewer can *understand*, and keep the model serializable (resolve-by-key) so the
document stays portable. A control that re-displays what a sentence already said is
cut.
