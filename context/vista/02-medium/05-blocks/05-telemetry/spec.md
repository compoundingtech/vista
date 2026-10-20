# Telemetry Block — Spec

Specifies the telemetry blocks: their live sources, backend-faithful freeze, the
Grafana-island render path, pixel-durability, and module isolation. Builds on
[requirements.md](./requirements.md); the generic provider contract these blocks
consume is [../../03-data-sources/spec.md](../../03-data-sources/spec.md); the
React/semantic-manifest boundary is [../../02-renderer/spec.md](../../02-renderer/spec.md).
Requirement IDs are path-scoped in `./requirements.md`. Decisions 0026, 0040–0043,
0046.

## Status

Draft.

## Telemetry providers

The telemetry blocks are fed by the pre-configured `otel`/`prometheus` telemetry
providers, which are ordinary providers under the generic
[03-data-sources](../../03-data-sources/spec.md) dual-mode contract (Schema spine,
`RpcGroup`/`core` split, Vite-SSR mount, live⇄frozen via one schema). This section
details only the telemetry-specific facts.

### Live telemetry sources (realizes decision 0026)

Vista runs on dev3 (decision 0017), co-located with the LGTM plane, which is
anonymous over loopback (tailnet-trust). Live telemetry is fetched by **direct typed
HTTP** — no token, no Grafana proxy, no `gcx` subprocess:

- **metrics** — Mimir `http://127.0.0.1:42030/prometheus/api/v1/query_range`
  → PromQL `matrix` result.
- **traces** — Tempo `http://127.0.0.1:42032/api/traces/{id}` → OTLP-JSON
  `batches`; `…/api/search` for TraceQL.

Off-dev3 access (not the current case) would require the human-gated
`GRAFANA_SA_TOKEN` (`op://`, MED.DATA-R31) as a Bearer header against the tailnet
Grafana URL. No secret is embedded in any published artifact (MED.DATA-R31,
MED.BLK.TELEM-R49).

### Provider shape — backend-faithful (decision 0041)

Providers emit standard, effect-`Schema`-validated, backend-faithful shapes, and that
is what freezes: **OTLP** (traces), **PromQL `matrix` result** (metrics)
(MED.BLK.TELEM-R50). Queried field identifiers validate **leniently**
(`Schema.String`): the providers decode arbitrary queried-back telemetry, which
legitimately violates `@overeng/otel-contract`'s strict *emission* scalars (e.g.
`__name__` is not a letter-led `OtelAttributeKey`; verified against live Mimir) — so
those scalars are NOT used here and otel-contract is not a vista dependency
(decision 0041 correction). No `@grafana/data` DataFrame on the wire or in the
snapshot — adaptation is at the render edge.

### Purity / freeze

Live telemetry providers are `effectful` (real network read) and set
`freezeEffectful: true` so publish auto-captures them. A live read is
non-deterministic: a metric snapshot is strictly point-in-time; a trace fetched by id
is immutable once complete, so it freezes faithfully. The viewer mode badge
(MED.DATA-R30) reflects this.

### Metric ranges and live advancement

`MetricQuery` preserves both authored intent and the exact interval represented
by its samples:

```ts
type MetricRange =
  | { readonly kind: "relative"; readonly last:
      "30s" | "1m" | "5m" | "15m" | "1h" | "6h" | "24h" }
  | { readonly kind: "absolute"; readonly start: number; readonly end: number }

interface MetricSnapshot {
  readonly capturedAt: number
  readonly requestedRange: MetricRange
  readonly resolvedRange: {
    readonly kind: "absolute"
    readonly start: number
    readonly end: number
  }
  readonly query: string
  readonly stepSeconds: number
  readonly points: number
  readonly result: QueryResult
}
```

`resolveRange(args, at)` is pure. Frozen capture resolves a relative range at the
publication clock; each live poll resolves it again at the poll clock. The
requested range remains in `MetricSnapshot` while the resolved absolute range
states what the captured points actually cover. Point caps constrain the
resolved start rather than silently labeling a truncated result as the full
requested interval.

The Operation's Snapshot identity uses the complete Schema-encoded arguments:
PromQL, requested range, step, and point cap. Capture time, resolved range,
cursor, BindingMode, and refresh cadence are value or delivery state and never
key material.

```text
MetricQuery props
  -> bind(otel.ops.query, full arguments, frozen | live policy)
  -> publish-time MetricSnapshot
  -> optional pollable LiveDriver
       cursor = latest sample timestamp
       fold = deduplicate + append + drop outside resolved window + enforce cap
  -> telemetry island receives decoded series
```

