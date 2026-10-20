# Experiment: always-dev-server serving (2026-06-20)

Validates serving ALL versions (draft + published) via the Vite dev server, no
`vite build`. Throwaway: `/home/schickling/vista-build/proto-devserver/`. Revises
decision 0007 / OQ-SERVE. Verdict: **viable and cheaper than `vite build` — in the
single-global-server shape.**

## The principled design

**One global Vite dev server** roots the entire `reviews/` tree at `base='/r/'`,
serving every slug's every immutable version as an MPA entry; one separate HMR
server per live draft.

- **HMR off for published:** `server.hmr:false` is necessary but NOT sufficient —
  Vite still injects the `@vite/client` script (boots a WS, logs noise). Clean fix:
  a post-order `transformIndexHtml` plugin strips that tag from version mounts.
  Proof: published `/v5/` console = 0 errors/0 warnings. Draft keeps the client +
  hot-reloads.
- **External cacheDir:** points outside the version source. Version dirs are
  `chmod -R a-w`; the server provably never writes them (immutability SVC-R10 holds).
- **`server.watch:null`** on published versions (immutable source never changes) —
  removes chokidar entirely.

## Cost (the crux) — one server, not per-version

Vite's `getConfigHash` hashes `root` but **not `base`**, so a shared cacheDir
across per-version servers (different roots) THRASHES (re-optimizes per mount). The
real lever is **one server, one `root` → one configHash → one prebundle.**

| Approach | RSS | warm 15 | prebundles | eviction |
| --- | --- | --- | --- | --- |
| N servers, per-version cacheDir (m1-shape) | 2109 MB | 4718 ms | 15 | needed |
| **1 server, all versions (recommended)** | 575 MB (686 w/ draft) | 290 ms | 1 | not needed |

RSS is **flat in both the version and slug dimensions** (one server rooted at
`reviews/` serving 2 slugs × 3 versions = 652 MB, 1 prebundle, correct per-slug
isolation, `/r/` mapping verified). So SVC-R20 eviction is demoted from "required" to an
optional graceful lever (huge trees, idle draft servers).

## Decision interactions

- **Revises 0007 / SVC-R17:** published = served from immutable source via the same dev
  server (HMR-stripped, watch-null), NOT `vite build`. OQ-SERVE → live-dev-server-
  from-source. (Decision 0029.)
- **0005 (router):** one server roots the whole tree; slug/version dispatch is
  `base='/r/'` + Vite MPA mapping, not a per-version mount map. `latest` 302 unchanged.
- **0006 (deps):** `noDiscovery:true` → the `include` list must enumerate the entire
  shared dep closure (service is the single dep owner). One shared prebundle for the
  whole fleet is a bonus.
- **0027 (providers):** proven — `ssrLoadModule` loads a TS provider and runs its
  Effect on an HMR-off/watch-null server. One server = one shared SSR realm across
  versions (fine for immutable/frozen; per-version isolation is a note for LIVE
  providers).
- **SVC-R21/OQ-FSALLOW widens:** one server's `fs.allow` is the whole reviews tree (each
  version can `/@fs` every other's source). Acceptable under trusted-author tailnet
  (0009) but declared.

## Static/single-file export: optional, not primary

Per MED.DATA-R29 a frozen review makes zero `/_data/` calls, so a published-and-frozen
version needs no provider runtime at serve time — a static/single-file export stays
worthwhile as an OPTIONAL durable offline/archival artifact (disaster recovery /
handoff), not the normal serving path.

## Gotchas / ranked open

1. Middleware-mode HMR WS — **resolved** (decision 0029, server impl): the draft's
   HMR runs over the shared service HTTP server via `hmr.{server, clientPort, path}`
   where `path` is a bare suffix Vite joins under the draft's multi-segment base
   (`/r/<slug>/draft/__vista_hmr__`) and `clientPort` keeps the browser client
   same-origin; each draft installs its own per-draft upgrade listener. Single-port
   multi-segment-base HMR is proven — there is NO multi-segment-base limitation and no
   stray `:24678`/`localhost:5173` port. Pairs with snapshot self-determination via a
   `@vite-ignore`d `import('./snapshot.json?import')` so the draft 404s → live and a
   published version serves the frozen snapshot.
2. Real rename-on-save editors could trip inotify; `usePolling` is the fallback.
3. Open: per-version provider isolation under one shared SSR realm (fine frozen;
   decide for live); draft-server lifecycle/eviction (the one server that costs
   RSS); whether `latest`/`draft` stay separate servers or fold in.
