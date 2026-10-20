# Query candidate report — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/query/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Whether typed operation values on the existing Provider layer preserve Schema-backed frozen/live symmetry with less per-Block plumbing.

## Method

A vertical slice exercised semantic collection, publish capture, static hydration, app-local Providers, and per-binding live refresh against a real pull request.

## Result

The Query candidate scored 30/35 and proved the core collection, capture, hydration, and RPC seams, while exposing client/server capability leakage and an unsuitable public Query surface.

## Conclusion

The Query candidate scored 30/35 and proved the core collection, capture, hydration, and RPC seams, while exposing client/server capability leakage and an unsuitable public Query surface.

## VRS Impact

Retain the RPC-derived operation and DataBinding kernel; do not retain the generic public Query component or all-in-one Provider object.

## Source Report

# Query candidate report

## Result

The vertical slice works end to end. `defineProvider` produces typed first-class values (`gh.ops.pullRequest`, `local.ops.readNote`) carrying provider id, RPC tag, payload Schema, success Schema, RPC group, and in-process core. The app uses the generic `<Query of={…} args={…}>` primitive. A Node render collects the two bindings without data, publish executes those bindings in-process, and the browser hydrates an `@effect/atom-react` atom family from `snapshot.json`. Each block refreshes independently through `@effect/rpc` and flips from `frozen as of <timestamp>` to `live`.

Published fixture evidence: PR `schickling/dotfiles#2910` decoded to 4 files, 2 commits, +71/−70. `dist/` is the self-contained static output. `dist/query-manifest.json` contains both automatically derived bindings, including the app-local provider.

## Scores

| Criterion | Score | Evidence |
| --- | ---: | --- |
| C1 Author ergonomics | 4/5 | App intent is one line: `<PullRequestViewer repo="schickling/dotfiles" pr={2910} />`. A block binds data with one generic `<Query of={gh.ops.pullRequest} args={{ repo, pr }}>`; it has no provider string, operation string, `useDataBinding`, `runFrozen`, or `runLive`. The server operation is registered once in `defineProvider`. Rich domain/tool schemas remain necessarily verbose. See line-count comparison below. |
| C2 Schema at every IO boundary | 5/5 | `gh pr view`, PR files API, and per-commit API stdout each decode through `Schema.fromJsonString(...)`; assembled data decodes through `PullRequestData`; RPC request/response use the same payload/success/error Schemas through `@effect/rpc`; the generic live client performs an additional explicit payload and success decode; publish explicitly `Schema.encode`s args, success, and the outer snapshot; browser boot decodes `SnapshotSchema`; frozen reads decode args and value through the query Schemas. There is no Flight/opaque result blob. |
| C3 Live/frozen symmetry | 5/5 | `Query.successSchema` is the single decoder used by live and frozen paths. `snapshotKey` recursively sorts object keys. A fingerprint of the success Schema's canonical JSON Schema is persisted and checked before hydration. Tests prove equal live/frozen values, arg-order independence, and old-snapshot rejection after a structural schema change. |
| C4 Runtime refresh | 5/5 | Refresh is per query. `Atom.family` is keyed by the canonical `snapshotKey`; its `Atom.fn` has the decoded snapshot as `initialValue` and runs the generic RPC live call on write. From the standalone Vite static page, one click generated only `POST /_data/local/`; the GitHub click generated only `POST /_data/gh/`. Both indicators changed to `live`. |
| C5 Fit with Vista invariants | 3/5 | Node `renderToStaticMarkup` collection works with no data/snapshot installed; no extra package was installed; `dist/` boots from static assets plus `snapshot.json`; GitHub credentials stay behind the server process. The prototype uses a client Query component suitable for a RuntimeIsland. Deductions: it uses throwaway CSS rather than StyleX/Geist, and importing the provider object means dormant server core code is present in the client bundle even though credentials and execution stay server-only. A production split should emit/import a client-safe query descriptor. |
| C6 Complexity / maintenance | 3/5 | Zero new dependencies and no React internals. The generic substrate is four small concerns: provider/query contract, collector, snapshot, and atom client. It reuses Effect Schema/RPC and Vite. Costs: schema fingerprinting policy must be owned; the prototype bundle is 605 kB minified (191.7 kB gzip); dynamic app-provider discovery and client-safe descriptor splitting need production integration. React/Vite upgrades touch only the generic collector/bootstrap rather than every data block. |
| C7 App-local providers | 5/5 | `src/providers/local.provider.ts` is discovered at runtime by suffix beside the app, mounted exactly like the service `gh` provider, collected/published with the same `<Query>`, and refreshed successfully through `/_data/local/`. No provider union changed. |

