# Kit block additions to express the doctrine: ask, fork, status-line, settled

Status: accepted (integration spike evidence)

## Context

The integration spike
([../02-medium/04-doctrine/.experiments/2026-06-20-end-to-end-integration-doctrine-review.md](../02-medium/04-doctrine/.experiments/2026-06-20-end-to-end-integration-doctrine-review.md))
showed the kit's existing `Block` union cannot express the doctrine skeleton. The
four missing shapes were prototyped via the `custom` escape hatch (the documented
graduation path) and should graduate into first-class blocks.

## Decision

Add four doctrine-spine blocks to the kit:

- **`ask`** — THE ASK (BLUF): `recommendations[] {title, lean, evidenceRef,
  awaitingSignoff}` + `openQuestions[] {code, question, lean, evidenceRef}`. The
  most load-bearing missing block; encodes ask-first (decision 0012) structurally.
- **`fork`** — a decision-tree node: `axis` + `driver` + `branches[] {label, name,
  thesis, verdict: chosen|rejected|deferred, why, pros?, cons?}`. Replaces a flat
  `options-grid` for the options-comparison archetype, because the grid is a flat
  peer-card layout that cannot subordinate rejected branches or root the shared
  driver (decision 0012's "fork invalid with <2 options" + 0019's status buckets
  + Q16's shared-driver/proof_ref live here).
- **`status-line`** — N locked · M open · K awaiting, for the HEADER (projection of
  the per-decision status, decision 0019).
- **`settled`** — locked decisions, collapsed by default.

The existing `decision-log` *groups by status in place and auto-expands*; the
doctrine *places by status* (open→ASK, locked→SETTLED, collapsed). These coexist:
`decision-log` for an in-place status-grouped log; the doctrine spine blocks for
the ask-first placement.

## Consequences

- These graduate via the `custom`→first-class path (decisions 0008, 0016): each
  gets an `effect` Schema payload and a renderer `case`.
- `options-grid` stays for genuine flat side-by-side comparison where no fork
  subordination is needed; `fork` is the archetype block for options-comparison.
- The kit's `04-component-kit/05-review-blocks` family owns these; the renderer's
  exhaustive switch enforces completeness.
- The advisory linter reads `ask` / `fork` / status to check the doctrine
  invariants structurally.
