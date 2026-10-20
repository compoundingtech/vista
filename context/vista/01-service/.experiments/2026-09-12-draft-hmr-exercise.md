# Experiment: draft HMR through managed service (2026-09-12)

OQ-DEPLOY-HMR exercise. Throwaway draft `hmr-probe-20260912t0959z` (created
and removed; both URLs verified 404 afterwards). No service changes.

## Result

FAIL on both paths, at different layers:

1. **Loopback** (`ws://127.0.0.1:5192/…/__vista_hmr__`): upgrade + `connected`
   frame OK (+885ms), then Vite error `Failed to resolve import "react"`
   from the virtual draft entry — the app never renders, so update fan-out
   is unreachable. Draft HMR is broken before networking matters.
2. **Tailnet** (`https://vista-dev3.tail8108.ts.net`): page 200, but Vite
   constructs `wss://vista-dev3.tail8108.ts.net:5192/…` — wrong port for the
   single Tailscale Service endpoint — `ERR_CONNECTION_REFUSED` at +1112ms.
   Upgrade never happens.

## Conclusion

Two independent defects: draft-entry module resolution (bundler config) and
tailnet HMR URL construction (port/path for the service endpoint). Fix loopback
resolution first; tailnet second. Also observed: the managed service converged
images mid-exercise on its own (no agent action); and `vista new` resolved a
third live seat value (`9h7nb2p6`), confirming ST_AGENT rotation is ongoing.

## Follow-up: local resolver and client proof (2026-09-21)

The focused service tests now pass against an external catalog source. Draft
Vite resolves provided packages through the service dependency anchor instead
of relying on catalog ancestry. The client no longer forces a separate HMR
port; the slug-scoped WebSocket path uses the service origin. The deployed
Tailscale endpoint remains unexercised.
