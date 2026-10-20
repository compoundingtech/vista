# Grafana-component React-island feasibility (e2e)

Validates whether all telemetry blocks can render via real Grafana React
components inside an isolated React-18 island hosted by Vista's React-19 app, fed
from our own data, with no Grafana backend. Throwaway under `tmp/island-experiment/`.

## Result: all three render; trace leg carries license + fork risk

Empirically rendered together (screenshots `shot-all-three.png`):

- **Metric time-series** — `@grafana/ui` `TimeSeries`. Renders with only
  `ThemeContext.Provider value={createTheme()}`. Caveats: the component lives in
  `@grafana/ui/graveyard/` (deprecated; supported path is Scenes/PanelRenderer,
  heavier), and DataFrames must pass `applyFieldOverrides()` or axis ticks render
  literally `undefined`. It is **uPlot under the hood** — so the island buys
  little over uPlot-direct for metrics.
- **Trace waterfall** — Grafana's Jaeger `TraceTimelineViewer` fork. Renders
  cleanly (Redux-free, props+hooks). Requires vendoring ~100 `.tsx` files from
  grafana@v13.1.0 + 3 no-op app-glue stubs + a hand-written ~45-prop wrapper that
  feeds `transformTraceData()` via the 3 vendored hooks. `@grafana/runtime`
  `config` works unstubbed (benign `grafanaBootData` warning) but is real coupling.
- **Flamegraph** — `@grafana/flamegraph`. Published, Apache-2.0, supported,
  `getTheme` prop only. No equally-polished lean equivalent (`d3-flame-graph` is
  lighter, less featured).

## Cost — confirmed amortization

One shared `@grafana/ui`+`@grafana/data`+scenes+schema substrate ≈ 9 MB raw /
**2.48 MB gzip**. Each additional Grafana viz adds only its delta: adding the
whole trace view over metric+flamegraph was **+128 KB**. So one island for
N Grafana vizzes is cost-efficient *once the ~2.5 MB-gzip base is paid*. Monaco
language modes (pulled by `@grafana/ui`'s CodeEditor barrel) code-split out.

## Dual-React mechanism (carried from 2026-06-26 island-proof)

Per-importer Vite `resolveId` plugin routes bare `react`/`react-dom` (and
jsx-runtime) to React 18 for `node_modules` + vendored-island importers, React 19
for host `src/`. No `resolve.dedupe` for react. Island is **client-only**
(`@grafana/data` touches `window` at import) → must be dynamically imported in the
browser, never in the SSR/`ssrLoadModule` graph.

## OTLP→Jaeger trace adapter — fiddly conversions

`{spanId,parentSpanId,startUnixNano,endUnixNano,name,serviceName}` → Jaeger
`TraceResponse` → `transformTraceData()`:
- ns→µs `Math.round(nano/1000)` — sub-µs precision lost (Jaeger model is µs).
- `parentSpanId` → `references:[{refType:'CHILD_OF',spanID,traceID}]`; root = `[]`.
- invent a `pN` processID per serviceName into `processes`; a serviceName that
  doesn't round-trip renders as `<trace-without-root-span>`.
- fillers `logs:[]`, `flags:1`. Let `transformTraceData` derive depth/start/hasChildren.

## Theming

All three islands take one `createTheme(DeepPartial<GrafanaTheme2>)` — a single
token→GrafanaTheme2 mapping themes everything consistently. Caveat: mapping onto
Grafana's large/opinionated/evolving theme schema; some component CSS uses
hardcoded `autoColor()` fallbacks.

## Load-bearing risks (trace leg only)

1. **License.** Grafana relicensed its repo to **AGPL-3.0 (2021)**; the vendored
   trace `.tsx` (post-2021 modifications) is plausibly AGPL, not the repo's
   `LICENSE_APACHE2`. Vista is a *served* app (tailnet URL) → AGPL §13 network-use
   is the triggering case. Needs policy/legal review.
2. **Maintenance.** ~100 vendored files, no npm version to bump; upstream tracking
   = manual re-copy + re-diff against local stubs each Grafana release across a
   non-API app-glue boundary that can break silently.

Metric (`@grafana/ui` graveyard) and flamegraph (`@grafana/flamegraph`, Apache)
do not carry the AGPL/fork risk. The trace view is the sole problematic leg.
