# Thin-shell authoring: reviews lazy-load heavy blocks, keep the eager graph light

Status: accepted

This decision provides the foundation for decision 0052, extends
MED.BLK.TELEM-R52, preserves MED.AUTH-R24's graduation trip-wire and
MED.AUTH-R25 portability, and adds MED.AUTH-R59.

> **Greenfield amendment:** The node-safe eager-graph constraint remains.
> `Renderer`, `defineReview`, `ReviewShell`, and `review.tsx` below describe the
> retired document path. Current `app.tsx` default-exports an ordinary zero-prop
> App; browser-only behavior stays below a stable lazy Island while Vista derives
> semantics through trusted in-process evaluation.

## Context

The kit's `Renderer` statically imports every block in an exhaustive `switch`, so
a review that renders via `@vista/kit` pulls the whole block closure into its
**eager module graph**. Measured against the code, exactly three module-scope
deps make it heavy: `ChartBlock → recharts` (→ es-toolkit, the transitive-CJS
interop hazard), `Diff`/`FileTree`/`GhPreviews → @pierre`, and `SystemExplorer →
@xyflow`. `MermaidDiagram` and the telemetry blocks are **already light** at
module scope (mermaid `await import`s inside its effect; telemetry routes Grafana
through the `LazyBlock`/island loader, decision 0046) — they stay eager.

An architecture exploration
([.experiments/2026-07-01-render-architecture-exploration.md](../01-service/.experiments/2026-07-01-render-architecture-exploration.md))
measured that dynamic-importing the heavy set shrinks the eager prebundle ~3×
(barrel `~400 MB` warm → `132 MB`). Note: the `derive-projection.ts` DOM-shim's
driver is **not** a block — no block imports Geist `Table`; Geist enters the graph
only via `ReviewShell` (ThemeSwitcher). So making `Renderer` lazy banks the
prebundle/interop win but does **not** by itself make the projection shim-free.

## Decision

Reviews are **thin shells**: the eager graph carries React + lightweight doctrine
primitives; the genuinely heavy blocks — **chart, diff, file-tree, gh-previews,
system-explorer** — are dynamic-imported at render. This is delivered as two
levers (staged):

- **Lever 1 — Renderer laziness (the ~3× shrink).** `Renderer` keeps its
  exhaustive `switch (block._tag)` + `assertNever` (the MED.AUTH-R24 graduation trip-wire —
  NOT replaced by a registry); only the five heavy arms render a `React.lazy`
  component behind a `Suspense` boundary with a measured-skeleton fallback (MED.BLK.TELEM-R52, no
  layout shift). Two mechanisms by React-root ownership: host-React heavy blocks
  use `React.lazy`/`Suspense` (same tree); the foreign-React telemetry island
  keeps the imperative `LazyBlock` (its own React-18 root — Suspense cannot bridge
  two reconcilers). recharts/@pierre/@xyflow leave `Renderer`'s eager graph.
- **Lever 2 — node-safe projection (separate).** A `@vista/kit/authoring` entry
  (only `defineReview` + types) keeps `ReviewShell`→Geist out of the `review.tsx`
  projection-eval graph, plus MED.AUTH-R59 (below). This is what shrinks the
  `derive-projection.ts` DOM shim toward removable — it is NOT a free rider on
  Lever 1.
- **Standing authoring rule (MED.AUTH-R59), lint-enforced:** a review module must not touch
  browser globals at module scope; such access moves into a component/effect.
  Enforced by an oxlint rule (the repo's idiomatic tooling), not discipline.

## Consequences

- **Attacks the root cause the render mechanisms only work around.** With the
  heavy deps out of the eager graph, the CJS-interop surface shrinks and a
  heavy-dep interop failure can only degrade its own lazy block, never blank the
  page — the doctrine spine always renders. This is what makes 0052's single
  server + auto-discovery reliable and per-version isolation unnecessary.
- Eager prebundle ~3× smaller; smaller re-optimize surface (de-risks 0052's
  accepted multi-version RSS/504 risk).
- Shim-free projection is a **distinct lever** (the `@vista/kit/authoring` split +
  MED.AUTH-R59), not delivered by Renderer laziness — Geist enters via `ReviewShell`.
- MED.AUTH-R25 orthogonal (blocks reference by string key; the document is unchanged);
  extends MED.BLK.TELEM-R52 from "may" to the default authoring shape; keeps the
  switch/`assertNever` graduation trip-wire (MED.AUTH-R24). `React.lazy` wants a default
  export, so each arm adapts the named export (`import(...).then(m => ({ default:
  m.X }))`).
- **Sequencing:** slice 1 = Renderer laziness (banks the shrink, independently
  shippable); slice 2 = `@vista/kit/authoring` split + MED.AUTH-R59 (node-safe projection);
  slice 3 = serve-time lazy-chunk durability.
- **Not a migration concern:** already-published reviews need not resolve the new
  lazy chunks — old reviews may be archived rather than migrated (maintainer
  decision, 2026-07-02).
- A win under any topology; adopted independent of the topology decision (0052
  keeps the single server).
