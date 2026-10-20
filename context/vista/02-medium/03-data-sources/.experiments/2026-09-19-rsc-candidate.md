# RSC candidate report — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/rsc/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Whether React Server Components and Flight can replace Vista's Provider and Snapshot plane.

## Method

A Vite RSC static-and-live slice exercised real GitHub data, app-local data, Flight publication, refresh, and semantic-extractor compatibility probes.

## Result

The candidate scored 19/35; Flight works as a render transport but is opaque to the domain Schema and conflicts with the synchronous semantic collector.

## Conclusion

The candidate scored 19/35; Flight works as a render transport but is opaque to the domain Schema and conflicts with the synchronous semantic collector.

## VRS Impact

Do not use Flight as the persistence boundary; retain Schema-encoded snapshots and the Provider plane.

## Source Report

# RSC candidate report

## Verdict

**Score: 19/35.** The authoring primitive is excellent and the static+live vertical slice works, but RSC Flight is the wrong persistence boundary for Vista's Schema-spine invariant. Flight is a rendered-tree protocol, not a re-validatable domain snapshot. RSC could be a render transport beside Vista's existing Schema-encoded `snapshot.json`; it should not replace that snapshot/provider plane.

The prototype is a standalone Vite 8 project using `@vitejs/plugin-rsc@0.5.35`, React/React DOM/`react-server-dom-webpack@19.2.8`, `rsc-html-stream@0.0.8`, and Effect `4.0.0-rc.112`. The versions are locally locked in `bun.lock`.

## Working vertical slice

- `src/app.tsx` is 8 physical lines. The GitHub author intent is exactly one JSX line: `<PullRequestViewer repo="schickling/dotfiles" pr={2910} />` (plus its import).
- `PullRequestViewer` is an async Server Component. It executes real `gh pr view`, `gh pr diff`, and one `gh api repos/.../commits/...` call per commit. The fixture resolves to 4 files, 2 commits, and patches for all 4 files.
- `src/data.server.ts` decodes request args, command stdout, `gh pr view` JSON, each commit API response, and the assembled `PullRequestData` with Effect Schema. The plain diff is type-checked as a string and parsed into patches; the assembled result is then checked by `PullRequestDataSchema`.
- `LocalBuildViewer` reads `fixtures/local-build.json` on the server and decodes it through `LocalBuildSchema`, proving an app-local source with no closed provider union or registration.
- `vite.config.ts` follows the plugin's official SSG `buildApp` shape and emits `dist/client/index.html` plus `dist/client/index_.rsc`. Final sizes: 31,982 bytes HTML and 15,349 bytes Flight, plus hashed JS/CSS assets.
- `refresh-control.tsx` is a `'use client'` island. Its props are `Schema.encode`d on the server and `Schema.decode`d on the client. Clicking refresh fetches a new production Flight payload and swaps the whole RSC root.
- The UI explicitly says `frozen as of <timestamp>` initially and `live as of <timestamp>` after refresh.

## Scores

| Criterion | Score | Evidence |
| --- | ---: | --- |
| **C1 Author ergonomics** | **4/5** | The PR use site is 1 JSX line and names only `repo`/`pr`; render mode comes from request context. `src/app.tsx` is 8 lines including the app-local example. The local source demonstrates the approximate cost of a new non-interactive data block: 6 schema lines + 5 collector lines + 11 renderer lines + 1 use-site line (about 23 lines, excluding imports). A new interactive boundary also needs encoded client props. Much less per-block glue than the current duplicated frozen/live closures. |
| **C2 Schema at every IO boundary** | **2/5** | Explicit Schema gates exist for component args→server, `gh` stdout/JSON→server, local file→server, assembled domain data, and the server→client `RefreshControl` props. `scripts/verify.ts` proves malformed client props fail. However, `index_.rsc` is opaque Flight. `PullRequestDataSchema` cannot decode it, so the snapshot write/read boundary is not covered by the domain schema. React has no generic Effect Schema hook at the Flight serializer boundary. |
| **C3 Live/frozen symmetry** | **2/5** | Live and a JSON frozen round trip both use `PullRequestDataSchema`; `scripts/verify.ts` proves 4 files/2 commits survive. The same async component renders build-time frozen and request-time live modes. But the artifact actually used by the page is Flight, not that JSON wire value: it has no deterministic domain snapshot key and cannot later be re-validated as `PullRequestData`. Keeping a Schema JSON sidecar would restore the invariant, but then RSC is not the data foundation. |
| **C4 Runtime refresh** | **4/5** | Confirmed from the page served at `:4173`: click fetched `http://127.0.0.1:5174/index_.rsc`, changed the indicator to live, and kept 4 files. Refresh granularity is whole-app/root, even though the button is displayed beside the PR block. One refresh runs 4 `gh` subprocesses for this fixture (`view`, `diff`, 2 commit API calls) and took about 6–7 seconds in browser verification. A real implementation must derive the endpoint from the Vista version URL rather than the prototype's fixed localhost endpoint. |
| **C5 Fit with Vista invariants** | **2/5** | Static publish and server-only credentials fit; the initial static page loaded with zero `_.rsc` or `/_data/` requests. Client islands fit naturally. The current Node semantic extractor does **not** fit async Server Components: direct extraction failed. A separate synchronous projection using the real `extractSemanticManifest` succeeded with 3 nodes/1 binding, but duplicates the binding and loses auto-capture's single source. Zero-install could remain true only by making the new packages service-owned. StyleX is RSC-compatible with `@stylexjs/unplugin` in all three environments, but that is another build-pipeline change. |
| **C6 Complexity / maintenance** | **1/5** | Three execution environments and five build passes, three new runtime packages, generated client/reference manifests, SSG stream injection, a live Flight handler, strict React/RSD version alignment, and a second render mechanism beside classic SSR. React explicitly says RSC framework/bundler APIs may break between React 19 minors. A production static client could not consume the Vite dev server's development Flight payload; it failed with “development version of React on the server while using a production version on the client.” A production-built handler with `NODE_ENV=production` was required. |
| **C7 App-local providers** | **4/5** | `LocalBuildViewer` imports a colocated server collector and reads/decodes a file with no central union or mount registration. This is maximally flexible. It is not yet a governed provider contract: purity, secret scanning, endpoint authorization, HMR discovery, and provenance would need a framework policy layer. |

