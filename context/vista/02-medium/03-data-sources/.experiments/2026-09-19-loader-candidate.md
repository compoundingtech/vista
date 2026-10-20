# Loader candidate report — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/loader/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Whether an App-level loader can replace per-Block Providers while preserving Schema validation and static/live behavior.

## Method

A real GitHub plus app-local-source loader was published to data.json, decoded in the browser, and refreshed through one Effect HTTP endpoint.

## Result

The loader scored 27/35: it is simple and Schema-safe but has whole-App invalidation, one failure domain, and conflicts with data-independent semantic extraction.

## Conclusion

The loader scored 27/35: it is simple and Schema-safe but has whole-App invalidation, one failure domain, and conflicts with data-independent semantic extraction.

## VRS Impact

Do not replace the Provider model; retain this result as evidence for per-binding granularity and data-independent extraction.

## Source Report

# Loader candidate report

## Result

The route-loader baseline works end to end for `schickling/dotfiles#2910` and an app-local JSON-file source. `app.tsx` exports one `loader: Effect.Effect<Data, DataSourceError>`, `DataSchema`, and a default component receiving `{ data: Data }`. Publish executes the loader once, schema-encodes the result to `static/data.json`, and builds a self-contained Vite directory. The browser decodes that file before rendering and does not call `/loader` until the user asks to refresh. Refresh reruns the whole loader on the Effect HTTP server, schema-encodes the whole struct, and swaps the whole app to `live` mode.

This is a working baseline, not a recommendation to replace Vista's per-block provider model. Its main loss is granularity, and it is not compatible with the current zero-prop semantic extractor without changing extraction order.

## Vertical slice and evidence

- `sources.ts` runs real `gh pr view 2910 --repo schickling/dotfiles --json …` and `gh pr diff 2910 --repo schickling/dotfiles`. Command names/arguments are `Schema.encodeEffect`ed before process execution; JSON stdout is decoded with `Schema.fromJsonString(GhViewWireSchema)`; diff stdout is decoded with `Schema.String` and split into per-file patches.
- The resulting schema copies the optional-field shape of Vista's `PullRequestData`. The captured fixture has 4 files, `+71/−70`, and patches for all four files.
- `local-source.json` is app-local. Its file contents decode through `Schema.fromJsonString(LocalSourceSchema)` before entering the loader result.
- `publish.ts` runs the loader, uses `Schema.encodeEffect(Schema.fromJsonString(DataSchema))`, builds with Vite, then writes `static/data.json`.
- `client.tsx` reads both `data.json` and `/loader` as text and decodes both with the same `Schema.fromJsonString(DataSchema)` value.
- `http.ts` uses an Effect `HttpRouter`; the `/loader` handler runs the same loader and applies `Schema.encodeEffect(DataSchema)` before JSON serialization.
- Browser proof: the initial request log contained `GET /data.json` and no `GET /loader`; the page showed `frozen as of 2026-09-19T12:16:50.278Z`. Clicking **Refresh whole app** added exactly one `GET /loader => 200` and changed the status to `live` while retaining the 4-file view.
- The production browser bundle has no `NodeServices`, `DataSourceError`, `loader.gh`, or `node:child_process` strings. Server-only collection code did not land in the static directory.

### Commands run

```sh
cd tmp/vista-data-bakeoff/loader
../../../node_modules/.bin/tsc --noEmit -p tsconfig.json
bun publish.ts
../../../node_modules/.bin/vitest run loader.integration.test.ts
bun server.ts
playwright-cli -s=loader-bakeoff open http://127.0.0.1:4177
playwright-cli -s=loader-bakeoff requests
playwright-cli -s=loader-bakeoff click e5
playwright-cli -s=loader-bakeoff snapshot
playwright-cli -s=loader-bakeoff requests
```

Final verification: TypeScript passed with no diagnostics. Vitest passed 2/2 tests. The first test sends a Fetch `Request` through the actual Effect router layer and decodes both the checked-in published snapshot and the endpoint response with the same schema. The second adds a required `schemaRevision: 2` field and proves the old snapshot fails decoding.

## Authoring size

Measured with `wc -l`:

- `app.tsx`: 20 lines. It is the complete loader contract and the only place that selects `repo`, PR number, and the two sources.
- `schemas.ts`: 54 lines for the complete reusable `PullRequestData`-shaped schema, local-source schema, and whole-app struct.
- `view.tsx`: 47 lines for the disposable visual stand-in; a real Vista app would replace its local viewer with the existing one-line `<PullRequestViewer pullRequest={data.pullRequest} />` composition.
- The actual source selection in the loader is two entries: `gh({ repo, pr })` and `readLocalSource`.
- Adding the demonstrated app-local source cost 5 schema lines, 18 source-implementation lines, and 1 loader entry: 24 lines. It required **zero** operation-specific server or client lines because both transport the whole `DataSchema`.
- Generic infrastructure is `client.tsx` 75 lines, `http.ts` 14, `server.ts` 32, and `publish.ts` 26. This is framework code, not per block.

## Scores

