# Render core: one dev server + GA auto-discovery (Rolldown bundled-dev rejected)

Status: accepted. Supersedes this decision's earlier bundled-dev-everywhere
target (rejected below, with proof). Revises decision 0029's `optimizeDeps`
model; reconciles with 0043; thin-shell authoring (decision 0054) is the
foundation. Backed by SVC-R58's CI mount guard. (Filename is legacy — the decision is
auto-discovery, not bundled-dev.)

## Context

Published reviews rendered blank service-wide: a transitive CJS dep
(`es-toolkit/compat/get`, via `recharts`, which the kit's `Renderer` statically
imports) was served **raw** because 0029 served deps with
`optimizeDeps.noDiscovery: true` + a **hand-maintained first-hop `include` list**;
any transitive CJS specifier not enumerated is served raw and dies on a missing
`default` export. The hand-list is the un-derivable list the "derive, don't
author" doctrine warns against, and a standing correctness hazard.

Two alternatives were explored empirically and one is rejected:

- **Rolldown bundled-dev** (`experimental.bundledDev`, Vite 8) kills the interop
  category by bundling the client graph, but is **fundamentally unfit for
  published pages** (proof: [.experiments/2026-07-01-rolldown-bundled-dev.md](../01-service/.experiments/2026-07-01-rolldown-bundled-dev.md)
  + commit 79a4ac28d): (1) it cannot resolve Vista's nested per-version MPA
  entries (`[UNRESOLVED_ENTRY]`/404 on every published GET), and (2) it bakes an
  HMR-WebSocket client into the bundle that the strip machinery cannot neutralize,
  violating the console-clean/zero-WebSocket published invariant. Not
  config-fixable — the only workaround is per-version `vite build`, which the
  provider runtime (`ssrLoadModule`, decision 0027 — the dev server is mandatory)
  forbids.
- **GA auto-discovery** (`optimizeDeps: {}`) lets Vite's optimizer scan the true
  transitive graph and prebundle every dep with correct interop, within the
  unchanged 0029 serving model. A benchmark
  ([.experiments/2026-07-01-render-mechanism-benchmark.md](../01-service/.experiments/2026-07-01-render-mechanism-benchmark.md))
  settled it: on the recharts→es-toolkit closure discovery renders (svg=3, 0
  console errors, 0 WebSockets) with **no hand-list**, while include-list **blanks
  the page** the moment a transitive CJS dep is missing (exact
  `es-toolkit … no export named 'default'`). Perf: 8× faster startup, ~850ms
  slower cold render (a rare per-server-start / per-new-dep path), warm + draft
  HMR equivalent.

## Decision

The render core is **one global Vite dev server (0029 unchanged) + GA
auto-discovery**: `optimizeDeps: {}` on published and draft — no `noDiscovery`,
no hand-maintained `include` list, no first-hop coverage guard. Vite derives the
whole prebundle from the true graph — "derive everything, author nothing," the
purest form of the derive-don't-author doctrine.

- **Rolldown bundled-dev is rejected** as fundamentally unfit for published
  (above). The dead `VISTA_BUNDLED_DEV` proof apparatus + its `closeDraftHardened`
  teardown guard are removed — one clean core, one path.
- **Thin-shell authoring (decision 0054) is the foundation.** Reviews
  dynamic-import heavy/browser-coupled blocks, so the eager graph is tiny;
  discovery over it is trivial, and a heavy-dep interop issue degrades only its
  own lazy block, never blanks the page (the doctrine spine renders regardless).
- **0043's island stays a built, content-pinned chunk** — reviews `import()` it
  dynamically, so it is code-split (its own `/assets/island-*.js`) regardless of
  optimize mode (which only touches the client dep-optimizer). Freeze/pixel
  durability preserved.
- **Freeze-symmetry preserved.** Draft and published render through one path (no
  `vite build` for reviews); what you preview is what freezes. Per-version build
  was considered and rejected: it would buy static/offline/isolated published but
  cost freeze-symmetry across all reviews (see
  [.experiments/2026-07-01-render-architecture-exploration.md](../01-service/.experiments/2026-07-01-render-architecture-exploration.md)).

## Consequences

- Kills the blank-render category with **zero hand-maintenance**; removes the
  include list, its coverage guard, and the bundled-dev apparatus — net mechanism
  removed.
- GA optimizer (not experimental) → **no Rolldown binary on the serve path**, so
  the per-platform `@rolldown/binding-*` serve-time FOD risk evaporates (a
  simplification vs the rejected bundled-dev path).
- Cold first-request re-optimize (~850ms) is rare (per-server-start / per-new-dep)
  and small; **pre-warm-at-publish is an optional lever, not built** — publish's
  freeze pass is where a cheap warm-touch could go if cold latency ever matters.
- **One accepted, unmeasured risk (monitor in production):** sustained
  multi-version RSS and a possible re-optimization 504 window — 0029's original
  rationale for the hand-list. Thin-shell shrinks the eager graph so re-optimize
  is cheaper and rarer; no dedicated soak was gated (deploy is human-gated).
- Retires OQ-BUNDLEDDEV-DERISK (gate cannot be met on the published path) and
  resolves OQ-SERVE to one-server + auto-discovery. SVC-R17 already states the
  property mechanism-neutrally (no un-interop'd module; no hand-list), so it
  stands; discovery is its mechanism.

## Amendment 1 — Discovery seeded from the projected runtime policy

GA auto-discovery stands; what changes is the optimizer's starting set. The
draft dev server passes the Genie-projected `optimizeInclude` (decision 0044)
as `optimizeDeps.include` while `noDiscovery` stays off. This is not the
hand-maintained first-hop list this decision rejected: the seed is derived from
package composition, and a specifier it lacks is still discovered and
prebundled with correct interop, so the blank-render category stays closed.

The seed exists because the data runtime (decision 0094) enlarged the eager
closure with `effect` reactivity and RPC subpaths. Discovering those one
lazy-block family at a time re-bundled the whole closure on every pass: a
cold draft took three passes and about 65 s before its first paint. With the
seed the same draft converges in one pass and paints in about 6 s with no
outdated-dependency reloads
([../02-medium/03-data-sources/.experiments/2026-09-19-integration-spike.md](../02-medium/03-data-sources/.experiments/2026-09-19-integration-spike.md)
records the integration; the measurement is in the T1 pull request).
