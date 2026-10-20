# Collapsed ticks use even pitch, not positional mapping

Status: accepted

## Context

The collapsed rail mapped each tick to its section's proportional document
position (`targetTop / scrollHeight`, q9 measured exactly on self-inspect-poc
v7: 375/1482 = 0.253, 1346/1482 = 0.908). The mapping was honest, but uneven
review docs (long intro, long middles, short clustered closings) rendered as
an odd-looking rail with an empty top quarter — flagged as looking broken.

## Evidence and Argument

q9 interviewed with a to-scale rendered preview of both modes using the real
v7 offsets (positional 78/112/165/222/243/261/279 vs even 0/51/…/308 on the
308px track). The principal chose even pitch: a calm rail is preferred over
the position signal for uneven review docs. Whether Notion maps evenly is
unconfirmed — the choice matches the principal's memory of Notion, not a
measured reference.

## Options

| Tick spacing | Tradeoffs |
| --- | --- |
| Positional minimap | Honest position signal; odd docs look odd |
| Even pitch | Always calm; position signal moves to the expanded panel + active tick |
| Positional with title anchored | Keeps honesty, fills the top; touches the h1-exclusion rule |

## Decision

Even pitch: `railTickOffsets` distributes ticks uniformly across the usable
track (first at 0, last at `trackHeight`). The min-gap push-down and
overflow-compression machinery is deleted with it — uniform pitch cannot
collide or spill. Position honesty now lives in the expanded panel order
and the active tick.

## Consequences

- `RAIL_TICK_GAP` removed; `ShellOutlineItem.position` retained for the
  `data-vista-outline-position` attribute.
- Tick tests rewritten for pitch expectations, plus a lone-entry case.
