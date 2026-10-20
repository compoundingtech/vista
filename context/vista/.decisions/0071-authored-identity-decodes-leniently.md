# Authored identity decodes leniently; the index projection is re-derivable

Status: accepted

## Context

Decision 0068 established that `meta.json` (a version's authored identity) is outside
the `apiVersion` version-gate, so identity keeps resolving across a global-contract
bump (SVC-R15). But identity must survive not only a *contract* bump — it must also
survive its own *schema* evolving. If a later change adds an identity field, an
existing JSON-valid `meta.json` that predates it must still decode; if the decoder
rejects the whole record on the missing field, the version collapses to the scan
placeholder (`author:'unknown'`, no title) — the exact identity loss 0068 forbids,
reached by schema-rejection instead of version-gating.

## Evidence and Argument

Identity is authority whose whole point is to outlive the code — and the schema —
that wrote it. The migration-avoidance stance 0061 applies to a contract bump
(no re-stamp) applies just as much to identity's *own* schema evolution: a new
identity field must be backward-tolerant, not a reason to drop the record. The
disposable frozen `snapshot.json` gets the opposite treatment — fail-closed on skew
(0061) — precisely *because* it is not authority; treating identity the same way
would be the category error 0068 corrected.

The index projection (`title`/`template`/`status`) is a different case again: it is
re-derivable from `doc.meta` at any time (SVC-R57), so it is never authority and its
absence is never a reason to reject a record — it is simply recomputed or falls back.

## Decision

- **Identity decode is lenient.** The authored identity fields
  (`author`/`timestamp`/`changeSummary`/`parent`) tolerate drift: a JSON-valid
  `meta.json` never rejects on a missing or extra identity field (defaults fill the
  gaps). A `meta.json` that is non-JSON (unparseable), or that is missing the
  structural identity keys (`slug`/`version`), is skipped (→ synthetic fallback);
  every other JSON-valid file resolves its authored identity, and a corrupt
  re-derivable projection field is dropped without taking identity down.
- **The index projection stays optional and droppable.** `title`/`template`/`status`
  are optional and re-derivable from `doc.meta` (SVC-R57); their absence never fails
  a decode.
- **Reinforces SVC-R15 / 0068.** Lenient identity decode is the no-re-stamp guarantee
  applied to identity's own schema evolution, the counterpart to the fail-closed
  treatment of the disposable version-gated snapshot (0061).

## Consequences

- Adding an identity field is backward-tolerant with no re-stamp and no migration: an
  older `meta.json` keeps resolving with the new field defaulted.
- A partially-drifted-but-JSON-valid `meta.json` keeps its present fields rather than
  collapsing wholesale to a placeholder; only a file that is unparseable or missing the
  structural identity keys (`slug`/`version`) falls back to the synthetic placeholder.
- Deliberate contrast with 0061: the disposable snapshot is fail-closed; authored
  identity is lenient — the two halves of the same migration-avoidance stance applied
  to their two data classes.
- Cross-references: 0068 (identity outside the version-gate), 0061 (disposable
  snapshot — fail-closed), 0004 (durability boundary), SVC-R12/SVC-R15 (identity
  authority), SVC-R57 (re-derivable projection).
