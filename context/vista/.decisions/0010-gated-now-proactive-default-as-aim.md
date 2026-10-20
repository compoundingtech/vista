# Gated render-only now, proactive default as a vision aim

Status: accepted (Q8)

## Context

The motivating problem is that the only agent→human medium today is terminal
text, which degrades as complexity grows. That argues for Vista becoming a richer
*default* channel. But publishing a web artifact carries more ceremony than
printing text, and proactive-everywhere risks over-use and noise — comparable
systems spend large prompt budgets fighting over-use.

## Decision

A vision-vs-spec split:

- **Vision:** Vista aims to become a genuinely better default medium that grows to
  cover more of agent→human communication as the kit matures and publishing
  ceremony drops.
- **Requirements/spec (now):** Vista is **gated**. The agent reaches for it at
  deliberate moments — architecture/design review, plan sign-off, options
  comparison, live-telemetry exploration — and keeps using the terminal for
  everything else. The thin skill (decision 0002) carries concrete "when to use /
  when not to" triggers; a `/vista` skill also makes it user-invocable.

The trigger set widens toward the vision as kit coverage grows and the standing
service + zero-install deps (decisions 0002, 0006) make publishing near-zero
ceremony.

## Consequences

- Honest about the destination without committing the architecture to
  proactive-everywhere before it earns its keep.
- The skill must encode gating discipline, not just a publish command.
- The widening of triggers is a roadmap trajectory, measured against real use.
