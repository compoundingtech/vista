# Freeze-by-default on publish, via auto-capture

> **Amended:** publish runs over the `VistaControlApi` RPC boundary (decision
> [0065](./0065-control-plane-rpc-boundary.md)), not `POST /_publish`, and
> publication is all-or-nothing (decision
> [0075](./0075-published-versions-are-self-contained-static-directories.md)); the
> `partial` best-effort failure mode is retired. The freeze-by-default policy,
> auto-capture mechanism, indicator, and secret guards stand.

Status: accepted

Evidence: the freeze-options spike; settles the freeze-default question.

## Context

A review's data-backed blocks can be served live (provider call at view time) or
frozen (snapshot inlined at publish). The default policy and the capture mechanism
were open. The freeze spike
([../02-medium/03-data-sources/.experiments/2026-06-20-freeze-on-publish.md](../02-medium/03-data-sources/.experiments/2026-06-20-freeze-on-publish.md))
settled both empirically.

## Decision

- **Default = freeze-by-default + opt-in live.** Reproducibility is the durable
  property of an immutable version (decision 0004, T06); `publish` freezes each
  data-backed block by default, and a block can set `mode:'live'` to stay live
  (genuinely-live panels). All three policies are **one binding** (`defaultMode` +
  per-block `mode` override), not three code paths — the default is a one-line
  policy bit. Proven: after underlying data flips A→B, a frozen panel honestly shows
  "as of <publish time>" while a live panel shows the new value; defaulting live
  would silently mutate a published review's meaning.
- **Capture = auto-capture, not declared.** At publish, a **capture pass executes
  the review's frozen blocks** through a `recordingCore` that wraps each provider's
  `core`, `Schema.encode`s the result with the live success schema, and stores it
  under the **exact `snapshotKey` the viewer recomputes**. Proven load-bearing: a
  block deriving its arg at runtime round-trips only under auto-capture; a
  hand-declared plan drifts (stale literal → key mismatch → frozen miss). Per-block
  outcome is a tagged union (`captured` / `failed` / `secret-blocked`) — nothing
  fails silently. The block descriptor `{providerId, rpcTag, args, mode?}` is the
  single source of truth for capture and view.
- **Indicator (MED.DATA-R30):** per-panel badge "❄ FROZEN · as of <time>" vs "● LIVE · just
  now", plus whether the mode came from the policy default or a per-block override.
- **Secrets (MED.DATA-R31):** schema-level `Redacted`/`Sensitive` brand as the primary guard
  (codec can't encode the secret) + a value-scan backstop over the encoded payload
  (proven catching a planted `sk-…` canary).
- **Failure mode:** all-or-nothing. A capture failure on any frozen block aborts
  the whole publication before any version is exposed; there is no partial or
  best-effort mode that publishes some blocks and records the rest as failures.
  Per-block outcomes remain a tagged union so the aborting failure is precise.

## Consequences

- Capture executes real provider calls → providers must be marked **`pure` vs
  `effectful`**; auto-capture only `pure` providers (refuse effectful, or require a
  freeze-safe read replica). Residual for 05-data-sources.
- `snapshotKey` must **canonicalize args** (sort keys) before hashing so
  semantically-equal args collide.
- A live override in a published `vN` resolves the *current* provider source — fine
  because live is non-durable; ratified.
- Implements MED.DATA-R28–MED.DATA-R30; the service's `publish` owns the capture pass + secret assert.
- **Publication runs in the service as one transaction.** Because only the
  standing service holds the mounted providers the capture pass replays, `vista
  publish` calls the service-owned `VistaControlApi` procedure; the service owns
  version allocation, capture, secret assertion, build, verification, and atomic
  exposure, and returns either the complete receipt-backed version or nothing.
  The CLI is thin and **aborts on an unreachable service** rather than attempting
  a local publish (decisions 0028, 0065, 0075).

## Amendment 1 — Three author-declared modes

The default remains frozen and effectful capture still requires explicit
acknowledgement. Binding policy now has three author-declared modes:
`frozen`, `live`, and `subscription`.

- A published frozen binding never becomes live and exposes no refresh
  capability.
- A live binding ships the same publish-time Snapshot used for instant paint,
  then refreshes according to its policy.
- A subscription binding ships a folded Snapshot and cursor, then connects
  automatically, catches up, and remains live.

The descriptor recorded in SemanticManifest is `(Operation, encoded arguments,
BindingPolicy)` rather than the historical `defaultMode`/per-Block override
shape. Provenance is rendered as Frozen, CatchingUp, or Live. The indicator
contract remains explicit, but its exact glyphs and relative-time wording are
presentation rather than durable semantics.
