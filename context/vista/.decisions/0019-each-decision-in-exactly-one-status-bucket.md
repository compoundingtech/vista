# Each decision occupies exactly one status bucket

Status: accepted (integration spike evidence; resolves OQ-DOCTRINE sub-question 4)

## Context

The doctrine surfaces decisions in THE ASK (open questions + recommendations
awaiting sign-off) and in SETTLED (locked). The integration spike
([../02-medium/04-doctrine/.experiments/2026-06-20-end-to-end-integration-doctrine-review.md](../02-medium/04-doctrine/.experiments/2026-06-20-end-to-end-integration-doctrine-review.md))
hit a real ambiguity: the `cl2-storm` source had *locked* the headline architecture
axis, yet the review wants it *awaiting sign-off*. A naive model placed it in both
ASK and SETTLED and double-counted the status line. This also answers the
hybrid one-ask-vs-ask-per-axis question.

## Decision

A decision occupies **exactly one** status bucket: `locked` | `open` |
`awaiting-sign-off`. The status line (`N locked · M open · K awaiting`) and the
placement (ASK vs SETTLED) derive from that single field; nothing is double-placed
or double-counted.

- `awaiting-sign-off` > `locked` when both could apply: if the author wants the
  reviewer to ratify a choice, it belongs in THE ASK as awaiting-sign-off, not in
  SETTLED — even if upstream notes "locked" it. "Locked" in SETTLED means *settled,
  no sign-off sought*.
- Multi-axis reviews keep **one ASK section** (no per-axis duplication); each axis
  contributes its decision(s), each in exactly one bucket. This is the resolution
  of one-ask-vs-per-axis: one ASK, decisions bucketed by status.

## Consequences

- The schema gives each decision a single `status` enum; ASK/SETTLED placement and
  the status line are projections of it — the advisory linter can check the
  partition (no decision in two buckets, counts consistent).
- Resolves the locked-vs-awaiting overlap and the one-ask-per-axis question
  together.
- Informs the `AskBlock` / `SettledBlock` / `StatusLine` additions (decision 0020).