**Total: 30/35.** This candidate is substantially more ergonomic than the current per-component closure pattern while retaining Vista's Schema/snapshot keystone. Its main adoption risk is making the provider's query descriptor client-safe without bundling the server core.

## Author and operation line counts

There are two honest views because the candidate implements the full rich `PullRequestData` (patches and per-commit files), while today's `changedFiles` operation returns a much smaller summary.

- **App author intent:** 1 line in `src/app.tsx` (line 48).
- **Query binding inside the data-backed viewer:** 4 plumbing lines (open/close of `<Query>` and render function, lines 8–9 and 28–29). The rest of the viewer is actual UI.
- **Current `changedFiles`, raw end to end:** 133 lines: 23 contract/schema lines (`provider-contracts.ts:24–46`) + 82 server/tool lines (`gh.provider.ts:27–108`) + 28 client component lines (`data-components.tsx:165–192`).
- **Candidate rich `pullRequest`, raw end to end:** 192 lines: 44 contract/schema lines (`schemas.ts:7–50`) + 124 server/tool/registration lines (`gh.provider.ts:11–134`) + 24 viewer lines (`app.tsx:7–30`). This is larger because it collects title/body/branches, patches, two commits, and per-commit files rather than only file counts.
- **Comparable operation plumbing (excluding domain schemas, external-tool implementation, and UI markup): current 49 lines** = 7 RPC declaration + 14 provider core/registration + 28 bespoke client component. **Query candidate 16 lines** = 12 `defineProvider` operation registration (`gh.provider.ts:125–136`) + 4 generic Query binding lines. That is a 67% reduction, and subsequent blocks do not add frozen/live closures or extend a provider union.

## Boundary inventory

1. `gh` subprocess stdout → `GhView`, `GhFiles`, or `GhCommitDetail`: explicit `Schema.decodeEffect(Schema.fromJsonString(...))`.
2. Tool models → Vista model: explicit `Schema.decodeUnknownEffect(PullRequestData)`.
3. Provider payload/success/error → RPC wire: `Rpc.make` references the same Schemas; `@effect/rpc` performs its schema codec at transport.
4. Live RPC result → atom: explicit `Schema.decodeUnknownEffect(query.successSchema)` after transport decode.
5. Publish args/success → snapshot entry: explicit `Schema.encodeUnknownEffect`.
6. Snapshot object → JSON file: explicit `Schema.encodeEffect(SnapshotSchema)`.
7. Browser JSON → snapshot: explicit `Schema.decodeUnknownEffect(SnapshotSchema)`.
8. Frozen entry → atom initial value: explicit payload and success decode through the query Schemas.
9. App-local JSON file → provider value: `Schema.fromJsonString(LocalFile)` then `LocalNote` decode.

## Commands and observed proof

From `tmp/vista-data-bakeoff/query/`:

```sh
../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
../../../node_modules/.bin/vitest run src/query.unit.test.ts
bun run publish
../../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4175
PORT=4327 bun src/server.ts
playwright-cli -s=query-bakeoff open http://127.0.0.1:4175
playwright-cli -s=query-bakeoff requests
playwright-cli -s=query-bakeoff goto 'http://127.0.0.1:4175/?data=http%3A%2F%2F127.0.0.1%3A4327%2F'
# snapshot, click each "Refresh this query", snapshot, then:
playwright-cli -s=query-bakeoff requests
```

Observed:

