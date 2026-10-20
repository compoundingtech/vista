# Enforce the cheap doctrine invariants structurally; guide the rest

Status: accepted (Q13)

## Context

The review doctrine (root rule: the author absorbs verification cost; the reviewer
confirms, never reconstructs) is strongly evidenced by two investigations
([../02-medium/04-doctrine/.experiments/](../02-medium/04-doctrine/.experiments/)). The
spine is settled: a fixed skeleton (lead with the ask → archetype body →
settled/context), the seven questions every review must answer, archetype-matched
body structure, and narrative-default-with-interactivity-as-a-scarce-resource. The
open fork is *how much the system enforces it* — and agent discipline is precisely
what produces slop, so pure guidance is weak.

## Decision

Adopt the doctrine spine. Enforce the **cheaply machine-checkable** invariants
**structurally**, and keep the judgment-heavy ones as **taught doctrine**.

Structurally enforced (encoded in the content schema + a "slop linter"):

- ask-first / explicitly-informational (a review must surface its ask or declare
  itself informational);
- locked/open as a first-class structural axis, not a status string;
- evidence reachable from an ask (orphan sections are flagged);
- a decision-fork is invalid with <2 options;
- load-bearing claims should carry an evidence/citation reference;
- a provenance stamp (generator, inputs, timestamp).

Taught (doctrine guidance + kit conventions, not machine-gated): is the mental
model good and minimal; is each interactive control earned (Distill's gate); is
the structure the right archetype; is density well-layered rather than cluttered.

The slop linter is **advisory, not blocking**: it surfaces warnings on the review
(and to the agent) but does not refuse `publish`. A hard gate would fight
legitimate exceptions; the goal is to make good structure the path of least
resistance, not to block work.

## Consequences

- The kit/renderer gets concrete jobs: surface the ask, render locked/open as
  structure, warn on detectable smells (orphan section, fork <2 options, uncited
  claim, missing provenance).
- The content schema must make ask/locked-open/evidence-refs first-class fields,
  not optional prose (informs `03-authoring` + `07-review-doctrine`).
- Advisory-not-blocking keeps escape hatches open; chronic warnings are a signal,
  not a wall.
- The judgment-heavy invariants live in the skill/doctrine docs and are evaluated
  by humans, not the linter.