## Boundary inventory

| Crossing | Prototype gate | Result |
| --- | --- | --- |
| JSX `repo`/`pr` → server collector | `PullRequestArgsSchema.decodeUnknownSync` | Validated |
| `gh pr view` stdout → object | stdout `Schema.String`, then `Schema.fromJsonString(GhViewSchema)` | Validated |
| `gh pr diff` stdout → patches | stdout `Schema.String`; parser; final `PullRequestDataSchema` | Shape validated after parse; diff grammar is not modeled as a Schema |
| `gh api` commit stdout → object | `Schema.fromJsonString(GhCommitSchema)` | Validated |
| local JSON file → object | `Schema.fromJsonString(LocalBuildSchema)` | Validated |
| assembled PR → render | `decodePullRequest`, then `encodePullRequest`/`decodePullRequest` | Validated |
| server → `'use client'` island props | `encodeRefreshControlProps` / `decodeRefreshControlProps` | Validated by userland wrapper |
| publish write/read | React Flight + SSR HTML | **Opaque to domain Schema** |
| live refresh | Flight fetch + React `createFromFetch` | React-valid, not domain-Schema-valid |

## Required questions

### 6(a): Can Flight be Schema-decoded or re-validated later?

No. `scripts/verify.ts` reads the emitted `index_.rsc` and proves `decodePullRequest(flight)` fails. Flight includes JSX records, client-reference IDs, CSS hints, React tokens, and streamed chunks. It can only be interpreted by the matching `react-server-dom` client plus the plugin-generated module manifest. A separate Schema-encoded JSON value round-trips correctly, but that is precisely Vista's current snapshot pattern. Conclusion: Flight is a tree/render plane, not a durable data snapshot.

### 6(b): Can server→client props be Schema-validated?

Yes, explicitly and locally. The server encodes a plain `RefreshControlProps` wire value before passing it into the client module; `RefreshControl` accepts `unknown` and decodes it again. The probe proves a string PR number is rejected. This is userland discipline, not enforcement by RSC. Effect `Schema.Class` instances must be encoded to supported plain values before crossing because React does not serialize arbitrary class instances.

### 6(c): Can semantic-manifest extraction coexist?

Only as a separate synchronous projection. `scripts/semantic-smoke.tsx` uses Vista's real `AppRoot`, `Section`, `RuntimeIsland`, `useDataBinding`, and `extractSemanticManifest`:

- synchronous projection: succeeds, 3 nodes and 1 binding;
- direct async Server Component under `extractSemanticManifest`: fails as expected.

The existing extractor uses React context plus `renderToStaticMarkup`; RSC Server Components cannot create context, and classic static rendering cannot wait for async server components. The proof sketches the least invasive coexistence model—a parallel semantic skeleton with a runtime-island placeholder—but it duplicates the PR binding and therefore contradicts the current “typed JSX is the single source” invariant. Rewriting extraction over Flight would be a substantial design change and render retries make mutation-based collection risky.

### 6(d): StyleX and hooks blast radius

A source scan of `flakes/vista/blocks/src/blocks` found **21 non-test modules with hook calls**. Those modules (and their transitive client imports) need a client boundary. The hook owners are:

`Diff.tsx`, `FileTree.tsx`, `FlamegraphBlock.tsx`, `GhPreviews.tsx`, `MermaidDiagram.tsx`, `MetricBlock.tsx`, `PullRequestViewer.tsx`, `ResizableSplit.tsx`, `SourceInspector.tsx`, `TraceBlock.tsx`, `doctrine.tsx`, `pull-request/{PullRequestCommits,PullRequestDiff,PullRequestTreemap,parts,review}.tsx`, `system-explorer/SystemExplorer.tsx`, and `treemap/{CheckRow,FilterPanel,TooltipOverlay,Treemap}.tsx`.