`MetricQuery` accepts `mode: "frozen" | "live"` and defaults to frozen,
`range: { kind: "relative", last: "1h" }`, a 60-second step, and 61 points.
`refreshEvery` applies only to live policy. Live mode paints the captured
`MetricSnapshot` before polling, then advances through the Provider's fold. The
telemetry island receives decoded series only; it owns no fetching, timers,
range resolution, cursor, or retention policy.

## Rendering — Grafana island (decisions 0040, 0042)

All telemetry blocks (metric time-series, trace waterfall, flamegraph) render via
real Grafana components inside one shared, lazily-loaded, **client-only** island
(its own bundled React 19 instance, Grafana 13.2) mounted into the React-19 host
(MED.BLK.TELEM-R51). Single path; no
first-party fallback (the prior `OtelTrace.tsx` is retired).

- **metric** — `@grafana/ui` `TimeSeries` (uPlot-backed; pin `@grafana/ui` exactly;
  wrap behind a one-file adapter so a future swap to uPlot-direct is localized;
  `applyFieldOverrides()` is required or axis ticks render `undefined`).
- **trace** — Grafana's Jaeger `TraceTimelineViewer`, vendored (decision 0042).
- **flamegraph** — `@grafana/flamegraph` (`getTheme` prop).

### Dual-React mechanism (SUPERSEDED by decision 0046 — kept for provenance)

> Decision 0046: the island is a **pre-built self-contained chunk** (react18 +
> grafana inlined, exported `mount*` functions), imported as ONE provided artifact.
> This dissolves the per-importer routing, `dedupe` interaction, and
> `use-sync-external-store18` leaf-dup below — they are moot inside a hermetic chunk.
> The facts that carry over: subtree deep-imports (not the barrel),
> `applyFieldOverrides()`, and `@grafana/data` being client-only (dynamic-import
> only, never in the SSR/projection graph). The dev-server router below is NOT added
> to the service.

Per-importer dual-React router with **two surfaces** (both required): the
request-time Vite `resolveId` plugin AND an `optimizeDeps.rolldownOptions` plugin
(Vite 8 prebundles with Rolldown, not esbuild — `esbuildOptions` is silently
ignored). Both map bare `react`/`react-dom`/jsx-runtime → `react18`/`react-dom18`
for island importers (path markers: `react18`, `react-dom18`, `@grafana`,
`@emotion`, `react-use`), and return `null` for host importers so they fall through
to the existing `resolve.dedupe:['react']` and collapse to the one React-19
singleton. The router discriminates by **importer, not specifier**, so it coexists
with `dedupe` without collision. Under `optimizeDeps.noDiscovery`, the island
subtree + its CJS-interop deps (`@emotion/css`, `react-use`, `uplot`, `rxjs`, plus
`react18`/`react-dom18`) are hand-enumerated in `OPTIMIZE_INCLUDE`.

**Deep-import the viz subtree, never the `@grafana/ui` barrel** (the barrel drags
shared react-using packages and collides): alias to e.g.
`@grafana/ui/dist/esm/graveyard/TimeSeries/TimeSeries.mjs`. Cost ~180 KB gzip per
island, not the ~2.5 MB barrel base. Closure reality: metric + trace are
host-disjoint; **flamegraph** additionally needs one leaf duplication
(`use-sync-external-store18`, routed for island importers) — not the react-aria
family. Fallback for any fragile leaf-dup: decision 0043's isolated island build.
Caveat: the `graveyard/` `dist/esm` seam bypasses the package `exports` map — safe
only with `@grafana/ui` pinned exactly; track the deprecation as a Notion blocker.

**Re-homing into runtime policy (decisions 0044/0045, implemented in
`flakes/vista/runtime-policy` + `service/src/runtime-policy`).** The proven mechanism
above (two-surface router, subtree alias, OPTIMIZE_INCLUDE enumeration, leaf-dup) is
NOT hardcoded in `server.ts`. It is authored as a typed `vistaRuntime` contribution
at the island's Genie package-composition boundary (provided import roots,
optimizeDeps, first-party/subtree aliases, the `react18`/`react-dom18`/
`use-sync-external-store18` mappings), and the dual-React routing cooperates with the
authoritative import-classifier so island specifiers classify as `provided` (not
fail-fast rejected). The runtime manifest is the projection Vite/import-validation
consume; the island owns its slice because it is an optional-loading boundary (0044).

### LazyBlock primitive (lazy large-block infra)

`kit/src/LazyBlock.tsx` — a generic React-19 host component (the island is its first
consumer, not the only one; MED.BLK.TELEM-R52). It is **imperative, not
`React.lazy`/Suspense** (the host React and the island's bundled React are separate instances,
so they cannot share a Suspense boundary):