| Criterion | Score | Evidence and judgment |
| --- | ---: | --- |
| C1 — Author ergonomics | **4/5** | The source call site is exceptionally direct and a new result field needs no RPC/client registration. The cost is that the author owns the whole aggregate schema: 20 app lines plus 54 schema lines here. A demonstrated new local source is 24 lines end to end, with 0 server/client lines. Better than the current three-file-per-block plumbing, but less local than a query primitive because every source changes the app-wide contract. |
| C2 — Schema at every IO boundary | **5/5** | Explicit encode: command name/argv, publish snapshot, live HTTP result. Explicit decode: `gh pr view` stdout, diff stdout, local file, boot snapshot, live response. Static and live use the same `DataSchema`; there is no Flight or other opaque result blob. The schema-drift test rejects the old snapshot. |
| C3 — Live/frozen symmetry | **4/5** | Exactly the same loader produces both values and exactly the same `DataSchema` decodes both. `data.json` can be revalidated later. There is no per-operation snapshot key: identity is simply the immutable publication's `data.json`, and `collectedAt` intentionally changes on every run. |
| C4 — Runtime refresh | **3/5** | It works from the published static page and visibly transitions from `frozen as of …` to `live`. Refresh is whole-app only and reruns both `gh` processes plus the local read even if only one block needs freshness. One slow or failing source blocks the whole replacement. |
| C5 — Fit with Vista invariants | **2/5** | Strong fit for Schema, server-only credentials, zero new dependencies, and self-contained static publication. Poor fit for the current semantic extractor: it imports a zero-prop default and renders it with no data, while this contract's default takes `data`. It also has no manifest bindings. Runtime islands and StyleX/Geist can still sit inside the view, but the prototype's simple CSS/view intentionally does not exercise them. |
| C6 — Complexity / maintenance | **4/5** | No new packages and no framework beyond Effect, React, and Vite. One generic endpoint and one client state machine replace operation-specific plumbing. However, a naïve browser import of `app.tsx` traversed `@effect/platform-node` and produced many Node-externalization warnings. The working prototype uses a client-only `view.tsx` while `app.tsx` reexports it. Real adoption needs a declared server/client split or a Vite transform; relying on tree-shaking is not safe. |
| C7 — App-local providers | **5/5** | App-local collection is just an imported Effect. No provider union, discovery, mount, RPC group, or service-shipped registration is involved. It publishes and refreshes through the same generic loader path. |

**Total: 27/35.** The loader is the lowest-concept-count option and an excellent whole-page baseline. Its coarse invalidation and extractor mismatch are architectural, not prototype polish issues.

## Semantic-manifest extraction assessment

The current `flakes/vista/service/src/semantic-extractor.ts` explicitly imports the default component, rejects `App.length > 0`, and calls `createElement(App)` twice with no props. This candidate's default component has one required `data` prop, so current extraction fails before it can collect an `AppRoot`.

For this exact loader contract, the extractor **must run the loader first**, decode its result with the exported `DataSchema`, and render `createElement(App, { data })`. Reusing that one decoded value for both determinism renders avoids two external collections, but it changes a load-bearing invariant: semantic extraction now depends on `gh`, local files, credentials, and loader latency. A separate data-independent semantic-shell export would avoid that dependency, but it would no longer be the simple contract under evaluation and would add another authoring primitive.

The loader produces no `DataBinding`s. The manifest therefore cannot say which block uses which source, cannot drive per-block freeze reports, and cannot refresh one block. `freeze.ts` and `snapshotKey(provider, operation, args)` are bypassed; the only frozen unit is the whole `DataSchema` document.

Multiple blocks can share one loader value cheaply within a render, and the loader can manually deduplicate source calls. The coupling cost is substantial: all blocks share one schema version, one failure domain, one freshness mode, one publish capture, and one refresh invalidation. Adding an unrelated block expands `data.json`; refreshing any block reruns every source; one failing source prevents every block from moving to live. This is acceptable for small report-like apps and degrades as an app becomes a dashboard.

## What could not work, or required a concession

1. **Current semantic extraction cannot consume the contract.** It requires a zero-prop default and no-data Node render.
2. **No per-block binding, freeze, error, or refresh exists.** Whole-app is intrinsic to this candidate, not missing implementation.
3. **A single mixed client/server module was not safe with plain Vite.** Importing `app.tsx` directly from the browser entry caused Vite to traverse the static `sources.ts` import and externalize a large Node dependency graph. The prototype fixed this honestly with `view.tsx`; Vista would need to formalize that split or generate a virtual client projection.
4. **Commit-level file patches are absent.** `PullRequestData.commits` is optional; `gh pr view` does not provide each commit's file patches, so the prototype omits commits rather than inventing empty or duplicated changes. The request-level data and patches are complete for the fixed scenario.
5. **The diff splitter is intentionally narrow.** It handles the fixed PR's ordinary `diff --git a/path b/path` headers. Quoted paths with unusual characters would need a real Git path parser for production.
6. **The visual slice uses a small local viewer.** It proves the data shape and app swap without pulling the full StyleX-heavy block tree into a disposable build. The shape is designed for the existing `PullRequestViewer` prop.

## Smallest Vista adoption change (file list, not a patch)

- `flakes/vista/service/src/scaffold.ts` — scaffold the `DataSchema`/`loader`/`default ({data})` contract and formalize the client-view split.
- `flakes/vista/service/src/semantic-extractor.ts` — SSR-load `loader` and `DataSchema`, execute/decode once, then pass the same data to both semantic renders; remove the zero-prop check for loader apps.
- `flakes/vista/service/src/publish.ts` — run the loader before static build, schema-encode `data.json`, include it in the receipt/inventory, and generate a bootstrap that decodes it before mounting the default component.
- `flakes/vista/service/src/server.ts` — add the receipt-verified app-level loader refresh route, SSR-load the authored loader on the server, schema-encode its result, and keep secrets/Node imports off the browser route.
- `flakes/vista/service/src/runtime-policy/index.ts` — distinguish server-only loader imports from the zero-install browser closure and reject accidental leakage instead of depending on tree-shaking.
- `flakes/vista/service/src/publish.test.ts` and `flakes/vista/service/src/publish-http.test.ts` — update contract fixtures and retain publish/self-contained/live-route coverage.

No changes to `flakes/vista/service/src/data/freeze.ts`, `snapshot.ts`, provider discovery, provider RPC groups, or block data bindings would be needed; the loader candidate replaces those paths for loader apps rather than extending them.
