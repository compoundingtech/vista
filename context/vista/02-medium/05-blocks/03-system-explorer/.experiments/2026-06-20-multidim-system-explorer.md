# Experiment: multi-dimensional system explorer (2026-06-20)

Spike for the complexity-taming capability (MED.BLK.SYSX-R42–MED.BLK.SYSX-R44, OQ-MULTIDIM): model a large
system as one typed graph and explore it through interactive lenses. Modeled the
real `14-axe` VRS subsystem (33 nodes / 46 edges, 3 C4 levels, 4 aspects) using
**React Flow (`@xyflow/react`) + elkjs**. `tsc --noEmit` and `vite build` passed.
(Spike source was under `tmp/proto-multidim/`, since reclaimed.)

## Structured foundation (recommended schema)

One model, many projections. A **lens** is pure serializable data; projection is a
pure function `(model, lens) -> ProjectedScene` (model never mutated). Essentials:

- `SystemNode { id, label, blurb, level (C4), parent?, domain, lifecycle, trust }`
  — explicit **`parent` containment** (not the flat `level` the docs implied) is
  what makes semantic zoom/drill work.
- `SystemEdge { id, source, target, aspect, label? }` — **parallel edges keyed by
  `aspect`** (dataflow|controlflow|ownership|telemetry), one per concern. That IS
  the multi-dimensionality: a dimension toggle is literally
  `edges.filter(e => active.has(e.aspect))` (verified 42→28 edges, zero layout cost).
- `Lens { aspects, maxLevel (zoom floor), expanded (per-node drill), focus?,
  muteBy?, layout }` — a serializable projection spec.

## Mechanisms, ranked (Distill's gate: cut what doesn't change understanding)

1. **Focus + context** (neighborhood bright, rest faded ~22%) — highest value;
   collapses a 28-node hairball to "X + its neighbors" instantly.
2. **Aspect toggle** — the core multi-dimensional idea; a free restyle of the
   persistent scene.
3. **Semantic zoom** (`maxLevel` floor + per-node `expanded` drill) — biggest
   reducer; overview shows 18 containers not 33 components, drill locally.
4. **Attribute-mute** (fade by lifecycle/trust) — keep as a distinct *lens*, but
   mechanically a focus+context variant (select-by-attribute vs by-distance).
5. **Linked table** — keep as a reliable index/brush target, NOT billed as a second
   analytical view (it's a redundant projection).
- **Cut:** plain attribute filtering (hide) as a separate mechanism — it's
  aspect-toggle/zoom generalized, and hide loses context vs mute.

Self-finding (gate turned inward): an initial third zoom knob (`collapsed`) never
changed rendered state — collapse and expand are the same op relative to the zoom
floor; cut to one `expanded` override. Every knob must be a genuinely independent
variable (Victor). Honest caveats: `MuteRule.domain` and `layout:'force'` are
schema-defined but UI-unreachable (wire-or-cut); sparse-aspect lenses (ownership: 4
edges over 28 nodes) render low-signal islands — must auto-scope to participating
nodes.

## Rendering finding (measured, not asserted)

> Aspect toggles and focus changes hold `layoutCount` constant — the persistent
> scene restyles for free. Only structural zoom (drill/collapse, or a layout-kind
> switch) increments it and pays an elk relayout.

Verified: `layoutCount` stayed at 3 across four aspect toggles + a focus change;
+1 on the `agent run` drill and the grouped-layout lens. Mermaid by contrast takes
a source string, so every toggle re-parses + re-lays-out + replaces the whole SVG
(5 renders, ~130–215 ms each, custom badges lost). **Recommendation: a hybrid** —
add a faceted **`system-explorer`** kit family on React Flow + elkjs (rich custom
React node bodies carry level/lifecycle/trust badges + drill affordance,
impossible in a regenerated SVG); **keep `mermaid-diagram`** for static authored
diagrams. elkjs layout keyed on the visible node-set signature (runs only on
structural change).

## Composition with kit + doctrine

`SystemExplorerBlock { _tag: 'system-explorer', modelKey, defaultLensId? }` —
resolve-by-key like `otel-panel` (host resolves `modelKey -> SystemModel`), so the
doc stays portable/serializable (MED.AUTH-R25). Overview→zoom→details-on-demand
(Shneiderman) is the model's spine: a default lens at `maxLevel:'container'` is the
zero-interaction overview. Graduates via the `custom`→first-class path (decision
0008). The typed graph aligns with the `axe vrs` graph-JSON extractor — a
`system-explorer` could consume the VRS-extracted graph directly (shared model).

## Open design decisions (→ open-questions.md)

1. Compound/group nodes (React Flow `parentId`/`extent`) vs flat reroute for
   expanded parents — highest-impact.
2. Sparse-aspect lenses: hide / fade / relayout non-participating nodes.
3. Filter (hide) vs mute (fade) as the default verb.
4. Model source: hand-authored TS vs generated from `axe vrs` graph JSON (and who
   enriches `aspect`/`trust`/`lifecycle`).
5. Lens persistence/sharing: shareable deep-link / saved named view shipped in the
   artifact.
6. Wire or cut `layout:'force'` and `MuteRule.domain`.
