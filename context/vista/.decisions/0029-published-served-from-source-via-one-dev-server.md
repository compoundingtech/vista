# Published versions served from immutable source via one dev server

> **Dependency-serving clause superseded by [0052](./0052-render-via-rolldown-bundled-dev-everywhere.md) — Vite dep optimization uses GA auto-discovery (`optimizeDeps: {}`), not `noDiscovery` plus a hand-maintained `include` list. The one-global-dev-server core stands.**

> **Published-serving amendment: superseded by [0075](./0075-published-versions-are-self-contained-static-directories.md). Only owner-scoped drafts use Vite/HMR. Published `vN` and `latest` serve receipt-backed self-contained static directories; a receiptless or invalid publication returns HTTP 409 without Vite fallback. The draft/HMR findings below remain historical input.**

Status: superseded by 0075

The draft/HMR spike evidence below remains historical input only.

## Context

Decision 0007 said published `vN` are static-built snapshots. The user's direction
was to always use the Vite dev server (no `vite build`), since the dev-server
runtime is needed for providers (decision 0027) anyway. The spike
([../01-service/.experiments/2026-06-20-always-dev-server-serving.md](../01-service/.experiments/2026-06-20-always-dev-server-serving.md))
proved this viable and cheaper than `vite build`.

## Decision

The service serves ALL versions (published + draft) from their **immutable source**
via the Vite dev server — no `vite build` step. Published = source served read-only;
draft = source served with HMR.

- **One global Vite dev server** roots the entire `reviews/` tree at `base='/r/'`,
  serving every slug × version as an MPA entry. One separate HMR server per live
  draft. (Revises 0005: dispatch is `base='/r/'` + Vite MPA mapping, not a
  per-version mount map; the `latest` 302 clause is later superseded by
  [0035](./0035-latest-is-a-follow-latest-route.md).)
- **Published has no HMR:** `server.hmr:false` + a `transformIndexHtml` plugin that
  strips the injected `@vite/client` script (necessary — `hmr:false` alone still
  injects it). Published console is clean. Draft keeps the client + hot-reloads.
- **Draft-live mechanism (the live authoring surface under one global server).** The
  draft authors against the same source a published `vN` freezes from; two mechanisms
  let one global server host it without a per-draft server/port:
  - **Snapshot self-determination.** A review resolves its own mode at runtime via a
    `@vite-ignore`d dynamic `import('./snapshot.json?import')`: published ships an
    immutable `snapshot.json` (→ frozen, zero `/_data/` calls, MED.DATA-R29), the draft has
    none (the import 404s → live). `@vite-ignore` is load-bearing — a static `import`
    of a draft-absent file breaks the whole module instead of 404ing cleanly.
  - **Same-origin HMR.** The draft's HMR runs over the **shared service HTTP server**
    via `hmr.{server, clientPort, path}`, where `path` is a bare suffix Vite joins
    under the draft's multi-segment base (`/r/<slug>/draft/__vista_hmr__`, slug-unique)
    and `clientPort` keeps the browser client same-origin. Each draft installs its own
    per-draft upgrade listener on the shared server, so concurrent live drafts route
    with no custom dispatcher. **This supersedes the earlier (incorrect) framing that a
    multi-segment base forced the draft onto its own server/port** (e.g. a stray
    `:24678`); single-port multi-segment HMR is proven. Resolves the local-HMR half of
    OQ-DEPLOY-HMR (the `tailscale serve` WS half stays open).
- **Immutability + cacheDir placement:** the Vite `cacheDir` must be a **SIBLING of
  the reviews root, never under it** — not merely outside the version source. The
  global server roots at `reviews/` with `base='/r/'`; a cache under `root` is
  addressed as `/r/.vite-cache/...deps/*.js`, so the prebundled-deps requests 404
  (the optimizer URL ≠ where the middleware serves them). One shared cache for the
  published fleet (one `root` → one configHash → one prebundle); each draft gets its
  own subdir. Version dirs read-only; `server.watch:null` on published (immutable
  source). SVC-R10 holds.
- **Cost:** one server / one `root` → one configHash → **one prebundle** for the
  whole fleet (Vite hashes `root`, not `base`). Measured 575 MB / 290 ms vs
  2109 MB / 4718 ms for per-version servers; RSS flat across versions AND slugs. So
  SVC-R20 eviction is demoted from required to an optional graceful lever.
- **Deps (0006):** `optimizeDeps.noDiscovery:true` + an `include` list enumerating
  the whole shared dep closure (the service is the single dep owner).

## Consequences

- No build step at publish; publishing is freezing source (+ `freeze()` of live
  data, 0027). One serving path for draft + published; providers mount for free.
- The dev-server runtime is a serve-time dependency. A static/single-file export
  stays worthwhile as an OPTIONAL durable offline/archival artifact for
  frozen reviews (which make zero `/_data/` calls, MED.DATA-R29), not the normal path.
- `fs.allow` widens to the whole reviews tree (each version can `/@fs` others'
  source) — acceptable under trusted-author tailnet (0009), declared (SVC-R21).
- One shared SSR realm across versions — fine for immutable/frozen providers;
  per-version isolation is an open note for live providers.
- Supersedes 0007's "static-built snapshots"; OQ-SERVE resolves to
  live-dev-server-from-source.
