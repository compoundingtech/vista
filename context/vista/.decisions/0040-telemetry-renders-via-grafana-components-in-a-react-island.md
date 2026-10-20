# Telemetry blocks render via Grafana components in an isolated React island

> **Routing mechanism superseded by [0046](./0046-telemetry-island-is-a-prebuilt-self-contained-chunk.md) — the island is a pre-built self-contained chunk, not a per-importer dual-React router. Rendering telemetry via Grafana components in an island stands.**

Status: accepted (data-sources telemetry interview Q1/Q3)

## Context

Vista's telemetry blocks (metric time-series, distributed-trace waterfall,
flamegraph) were hand-rolled (a CSS waterfall, a Recharts chart) over synthetic
data. The question was whether to keep first-party renderers or reuse SOTA
observability UI. Grafana ships the best-in-class telemetry components, but they
require **React 18** and Vista's host app is **React 19** — and Grafana's trace
view is not published to npm.

An e2e experiment (`05-data-sources/.experiments/2026-06-26-grafana-island-feasibility.md`)
proved all three Grafana vizzes render together inside an isolated **React-18
island** mounted into the React-19 host via a per-importer Vite `resolveId` router,
fed from our own data, with no Grafana backend. The island's `@grafana/ui`
substrate costs ~2.5 MB gzip as a one-time base; each additional Grafana viz then
adds only its delta (the whole trace view was +128 KB) — so one shared island
amortizes across all telemetry blocks.

## Decision

All telemetry blocks render through real Grafana React components inside a single
shared, lazily-loaded, **client-only** React-18 island:

- **metric time-series** — `@grafana/ui` `TimeSeries` (uPlot-backed).
- **trace waterfall** — Grafana's Jaeger `TraceTimelineViewer` (vendored; see
  decision 0042 for the license stance).
- **flamegraph** — `@grafana/flamegraph`.

Maximum visual consistency with Grafana across the telemetry surface is the chosen
property, paid for by the one-time island base and the constraints below.

## Consequences

- The island is **client-only**: `@grafana/data` touches `window` at import, so the
  island module is dynamically imported in the browser and never enters the
  SSR/`ssrLoadModule` graph (amends the freeze/SSR semantics; see spec).
- The kit gains a general **lazy large-block** capability (the island is its first
  consumer) so the ~2.5 MB base loads on demand, not on every review.
- Theming is one `createTheme(DeepPartial<GrafanaTheme2>)` mapping from Vista design
  tokens, shared by all three vizzes.
- The metric leg uses `@grafana/ui/graveyard/TimeSeries` (deprecated upstream); it
  is uPlot under the hood. Accepted for visual consistency; longevity risk mitigated
  by pinning/vendoring (tracked as a spec risk).
- Rejected alternatives: first-party renderers (lose Grafana parity); uPlot-direct
  for metrics (lean but breaks single-island visual consistency); Perses/`@grafana/scenes`
  (React-18-locked AND runtime-coupled).
- **Single path, no fallback (interview Q4).** The Grafana island is the only
  telemetry renderer; there is no first-party hybrid fallback. The existing
  first-party `kit/src/blocks/OtelTrace.tsx` is retired, not kept in parallel.
  Partial/rootless traces (a common Tempo case the red-team flagged — the
  OTLP→Jaeger adapter renders `<trace-without-root-span>` on a missing root or
  missing `service.name`) are handled *inside the single adapter* by synthesizing a
  placeholder root and tolerating missing service names — single-path robustness,
  not a second renderer. The partial-trace robustness loss vs the retired
  first-party renderer is accepted for simplicity.
- Red-team mitigations (see `.experiments/2026-06-26-grafana-island-critique.md`)
  are load-bearing and specified in `spec.md`: real-pipeline integration proof
  first; the island reached only via dynamic `import()` inside the block, never
  re-exported from the kit barrel (projection-`ssrLoadModule` safety + lazy bundle);
  `@grafana/ui` pinned exactly.
- **Integration VERIFIED for the metric viz in the real pipeline**
  (`.experiments/2026-06-27-island-real-pipeline-integration.md`), refining HOW:
  - The per-importer dual-React router needs TWO surfaces — the request-time Vite
    plugin AND an `optimizeDeps.rolldownOptions` plugin (Vite 8 prebundles with
    Rolldown, not esbuild). It coexists with `dedupe:['react']` by discriminating on
    importer (island paths routed pre-`vite:resolve`; host falls through to dedupe).
  - **Deep-import the viz SUBTREE, not the `@grafana/ui` barrel** (the barrel drags
    shared react-using packages and collides). Cost drops from ~2.5 MB to ~180 KB
    gzip island-attributable.
- **Per-viz closure reality (refines "one shared island"):** metric + trace are
  host-disjoint and share one island cleanly; **flamegraph** needs ONE extra leaf
  duplication (`use-sync-external-store18`), not the react-aria family. If any
  leaf-dup proves fragile, decision 0043's isolated island BUILD is the universal
  fallback. So 0040 holds, with flamegraph carrying a small, bounded extra step.
- **Public distribution approved** by Johannes on 2026-10-20 (Q347 / Axe Q10),
  superseding the internal-only licensing scope. Vista is Apache-2.0; the vendored
  trace subtree is AGPL-3.0-only, with Corresponding Source in the public Vista
  repository (decision 0042). Operators who serve a modified island to remote users
  other than themselves must offer that source to those users (for example, a
  repository link). Johannes's fleet serves first-party users only. No serve-time
  link or AGPL-specific CI tripwire is added; a UI source link is a possible later
  product change, not a legal conclusion about every deployment. The dynamic-
  `import()` / no-barrel-export boundary stays for projection node-safety and
  lazy bundle size, not as an exemption from AGPL.
- **The island runtime surface is a `vistaRuntime` contribution, not hardcoded
  `server.ts`** (decisions 0044/0045, since implemented in `flakes/vista/runtime-policy`
  + `service/src/runtime-policy`). The island's deps (react18/react-dom18,
  `@grafana/ui`+`@grafana/data`, the viz-subtree alias, optimizeDeps includes, the
  `use-sync-external-store18` leaf-dup) attach as typed Vista runtime metadata at the
  Genie package-composition boundary — the island is a legitimate package/optional-
  loading-boundary contribution owner per 0044. The dual-React `resolveId` routing
  must be expressed through / cooperate with the authoritative import-classifier Vite
  plugin (0045) so island specifiers classify as `provided` rather than failing
  fast — NOT as a competing hardcoded resolver. The isolated-experiment's
  hardcoded `server.ts` plugins/`OPTIMIZE_INCLUDE`/alias were pre-0044/0045 and are
  superseded by this contribution path (the proven mechanism — two-surface router,
  subtree import, dedupe-by-importer — carries over, re-homed into the manifest).