- TypeScript: clean.
- Vitest: 1 file, 3 tests passed.
- Publish: Node collector found exactly 2 query bindings; Vite built 281 modules.
- Static boot request list: only `GET /snapshot.json` plus static assets; **zero `/_data` calls**. The page showed the real frozen PR data and both frozen timestamps.
- After refresh: `POST http://127.0.0.1:4327/_data/local/ => 200` and `POST http://127.0.0.1:4327/_data/gh/ => 200`; both cards showed `live` and GitHub still showed 4 files / 2 commits / +71 −70.

Port 4317 was already occupied during the bakeoff, so the browser bootstrap accepts a `?data=<base URL>` override; its default remains `http://127.0.0.1:4317/`.

## What could not work / limitations

- Nothing in the required vertical slice failed; `@effect/atom-react` was suitable, so no `useSyncExternalStore` fallback was needed. Its current API (`Atom.family`, `Atom.fn`, `useAtomSuspense`, `useAtomSet`, `RegistryProvider`) provided hydration, Suspense, refresh waiting state, and per-key cache identity directly.
- This disposable app renders a compact PR list rather than importing the production `PullRequestViewer`; the captured value is nevertheless the production `PullRequestData` shape, including patches and commits.
- The provider object carries both query metadata and core, so Vite retains dormant server functions in the client graph. No token or environment secret is included, and the functions execute only in Bun on publish/server, but production should split generated/client-safe descriptors from handlers.
- Schema fingerprints use Effect's JSON Schema projection. It catches the tested structural drift but may not preserve every arbitrary transform/refinement. Production needs either a deliberately versioned schema identity or a canonical Effect-Schema AST fingerprint policy.
- The generic atom runtime stores canonical-key → args beside each query's atom family. Production should align its disposal/idle TTL with Vista's version lifecycle.
- Vite reported a large single client chunk; code splitting the RPC refresh path and provider descriptors would be required before shipping.

## Smallest production adoption change

No patch was made outside this prototype. The smallest real cutover would touch:

- `flakes/vista/service/src/data/provider.ts`: make `defineProvider` derive client-safe `ops.<tag>` Query descriptors from each RPC and expose typed in-process execution separately.
- `flakes/vista/service/src/data/snapshot.ts`: retain the existing canonical key and add the chosen schema identity/fingerprint field.
- `flakes/vista/service/src/data/freeze.ts`: consume collected Query bindings generically and encode through each Query's schemas rather than block-owned closures.
- `flakes/vista/service/src/data/client/frozen.ts`: accept a Query descriptor and decode one generic snapshot entry.
- `flakes/vista/service/src/data/client/provider.ts`: accept a Query descriptor and invoke its tag through one generic RPC client path.
- `flakes/vista/service/src/data/mount.ts`: actually call `discoverProviders` for each app's `providers/*.provider.ts`, reload them through Vite SSR, and include them in the registry.
- `flakes/vista/service/src/server.ts`: route the discovered app providers for both draft and receipt-verified published versions.
- `flakes/vista/service/src/publish.ts`: run the Query collector/capture and copy the encoded snapshot into the static version.
- `flakes/vista/blocks/src/authoring.tsx`: expose/integrate a Query collector seam so Query identity automatically appends the semantic node's binding during the existing Node render.
- `flakes/vista/blocks/src/data-components.tsx`: replace `ProviderRequest`, bespoke frozen/live closures, and the closed provider union with the generic atom-backed Query component/hook.
- `flakes/vista/blocks/src/provider-contracts.ts`: add the Schema form of `PullRequestData` and the rich GitHub RPC, or move those schemas beside the PR block and export the generated descriptor.
- `flakes/vista/service/src/data/providers/gh.provider.ts`: implement the rich `pullRequest` core using the existing Effect process service rather than Bun subprocesses.
- `flakes/vista/blocks/src/blocks/PullRequestViewer.tsx` (or a thin adjacent wrapper): accept `{repo, pr}` and bind `gh.ops.pullRequest`, passing its decoded value to the existing visual viewer.
- Vista's browser root/runtime-island entry: mount `RegistryProvider`, install the decoded snapshot before hydration, and configure the standing service base URL.
