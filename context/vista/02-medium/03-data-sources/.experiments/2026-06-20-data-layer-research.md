# Experiment: data-layer pattern research (2026-06-20)

Design comparison of data-layer patterns for the Vista provider model (Effect RPC
vs GraphQL vs tRPC vs typed endpoints vs server functions), against Vista's
constraints. Notes (throwaway): `/home/schickling/vista-build/research-datalayer/
provider-data-layer.md`. Pairs with the Effect-RPC-over-Vite-SSR prototype (which
must confirm the keystone below).

## Recommendation: Schema-spine + two-tier RPC

- **effect `Schema` is the non-negotiable contract spine** for every provider.
- **`@effect/rpc` where it earns its keep** (live calls, streaming, the typed
  client) — but do NOT force the full RPC transport runtime onto single-file
  ad-hoc providers. Two tiers, one contract:
  - **Pre-configured providers** (`gh`, `otel`/`prometheus`, `axe-vrs`) are full
    **RPC groups**, reusing the house convention `makeRpc(tag, {payload, success,
    error})` + `makeRpcGroup(...)` + Schema error unions + middleware (grounded in
    `flakes/forge/src/core/rpc.ts`, `flakes/op-proxy/src/rpc.ts`).
  - **Ad-hoc per-project providers** define the **same Schema contract** + a handler
    Effect on a **thin typed endpoint** on the existing connect router; they
    graduate to a full RPC group only if they need streaming / a typed JS client.
    A `fromRpc` adapter keeps the contract unified across tiers.

## The keystone: single-decode live/frozen symmetry

Live and frozen are both **server-side provider execution** — they differ only in
*when* the handler runs and *what happens to the result*. With Schema:

- **frozen** = `Schema.encode(Success)` at publish (publish.ts is the freeze
  injection point);
- the client decodes **both** the frozen JSON and a live response through the
  **identical** `Schema.decode(Success)`.

That single-decode symmetry is the strongest specific reason for a Schema-first
layer. GraphQL/RSC are result-blob protocols whose frozen payload needs codegen to
re-decode — they lose here. The prototype's items 1–2 (in-process invoke +
Schema extraction off an `Rpc`, and the single-decode symmetry) are the keystone
that confirms or falsifies this whole recommendation.

## GraphQL, steel-manned

Its one genuine edge: one introspectable graph with client-shaped per-field
selection + per-project type extension via stitching. Vista does not need it: the
document binds blocks to data by one string key per block (MED.AUTH-R25); it is render-only
(viewers don't author queries, VST-R01); cross-provider composition is a server-side
provider concern where secrets live (MED.DATA-R31).

## Grounding in existing code

- House RPC convention reused verbatim for pre-configured providers (forge,
  op-proxy).
- The provider→block binding seam is **already OQ-REGISTRY-KEYS** (generated key
  union vs runtime resolution, coupled to decision 0016) — reuse that, don't invent
  a parallel resolution.
- The proven m1 service already has the mount points: `ssrLoadModule` (provider
  mount), `fs.allow` scoping (no blast-radius change), the WS `upgrade` multiplex
  (streaming), `publish.ts` (freeze injection).

## Open decisions (→ OQ-DATALAYER; finalize after the prototype)

7 surfaced; headline ones: the two-tier boundary (when ad-hoc graduates to a full
RPC group); streaming element-codec for live OTel; caching; and the provider
registry/discovery mechanism (couples OQ-REGISTRY-KEYS).
