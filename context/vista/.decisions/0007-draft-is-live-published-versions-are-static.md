# Draft is live; published versions are static snapshots

> **Serving clause superseded by [0029](./0029-published-served-from-source-via-one-dev-server.md) — published versions are served live from immutable source via the dev server, not as static-built snapshots. The draft-is-live / versions-are-immutable core stands.**

Status: accepted (platform spike evidence)

## Context

Immutable versions (decision 0004) and live authoring are in tension: the agent
needs a hot-reloading surface while iterating, but a published version must never
change. The spike proved per-version live Vite instances work but are expensive
(N× dep prebundle, per-version watchers, connect's no-unmount leak).

## Decision

Exactly one **live** surface per review — the **draft** (`_staging/` mounted at
`/r/<slug>/draft/`) — runs a live Vite dev server with HMR. `vr publish` freezes
the draft into the next immutable `vN`. Published versions are served as **static
snapshots** (built assets), not live dev servers. The live Vite server is reserved
for the draft only.

Proven: N=2 reviews on one port hot-reload independently, each on its own HMR path
sharing one server `upgrade` event — so multiple drafts can be live at once
without per-version dev-server cost for published versions.

## Consequences

- Avoids N× esbuild/Babel prebundle, per-version watchers, and the append-only
  connect leak for the (unbounded, growing) set of published versions.
- The build-on-publish step is where freeze-on-publish for live data panels is
  applied (OQ-FREEZE-DEFAULT) and where static assets are produced.
- The draft is the only mutable surface; it is not a durable/citable URL.
- The exact static-build mechanism (per-version `vite build` output vs an
  inlined single-file artifact) is a spec detail; OQ-SERVE tracks the choice.
