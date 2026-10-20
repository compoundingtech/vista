# Experiment: Effect-RPC-over-Vite-SSR data-layer prototype (2026-06-20)

End-to-end prototype proving the default data-layer design. Throwaway:
`/home/schickling/vista-build/proto-datalayer/` (bun, no global installs; `tsc`
clean; seam/inproc regression checks pass). Confirms the research recommendation
([2026-06-20-data-layer-research.md](./2026-06-20-data-layer-research.md)).

## Verdict: it works well

- **Provider-as-RPC, typed end-to-end.** Providers are `@effect/rpc` `RpcGroup`s
  with effect-`Schema` requests/responses + the Effect error channel. The browser
  imports the contract module and gets real return types under `tsc`.
- **Mounted via Vite SSR.** `vite.ssrLoadModule()` loads each provider; exposed at
  `/_data/<id>` via `RpcServer.toWebHandler`.
- **Real + mock + ad-hoc providers.** `gh` does a real `gh pr view`; `otel` mocks a
  PromQL series; an ad-hoc `review-project/providers/changelog.provider.ts` is
  discovered + mounted idiomatically alongside the pre-configured ones.
- **Live call → `Loadable<T>`** with all four states proven, including a typed
  error channel round-tripped browser→server→browser.
- **Freeze (the keystone).** `POST /_freeze` runs each provider's `core` Effect
  **in-process** (no loopback HTTP), `Schema.encode`s with the success schema, and
  inlines JSON. The frozen view fetches **only** `/snapshot.json` — zero `/_data/`
  calls (network-verified). Live and frozen render identical data through one
  `Schema.decode` — the MED.DATA-R28/MED.DATA-R30 dual-mode win.
- **Composability** via `Effect.all` over providers' `core` functions (no RPC
  between providers). **HMR** confirmed (re-`ssrLoadModule` on change).

## The design (validated)

Provider = `{ id, group: RpcGroup, core: Record<tag, (payload) => Effect<A,E>>,
handlers: group.toLayer(core) }`. **The split is the insight:** `RpcGroup` is the
network boundary (browser crosses it over HTTP); `core` is the in-process call
surface with three callers — the handlers Layer, `freeze()`, and dependent
providers. Contract module is browser-importable; handler module is server-only.

- **Discovery:** glob `providers/*.provider.ts` (pre-configured) + `<project>/
  providers/*.provider.ts` (ad-hoc); `reload()` = `ssrLoadModule` →
  `RpcServer.toWebHandler(group, { layer: merge(handlers, layerJson) })`.
- **Freeze:** `core[rpc](args) |> Schema.encode(successSchema)` → inline; frozen
  mode `Schema.decode`s the same schema. One schema, two modes.
- **Client dataSource:** `live` = `RpcClient` over `FetchHttpClient` to `/_data/
  <id>`; `frozen` = decode snapshot entry. Both resolve to `Effect<T,E>`.

## Gotchas (→ spec / open decisions)

- **Module realm:** provider modules MUST share one `effect`/`@effect/rpc` copy
  with the host — keep effect packages in Vite `ssr.external` (don't `noExternal`).
  This is the analog of m1's React `dedupe` seam-fix.
- **node↔web bridge:** Vite middleware is node req/res; `@effect/rpc` is Web
  Request/Response. `RpcServer.toWebHandler` + ~30 lines of adaptation; landed clean.
- **HMR is change-only:** atomic-rename saves (vim default = unlink+add) would be
  missed; robust fix handles add/unlink or hooks Vite module-graph invalidation.
- **Streaming unbuilt:** `@effect/rpc` supports stream-success RPCs, but the adapter
  buffers `arrayBuffer()`; a real build must stream for otel live-tail / large diffs.
- **`core` composition is untyped** (`Record<string,(payload:any)=>Effect<any,any>>`)
  — the client path is fully typed, but in-process `core` composition is `any`.

## Ranked open decisions (OQ-DATALAYER)

1. **Type the in-process `core` surface** (derive per-RPC types from the
   `RpcGroup`) — the composability win is currently untyped. Highest priority.
2. **Streaming** (stream-success RPCs + a streaming node↔web adapter).
3. **HMR robustness** (add/unlink / module-graph invalidation).
4. **Freeze provenance + MED.DATA-R31 assert** (record blocks' actual live calls during a
   capture pass; assert no secret-bearing fields at freeze).
5. **One `RpcServer` per provider vs one shared group** (revisit at scale).
