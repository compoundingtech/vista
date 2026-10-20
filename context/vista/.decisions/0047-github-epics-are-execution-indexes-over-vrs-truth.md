# GitHub epics are execution indexes over VRS truth

Status: accepted (Vista misc6 alignment)

## Context

Issue #1214 is the long-lived tracker for Vista infra hardening and
block-system maturation. It contains workstreams, checkboxes, starter interview
questions, and cross-links to related efforts. Those are useful for coordination,
but several entries were already superseded by later Vista VRS decisions and
implementation evidence from misc5.

Vista already treats VRS as the intent layer: durable goals, requirements,
tradeoffs, decisions, experiments, deltas, open questions, and specification live
under `context/vista`. If the GitHub epic becomes a second source of design truth,
agents can drift between issue prose, VRS, and code.

## Decision

GitHub Vista epics are **execution indexes over VRS-owned truth**.

- The owning source of truth for Vista goals, problems, tradeoffs, design,
  requirements, decisions, open questions, deltas, and experiment evidence is
  `context/vista/**`.
- Issue #1214 tracks current workstreams, milestone status, links, checkboxes,
  and pointers to the owning VRS artifacts.
- When work resolves or changes a durable Vista fact, update VRS first in the
  correct artifact (`spec`, `requirements`, `.decisions`, `.experiments`,
  `.delta`, or `open-questions.md`), then update the issue as an index.
- The issue should avoid duplicating normative VRS prose except as short summaries
  or links. If issue text and VRS conflict, VRS wins and the issue must be pruned
  or annotated.
- Experiments may run in isolated temporary roots, but accepted evidence that
  affects Vista truth is captured under `context/vista/.experiments/` and linked
  from the issue.

## Options

| Option | Tradeoffs |
| --- | --- |
| Execution index over VRS-owned truth | Keeps GitHub useful for coordination while preventing split-brain design authority. Requires disciplined VRS updates and periodic issue pruning. |
| Epic as temporary source of truth | Faster for ad-hoc iteration, but lets issue prose drift from VRS and merged code. |
| VRS only; issue only links to VRS | Cleanest authority boundary, but less useful for project tracking and status scanning. |

## Consequences

- Vista work should land VRS changes alongside implementation milestones, not as
  a later cleanup pass.
- Issue #1214 should be kept current as work proceeds, but its job is status and
  routing, not durable design ownership.
- Before milestone commits or pushes, agents should check whether the issue needs
  a status/link update and whether any resolved issue text belongs in VRS instead.
- Starter interview prompts in the issue are treated as backlog prompts. Once
  answered by VRS or implementation, they should be removed, checked off, or
  replaced with links to the owning VRS records.
