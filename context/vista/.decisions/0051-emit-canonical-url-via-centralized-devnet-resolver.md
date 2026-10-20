# Emit the canonical URL: HM-plumbed for Vista, devnet resolver for the general case

Status: accepted (design; implementation in flight). Adds SVC-R55; extends SVC-R14 and
VST-R40; sibling of `context/devnet` decision 0002 (the read-only general-case
resolver).

## Context

Vista's CLI reused a single `VISTA_URL` env var for two distinct concerns: the
**loopback RPC transport target** (where the CLI reaches its local service) and
the **human-facing review URL** it prints. `VistaClient.urlFor(slug, version)`
built the emitted URL from the same `serviceUrl` used for RPC, and the deploy
pinned `VISTA_URL=http://127.0.0.1:${port}` (`vista.nix`). So every emitted URL
was a loopback address — useless to a human reading an agent's message on another
tailnet host. There was no code path that ever emitted a non-loopback URL.

This is not a runtime failure: the canonical Tailscale Service URL
(`https://vista-<host>.<tailnet>/…`) already resolves live (Vista is registered
via `managed-tailscale-service.nix`, VST-R40/decision 0017). The CLI simply never
constructs it — the Service name and tailnet suffix live only in Nix and were
never plumbed into `urlFor`. Usage mining confirmed the cost: agents guessed
across four URL shapes (`127.0.0.1:5192`, `<host>:5192`, the Tailscale IP, and a
stray `5193`) because nothing emitted the canonical one. See
[.experiments/2026-07-01-canonical-url-investigation.md](../01-service/.experiments/2026-07-01-canonical-url-investigation.md).

The canonical URL for **both** service classes (ephemeral devnet PTY services
and static managed-tailscale services) is deterministically
`https://<name>.<magicdns-suffix>`. `devnet-router` already builds exactly this
string and already holds the two ingredients (the tailnet suffix and the
Tailscale API). The only thing missing is **name discovery for the managed
class**: `devnet url` today derives names solely from `dev-*` PTY tags.

## Decision

- **Decouple transport from the public URL.** The loopback endpoint remains the
  RPC transport target. Every human-facing URL Vista surfaces (`publish`,
  `open`, `list`, status/banner output) must be the canonical Tailscale Service
  URL, never the loopback address (SVC-R55). The ban is on the *emitted* URL, not on
  loopback everywhere.
- **Vista's own URL is plumbed at deploy time (root-cause fix).** Vista emits its
  own review URLs and nothing else, and its canonical base
  (`https://vista-<host>.<tailnet>`) is deploy-time-known. Home Manager sets
  `VISTA_PUBLIC_URL` from the same registration that publishes the managed
  service, and Vista emits from it directly — no runtime resolution on the
  one-command happy path. This is the root cause: the URL was simply never
  plumbed. Vista's own emission does not need cross-host generality, so it does
  not pay for a runtime resolver.
- **A centralized devnet resolver serves the general cross-host case.**
  `devnet url <name>` is extended (read-only, tailnet-global via the Tailscale
  API `devnet-router` already calls) to resolve managed-tailscale Service names
  for consumers that need *another* host's URL (devnet decision 0002). This keeps
  URL resolution centralized for the general case ("don't reinvent per tool"),
  but Vista does not depend on it for its own emission — keeping the resolver's
  network dependency off Vista's hot path.
- **Read-only extension, not a publication change.** devnet only *reads* managed
  registrations to resolve a URL; it never publishes, reconciles, or tears down
  managed services. Vista's publication home stays `managed-tailscale-service.nix`
  (VST-R40/decision 0017); devnet's `svc:dev-*` publication contract (devnet SVC-R13/SVC-R14)
  is untouched. Because resolving non-`dev-*` names is net-new devnet surface, it
  is recorded as a dedicated `context/devnet` decision, not folded into the
  `dev-*` contract silently.
- **Fallback is fail-loud, opt-in-local.** When `VISTA_PUBLIC_URL` is not set
  (Vista running without its managed registration — CI, standalone, a
  collaborator), Vista must not silently emit a loopback URL. It fails unless
  local mode is explicitly opted into (`--local` / env), in which case it emits
  the loopback URL clearly marked non-canonical (SVC-R55). This keeps
  standalone/CI/collaborator use working without ever misleading a human into
  clicking a dead loopback link.

## Consequences

- Kills the four-way URL guessing observed in usage; agents receive one correct,
  clickable, cross-host URL.
- Adds a small, read-only devnet surface (managed-class name → URL) plus a
  `context/devnet` decision. Cross-system change, but additive.
- Vista's emission has **no runtime network dependency** (`VISTA_PUBLIC_URL` is a
  deploy-time env), so the fail-loud fallback never trips on a transient API blip
  — it trips only when Vista runs without the managed registration, where
  `--local` emits a marked loopback URL. This resolves OQ-URL-RESOLUTION (no
  caching / resolve-at-emit seam needed for Vista's own path).
- The devnet managed-name resolver (decision 0002) is retained as read-only,
  additive general-case infrastructure for other/future consumers; it is not on
  Vista's own emission path. A per-host naming mismatch between `vista-<host>`
  and the registration would surface as fail-loud, not a crash.
- Extends SVC-R14 (server-side canonical routing) with SVC-R55 (client-side canonical
  emission); preserves VST-R40 (managed-tailscale publication).
