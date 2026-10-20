# Data layer: effect Schema spine + two-tier Effect RPC, Vite-SSR mounted

> **Amended:** the Schema spine, two-tier `@effect/rpc` transport,
> `RpcGroup`/`core` split, SSR mount, and the one-schema live⇄frozen keystone
> stand. Historical clauses below: provider→block binding through
> `OQ-REGISTRY-KEYS`/decision [0016](./0016-bespoke-props-via-effect-schema-typed-registry.md)
> string keys (bindings are now derived from typed JSX by
> [0074](./0074-ordinary-react-components-project-semantic-primitives.md)/[0076](./0076-semantic-topology-is-publish-stable.md),
> with no App-authored data or model registry) and the slug-only `_data` route
> (now owner-scoped, decision [0077](./0077-owner-scoped-source-with-automatic-typed-receipts.md)).

Status: accepted

Evidence: a research comparison plus an end-to-end prototype.

## Context

Vista reviews have a server/data half of **providers** (peer to components,
05-data-sources intuition). The data-layer pattern was open (OQ-DATALAYER). A
research comparison and an end-to-end prototype
([../02-medium/03-data-sources/.experiments/](../02-medium/03-data-sources/.experiments/)) evaluated
Effect RPC, GraphQL, tRPC, typed endpoints, and server functions, and proved the
Effect-RPC-over-Vite-SSR approach works.

## Decision

- **effect `Schema` is the non-negotiable contract spine** for every provider.
- **`@effect/rpc` is the provider transport**, used in **two tiers, one contract:**
  - **Pre-configured providers** (`gh`, `otel`/`prometheus`, `axe-vrs`, decision
    0026) are full **RPC groups**, reusing the house `makeRpc`/`makeRpcGroup`
    convention (`flakes/forge`, `flakes/op-proxy`).
  - **Ad-hoc per-project providers** define the same Schema contract and graduate
    to a full RPC group only when they need streaming / a typed JS client.
- **The `RpcGroup` / `core` split is the core shape.** A provider is
  `{ id, group: RpcGroup, core: Record<tag,(payload)=>Effect<A,E>>, handlers:
  group.toLayer(core) }`. `RpcGroup` is the network boundary (the browser crosses
  it over HTTP); `core` is the in-process call surface with three callers — the
  handlers Layer, `freeze()`, and dependent providers.
- **Mounting:** the standing service loads providers via `vite.ssrLoadModule()`
  (HMR + TS parity with components) and exposes each at
  `/r/<encoded-owner>/<local-slug>/<v>/_data/<id>` via `RpcServer.toWebHandler`.
  Discovery globs pre-configured plus project-local `providers/*.provider.ts`.
- **Live ⇄ frozen via one schema (the keystone):** `freeze()` runs `core[rpc]` in
  process, `Schema.encode`s the success, and inlines it; the frozen view
  `Schema.decode`s the **same** schema. Live and frozen decode identically — single
  source of truth, no codegen. This is the specific reason for Schema-first over
  GraphQL/RSC (opaque result blobs). Frozen reviews make zero `/_data/` calls (MED.DATA-R29).
- **GraphQL rejected** for Vista: its edge (introspectable graph, client-shaped
  per-field selection, per-project stitching) is unneeded — a data-backed
  component declares one typed semantic binding that Vista derives into the
  manifest (MED.AUTH-R25), viewers author no queries (VST-R01), and cross-provider
  composition is a server-side provider concern where secrets live (MED.DATA-R31).

## Consequences

- Provider→binding resolution is derived from the App's typed JSX into the
  semantic manifest; there is no generated or hand-maintained key registry and no
  parallel resolution path.
- Effect packages must stay in Vite `ssr.external` so provider modules share one
  `effect`/`@effect/rpc` realm with the host (the analog of m1's React `dedupe`).

- Secrets stay server-side; freeze must assert no secret-bearing fields (MED.DATA-R31).
- Residual OQ-DATALAYER decisions (in the prototype experiment): type the
  in-process `core` surface (highest), streaming, HMR robustness (atomic-rename),
  freeze provenance, one-server-per-provider-vs-shared. These refine the
  05-data-sources spec; they do not reopen this decision.

## Greenfield terminology amendment

DataBinding is the internal record derived from a typed domain Block.
Provider resolves it; Snapshot is the frozen Provider result embedded in an
AppVersion. None is AppSource configuration or a public authoring surface.

## Amendment 1 — Rpc-first contract halves

The Effect Schema and `@effect/rpc` spine remains, but there is one contract model
for every Provider. Built-in and app-local Providers both author `Rpc.make` values
and an `RpcGroup` in a client-safe `*.query.ts` module.
`contract({ id, group })` derives the ProviderContract and its Operations; no
parallel operation specification synthesizes Rpc.

The implementation is a separate server-only `*.provider.ts` module.
`implement(contract, { purity, handlers, live? })` supplies behavior while
preserving each handler's typed `Effect<A, E, R>` requirements, and
`mountProvider(implementation, layer)` provides `R` once for the in-process core
and RPC handlers. `vista check` rejects a client import or re-export of
`*.provider.ts` and rejects server-only modules in the transitive closure of
`*.query.ts`.

DataBinding, Provider, Operation, and Snapshot remain internal. Typed domain
Blocks are the only public data surface; `Query` is not a Vista term. Provider
composition follows decision 0090 rather than the historical blanket statement
that all cross-provider composition is server-side.
