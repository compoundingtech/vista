# System explorer: React Flow + elkjs over a typed-graph foundation

Status: accepted (multi-dimensional explorer spike)

## Context

Vista must tame complexity by letting a human explore a system from multiple
perspectives over a structured foundation (MED.BLK.SYSX-R42–MED.BLK.SYSX-R44, OQ-MULTIDIM). The spike
([../02-medium/05-blocks/03-system-explorer/.experiments/2026-06-20-multidim-system-explorer.md](../02-medium/05-blocks/03-system-explorer/.experiments/2026-06-20-multidim-system-explorer.md))
proved a model + mechanisms + a rendering approach.

## Decision

- **Structured foundation = one typed graph.** `SystemNode` (with explicit
  `parent` containment for semantic zoom) + `SystemEdge` with an `aspect` tag,
  using **parallel edges keyed by aspect** (one per concern) — that is the
  multi-dimensionality. A **lens** is a pure, serializable projection spec; a pure
  function `(model, lens) -> scene` never mutates the model.
- **Rendering = React Flow + elkjs**, not Mermaid, for the explorer. A persistent
  scene restyles for free on aspect toggles and focus (layout count constant);
  only structural zoom pays an elk relayout. Rich custom React node bodies carry
  badges + drill affordances (impossible in a regenerated SVG). `mermaid-diagram`
  stays for static authored diagrams (hybrid, not replacement).
- **Kit family `system-explorer`**, a block `{ _tag, modelKey, defaultLensId? }`
  resolving the model by key (like `otel-panel`), keeping the doc portable (MED.AUTH-R25).
- **Mechanisms that earn their place:** focus+context, aspect-toggle, semantic
  zoom; attribute-mute as a lens; the linked table as an index only. Plain
  hide-filtering is not a separate mechanism. Every control must be a genuinely
  independent variable (Distill's gate / Victor) — knobs that don't change
  understanding are cut.

## Consequences

- Adds React Flow + elkjs to the kit's dependency set (the explorer family); the
  `vista-deps` closure must include them (decision 0017).
- The default lens (overview at container level) is the zero-interaction default;
  this realizes overview→zoom→details-on-demand and the doctrine's structured
  foundation (intuition.md).
- Strong synergy: the model aligns with the `axe vrs` graph-JSON extractor — a
  `system-explorer` can consume VRS-extracted graphs directly (shared, not
  re-authored). Model-source (hand-authored vs generated) is open.
- Open: compound/group nodes vs flat reroute; sparse-aspect lens scoping; filter
  vs mute default; lens persistence/deep-links; wire-or-cut unreached attributes.
