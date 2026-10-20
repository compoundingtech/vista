# No hard evidence-opened gate before sign-off; advisory only

Status: accepted (OQ-DOCTRINE sub-2; recommended default, reversible)

## Context

A tidy ask checklist can induce rubber-stamping — a reviewer signs off without
opening the evidence. Should the doctrine *gate* a sign-off on the reviewer having
opened the relevant evidence?

## Decision

**No hard gate.** Vista does not block or withhold a sign-off on whether evidence
was opened. Rationale:

- It contradicts the advisory-not-blocking stance (decision 0012) — a hard gate
  fights legitimate fast ratification of a clear lean.
- The structured-answer channel (decision 0013) already *records the choice* and
  the reviewer can answer in place; the anti-rubber-stamp work is better served by
  making evidence one click away (MED.DOC-R34) and by the one-line lean honestly labeling
  recommendations, than by a gate.
- Tracking "did the human open the evidence" is weak signal and adds ceremony.

The renderer **may** offer a soft affordance (e.g. a subtle "evidence unopened"
hint next to an awaiting-sign-off item) — advisory, never blocking.

## Consequences

- Sign-off stays low-friction; rubber-stamp risk is mitigated by evidence
  proximity + honest leans, not by gating.
- Revisit if the bounded-answer phase (decision 0013) ships and rubber-stamping
  proves a real problem in practice.
