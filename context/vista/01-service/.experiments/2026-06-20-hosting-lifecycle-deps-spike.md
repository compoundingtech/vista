# Experiment: hosting / lifecycle / deps spike (2026-06-20)

End-to-end throwaway spike validating the Vista standing-service pipeline:
agent drops a review in a standardized location → CLI registers → service
watches, mounts (programmatic Vite), serves at a canonical URL, with versioning
and zero per-review install. All claims exercised with curl + Playwright; service
torn down. (Spike source was under `tmp/proto-platform/`, since reclaimed.)

## What it validates (now spec-grade)

- **Single canonical URL + path routing.** One Node `http` + `connect` router on
  one port, delegating by base-prefix to one `vite.middlewares` instance per
  review version. URLs: `/r/<slug>/v<n>/` (immutable) and `/r/<slug>/latest`
  (router-level 302 to the current version). One devnet/Tailscale URL for the
  whole system. → decision 0005.
- **Zero-install deps.** A single `node_modules` symlink at the reviews root →
  the service's `node_modules`; Vite's walk-up resolves every bare specifier with
  no alias map and no per-review install. `resolve.dedupe: ['react','react-dom']`
  keeps React a singleton (no invalid-hook-call across renderer + escape hatch).
  `server.fs.allow` must include the reviews root + service dir. Measured agent
  ceremony: write `index.html` + `main.tsx`, run `vr publish`. Nothing else.
  → decision 0006.
- **Draft-live / versions-static.** `_staging/` mounts at `/r/<slug>/draft/` as
  the single live-HMR surface; `vr publish` snapshots it to immutable `vN`. N=2
  HMR proven: two reviews on one port, each on its own `__hmr` path sharing one
  server `upgrade`, hot-reloading independently. → decision 0007.
- **Restart re-discovery is free.** The registry is rebuilt from disk on start;
  `latest` is a disk symlink. Cold restart recovered all versions + latest.
- **Lifecycle.** `fs.watch(recursive, debounced)` auto-mounts new versions;
  malformed `vN` (no `index.html`) is skipped with a warning, never crashes;
  `retire` drops a `RETIRED` marker → 410, versions preserved on disk.

## CLI surface proven

`vr publish <slug> -m "summary"` (atomic temp-dir + rename snapshot → next `vN`,
write `meta.json {slug,version,author,timestamp,changeSummary,parent}`, swap
`latest`), `vr list`, `vr open <slug> [version]`, `vr retire <slug>`.

## New open decisions surfaced (→ open-questions.md)

1. **Old versions: live Vite vs static-built bundles.** Only the draft needs HMR;
   each live version root re-prebundles shared deps + holds a watcher, and
   `connect` is append-only (no unmount). Strong case to serve published `vN` as
   static built assets and run live Vite only for the draft. (OQ-SERVE)
2. **Concurrent-publish atomicity.** Real bug reproduced: two simultaneous
   `vr publish` both compute the same `vN`; the loser's `rename` hits `ENOTEMPTY`
   and silently drops content. Fix: atomic `mkdir vN` claim, retry on `EEXIST`.
   (OQ-PUBLISH-RACE)
3. **Mount eviction.** `connect` append-only means retire is a 410 shield in front
   of a still-running Vite instance, not teardown; need an evictable router to
   reclaim watchers/caches. (OQ-EVICT)
4. **`fs.allow` blast radius** — tighten from whole service dir to just
   `node_modules` + the specific review root. (OQ-FSALLOW)
5. **`latest` = 302 redirect** — confirm acceptable for consumers (chosen over a
   second mount to avoid double-prebundle).

## Ops note

Vite spawns esbuild/Babel worker children that outlive a parent `kill`; full
teardown needed `pkill -9 -f`. Addressed in production via systemd
`KillMode=control-group` (decision 0017).
