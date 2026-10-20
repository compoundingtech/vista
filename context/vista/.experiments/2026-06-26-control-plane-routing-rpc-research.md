# Control-plane routing / RPC architecture research

Date: 2026-06-26

## Question

Should Vista converge its shell/control plane onto `@effect/rpc` (option 4), and
what remains outside RPC?

## Evidence

- Vista already uses `@effect/rpc` for provider data. Provider modules expose a
  `RpcGroup` plus in-process `core`, mounted through `RpcServer.toWebHandler` at
  `/r/<slug>/<version>/_data/<id>` and called from the browser with
  `RpcClient.layerProtocolHttp` + `FetchHttpClient`.
- Vista's shell/control routes are still hand-routed in `service/src/server.ts`:
  `/health`, `/_vista/reviews`, `/_publish`, `/_answer`, `/_interview/*`, the
  review index, Vite internals, and `/r/<slug>/<version>/*`.
- `service-hub` is the closest existing dotfiles precedent for a typed control
  API plus UI fallback. It defines `ServiceHubApi` with `makeRpc` /
  `makeRpcGroup`, serves it at `/rpc` via `RpcServer.layerHttpRouter`, uses
  `layerNdjson` for streaming, and falls through to static UI handling on
  `RouteNotFound`.
- `effect-utils` contains `@overeng/effect-rpc-tanstack`, which proves Effect RPC
  can sit inside TanStack Start API routes (`createFileRoute('/api/rpc')`) via
  `RpcServer.toWebHandler`, with client support through `RpcClient`.
- The Vite review-serving lifecycle is unusual: one global published Vite server,
  per-draft Vite servers for HMR, Vite internal paths, inert `@vite/client`, and
  provider SSR loading. These paths are asset/app serving, not procedure calls.

## Findings

Moving Vista's operator/control commands to `@effect/rpc` is coherent when the
boundary is "agent/CLI/browser shell asks the standing service to perform an
operation." It is less coherent for review asset serving, Vite internals, and
canonical human URLs.

The useful split is therefore:

- **Control RPC:** publish, list reviews, retire, evict draft, ask/answer/await
  interview, maybe health/service metadata.
- **Provider RPC:** keep the existing per-provider `RpcGroup` / `core` split,
  mounted under the review URL where the block reads data.
- **Route/static gateway:** keep explicit HTTP routing for `/`, `/r/...`,
  redirects, Vite internal paths, HMR, and data-provider dispatch.

## Tradeoffs

### Control RPC advantages

- Reuses the same Effect Schema-first contract discipline already accepted for
  provider data.
- Lets CLI and browser shell share one typed client surface instead of duplicating
  endpoint contracts.
- Supports streaming naturally for `await` / watch-style interview flows via
  NDJSON, matching `service-hub`.
- Keeps expected errors as tagged `Schema.TaggedError`s instead of ad-hoc HTTP
  status + text parsing.

### Control RPC costs

- Simple curl/debug flows become less transparent. The accepted resolution is to
  make debugging intentional through a `vista debug ...` CLI namespace rather
  than preserving command-shaped HTTP shims.
- The current service has raw Node/Vite middleware ownership. A full
  `HttpServer.serve` rewrite is more invasive than adding an RPC web handler
  behind one prefix.
- RPC should not leak into immutable published review artifacts. Frozen reviews
  still need zero control-plane dependency.

### TanStack Router / Start fit

TanStack Router is a strong fit for the browser shell if the shell becomes a real
multi-route app with route loaders, search params, pending/error states, and
shareable views. It is not the right owner for Vista's service routing because
the service's hardest routes are Vite middleware, published/draft review serving,
HMR, and canonical review URLs.

TanStack Start is useful only if Vista chooses to make the shell a server-rendered
web app. Today Vista is already a standing Node service with Vite middleware and
Effect RPC; adding Start as the outer server would invert ownership and likely
complicate the Vite review gateway. The existing `effect-rpc-tanstack` package is
best treated as optional integration evidence, not the primary architecture.

## Recommended shape to test next

1. Add `VistaControlApi` as a single `RpcGroup`, mounted at `/_rpc/control` using
   NDJSON so streaming/watch operations do not need a second protocol later.
2. Keep `/health` and human/canonical review routes as plain HTTP.
3. Move CLI publish/list/open/retire to `RpcClient` and remove `/_publish`
   rather than retaining a compatibility/debug shim.
4. Move interview await to streaming RPC or an explicit re-arm RPC, replacing the
   current ad-hoc HTTP answer/await shape only after the browser round-trip is
   proven.
5. Leave provider RPC mounted per review/version under `/_data/<provider>`; do
   not merge provider and control groups unless there is a concrete cross-cutting
   middleware need.

## Evidence gaps

- Prototype `VistaControlApi` mounted beside current Vite router and prove it
  does not disturb HMR, published Vite internals, or provider `/_data` calls.
- Test NDJSON serialization for non-streaming and streaming control operations.
- Define the first `vista debug ...` commands needed to replace curl-based
  inspection.
- Decide whether the browser shell needs TanStack Router before adding it.
