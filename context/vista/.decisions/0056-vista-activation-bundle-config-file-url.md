# Vista activation bundle + config-file URL delivery (targeted, non-disruptive deploys)

Status: accepted (design; implementation pending). Refines decision 0051 (URL
delivery) and VST-R40 (first-party packaging); makes Vista a bundle-owned boundary
under the nix-convergence deployment model (`context/nix-convergence/02-deployment/`).

## Context

Vista ships as plain Home Manager config — `home.packages` (the `vista` CLI),
`home.sessionVariables.VISTA_PUBLIC_URL`, and `systemd.user.services.vista`. It is
**not** a bundle-owned boundary: there is no `activationBundles.vista`, so the
targeted, non-disruptive `targeted-deploy` path is structurally unavailable, and
the only mechanism that applies Vista's changes is a **full Home Manager
generation switch** — which on dev3 also restarts shared services
(mimir/nomad/docker/tailscaled) and, from a shared working branch, would carry
unrelated WIP live (established by the 2026-07-02 deploy investigation). The
crux: `VISTA_PUBLIC_URL` as an HM **session var** is HM-generation-scoped, so no
targeted mechanism can deliver it without a full switch.

## Decision

- **Vista becomes a first-class activation bundle** — `desired` / `activate` /
  `verify` derivations registered in `nix/flake/activations.nix`, mirroring
  `hypermerge`/`runner-scaler`. `targeted-deploy` can then activate Vista over SSH
  non-disruptively (no full HM switch, no shared-service restart). `verify` checks
  the vista user service is healthy and the canonical URL resolves.
- **`VISTA_PUBLIC_URL` moves from an HM session var to a bundle-owned config
  file** the CLI reads. This is a delivery-source refinement to decision 0051
  only: the loopback-transport-vs-public-URL decouple (SVC-R55), the fail-loud /
  opt-in-local fallback, and the emission sites are unchanged — only the *source*
  of the canonical base changes from a session var to a bundle-owned file (env
  may remain as an explicit override for `--local`/tests). This is what lets the
  bundle deliver the URL non-disruptively.
- The bundle owns exactly Vista's deploy delta: the CLI on PATH, the config file,
  and the vista service unit.

## Consequences

- Vista deploys become **targeted and non-disruptive** — the deploy blocker the
  investigation found is resolved; a future canonical-URL/render change ships via
  `targeted-deploy` from a rev without touching shared dev3 services.
- Refines 0051 (config-file source); SVC-R55/SVC-R58/MED.AUTH-R59 unchanged. The CLI's
  `VISTA_PUBLIC_URL` read changes from a pure env `Config` to reading the
  bundle-owned config file (with env override retained).
- Aligns Vista with the fleet's bundle-ownership model; `verify` gives deploy a
  built-in health/URL gate. `verify`'s loopback liveness check retries (bounded,
  ~30s) rather than probing once, so a service that is merely slow to boot (Vite
  server + provider mounts + review scan) is a pass, not a false deploy failure.
- The bundle delivers the `vista` **CLI** on PATH, not only the service binary and
  config file: `activate` owns a stable `~/.local/bin/vista` symlink (on
  `home.sessionPath`, ahead of the HM profile) at the desired closure's `bin/vista`,
  so a targeted deploy ships the fresh CLI. Delivered on both paths — the bundle
  `activate` (targeted) and a `home.activation` link (full switch) — from the same
  package `bin/vista`, so neither path leaves a stale CLI shadowing the other
  (the same dual-delivery, cannot-drift shape as the public-url config file).
- Enables Track 4 (the live dev3 deploy) once this bundle lands.
