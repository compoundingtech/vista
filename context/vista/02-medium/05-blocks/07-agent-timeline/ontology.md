# Agent Timeline — Ontology

Terms owned by the `agent-timeline` block. Data terms are inherited from omp-usage
(`context/agent-ecosystem/03-coding-agents/09-usage/01-ledger/`): session, root and
child session, request, agent turn, human prompt, steering, compaction, context
(prompt tokens), API-equivalent cost, seat, agent type, wall and active time, idle
threshold. Viewer terms are borrowed from Grafana/Jaeger and Perfetto where the
meaning matches: span, minimap, viewport, span details. `block`,
`RuntimeIsland` and `Ask` live in the [root ontology](../../../ontology.md).

## Agent Timeline

The block (see the [block library](../glossary.md#block-library)) that shows every agent session active in
a time horizon as one [span](#span) per session, nested by fork, on a shared time
axis, with a [session tree](#session-tree), a [minimap](#minimap), and
[span details](#span-details). Qualified "agent" on purpose: a Grafana trace is
one request's spans; an agent timeline is a window of sessions. _Avoid_: agent
graph (the exploration name), gantt, agent trace (a provenance record; see
`context/annotations`).

## Span

One session drawn as a horizontal bar from its first request to its end or to
now. The anchor of the block's mental model; everything drawn on or around a
span carries the `Span` leitwort. A span's hue is its agent type (Grafana colours
spans by service; the agent type is the service analog). _Avoid_: lane (the row
it sits in), bar (the drawing primitive), session (the data it represents).

## Span mark

One drawn signal on a span, registered once and consumed by both the renderer
and the [legend](#legend), so the legend can never omit a drawn mark. The
marks: [context histogram](#context-histogram), [activity](#activity),
[compaction marker](#compaction-marker), [prompt marker](#prompt-marker),
[span end](#span-end), [span highlight](#span-highlight), ancestor dimming.
_Avoid_: variant codes (E1–E3, H1–H3, F1–F4 were exploration facets and are
retired), glyph, icon.

## Context histogram

The in-span bars whose height is the session's context (prompt tokens) per time
bucket, so growth reads as rising bars and a [compaction](#compaction-marker) as a
drop. Buckets with no request draw nothing, so idle stretches are gaps. Where a
request has no context snapshot the bucket is a **context estimate** (billed-input
tokens) and is marked as such. _Avoid_: context fill (the retired lightness
encoding), context occupancy (the omp-usage lens with a different denominator),
"context" for anything other than the model's context window.

## Activity

What a span was doing at a time, read from the [context histogram](#context-histogram)
and its gaps: `working` (bars; consecutive requests no more than the idle
threshold apart), `waiting` (a longer gap while a descendant is active, drawn as a
light hatch behind the histogram), `idle` (a longer gap with no descendant
activity). The idle threshold is omp-usage's (10 minutes), and wall / active time
in the session tree are omp-usage's definitions (first to last request; sum of
gaps within the threshold). There is no separate rail; the working signal is the
bars themselves. _Avoid_: state track ("track" is a row in Perfetto), activity
rail (the retired rail under the span), status, state.

## Compaction marker

The mark at a compaction event: a drop in the histogram plus a labelled notch
(`254k → 56k`). _Avoid_: cliff (the retired fill-encoding word), reset.

## Prompt marker

The triangle above a root span at a human prompt; a steering prompt is the
hollow form. Child spans have no prompt markers (prompts are root-only in the
ledger). _Avoid_: turn (an agent turn is a different event), message.

## Span end

How a span terminates, from what the ledger observed: `exited` (a session exit
event; drawn as a cap — the only state that earns "ended"), `failed` (exited or
last request stopped with an error; cap in the error colour with a glyph),
`active` (no exit and a request within the active window, 10 minutes; open to the
now line with a marker), `inactive` (no exit and no recent request; open with a
faded marker — inferred, not observed). An exit followed by later requests is a
**resumption**, not an end; only the last exit can end a span. _Avoid_: running/ended as facts for
inferred states, merged (implies adoption of the child's output), closed.

## Span highlight

The single outline that marks a span as selected or as a find match; the two
share one channel. Non-matching rows keep tree context by **ancestor dimming**.
_Avoid_: focus (the keyboard concept), glow.

## Span hover

The cursor-following readout shown near a hovered span, positioned so it never
covers the hovered span. _Avoid_: tooltip (static), popover (the widget).

## Span details

The bottom drawer for the selected span: Overview, Timeline, Context, Spend,
Children. Borrowed from Grafana's span details. _Avoid_: drawer (the widget),
inspector, sidebar.

## Session tree

The resizable left tree of sessions in fork order with expand/collapse, text and
facet filters, and per-row wall · active time and cost. Collapsing a node rolls
its descendants into the parent span. **Expansion** is either `all` or an
explicit set of expanded session IDs, controlled by the caller or owned by the
viewer. The default set is empty (collapsed); newly arriving live sessions
remain collapsed unless expansion is `all`. _Avoid_: sidebar (the widget),
lane list, outline.

## Minimap

The whole-window overview strip (request density and cumulative cost) whose
brush is the [viewport](#viewport). Borrowed from Grafana/Perfetto/DevTools.
_Avoid_: overview, scrubber, timeline header.

## Viewport

The visible time range `[start, end]` within the window; only the x scale
changes when it moves. Wheel, drag, keys and the minimap brush all mutate the
viewport. _Avoid_: zoom level (a derived number), range selection (the drag
gesture that sets it).

On a live refresh the window moves forward. A viewport whose end is within one
refresh interval of the previous window end follows the window (**live edge**,
the tail mode of log viewers); any other viewport keeps its absolute times.
Viewer state (viewport, filters, selection, expansion) survives refreshes and
resets only when the horizon or agent filter changes. _Avoid_: auto-scroll,
pinned (hold vocabulary).

## Coverage

What share of the horizon the shown data is: included versus total roots
(main sessions), agents (all agent sessions), requests and cost, plus the
selection policy. An included/total denominator is shown only when it differs
from the included count; equal totals need no redundant denominator. _Avoid_:
sample rate, sampled (the retired badge).

## Bin

A fixed-width time aggregate of a session's requests (count, cost components,
tokens, tool calls, by-model and by-stop breakdowns, whether context was
estimated) used where individual rows are not retained. A retained row carries
only its own facts; nothing from a bin is attributed to a row's timestamp, model
or stop reason. _Avoid_: fold (the retired lossy merge), sample, bucket (the
retired rendering unit).

## Horizon

The data window: `1h`, `1d`, `7d`. Selects the fixture or query; the viewport
lives inside it. _Avoid_: window (ambiguous with the browser window), period.

## Legend

The list of the [span marks](#span-mark) currently drawn, derived from the mark
registry. _Avoid_: key, glossary.

## Reading guide

The in-product explainer that teaches one span mark at a time with a rendered
example, opened from the toolbar as an overlay. Its content is derived from the
same mark registry as the legend. _Avoid_: help (generic), tutorial, docs.

## Structure

```
Agent Timeline
├─ partOf: Span ──┬─ partOf: Context histogram   (context estimate isa bucket)
│                 ├─ related: Activity             (working = bars, waiting = hatch, idle = gap)
│                 ├─ partOf: Compaction marker
│                 ├─ partOf: Prompt marker        (steering isa prompt)
│                 ├─ partOf: Span end             (exited | failed | active | inactive)
│                 └─ partOf: Span highlight       (+ ancestor dimming)
├─ partOf: Session tree
├─ partOf: Minimap ── dependsOn: Viewport ── partOf: Horizon ── has: Coverage, Bins
├─ partOf: Span details ── dependsOn: selected Span
├─ partOf: Span hover ── dependsOn: Viewport cursor
└─ partOf: Legend, Reading guide ── dependsOn: Span mark registry
```

Leitwort `Span` is carried by the followers whose own word is generic (span mark,
span end, span highlight, span hover, span details) and dropped where the borrowed
domain word carries more (context histogram, activity, compaction marker,
prompt marker, minimap, viewport, session tree).

## Flagged ambiguities

- **track** — Perfetto: a row of the timeline. Never used here for a row or an encoding.
- **context** — always the model context window in this block; a row's tree
  context is "ancestor" (ancestor dimming), React context is never named.
- **trace** — Grafana: one request's span tree; agent trace: a provenance record,
  not this session-span viewer.
- **fork** — omp: a `task` tool call spawning a child session; here the nesting
  relationship, never a git branch.
