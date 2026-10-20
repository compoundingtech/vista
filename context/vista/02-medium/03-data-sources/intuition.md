# Data Sources — Intuition

The data/server layer for Vista apps. Design direction set; the exact pattern is
under active exploration (two spikes). Builds on requirements MED.DATA-R28–MED.DATA-R31 and decisions
0006, 0008, 0016, 0018, 0026.

## Providers are a peer concept to components

A Vista app project has two halves:

- **client** — React **blocks** that render (the block library).
- **server/data** — **providers** that fetch/compute data.

Providers are a first-class peer to components. Just as the block library ships
reusable *components*, Vista ships pre-configured **providers** — `gh`, `otel`/`prometheus`,
`axe-vrs` (decision 0026) — a "provider kit" mounted for every project. A specific
project can drop its own **ad-hoc provider** module into its app dir, the same
way it drops a custom component; the service mounts it. No ceremony.

## The service mounts the server/data part (via Vite)

The standing service already runs programmatic Vite + a custom router. It mounts an
app's providers as **server modules loaded via `vite.ssrLoadModule()`** — so
providers get the same TS transform + HMR + dev-server parity as components — and
exposes them as data endpoints (e.g.
`/r/<encoded-owner>/<local-slug>/<v>/_data/<provider>`). One
toolchain for client and server; no second backend.

## Live ⇄ frozen

A block's `dataSource` / `modelKey` (MED.DATA-R28) resolves to a provider:

- **live** — call the provider through the service (fresh).
- **frozen** — the publish-time `freeze()` runs the providers and inlines the
  results into the immutable version (reproducible, offline; MED.DATA-R29). Mode is always
  explicit to the viewer (MED.DATA-R30).

Secrets stay server-side in the service (tailnet, trusted-author); the client never
holds them, and live data is fetched through governed surfaces (MED.DATA-R31).

## Contract: effect Schema, default Effect RPC

The provider contract is **effect `Schema`-typed**, and the **default starting
point is Effect RPC (`@effect/rpc`)** — production-grade, typed end-to-end,
composable (layers, error channel, retries, spans), consistent with our whole
stack. This is the leading candidate, being validated and compared (GraphQL, tRPC,
typed data-endpoints, server functions) by the exploration spikes.

## Status

The data layer is decided (decision 0027): an Effect Schema spine + two-tier Effect
RPC (`RpcGroup`/`core` split, Vite-SSR mounted, single-decode live⇄frozen). Open
refinements — typing the in-process `core`, streaming, freeze provenance, registry
keys — are tracked as OQ-DATALAYER.
