# Canonical-URL emission: investigation + resolver seam

Date: 2026-07-01. Evidence for [decision 0051](../../.decisions/0051-emit-canonical-url-via-centralized-devnet-resolver.md)
(SVC-R55). Method: code read + live tailnet probes + past-session usage mining.

## Question

Why does Vista emit loopback URLs (`http://127.0.0.1:5192/r/<slug>/…`) instead
of its canonical tailnet Service URL, and where should canonical-URL resolution
live?

## Findings

**Root cause — one env var, two concerns.** `VistaClient` reads `serviceUrl`
from `VISTA_URL` (default `http://127.0.0.1:5192`) and `urlFor(slug, version)`
builds the *emitted* review URL from that same base — the loopback address the
CLI uses for RPC transport. The deploy (`vista.nix`) pins
`VISTA_URL=http://127.0.0.1:<port>`. So no code path ever emitted a non-loopback
URL. Not a runtime failure: `https://vista-<host>.<tailnet>/health` returned
`200` at investigation time — the canonical URL resolves, the CLI just never
constructs it (the Service name + suffix live only in Nix).

**Not a devnet-lifecycle problem.** Vista is a *static* managed-tailscale
service (VST-R40/decision 0017), deliberately not on the ephemeral devnet
PTY-per-session path — `devnet list` / `pty list --filter-tag run.role=dev-server`
are empty for Vista by design. "devnet" in the request was shorthand for "the
canonical tailnet URL mechanism," not a directive to re-home Vista's lifecycle.

**The URL is deterministic for both service classes.** Both ephemeral (devnet
PTY) and static (managed-tailscale) services resolve to
`https://<name>.<magicdns-suffix>`. `devnet-router` already builds exactly this
string and already holds the tailnet suffix + the Tailscale API client. The only
gap is **name discovery for the managed class**: `devnet url` derives names only
from `dev-*` PTY tags today. Managed services are discoverable at runtime via
the activation-bundle `desired.json` (host-local) or the Tailscale API
`vipServices` (tailnet-global, already called by `devnet-router`).

**Usage cost.** Past agent sessions guessed across four URL shapes —
`127.0.0.1:5192` (74×), `<host>:5192` (37×), the Tailscale IP (10×), a stray
`5193` (26×) — because nothing emitted a canonical URL.

## Verdict (→ decision 0051)

Decouple the RPC transport (loopback) from the emitted public URL (canonical,
SVC-R55). Vista's own base is deploy-time-known, so HM plumbs `VISTA_PUBLIC_URL` and
Vista emits from it — no runtime resolver on the hot path (adversarial critique,
2026-07-01). A read-only, tailnet-global `devnet url` extension (devnet decision
0002) is retained for the general cross-host case but is not on Vista's path.
Publication boundaries (VST-R40/0017; devnet's `dev-*` contract) are untouched.
