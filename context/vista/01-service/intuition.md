# Service — Intuition

*For: humans and coding agents working on the Vista substrate · Assumes: familiarity with the [Vista charter](../requirements.md), Vite dev-server serving, and Effect · Covers: the mental model behind the service node — why one standing service, one Vite server, one canonical URL.*

Everything in Vista runs on one thing that is always up. The medium renders on it,
the CLI drives it, feedback attaches through it. That thing is the **service** — the
substrate. The one sentence is: **make the system thick so the agent stays thin.**

An agent authoring an app should own only its own content. Every generic concern —
mounting, serving, versioning, resolving dependencies, freezing live data — belongs
to a long-lived service the agent never has to stand up. Per-app infrastructure
setup is exactly what a substrate exists to erase. So the service, not the CLI, holds
the mounted providers, allocates versions, captures freezes, and answers control RPCs
over a loopback transport; the CLI aborts rather than trying to publish on its own.

The serving model separates authoring from publication. **One Vite dev server**
provides the live, hot-reloading draft surface. Publishing builds canonical React
source once into a verified, self-contained static directory at the version's
canonical base path; the standing service then serves that immutable directory
through a generic static-file runtime without TSX/source evaluation or ambient
workspace dependencies (decision 0075). This makes published behavior a property
of the staged artifact rather than the service's current toolchain state.

Durability begins with exact identity: canonical owner × owner-local slug. Each
publish appends an immutable static version and advances `latest`. Retirement
hides `draft` and `latest` but keeps receipt-backed pinned `vN` links available.
The frozen-data projection is durable *within one contract version* — a rare
`apiVersion` bump is a clean namespace cutover with an accepted data-loss contract, not
a migration engine. What Vista surfaces to a human is always the **canonical tailnet
URL**, never the loopback address the CLI happens to dial.

Under the hood the host is **Effect-native at the request boundary** while Vite keeps
the upgrade/WebSocket boundary — one idiom end to end for publish, freeze, registry,
and provider mount, without disturbing the HMR handshake production already depends
on. That split is not incidental; it is the seam that lets the service carry a real
OTel tracer and compose the freeze pass as one connected trace.

This document is not normative. If a statement here becomes a testable constraint,
promote it to [requirements.md](./requirements.md); if it becomes mechanism, put it in
[spec.md](./spec.md) or a decision under `../.decisions/`.
