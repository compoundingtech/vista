# Experiment: Nix packaging + deployment design (2026-06-20)

Design + local proof (no real deploy, no host mutation) for packaging Vista as a
first-party Nix flake + standing service. (Spike source was under
`tmp/proto-deploy/`, since reclaimed.)

## Critical test (run first — it decides everything)

Can Vite serve a review when deps live in a **read-only** Nix store `node_modules`?
Harness: store deps frozen `chmod a-w` (named `node_modules` so node's walk-up
works), reviews-root `node_modules` symlinked into it, Vite `cacheDir` redirected
to mutable state. **Result: works.** Vite served the index, JSX-transformed
`main.tsx`, and esbuild prebundled react + react-dom + react-dom/client + mermaid —
all from the read-only store; prebundle cache landed in the redirected mutable
`cacheDir`; no EROFS/EACCES. Reviews symlink directly into the read-only store
closure — no need to materialize a writable `node_modules`.

## Recommended design (each tied to evidence)

- **Deps under Nix:** one `vista-deps` store closure shared by the service and all
  reviews (service deps == review deps). Reuse the repo's existing pnpm→nix path
  (`discord-agent`'s `build.nix` idioms), not dream2nix/pnpm2nix.
- **Service is an UNBUNDLED node app** run from its store dir with an adjacent
  `node_modules` → `vista-deps`. Vite cannot be bundled (it externalizes
  esbuild/rollup and spawns esbuild). Only the `vr` CLI can be a compiled Bun
  binary. The proof validated this exact layout.
- **Mutable state in `/var/lib/vista`** (reviews, cache) outside the store; service
  module modeled on `nixpkgs/nixos/modules/crosstask.nix`; the reviews-root
  `node_modules` symlink recreated via tmpfiles `L+`.
- **Tailscale exposure:** Vista is a *standing* service, so it publishes via the
  existing `managed-tailscale-service.nix` module — **NOT the devnet PTY-per-session
  path** (corrects the earlier "served via devnet" assumption; see delta below).
  One canonical `https://vista.<tailnet>/r/<slug>/<ver>/`.
- **Process lifecycle:** the platform spike's `pkill -9 -f` workaround is replaced
  by systemd `KillMode=control-group`. Proven locally: esbuild children share the
  server's process group; process-group/cgroup kill (and process-compose SIGTERM)
  leave zero survivors, port closed.

## Delta from earlier assumption

Decision 0002 / VST-R40 said "served over Tailscale Service via devnet". The spike
shows a *standing* service should use `managed-tailscale-service.nix` directly;
devnet is for PTY-per-session dev servers. VST-R40 updated accordingly; decision 0002's
intent (Nix-managed service on the fleet, exposed via Tailscale Service) stands —
only the mechanism (managed-tailscale-service, not devnet) changes.

## Proven vs residual risk

Proven locally: read-only-store Vite serve, cache redirect, runtime `vite`
resolution, orphan reap, supervised teardown. Residual (ranked):

1. Building the `vista-deps` derivation — disk pressure (<25 GiB) blocked a fresh
   install, so deps were reused; expect a first-build FOD mismatch → repair with
   `/sk-evergreen`, do not hand-patch. (OQ-DEPLOY-DEPS-BUILD)
2. HMR/WebSocket through a single `tailscale serve` (untestable under no-tailnet
   constraint). (OQ-DEPLOY-HMR)
3. Deps-bump cache invalidation.
4. Host placement dev3 vs dev4.
5. NixOS vs home-manager module.

The agent respected the disk policy (reused deps rather than bypassing).
