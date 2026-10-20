# Vendored: Grafana Jaeger TraceTimelineViewer

Self-contained vendored unit (decision 0042). This is the trace-waterfall subtree
of Grafana's `public/app/features/explore/TraceView/`, copied as source `.tsx`
because Grafana does NOT publish it to npm.

- **Upstream:** https://github.com/grafana/grafana
- **Revision:** `v13.1.0`. The island's `@grafana/*` packages are pinned to
  `13.2.3` (peers React 19); this subtree was type-checked
  and render-tested against `13.2.3` but not re-copied from the `v13.2.3` tag.
  The deep `graveyard/TimeSeries` import and these vendored components are only
  correct while those packages stay pinned exactly; re-diff against the package
  tag on every Grafana upgrade.
- **License:** **AGPL-3.0-only**, matching Grafana `v13.1.0`'s SPDX declaration.
  The exact upstream license is retained in `LICENSE` (see the root
  `THIRD_PARTY_NOTICES.md` for its source and SHA-256). The Uber-origin Jaeger
  files retain their Apache-2.0 headers; the surrounding Grafana fork is AGPL.

## Scope (load-bearing — decision 0042)

Public distribution of Vista was approved by Johannes on 2026-10-20
(Q347 / Axe Q10), superseding the former internal-only scope in decisions
0040/0042. Vista's own source is Apache-2.0; this subtree is AGPL-3.0-only.
The public repository provides the Corresponding Source. Operators who serve a
modified island to remote users other than themselves must offer that source to
those users (for example, a link to the public repository). Johannes's fleet
deployment serves first-party users only. No serve-time link is added in this
release; a UI source link is a possible later product change. This records the
distribution decision, not a definitive legal assessment of every deployment.

## How it is consumed

Only the trace island (`../../src/island.tsx`, `mountTrace`) imports from this
tree, and only the reachable subset is bundled: `TraceTimelineViewer`,
`model/transform-trace-data`, and the `useChildrenState` / `useDetailState` /
`useViewRange` / `useHoverIndentGuide` hooks. The chunk is lazily, dynamically
imported client-side, so the AGPL code never enters the SSR/projection graph.

## Maintenance (managed liability)

No npm version to bump. Upstream tracking is a manual re-copy + re-diff against the
local stubs on each Grafana upgrade, across a non-API app-glue boundary that can
break silently.

### Local modifications from upstream

Three app-glue files that import unresolvable Grafana-app internals
(`app/*`, `@grafana-plugins/*`, `@grafana/prometheus`) are replaced with trivial
stubs (they are off the waterfall render path):

- `createSpanLink.tsx` — keeps only `pyroscopeProfileIdTagKey` + no-op factory.
- `components/TraceTimelineViewer/SpanDetail/SpanDetailLinkButtons.tsx` — `() => null`.
- `components/TraceTimelineViewer/SpanDetail/SpanFlameGraph.tsx` — `() => null`.

`jsonMarkup.js` (MIT) is vendored alongside because the recursive copy filtered to
`.ts`/`.tsx`/`.css`. The unreachable app wrapper files (`TraceView.tsx`,
`TraceViewContainer.tsx`, `useSearch.ts`, `components/TracePageHeader/*`) still
reference app-glue specifiers; they are NOT on the import path and tree-shake out
of the built chunk.
