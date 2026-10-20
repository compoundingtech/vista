# The service host is Effect-native at the request boundary; Vite owns the upgrade boundary

Status: accepted

## Context

The standing service's process host — entrypoint, HTTP routing, publish, freeze,
registry, provider mount, config — grew as imperative `node --experimental-strip-types`
code, while Effect already runs in the same process (control RPC, providers,
runtime-policy). No decision ratified an imperative host: 0017 ratifies *unbundled
node* (not non-Effect), and 0065 ratifies *route-owned serving* (not non-Effect).
The split is incidental, and it forces a typed/untyped seam through the middle of
one process. Making the host Effect-native gives one idiom end to end and is the
natural home for the service's OTel tracer layer (0064) and for composing the
freeze pass as a single traced Effect.

The open risk was purely mechanical: Vista serves apps through Vite's
dev-server connect middleware and depends on Vite owning the HMR WebSocket
`upgrade` listener on the shared `http.Server` (`server.ts:703-707`,
OQ-DEPLOY-HMR). Whether `@effect/platform`'s HTTP server can coexist with that was
unproven.

## Evidence and Argument

A runnable spike settled it — GREEN, with one load-bearing constraint
([01-service/.experiments/2026-07-03-effect-native-host-spike.md](../01-service/.experiments/2026-07-03-effect-native-host-spike.md)).
The host can be Effect-native at the **request** boundary while the **upgrade/WS**
boundary stays Vite-owned — which is exactly production's existing topology, so the
per-slug multi-draft HMR routing carries over unchanged. Effect's `serveEffect`
path (Topology A) is unusable here: it unconditionally attaches its own `upgrade`
listener that corrupts Vite's HMR frames on a shared server. The working path
(Topology B) attaches the Effect request handler manually via
`NodeHttpServer.makeHandler` and leaves `upgrade` to Vite.

## Options

| Option | Tradeoffs |
| --- | --- |
| A. Full Effect HTTP router (request boundary), Vite-owned upgrade | One idiom end to end for all request handling; hosts the OTel tracer and single-fiber freeze naturally; must use `makeHandler` (not `serveEffect`) or HMR breaks. |
| B. Effect core, thin imperative HTTP glue | Less churn at the very edge; but keeps a permanent typed/untyped seam and a second serving idiom, exactly the inconsistency this decision removes. |
| C. Keep imperative host | Rejected: no ratification supports it; blocks the OTel tracer layer and the single-trace publish. |

## Decision

The service host is **Effect-native at the HTTP request boundary**. Request
routing is an `@effect/platform` `HttpRouter`/`HttpApp`; the process entrypoint is
`NodeRuntime.runMain`; publish, freeze, registry, provider mount, and config are
Effect with tagged errors and `Config`. App/static paths are served by
delegating to `vite.middlewares` from inside an Effect handler via
`NodeHttpServerRequest.toIncomingMessage`/`toServerResponse`.

Two boundaries are preserved as invariants:

- **Serving stays route-owned, not RPC (0065).** The Effect HTTP router is a
  serving surface; it does not turn app/static serving into procedure calls.
- **The upgrade/WS boundary stays Vite-owned (0017 unbundled, OQ-DEPLOY-HMR).**
  The Effect request handler MUST be attached via `NodeHttpServer.makeHandler` +
  manual `server.on('request', handler)`, sharing the one `http.Server` with
  Vite's `hmr.server`. `NodeHttpServer.layer` + `serveEffect` is forbidden here —
  it attaches a competing `upgrade` listener that corrupts HMR. This is a spec
  invariant, not implementer discretion.

## Consequences

- One Effect idiom across the whole process; the incidental imperative/Effect seam
  is removed.
- The service gains a real Effect runtime layer, which is where the OTel tracer
  (0064) is provided — turning the already-well-named service spans from no-op to
  exported.
- The freeze pass composes as one Effect within this runtime, giving a single
  connected publish trace (0064) and removing the `runPromise`-in-loop
  irreversibility hazard.
- The `makeHandler`-not-`serveEffect` constraint is a permanent footgun guard; a
  regression test should assert HMR still handshakes after the migration.
- Unbundled-node (0017) and route-owned serving (0065) are unchanged.
