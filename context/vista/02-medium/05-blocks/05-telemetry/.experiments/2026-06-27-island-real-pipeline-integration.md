# Grafana island — real-pipeline integration checkpoint

Resolves the load-bearing risk [[OQ-ISLAND-PIPELINE]]: does the dual-React island
compose with Vista's REAL two-server pipeline (`resolve.dedupe:['react']` +
`optimizeDeps.noDiscovery` + published & draft servers), not just a standalone
`vite build`? Run in an isolated worktree against `flakes/vista`. Verified diffs
preserved at `tmp/island-integration/island-integration.patch` (replay when disk
allows; see disk note below).

## Verdict: YES for the metric viz (empirical); architecture refined for all three

Host React **19.2.7** and island React **18.3.1** coexist on one page; `@grafana/ui`
`TimeSeries` (uPlot) paints with correct axis ticks, console clean, in BOTH
published and draft modes. Non-browser suite 30/30 incl. `sample-projection-drift`
and `publish` guards — the dynamic-`import()` isolation holds (no `@grafana/data`
`window` touch leaked into the SSR/projection graph).

## Three breakages the standalone proof never hit (now fixed)

1. **Vite 8 optimizes deps with Rolldown, not esbuild** — `optimizeDeps.esbuildOptions`
   is silently ignored, so the React router must also live on
   `optimizeDeps.rolldownOptions.plugins` (a Rollup-style `resolveId`), else
   Grafana's bare `react` binds to host React-19 in the prebundle → `_inheritsLoose`
   on undefined. There are TWO surfaces: the request-time Vite plugin AND the
   optimizer plugin.
2. **The `@grafana/ui` barrel is fatal → deep-import the viz SUBTREE.** Importing the
   barrel drags shared react-using packages; one hoisted copy binds to only one
   React → "Invalid hook call". Fix: alias to the specific viz subtree
   (`@grafana/ui/dist/esm/graveyard/TimeSeries/TimeSeries.mjs`). Cost collapses from
   the barrel's ~2.5 MB gzip to **~180 KB gzip** island-attributable.
3. **`noDiscovery` raw-serve CJS interop** — the scoped subtree + its CJS-interop
   deps (`@emotion/css`, `react-use`, `uplot`, `rxjs`, …) must be hand-enumerated in
   `OPTIMIZE_INCLUDE` so Rolldown prebundles them (binds react→react18, fixes named
   imports from CJS).

## The dedupe ↔ router interaction (what standalone couldn't test)

The router discriminates by **importer**, not specifier. The request-time plugin is
`enforce:'pre'`: for island importers (matched by path markers `react18`,
`react-dom18`, `@grafana`, `@emotion`, `react-use`) it resolves bare `react` to an
absolute `react18` path BEFORE `vite:resolve` (where `dedupe` lives) runs. Host
importers return `null` → fall through → `dedupe:['react']` collapses them to the one
React-19 singleton. No collision: `dedupe` still governs the host; the router carves
out only the island. `react18`/`react-dom18` are their own `OPTIMIZE_INCLUDE` entries
so Grafana's routed `react` and the island root's `react18` dedupe to ONE react18
chunk (the singleton hooks need).

## Shared-island architecture verdict (refines decision 0040)

Module-level closure analysis (dist-import + `@grafana/ui` graph reachability, NOT
package manifests — the manifest walk over-counted react-aria). Correction: the
host kit's `react-aria-components` **self-bundles** react-aria; host and island use
physically different copies → routable.

- **Metric + trace → host-disjoint (clean (a)).** Metric proven. Trace (vendored
  `TraceTimelineViewer`, imports `@grafana/ui` 35×) reaches 54 `@grafana/ui` modules,
  **0 reach react-aria**; imports no `react-redux`/`use-sync-external-store`/standalone
  `@react-aria`. Residual: trace also imports `@grafana/scenes`/`@grafana/runtime`
  (untraced here) — verify those when wired.
- **Flamegraph → one leaf collision (narrow (b)).** `@grafana/flamegraph` imports the
  `@grafana/ui` barrel (28×); its graph reaches react-aria via exactly one path
  (`Table → ConfirmModal → Modal → ModalBase → @react-aria/overlays`), but standalone
  `@react-aria/*` is imported by 0 host packages → not a host collision. The ONE
  genuine module-level collision is **`use-sync-external-store`** (a leaf: host
  `zustand`@19 vs island `react-redux`/react-aria@18). Fix = duplicate that single
  leaf (`use-sync-external-store18` alias, routed for island importers) — NOT the
  react-aria family. **Unproven: install-blocked on disk** (below); structurally the
  same mechanism as `react18`/`react-dom18`.
- **(c) "can't isolate" applies to none.** Safety net: decision 0043's isolated
  island BUILD inlines a viz's own react18 + react-aria + use-sync-external-store and
  collides with nothing — the universal fallback if any leaf-dup proves fragile.

## Caveats to carry

- The metric seam `…/dist/esm/graveyard/TimeSeries/TimeSeries.mjs` is a deprecated
  `graveyard/` path AND a `dist/esm` internal bypassing the package `exports` map —
  safe only because `@grafana/ui` is pinned exactly (13.1.0). Track as a Notion
  blocker. The supported alternative (Scenes/PanelRenderer) is heavier/runtime-coupled.
- pnpm needs `strict-peer-dependencies=false` (react18 alias + Grafana vs workspace
  react19).

## Disk note (blocked the flamegraph empirical proof)

dev3 root fs 85GB→13GB→~100% this session under multi-agent load; agent-policy's
25 GB build floor refused `pnpm add @grafana/flamegraph`. So flamegraph wire-in +
the `use-sync-external-store18` leaf-dup are ANALYSIS-clean but not runtime-proven.
Filed as `axe feedback` (nix friction). Replay the integration patch + finish the
flamegraph/leaf-dup proof once disk recovers above the floor.
