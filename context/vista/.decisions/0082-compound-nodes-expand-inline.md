# Compound/group nodes expand inline by default

Status: accepted

## Context

Decision 0018 settled the system-explorer foundation (typed graph, React Flow,
elkjs); OQ-MULTIDIM left interaction defaults open. This record resolves all
three: compound/group-node default (q10), lenses (q12), filter-vs-mute (q13).

## Evidence and Argument

Interviewed as q10 (expand-inline over drill-down and muted-preview): overview
preserved on the canvas, cheapest on React Flow. No usability comparison exists
— that is OQ-MULTIDIM's stated blocker — so this is judgment now, with a
variant study available afterwards if contested. Decision record promoted from
the q10 answer.

## Options

| Default | Tradeoffs |
| --- | --- |
| Expand inline | Overview preserved; large groups flood; cheapest |
| Drill down | Each level legible; cross-level relations hidden; needs breadcrumbs |
| Muted preview | Zero layout churn; dense groups stay dense |

## Decision

Compound/group nodes expand inline on click with graph reflow; a view-mode
toggle may offer drill-down later without changing this default.

## Amendment 1 — dim everywhere: lenses (q12) and filters (q13)

Lenses dim non-matching nodes in place (layout frozen); user-driven filters
do the same. One rule for both triggers, directly from R44 (restyle for
free; relayout reserved for structural zoom) and consistent with expand-inline
above. Isolate/mark variants remain available as explicit actions, never the
default. OQ-MULTIDIM closes: all three defaults settled.

## Consequences

- A contested default gets a Storybook variant study, not a re-argument.
