# Nix packaging: unbundled service, read-only deps closure, managed Tailscale

> **Amended:** the unbundled node service, read-only `vista-deps` store closure,
> mutable `/var/lib/vista` state, managed-Tailscale exposure, and
> `KillMode=control-group` lifecycle stand. Historical clauses below: the `vr` CLI
> name (now `vista`, decision [0028](./0028-cli-named-vista-and-review-index.md)),
> the slug-only `/r/<slug>/<ver>/` URL (now owner-scoped
> `/r/<encoded-owner>/<local-slug>/<version|latest>/`, decision
> [0077](./0077-owner-scoped-source-with-automatic-typed-receipts.md)), and
> `tailwindcss` in the closure (Vista-owned surfaces are StyleX-authored,
> decision [0036](./0036-geist-native-dark-first-visual-system.md) as amended).

Status: accepted

Evidence: the deployment spike, proven locally.

## Context

Vista is a standing Nix-managed service (decision 0002, VST-R40). The hard parts:
Nix dislikes mutable `node_modules`, Vite resolves deps at review-serve time and
cannot be bundled, and the service must expose one canonical URL over the tailnet.
The deployment spike
([../01-service/.experiments/2026-06-20-nix-packaging-deployment.md](../01-service/.experiments/2026-06-20-nix-packaging-deployment.md))
proved the design locally.

## Decision

- **One `vista-deps` store closure** shared by the service and all reviews
  (service deps == review deps), built via the repo's pnpm→nix path
  (`discord-agent` `build.nix` idioms). Reviews symlink their `node_modules`
  directly into this **read-only** store closure; Vite serves from it with
  `cacheDir` redirected to mutable state. Proven: read-only-store serve works, no
  writable `node_modules` materialization needed.
- **The service is an unbundled node app** (Vite externalizes esbuild/rollup and
  spawns esbuild — cannot be bundled). Only the CLI may be a compiled Bun binary;
  it is named `vista` (the `vr` name below is historical).
- **Mutable state in `/var/lib/vista`** (durable reviews + cache) outside the
  store; service module modeled on `crosstask.nix`; reviews-root `node_modules`
  symlink via tmpfiles `L+`.
- **Exposed via `managed-tailscale-service.nix`** (standing service), not devnet,
  at one canonical host. Routes are owner-scoped:
  `https://vista.<tailnet>/r/<encoded-owner>/<local-slug>/<version|latest>/`; the
  historical slug-only form is retired.
- **Process lifecycle via systemd `KillMode=control-group`** — reaps Vite's
  esbuild children (replaces the spike's `pkill -9 -f`). Proven: zero survivors.

## Consequences

- The dep set is upgraded by rebuilding `vista-deps`; reviews and service stay in
  lockstep (SVC-R16/MED.BLK-R27 satisfied via one closure). The closure must include the
  block-library toolchain (StyleX, React Flow, elkjs, …); `tailwindcss` was part of
  the historical closure and is not part of the current styling contract.
- **Reviews must resolve against the closure from a location that can walk up to it:**
  the production mutable reviews root (`/var/lib/vista`) carries a root `node_modules`
  symlink into the read-only `vista-deps` store closure, so Vite's walk-up from each
  review resolves every specifier without an alias map (decision 0006). The reviews
  root placement is therefore load-bearing, not arbitrary.
- First build of `vista-deps` will likely hit a FOD hash mismatch — repair with
  `/sk-evergreen`, never hand-patch (OQ-DEPLOY-DEPS-BUILD).
- HMR/WebSocket through a single `tailscale serve` is unproven (OQ-DEPLOY-HMR).
- Host placement (dev3 vs dev4) and NixOS-vs-home-manager module are open.
- Updates VST-R40 (managed-tailscale-service, not devnet).
