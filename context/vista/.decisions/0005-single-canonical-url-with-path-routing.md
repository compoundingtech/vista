# Single canonical URL with path routing

> **Routing mechanism amended by [0035](./0035-latest-is-a-follow-latest-route.md), [0075](./0075-published-versions-are-self-contained-static-directories.md), and [0077](./0077-owner-scoped-source-with-automatic-typed-receipts.md). Current managed routes use `/r/<encoded-owner>/<local-slug>/...`; `latest` follows the newest receipt-backed static version in place, pinned `vN` is static, and only `draft` uses Vite/HMR. The historical `<slug>` and per-version-Vite mechanism below describe the legacy decision input.**

Status: accepted

## Context

Vista needs review URLs that are durable, human-legible, and cheap to serve from
one standing service over a single Tailscale Service endpoint. The spike
([../01-service/.experiments/2026-06-20-hosting-lifecycle-deps-spike.md](../01-service/.experiments/2026-06-20-hosting-lifecycle-deps-spike.md))
tested the real options.

## Decision

One canonical host with **path routing**, not a fresh URL/port per review. A
single Node `http` + `connect` router on one port delegates by base-prefix to one
`vite.middlewares` instance per review version:

- `/r/<slug>/v<n>/` — immutable version mount
- `/r/<slug>/latest` — router-level **302** to the current version's mount
  (superseded by [0035](./0035-latest-is-a-follow-latest-route.md))
- `/r/<slug>/draft/` — the live-HMR draft surface (decision 0007)

`latest` is a redirect, not a second render, to avoid double-prebundling the same
content.

## Consequences

- One devnet/Tailscale URL for the whole system; durable per-version links.
- Vite `base` per mount rewrites module URLs correctly under the prefix.
- The append-only `connect` stack cannot evict mounts (OQ-EVICT); a real evictable
  router is needed for retire/stale reclamation.
- The old 302-for-`latest` consumer question is closed by
  [0035](./0035-latest-is-a-follow-latest-route.md): `/latest` is now a follow-latest
  route, while `vN` URLs remain the immutable durable links.