1. host renders a measured skeleton placeholder + a `useState` loading flag;
2. an effect does `const mod = await import('…/island')` then
   `mod.mount(el, props, { onError })`, returning `() => root.unmount()`;
3. one island **module** per page (browser-cached once), one island **root** per
   block instance (`createRoot(el)`).

**Two-layer error ownership** (a host boundary cannot catch a throw inside the island's
root): (a) the host `await import()` is try/caught → chunk-load failure shows a
"couldn't load visualization" fallback; (b) the island installs its own
`ErrorBoundary` and reports render throws out via `onError`.

The single dynamic-`import()`-inside-the-block boundary simultaneously satisfies AGPL
containment, projection node-safety, and lazy bundle size.

### Adapters (at the island edge, client-only)

- **OTLP → Jaeger Trace** → `transformTraceData()`. Handle ns→µs, root via
  `references:[{refType:'CHILD_OF'}]`, per-`service.name` `processID` map. Partial/
  rootless traces (the common Tempo case) are handled **in this single adapter** by
  synthesizing a placeholder root and tolerating a missing `service.name` — no second
  renderer (decision 0040, interview Q4).
- **PromQL `matrix` result → DataFrame** (time + number fields; pass through
  `applyFieldOverrides()`).

### Theming

One `createTheme(DeepPartial<GrafanaTheme2>)` maps Vista design tokens →
`GrafanaTheme2`, shared by all three vizzes (MED.BLK-R07). (Caveat: maps onto
Grafana's large, evolving theme schema; some component CSS uses hardcoded
`autoColor()` fallbacks.)

### Empty / failed states

Telemetry blocks report a structural reason — reuse the
`grafana-dashboards/src/verifier/classifier.ts` `QueryResultKind` taxonomy
(`grafana_down` / `ds_missing` / `auth_missing` / `query_error` / `empty` /
`all_null` / `zero_values` / `has_data`) — never a bare "no data".

## Durability (decision 0043)

Static publication (0075) builds every version once. A telemetry version
additionally **pins the island CHUNK it was built against** so a later `@grafana/ui`
/ island rebuild cannot re-render an already-published version (MED.BLK.TELEM-R53).
Data-freeze semantics (0031/0041) are unchanged; this adds pixel-freeze on top.

Current mechanism:

- Publication detects a telemetry Island from the derived semantic manifest, not
  by scanning source text or consulting an App-authored registry.
- The repository-pinned publish build resolves the prebuilt telemetry Island and
  emits its content-hashed JavaScript and required glyph assets into that
  version's self-contained `site/` directory.
- The version receipt and service-owned publication root bind every emitted
  Island asset in the static inventory. A later Grafana/Island rebuild cannot
  change a pinned `vN`.
- A missing Island build, unresolved dependency, or incomplete asset/reference
  closure aborts the all-or-nothing publication before the version becomes
  visible.
- Draft uses the live Vite alias and HMR. Published `vN` and `latest` use only the
  generic receipt-gated static runtime; they never resolve a live Island alias,
  serve from the shared chunk store, or fall back to Vite.

## Module isolation (projection-safety + bundle)

The island (incl. the vendored Jaeger trace source) lives in a unit the block-library
barrel never re-exports, reached only via dynamic `import()` inside the block
(MED.BLK.TELEM-R54). A lint/grep guard enforces this. The reason is **technical**, not
licensing: a static import would pull `@grafana/data`'s eval-time `window` access into
the publish/projection `ssrLoadModule` graph (breaking every app) and defeat lazy
loading.

AGPL: accepted as-is for internal tooling (decision 0042, owner direction). No
serve-time §13 source link or AGPL-specific CI tripwire is built. Decision 0042's
internal-scope predicate stands (revisit only if Vista is ever externally
distributed). Vendored grafana rev recorded at the package root.

## Integration invariants (red-team mitigations)

1. **Real-pipeline paint:** the metric island must paint in the real published +
   draft pipeline with the `sample-projection-drift` + `publish` guards green, via
   `telemetry-island.browser.test.ts` (mirroring `heavy-kit.browser.test.ts`). The
   flamegraph `use-sync-external-store18` leaf-dup and the trace
   `@grafana/scenes`/`@grafana/runtime` closure must be runtime-proven the same way.
2. **No barrel leak:** the island is reached only via dynamic `import()` inside the
   block; lint/grep guard; extend `sample-projection-drift.test.ts` to a telemetry
   sample so a static `@grafana/data` import (touches `window`) that would break
   index-projection derivation goes red.
3. Pin `@grafana/ui` exactly; track the `graveyard/TimeSeries` deprecation as a Notion
   blocker.
