# Contract version-gate excludes authored identity

Status: accepted

## Context

Decision 0061 established one global `apiVersion` carried by every wire payload
and persisted artifact, read fail-closed. Its *evidence* already split persisted
state into two classes — **authored identity + immutable source** (authority,
never migrated, 0004/SVC-R15) versus **frozen data snapshots** (contract-namespaced,
disposable projections). But its *decision* clauses said "every persisted artifact
is wrapped ... on disk" and "fail-closed ... on read of a persisted snapshot",
which literally pulls a version's `meta.json` into the version-gate.

Enforcing that is self-contradictory: `meta.json` holds authored identity
(slug/version/author/timestamp/changeSummary/parent, SVC-R12) plus a re-derivable
index projection. If it were envelope-version-gated and read fail-closed, the very
first envelope introduction — and every later bump — would drop every existing
version's identity to a placeholder (`author:'unknown'`, no title), which SVC-R15
and 0004 forbid ("a version link must keep resolving to that version's identity
and immutable source"). The only way to keep identity durable *and* fail-close it
would be a one-time re-stamp step at every cutover — i.e. the migration machinery
0061 exists to avoid (`/sk-patterns-migration-avoidance`). (Raised as
OQ-META-ENVELOPE.)

## Evidence and Argument

The `apiVersion` versions the *contract* — the shapes that two independently
deployed parties (a packaged CLI, the standing service) or a code-vs-disk pair
must agree on: control RPC, interview, runtime-policy, and the frozen snapshots.
Authored identity is not a contract shape negotiated across a skew; it is durable
authority whose whole point is to outlive the code that wrote it. Fail-closing on
a version mismatch only makes sense where **data loss on skew is acceptable** —
the disposable class. Identity is never disposable, so it is never fail-closed.

This is not a new class of persisted state (no migration, no re-stamp): identity
stays plain and is still schema-decoded, so a genuinely malformed `meta.json` is
skipped, never force-cast — it simply is not `apiVersion`-gated.

## Options

| Option | Tradeoffs |
| --- | --- |
| Identity outside the contract-scope (chosen) | `apiVersion` gate covers wire + the disposable frozen snapshots only; `meta.json` stays plain + schema-decoded, durable across bumps. Zero migration; honest ontology (identity ≠ contract). Cost: `meta.json` does not literally carry `apiVersion`, a deviation from 0061's original "every artifact" wording (resolved by narrowing that wording). |
| Envelope `meta.json` + re-stamp at cutover | `meta.json` self-describes; but a bump must re-stamp every existing identity to preserve it — a one-time migration step at every cutover, the exact machinery 0061 avoids. Rejected. |
| Self-describing but version-tolerant identity | `meta.json` carries `apiVersion` for provenance yet is never fail-closed on it. Rejected: it carries a version it never enforces (inert stamp) and invites future drift back toward fail-closed identity. |

## Decision

- **The `apiVersion` version-gate covers the contract class only:** every wire
  payload and every persisted **disposable** artifact (the frozen `snapshot.json`)
  is enveloped and read fail-closed.
- **Authored identity is never `apiVersion`-gated.** A version's `meta.json` is
  authority (identity + the re-derivable index projection): schema-decoded (a
  malformed file is skipped, never force-cast) but not enveloped and not
  version-gated, so it keeps resolving across a bump (SVC-R15, 0004).
- **Amends 0061.** Narrows 0061's "every persisted artifact ... on disk" /
  "fail-closed ... persisted snapshot" clauses to the disposable class — bringing
  the decision in line with 0061's own evidence (identity is authority, disposable
  frozen data is the version-namespaced projection). No re-stamp, no migration.

## Consequences

- OQ-META-ENVELOPE is resolved; the shipped behavior (meta.json plain + durable,
  snapshot.json enveloped + fail-closed) is now the ratified contract, not an
  interim deviation.
- `VST-R66` is reworded to "every persisted **contract** artifact"; identity is
  explicitly carved out.
- The version-gate's blast radius on a bump is exactly the disposable frozen data
  (which may stop rendering, 0061's data-loss contract) — never identity.
- Cross-references: 0061 (amended), 0004 (durability boundary), SVC-R15/SVC-R12
  (identity authority), 0027 (frozen keystone — the enveloped class).
