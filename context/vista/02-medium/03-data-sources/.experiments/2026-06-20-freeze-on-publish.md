# Experiment: freeze-on-publish options (2026-06-20)

Empirically settles OQ-FREEZE-DEFAULT (capture mechanism + default policy + the
indicator UX), building on the data-layer prototype. Throwaway:
`/home/schickling/vista-build/proto-freeze/` (`tsc` green; 16/16 harness checks; 4
proof screenshots in `.proof/`). → decision 0031.

## Capture mechanism: auto-capture, NOT declared (load-bearing)

A block whose arg is derived at runtime (`vista-service-20`) proves it: **auto-capture**
records the real provider call and stores the result under the *exact* `snapshotKey`
the viewer recomputes → round-trip green. A hand-**declared** plan with a plausible
stale literal (`vista-service`) computes a *different* key → frozen miss → view-time
error. A declared plan is a parallel list that drifts the moment args are computed
(a diff for PR #X; a service derived from the target node; one provider reused with
two arg sets). Auto-capture has no parallel list to drift → params handled
automatically.

Design (`service/capture.ts`): a `recordingCore` wraps each provider's `core`; the
publish **capture pass executes the review's frozen blocks**, `Schema.encode`s each
result with the live success schema, scans for secrets, and stores under the shared
`snapshotKey`. Per-block outcome is a tagged union (`captured` / `failed` /
`secret-blocked`) — nothing fails silently. The block descriptor
`{providerId, rpcTag, args, mode?}` is the single source of truth for both capture
and view.

## Default policy: freeze-by-default + opt-in live

Reproducibility is the durable property of a published version (T06); live is
explicitly non-durable. The divergence proof (`.proof/04`): after the underlying
data flips A→B, a frozen panel honestly shows "as of 07:18 · 99.5% GREEN" while a
live panel shows "● LIVE · 42% RED". Defaulting to live would silently mutate a
published review's meaning after the fact. All three policies (freeze-default /
live-default / per-block) are **one binding** (`defaultMode` + per-block `mode`
override), not three code paths — so the default is a one-line policy bit.

## Indicator UX (MED.DATA-R30)

Per-panel badge: "❄ FROZEN · as of <time>" vs "● LIVE · just now", and whether the
mode came from the policy `default` or a per-block `override`. Screenshots
`.proof/01-04`.

## Secrets (MED.DATA-R31)

Value-scan over the encoded payload caught a planted `sk-…` canary at `$.note`. The
principled version is a Schema-level `Redacted`/`Sensitive` brand whose codec can't
encode the secret; recommend **schema annotation as primary + value-scan as
defense-in-depth**.

## Ranked open decisions (→ OQ-DATALAYER residuals)

1. **Capture executes real calls → side-effects.** Mark providers `pure` vs
   `effectful`; auto-capture only `pure` ones (or require freeze-safe read replicas).
2. **Secret guard:** Schema `Redacted` brand (primary) + value-scan (backstop).
3. **Freeze failure:** `abort` (reproducible-or-nothing) as default; `partial`
   opt-in for best-effort dashboards.
4. **Args hashing:** canonicalize (sort keys) before hashing `snapshotKey` so
   semantically-equal args collide correctly.
5. **Live override in a published `vN`** resolves *current* provider source — fine
   because live is non-durable; ratify.
