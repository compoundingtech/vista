# Ask-first is the global default; informational reviews must declare it

Status: accepted (OQ-DOCTRINE sub-1; recommended default, reversible)

## Context

The doctrine leads with THE ASK. A review with no ask is allowed only when it is
genuinely *informational*. The risk: an easy "informational" escape hatch lets an
agent dodge the hard work of naming the decision, reintroducing slop.

## Decision

Ask-first is the **global default** across all archetypes (not per-archetype). A
review may have an empty ask **only** by setting an explicit `informational: true`
(or `archetype: telemetry-exploration` with a declared informational ask) — never
by omission. The slop linter (decision 0012, advisory) warns when a review is
declared informational but contains decision/options/fork content (the shape of a
review that *should* have an ask). The default forces the agent to either name the
ask or consciously declare there is none.

## Consequences

- Empty ask is a deliberate, visible declaration, not a silent default — closes the
  "dodge the decision" hole.
- The linter cross-checks declared-informational against content shape (same
  mechanism as archetype cross-check, decision 0014).
