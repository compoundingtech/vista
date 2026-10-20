# Effect-native host spike: can `@effect/platform` own the request boundary while Vite keeps HMR?

Date: 2026-07-03

## Question

Can the service host become Effect-native at the HTTP request boundary
(`@effect/platform` router + delegation to `vite.middlewares`) while preserving
Vite dev-server serving and HMR WebSocket on one shared `http.Server`, under
`node --experimental-strip-types`? This gates the host-posture decision (0060).

## Method

A throwaway spike (`tmp/vista-effect-host-spike/spike.ts`, `viteroot/hello.ts`)
replicated production's topology: one shared `http.Server`, a Vite dev server in
`middlewareMode` with `hmr: { server, clientPort, path }`, review paths delegated
to `vite.middlewares` from inside an Effect handler. Two topologies were run
through one hardened oracle — an Effect route, a Vite-transformed module, and a
**real `ws` HMR handshake requiring Vite's genuine `{"type":"connected"}` frame
plus a clean health window** (not merely socket-open). Deterministic across 3 runs.

## Result

GREEN — for the **request** boundary only; the **upgrade/WS** boundary must stay
Vite-owned, which is exactly production's current topology
(`service/src/server.ts:703-707`, no custom upgrade dispatcher).

| Topology | Shape | Result |
| --- | --- | --- |
| B | `NodeHttpServer.makeHandler(app)` + manual `server.on('request', handler)`; Vite owns `upgrade` | GREEN — all legs pass, HMR clean |
| A | `NodeHttpServer.layer(() => server, { port })` + `HttpServer.serveEffect(app)` | RED — `serve` unconditionally attaches its own `upgrade` listener that runs the app on the upgrade socket, writing non-WS bytes after Vite's 101 → client errors `Invalid WebSocket frame: RSV1 must be clear` |

A false-GREEN trap mattered: a bare `open`-only WS check passes Topology A. Only
requiring Vite's `connected` frame + a clean health window exposed A's corruption.

## Load-bearing pattern (Topology B)

```ts
const server = http.createServer()                    // no request callback
const vite = await createViteServer({ root, appType: 'custom',
  server: { middlewareMode: true, hmr: { server, clientPort: port, path: HMR_PATH } } })
const handler = await Effect.runPromise(NodeHttpServer.makeHandler(app)) // request-only
server.on('request', handler)                          // Vite keeps its own 'upgrade'
server.listen(port)
```

Delegation from inside an Effect route:

```ts
HttpRouter.all('/*', Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const nodeReq = NodeHttpServerRequest.toIncomingMessage(request)
  const nodeRes = NodeHttpServerRequest.toServerResponse(request)
  yield* Effect.async<void>((resume) => {
    nodeRes.once('finish', () => resume(Effect.void))
    nodeRes.once('close',  () => resume(Effect.void))
    vite.middlewares(nodeReq, nodeRes, (err) => {
      if (!nodeRes.writableEnded) { nodeRes.statusCode = err ? 500 : 404; nodeRes.end(/* … */) }
    })
  })
  return HttpServerResponse.empty()
}))
```

Load-bearing APIs: `NodeHttpServer.makeHandler`, `NodeHttpServerRequest.toIncomingMessage`/
`toServerResponse`, `HttpServerResponse.empty()`. Enabling mechanism:
`platform-node/internal/httpServer.js` `handleResponse` short-circuits to
`Effect.void` when `nodeResponse.writableEnded`, so once Vite ends the response
Effect does not double-write.

## Invariant this produces

The implementation MUST use `makeHandler` + manual `server.on('request', ...)`.
Reaching for the named `NodeHttpServer.layer` / `serveEffect` silently corrupts
HMR. This is recorded as a spec invariant in 0060, not left to implementer memory.
