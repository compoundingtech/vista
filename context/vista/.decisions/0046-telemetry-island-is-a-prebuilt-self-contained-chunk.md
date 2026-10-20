# Telemetry island is a pre-built self-contained chunk

> **Reconciled as a legacy special case by [0059](./0059-heavy-components-via-esm-sh-and-lazy-boundary.md) — new heavy components use `esm.sh` + a lazy boundary; the telemetry island keeps this pre-built chunk.**

Status: accepted (data-sources telemetry interview, island-runtime-fit)

## Context

The telemetry island (decision 0040) renders Grafana components that require
React 18 inside Vista's React-19 host. The isolated spike proved a dev-server
per-importer dual-React `resolveId` router, but Vista's runtime-policy contract
(decision 0044, `service/src/runtime-policy/`) is a deliberately declarative
global-alias model — `vistaViteResolveConfig = { dedupe, alias }` +
`optimizeInclude` + `publicImportRoots`, with NO per-importer routing. A global
`react`→react18 alias would break the React-19 host; expressing per-importer
routing would mean extending the freshly-built 0044/0045 contract
([[OQ-ISLAND-RUNTIME-FIT]]).

## Decision

The island is a **pre-built, self-contained ESM chunk**, not dev-server-routed:

- One chunk bundles React 18 (`react18`/`react-dom18`), the Grafana viz subtrees
  (metric `TimeSeries`, trace `TraceTimelineViewer`, `@grafana/flamegraph`),
  `@grafana/data`, and the edge adapters — all **inlined, zero externals**. It
  exports `mount*(el, props)` functions per viz.
- The host imports that single artifact through a generic `LazyBlock` dynamic
  `import()` (client-only). To the runtime-policy it is ONE provided import (a
  single alias/asset), needing no contract change and no per-importer routing.
- Published versions content-address the chunk (decision 0043). Draft serving uses
  a dev-build of the same chunk.

## Consequences

- **Hermetic isolation dissolves the collision problems.** Because react18 +
  grafana + their shared deps are inlined per-chunk, there is no host↔island react
  collision, no `dedupe` interaction, and no `use-sync-external-store18` leaf-dup —
  the closure analysis and the two-surface Rolldown router from the spike are moot.
- **One chunk for all three vizzes** inlines the ~2.5 MB-gzip grafana base ONCE
  (not per-viz), so adding trace/flamegraph beside metric is incremental.
- The spike's dev-server dual-React routing (`server.ts` plugins +
  `OPTIMIZE_INCLUDE` grafana enumeration) is **superseded**; it is not added to the
  service. The proven facts that carry over: subtree deep-imports (not the
  `@grafana/ui` barrel), `applyFieldOverrides()` for metric, `@grafana/data` is
  client-only (`window` at import) so the chunk is dynamic-import-only and never in
  the SSR/projection graph.
- Island INTERNALS (the grafana wiring) are built, not HMR'd — acceptable: they are
  infrastructure, not per-review authoring; review authors edit the doc/data (still
  HMR) and the block dynamic-imports the stable chunk.
- A build step joins the publish path for island-bearing reviews; the chunk-store
  lifecycle ([[OQ-CHUNK-STORE]]) and draft↔built parity ([[OQ-BUILD-PARITY]]) apply.
- Supersedes the `server.ts`-hosted mechanism in decision 0040's consequences and
  the "two-surface router re-homed into the manifest" note (0040/spec); the island
  runtime surface is the built chunk, not a `vistaRuntime` routing contribution.
