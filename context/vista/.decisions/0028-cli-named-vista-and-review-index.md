# The CLI is named `vista`; reviews have a browsable index

> **Publish-transport detail superseded by [0065](./0065-control-plane-rpc-boundary.md) — publish goes over the `VistaControlApi` RPC boundary, not a `POST /_publish` HTTP endpoint. The `vista` name and browsable index stand.**

Status: accepted

## Context

The agent-facing CLI was provisionally `vr` (decisions 0002, 0005, 0007, spec).
Vista also lacked a review index — reviews were reachable only by known slug URL.
Both are settled here.

## Decision

- **The CLI is named `vista`** (not `vr`). Every app-scoped command takes an
  owner-local `<local-slug>` and derives the owner from `$ST_AGENT`; there is no
  owner flag. The operational surface includes `publish`, `new`, `rehydrate`,
  `open`, `retire`, `artifact get`, app diagnostics, `ask`, and `await`.
  `vista list` and fleet diagnostics remain global. This supersedes every `vr`
  reference in earlier decisions; decision 0077 defines the owner/source binding.
- **Apps have a browsable global index** (Q6=A). The service serves an index at
  `/` (and/or `/r/`) listing all Apps by owner/local slug, newest immutable
  static version, status line, Template, and last-updated. Active Apps link to
  owner-scoped `latest`. Retired Apps expose no `draft` or `latest` link but keep
  receipt-backed pinned `vN` history available. Receiptless versions remain
  withheld. `vista list` mirrors the same registry.
- A richer **gallery** (search, filter by status/template, recently-updated,
  retired toggle) is a deferred enhancement, not built.
- **`vista publish` is thin.** It invokes the running service through
  `VistaControlApi`; only the service holds the mounted providers used by freeze
  capture. The CLI aborts on an unreachable service instead of attempting a local
  publish. It owns presentation, not version, capture, build, or receipt logic.

## Consequences

- The index is cheap — the service already rebuilds the registry from disk (SVC-R18) —
  and directly answers "what reviews exist, and what needs my attention?" across
  all reviews, which compounds in value as reviews accumulate.
- Spec/CLI references to `vr` should read `vista` (the rename is authoritative
  here; existing files are corrected as they are next touched, to avoid colliding
  with the concurrent VRS edits).