All **28 non-test TSX modules** in that directory import StyleX. StyleX itself does not force client rendering: its official Vite+RSC setup runs `@stylexjs/unplugin` for RSC, SSR, and client builds and emits aggregated CSS. The hooks do force client evaluation. The existing rich PR viewer is deeply hook-based, so the smallest practical boundary is to mark its public viewer entry as client code, which pulls its dependency subtree client-side and leaves only the data collection/server wrapper in RSC. This is why the prototype uses a minimal viewer rather than pretending the real viewer was a trivial server component.

## What could not work

1. **Flight as the durable Schema snapshot:** definitively opaque; the domain decoder rejects it.
2. **Direct existing semantic extraction of an async Server Component:** the probe fails; only a duplicated synchronous projection works.
3. **Production static client refreshing from `vite dev`:** React rejected the development Flight payload against the production client. Refresh works only against `dist/rsc/index.js` served under `NODE_ENV=production`.
4. **Drop-in reuse of the real rich viewer in this isolated spike:** its hook/StyleX/dependency graph needs a deliberate client boundary and StyleX plugin configuration across all environments. The minimal viewer avoids claiming that migration is free.
5. **Per-block Flight refresh:** this prototype swaps the whole root. A route/payload convention for block fragments would be framework code, not supplied by the plugin.
6. **Full Vista governance for app-local collectors:** the direct server import proves feasibility, not purity labels, secret scanning, auth policy, or receipt provenance.

## Smallest real adoption change (file list)

This is the smallest credible shape if RSC is adopted **as render transport while retaining Schema JSON snapshots**:

- `flakes/vista/service/package.json.genie.ts` — add/pin `@vitejs/plugin-rsc`, `react-server-dom-webpack`, and `rsc-html-stream` as service-owned dependencies.
- `flakes/vista/service/package.json` — regenerated projection.
- `flakes/vista/service/src/publish.ts` — replace/add the generic static build with RSC/SSR/client multi-environment build and emit HTML + Flight while retaining `snapshot.json`.
- `flakes/vista/service/src/server.ts` — serve live production-compatible `*.rsc` requests beside static versions and existing `/_data` routes.
- `flakes/vista/service/src/runtime-policy/vite-plugin.ts` — configure the RSC, SSR, and client environments, React dedupe/externalization, StyleX, and app-local server module policy.
- New `flakes/vista/service/src/rsc/{entry.rsc,entry.ssr,entry.browser}.tsx` — Flight render, SSR, hydration, and refresh runtime.
- `flakes/vista/blocks/src/data-components.tsx` — expose an async server wrapper for PR collection while keeping schema/provider identity for freeze and manifest capture.
- `flakes/vista/blocks/src/blocks/PullRequestViewer.tsx` — establish the client boundary for the existing hook-heavy viewer.
- `flakes/vista/blocks/src/authoring.tsx` — define how the synchronous semantic projection refers to async data blocks without duplicating bindings; this is the unresolved load-bearing design item.
- `flakes/vista/blocks/src/provider-contracts.ts` (or a new colocated PR data schema module) — make `PullRequestDataSchema` the shared plain-wire contract.

If Flight is proposed to replace `snapshot.json`, the adoption should be declined because C2/C3 remain unsatisfied.

## Reproduction commands

From `tmp/vista-data-bakeoff/rsc/`:

```sh
# Already performed locally; records the extra packages in this standalone project.
bun add @vitejs/plugin-rsc@latest react-server-dom-webpack@19.2.8 rsc-html-stream@0.0.8

../../../node_modules/.bin/tsc --noEmit -p tsconfig.json
bun run build
bun run verify

# Terminal 1: generic static bytes only (no gh/data execution)
bun run serve:static
# Equivalent plain server also verified:
# python3 -m http.server 4173 --bind 127.0.0.1 --directory dist/client

# Terminal 2: production Flight endpoint used by the refresh button
bun run serve:live

# Open http://127.0.0.1:4173/, observe “frozen”, then click “Refresh live”.
```

Browser verification observed:

```text
initial: mode="frozen as of 2026-09-19T12:17:50.952Z", files=4, commits=2, dataCalls=[]
after click: mode="live as of 2026-09-19T12:18:35.749Z", files=4,
             flightRequests=["http://127.0.0.1:5174/index_.rsc"]
```

`bun run verify` output:

```text
boundary verification passed {
  flightSchemaReadable: false,
  files: 4,
  commits: 2,
  propsValidatedBothSides: true,
  sameDomainSchemaLiveFrozen: true
}
semantic extraction probe passed {
  syncProjectionNodes: 3,
  asyncServerComponentDirectlyExtractable: false,
  requiresParallelSynchronousProjection: true
}
```

## Primary sources consulted

- `@vitejs/plugin-rsc` README and runtime API: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/README.md
- Official SSG example/config: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/examples/ssg/vite.config.ts
- Plugin package/peer dependencies: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/package.json
- React server/client serialization rules: https://react.dev/reference/rsc/use-client
- React Server Components and framework-version warning: https://react.dev/reference/rsc/server-components
- StyleX Vite+RSC integration: https://stylexjs.com/docs/learn/installation/vite/vite-rsc/
