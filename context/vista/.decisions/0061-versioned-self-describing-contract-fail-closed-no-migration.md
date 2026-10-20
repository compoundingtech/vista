# Versioned self-describing contract, fail-closed, with no migration machinery

Status: accepted

## Context

Vista's wire payloads (control RPC, interview) and persisted artifacts (`meta.json`,
frozen app/data snapshots) carried no uniform version marker — only
`runtime-policy` stamped a local `schemaVersion`. A packaged `vista` CLI and the
standing service deploy independently (`vista:packaged-smoke` proves a packaged
binary exists), so wire skew is real; and persisted snapshots outlive the code
that wrote them. Without a version marker, a shape change is a silent
mis-decode. The question was how much versioning + compatibility machinery to
build.

## Evidence and Argument

Vista is single-user, tailnet-only, trusted-author (A01/A02). Global contract
bumps are rare in practice. Under `/sk-patterns-migration-avoidance`, persisted
vista state classifies as follows: the app **identity and immutable source**
are authority (never migrated, 0004); the **frozen data snapshots** are
contract-namespaced, disposable projections. The migration-avoidance rubric
favors a fresh namespace + accepted, bounded data loss over migration machinery
when old state is not durable authority, all readers/writers cut over together,
and rollback is a pointer reversal — all true here. Building a coercion/compat
matrix for a rare event on a single-consumer contract is unjustified complexity.

## Options

| Option | Tradeoffs |
| --- | --- |
| Self-describing + fail-closed + no migration (chosen) | One version axis; zero migration/coercion code; old-version snapshots unsupported after a (rare) bump — an accepted, written data-loss contract. |
| Coerce / compat matrix | Old snapshots keep rendering across bumps; but a full forward-transform matrix to build and maintain — a migration machine for a rare event. |
| Per-contract versions | Finer-grained; a frozen snapshot declares only its own schema version. Rejected here for simplicity — one global number is enough for a single-consumer contract. |

## Decision

- **One global `apiVersion`.** A single integer versions the entire vista
  contract (control RPC, interview, runtime-policy, and persisted snapshots),
  bumped when any covered shape changes.
- **Self-describing everywhere.** Every wire payload and every persisted artifact
  is wrapped in one shared `{ apiVersion, payload }` envelope helper (schema
  transform), on the wire *and* on disk. Nothing is decoded blind.
- **Fail-closed everywhere.** A reader rejects any non-current `apiVersion` with a
  typed `VersionSkew` error — on the wire and on read of a persisted snapshot.
  There is no coercion, forward-transform, or multi-version reader. Writing
  migration/compat code is explicitly out of scope (migration-avoidance).
- **The global version is the namespace; a bump is a cutover, not a migration.**
  New snapshots are written under the new version; existing snapshots are neither
  re-stamped nor migrated. App identity and immutable source are untouched
  (0004), but frozen snapshots published under an older `apiVersion` become
  **unsupported** after a bump.
- **Data-loss contract (explicit):** on a global-version bump, previously-published
  apps' frozen data may stop rendering and are not recovered. This is accepted
  because bumps are rare; the alternative (migration machinery) is deliberately
  not built. Amends 0004 (see its Amendment section) and narrows the vision's
  "trust the artifact over time" for the cross-version case (recorded as a delta;
  `vision.md` is human-owned).

## Consequences

- The real skew that exists — a packaged CLI against a newer/older service — is
  caught loudly with a typed error instead of a silent mis-decode.
- Zero migration/compat code to write, test, or carry. Simplicity is the point.
- A global-version bump is an operational event with a known blast radius
  (old-version apps unsupported); it should be rare and deliberate, and the
  bump PR must say so.
- The envelope helper is one schema-transform reused across every contract and
  the persisted stores — a single place that defines "what version is this."
- A version-skew test (wire) and an old-snapshot-rejection test (disk) are
  required (epic Track F).
- Cross-references: 0027 (freeze keystone — the frozen payload is now enveloped),
  0065/0038/0039 (control/interview wire), 0004 (durability boundary), 0044
  (runtime-policy `schemaVersion` folds into the global version).

## Amendment (0068)

The "every persisted artifact is wrapped ... on disk" and "fail-closed ... on read
of a persisted snapshot" clauses are narrowed by **0068** to the disposable
contract class (the frozen `snapshot.json`) only. Authored identity (`meta.json`)
is authority, not part of the versioned contract: it is schema-decoded but never
`apiVersion`-gated, so it keeps resolving across a bump (SVC-R15/0004). This aligns
the decision with its own evidence (identity is authority; frozen data is the
version-namespaced projection) and keeps the no-migration/no-re-stamp guarantee.

