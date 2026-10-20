# Vista Open Questions

Only unresolved design questions live here. Settled alternatives, experiments,
and superseded mechanisms remain in `.decisions/` and subsystem `.experiments/`.

## OQ-CONTROL-RPC-EXPOSURE — Control endpoint network authorization

[SVC DQ1](./01-service/spec.md#dq1--control-rpc-authorization) asks how to
enforce the control-plane boundary without breaking the CLI.

The control RPC accepts publish/retire and other writes, but its router mounts
`/_rpc/control` without a loopback guard or service-level authentication
(`flakes/vista/service/src/server.ts:1196-1199`; forwarding at `:897-901`).
`httpServer.listen(port)` has no host binding (`server.ts:1380-1382`); the
dev3 bakeoff observed `*:5192`, not loopback-only. The `isLoopbackRequest`
helper (`server.ts:195-198`) does not guard this route. The separate
`/_rpc/read` route intentionally exposes only non-mutating, allowlisted read
procedures and does not resolve the control-route risk.

- **Resolution signal:** decide and enforce network/authorization policy for
  control writes without breaking the CLI's local control workflow; track the
  shared published-surface contract in [#3989](https://github.com/schickling/dotfiles/issues/3989).
- **Decision owner:** `01-service` and the Vista deployment owner.

## OQ-DEPLOY-HMR — Draft HMR through Tailscale Service

Local same-origin draft HMR now has coverage for the service dependency anchor,
external catalog sources, and the slug-scoped WebSocket path. The managed Vista
service still needs one deployed proof that the path survives the single
Tailscale Service endpoint. This affects only `draft`; immutable `vN` and
`latest` serve receipt-backed static files and never use HMR.

- **Evidence:** the focused service route tests pass on 2026-09-21. The
  previous resolver failure and wrong-port client construction are fixed.
- **Remaining proof:** exercise the deployed endpoint without changing the
  immutable publication contract.
- **Decision owner:** `01-service` and the Vista deployment owner.



## OQ-STATE-ROOT — One Vista state root

Vista's mutable state is split across two roots on a Nix-managed host. The Home
Manager `stateDir` (`~/.local/state/schickling/vista`) holds `apps`, `cache`,
`live-state` and the legacy apps archive. `~/.local/state/vista` holds
`sources` (the module's `sourcesDir` default, owner-scoped `_owned.v1`) and
`trail` (the CLI journal default, `VISTA_TRAIL_DIR`). The split has no design
reason; it already let a packaged default grow a stray apps tree.

- **Resolution signal:** one documented root for all Vista state, with
  `sources` and `trail` moved by a live migration that has a fail-closed
  bridge, a forward-only marker and a fenced deploy window. No data moves
  outside such a window.
- **Proposed resolution:** the Home Manager `stateDir` becomes the single
  root, because it already holds `apps`, `cache`, `live-state` and the archive.
  1. Code first, no data move: the module sets `VISTA_TRAIL_DIR` explicitly and
     derives `sourcesDir` from `stateDir`. The new default applies only behind a
     new forward-only migration marker.
  2. A fail-closed bridge moves `sources` and `trail` with a same-filesystem
     rename, refuses mixed states, writes the marker and is safe to re-run.
  3. A fenced deploy window on one host first, with snapshot, delta and probe.
     The window is accepted when the probe passes and `~/.local/state/vista` is
     empty.
- **Decision owner:** `01-service` and the Vista deployment owner.

## OQ-DATA-CROSS-VERSION-SHARING — Shared upstream execution

[MED.DATA DQ1](./02-medium/03-data-sources/spec.md#open-design-questions)
leaves open whether compatible AppVersions may share an active upstream poller.
Snapshot, LiveOverlay, authorization, teardown, retention, and telemetry remain
AppVersion-owned regardless of the answer.

- **Resolution signal:** a lease design proves that retiring or replacing one
  AppVersion cannot extend, terminate, authorize, or relabel another version's
  work.
- **Decision owner:** `02-medium/03-data-sources` and `01-service`.
