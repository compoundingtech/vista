# Faint ink: interim vista override now, Geist ramp brief in parallel

Status: accepted

## Context

OQ-A11Y-FAINT corrected 2026-09-12: light `--ds-gray-800` fails 4.5:1 on
every surface across 50+ required-information sites; narrow justification
is dead. q11 chose bridge-both over geist-first and vista-override-only,
with the note to follow up on the StyleX theme-architecture refactor.

## Evidence and Argument

Rendered preview with live-computed ratios: #767676 passes white only,
#737373 white+card, #6e6e6e all three (5.10/4.89/4.55). Dark needs no
change. Tracking issue #2768 owns the override, the Geist brief, and the
removal condition.

## Options

| Direction | Tradeoffs |
| --- | --- |
| Geist-first | Principled, all consumers; vista stays red until release |
| Vista override only | Immediate; forks the contract, fossilizes |
| Bridge both | Relief now + upstream fix; needs removal tracking |

## Decision

Bridge both: interim light-only `[data-theme='light'][data-theme='light']`
Geist's doubled-class theme deterministically), plus a routed Geist brief
covering gray-800 and the sibling chromatic ramps in one review. Delete the
override when the Geist light ramp passes AA on all three surfaces.

## Consequences

- OQ-A11Y-FAINT closes into #2768.
- The StyleX refactor follow-up (#2754 family) must preserve a home for
  such overrides or absorb them; linked, not blocking.
