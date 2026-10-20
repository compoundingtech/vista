# Content spacing scope and hierarchy: all nine findings in one round

Status: accepted

## Context

Live v3 reads better after the body retry but spacing and layout still lag
Linear/Notion/Geist density. SpacingCritic reported 9 findings: P0 masthead
unstyled, measure escaping bare prose, zero section separation; P1 fixed-h2
rank, hairline on every section, two competing h2 ramps; P2 ad-hoc rhythm
values, body ink weight, top-edge padding. Interview q6 scoped the round,
q7 placed the prose contract, q8 set heading rank and rules.

## Evidence and Argument

q6 chose all-nine over p0-only and p0-p1: one round to done-ish, accepting
taste/structure bundling. q7 chose section-prose over content-wide-optout
and markdown-only-documented, with the architectural note that Section text
flow and Markdown prose share one styling source of truth and look right
out of the box. q8 chose rank-from-depth with top-level rules over
tuned-fixed and rank-no-rules. All three answers are recorded and promoted
here. Code evidence: live v3 DOM (`section > h2 + p`, no prose ancestor),
1104px/119 CPL paragraphs, 0px section gaps, 45px masthead at body size.

## Options

| Scope | Tradeoffs |
| --- | --- |
| P0s only | Smallest diff; hierarchy stays unpolished |
| P0+P1 | Structural plus hierarchy; larger blast radius |
| All nine | Done-ish in one round; mixes taste with structure |

| Measure scope | Tradeoffs |
| --- | --- |
| Section carries prose | Cheapest path styled; full-bleed untouched |
| Content-wide with opt-out | Strongest default; forgotten opt-out squeezes |
| Markdown-only documented | Zero code; proven weak by the scaffolded showcase |

| Heading treatment | Tradeoffs |
| --- | --- |
| Rank from depth + top rules | Visual and assistive hierarchies agree |
| Tuned fixed h2 | Minimal; flat assistive outline |
| Rank, no rules | Calmest; unproven on Vista |

## Decision

All nine findings in one round. Section carries the prose contract via the
shared styling source (MED.AUTH-R78). Heading rank derives from nesting
depth with hairline rules on top-level sections only. P2 token polish
(space scale, ink step-down, top edge) rides the same round.

## Consequences

- MED.AUTH-R78 added: shared prose styling source of truth.
- Node-safe rule still holds: server-loaded modules never value-import
  `.stylex`; presentation via data attributes plus client CSS.
- Visual proof must cover a Markdown-heavy page, not just the filler
  showcase, so measure/rhythm claims are exercisable.
