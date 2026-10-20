# Archetype is agent-declared, human-overridable, with an advisory cross-check

Status: accepted (Q15)

## Context

The review doctrine selects a body structure by **archetype**
(architecture-review, options-comparison, plan-signoff, telemetry-exploration,
code-recap). A mis-selected archetype silently picks the wrong body doctrine and
reproduces slop, so how the archetype is determined is load-bearing. Options:
agent-declared, inferred from content shape, or human-selected.

## Decision

The agent **declares** the archetype at author time, and the schema **requires**
it — making it a conscious authoring decision, not a silent default. A human can
override. The slop linter (decision 0012, advisory) **cross-checks** the declared
archetype against content shape and warns on mismatch (e.g. "declared
`architecture-review` but there is no system map and two options-grids — did you
mean `options-comparison`?"). The mismatch is an advisory warning, not a publish
block (consistent with 0012). Inference is a *hint*, never a silent driver.

## Consequences

- Choosing the archetype forces the agent to decide what kind of review this is —
  half the anti-slop battle.
- Reuses the linter from 0012; no new enforcement machinery.
- The content schema must carry a required `archetype` field (informs
  `03-authoring` and `07-review-doctrine`).
- Inference logic, if built, only powers the advisory cross-check, not selection.
