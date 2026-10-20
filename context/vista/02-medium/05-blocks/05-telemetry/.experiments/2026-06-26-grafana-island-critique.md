# Adversarial critique — Grafana-island telemetry architecture

Independent red-team (Plan agent) of decisions 0040–0042, grounding on Vista's
real pipeline (`server.ts`, `publish.ts`, `freeze.ts`, `heavy-kit.browser.test.ts`,
`sample-projection-drift.test.ts`), not just the standalone island proof. Findings
most-severe first; each carries the mitigation now folded into `spec.md`.

## 1. Integration unproven in the real pipeline (HIGH)

The island proof was a clean standalone `vite build`. The real service has
`resolve.dedupe:['react']` (load-bearing for the custom-block escape hatch),
`optimizeDeps.noDiscovery:true` with a hand-maintained include list, and two server
instances (published + per-slug draft) sharing one out-of-tree prebundle. The
per-importer dual-React `resolveId` routing coexisting with `dedupe:['react']` is
unproven; the whole `@grafana/ui`+react18 CJS closure must be hand-enumerated under
`noDiscovery` or it serves raw HTTP-200 and dies on a missing `default` export
(exactly why `heavy-kit.browser.test.ts` exists).
**Mitigation:** reproduce the island in the real two-server pipeline + extend the
heavy-kit render-proof to a telemetry page as the FIRST implementation step.

## 2. Projection `ssrLoadModule` hazard (MEDIUM)

Reviews are pure CSR and freeze replays provider `core` (no React render), so
"freeze SSRs the island" is a non-issue. But the planned index projection
(decision 0034) will node-import the review module graph via `ssrLoadModule`; a
static island import anywhere in `review.tsx` or the `@vista/kit` barrel pulls
`@grafana/data` (`window` at import) into Node and breaks projection for EVERY
review.
**Mitigation:** island reached only via dynamic `import()` inside the block, never
re-exported from the barrel; lint/grep CI guard; extend `sample-projection-drift`
to a telemetry sample.

## 3. AGPL bound is policy, not code (HIGH)

Containment is a bundler outcome (code-split), not a package boundary; the trace
block lives in the kit consumed by every review. §13 triggers on serving to any
non-first-party network user — a one-line `VISTA_ALLOWED_HOSTS`/guest change, with
no code tripwire.
**Mitigation:** AGPL trace source in a separate vendored package the barrel never
re-exports + CI import-guard (doubles as the projection guard); a serve-time §13
source-offer link rendered whenever the trace island mounts.

## 4. Frozen telemetry is not pixel-reproducible (MEDIUM) — OPEN DECISION

Decision 0029 ships no `vite build`; published pages render from raw source + one
shared mutable prebundle. A frozen telemetry page imports the 2.5 MB island from
that shared prebundle, so bumping `@grafana/ui` re-renders every past frozen
telemetry page. 0041 freezes the data bytes, not the pixels. Note: nothing in
Vista is pixel-durable today (0029) — the island amplifies blast radius (tiny
first-party → 2.5 MB Grafana), it does not introduce a new class.
**Options:** (a) build only the island into each version dir at publish (pinned,
pixel-durable, surgical departure from 0029); (b) accept "data-frozen, not
pixel-frozen" and align the MED.DATA-R29/0041 wording + badge so it does not overclaim.

## 5. Metric leg weakest (MEDIUM-LOW)

`@grafana/ui/graveyard/TimeSeries` is deprecated upstream; needs
`applyFieldOverrides()` or axis ticks render `undefined`. But the `@grafana/ui`
base is paid by flamegraph anyway, so routing metric through it is incremental, not
a cost driver — a longevity/pin risk only.
**Mitigation:** pin `@grafana/ui` exactly; wrap `TimeSeries` behind a one-file
adapter so a future swap is localized; track the graveyard removal as a Notion
blocker.

## 6. Adapter regresses partial/rootless traces (MEDIUM)

OTLP→Jaeger renders `<trace-without-root-span>` on a missing root (Tempo partial
returns, sampled-out parents, mid-flight, multi-root forests) or missing
`service.name`; drops span links/FOLLOWS_FROM; ns→µs collapses sub-µs. The retired
`OtelTrace.tsx` was more robust here.
**Resolution (interview Q4):** single path, no first-party fallback; handle in the
one adapter by synthesizing a placeholder root and tolerating missing service
names. Robustness loss accepted for simplicity.

## Lazy-block infra recommendation (folded into spec)

Generic `kit/src/LazyBlock.tsx` primitive (not island-specific). IMPERATIVE mount,
NOT `React.lazy`/Suspense (host React-19 and island React-18 are different
reconcilers): host renders a measured skeleton + `useState`; an effect does
`await import(island)` then `mod.mount(el, props, { onError })`, returns
`root.unmount()`. One island module per page, one React-18 root per block instance.
Two-layer error ownership: host try/catch for chunk-load failure + the island's own
React-18 ErrorBoundary reporting via `onError` (the React-19 boundary cannot catch
across roots). The single dynamic-`import()`-inside-the-block boundary
simultaneously satisfies AGPL containment, projection node-safety, and lazy bundle
size.

## Steelman of the cheaper path (recorded; not chosen)

First-party trace (`OtelTrace.tsx`) + uPlot-direct metric + `d3-flame-graph` avoids
AGPL, the fleet-wide dual-React closure under `noDiscovery`, the `dedupe`
interaction, the 2.5 MB shared-mutable prebundle, the deprecated component, and the
100-file vendoring — at the cost of flamegraph polish and Grafana visual identity.
Verified `@grafana/flamegraph@13.1.0` directly depends on `@grafana/ui@13.1.0`, so
the lean path is only decisively cheaper if flamegraph is also forgone. User chose
all-in-island (Q1/Q3/Q4) for maximum Grafana parity with eyes open.
