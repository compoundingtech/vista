# Coexist with annotation tools; may supersede plannotator later

Status: accepted (Q10)

## Context

We already own human→agent annotation surfaces (`plannotator`, `agentation`; see
[../.reference/annotation-tools-prior-art.md](../.reference/annotation-tools-prior-art.md)).
Vista is agent→human rendering (decision 0001). The vision must state the intended
end-state so we don't build overlapping systems.

## Decision

Near-term: **coexist with distinct roles.** Vista renders (agent→human); the
annotation tools capture (human→agent). They compose — a human can annotate a
Vista view via those tools — and Vista does **not** grow its own general feedback
capture now (decision 0013 carves only a bounded structured-answer exception).

Vision: convergence is named as a *possible* future, not committed. Once Vista
grows the later feedback-capture phase (roadmap), a markdown-review layer on top
of Vista's rich rendering (roughdraft.md-style) could **supersede `plannotator`'s
niche**. `agentation`-style live UI annotation is the model for that eventual
phase (thin agent surface, system does the work).

## Consequences

- Requirements stay clean (render-only now); the ambition is recorded in vision +
  roadmap without forcing architecture today.
- No duplicate general feedback-capture system is built near-term.
- If/when Vista adds capture, revisit this decision and the plannotator boundary.
