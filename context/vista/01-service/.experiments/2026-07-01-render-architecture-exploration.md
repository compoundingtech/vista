# Render/serving architecture exploration: topology + authoring model

Date: 2026-07-01. Evidence for [decision 0054](../../.decisions/0054-thin-shell-authoring-lazy-heavy-blocks.md)
and [0052](../../.decisions/0052-render-via-rolldown-bundled-dev-everywhere.md).
Method: analysis + local single-entry Vite RSS spikes. Data under
`tmp/vista-arch-explore/`.

## The crux

The single-global-server topology (0029) roots one server at `reviews/` and
serves each `<slug>/vN/` as a nested MPA entry — which *forces* per-URL-lazy-
transform and is exactly why bundled-dev (an application bundler needing
enumerated entries) can't serve published. So the question was whether a
different topology or authoring model is more principled.

## Findings

**Topology (RSS is structural, not raw MB):** single server = **one shared
prebundle, RSS flat in N versions**; a per-version dev-server *pool* = N
prebundles (~2.5 GB @ 8-live vs 0.575 GB whole-fleet) — strictly worse. The only
*strong* alternative is per-version **build** (a single entry unlocks a clean
`vite build` → static/offline/service-independent/crash-proof published, interop
once), but it costs **freeze-symmetry** (built ≠ dev-served byte-identical) across
all reviews — a Vista core value (0029). Rejected as the default; kept as the
0043-style escape hatch (islands) only.

**Authoring — thin-shell is the headline (adopt regardless of topology):**
splitting reviews so they eagerly import only lightweight primitives and
dynamic-import heavy blocks measured a **~3× eager-prebundle shrink** (barrel
`~400 MB` warm → thin-shell `132 MB`, node baseline 96 MB). It (a) removes
recharts/es-toolkit from the eager graph (interop surface shrinks at the source),
(b) removes the vendored-Geist module-load driver behind the projection DOM shim
(shim-free projection becomes achievable), (c) shrinks the re-optimize surface.
It attacks the root cause that discovery/bundled-dev/fixed-surface all merely
work around. Cost: authoring discipline + a Renderer/registry refactor.

## Verdict

- **Thin-shell authoring: adopt** (decision 0054) — highest-leverage, orthogonal
  to topology, strict improvement.
- **Topology: keep single server + symmetric no-build** (decision 0052). Per-version
  build would win only if service-independent/offline published, per-version
  live-provider SSR-realm isolation (0027/0029's "one shared SSR realm"
  limitation), or fleet-crash blast-radius become hard requirements. With
  thin-shell landed, one symmetric render path is worth more.
