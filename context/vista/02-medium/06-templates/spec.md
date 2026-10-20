# Templates — Spec

Specifies the per-kind template bodies, how a template composes blocks, and
`vista new`. Builds on [requirements.md](./requirements.md); the doctrine principles
these bodies realize are [../04-doctrine/spec.md](../04-doctrine/spec.md); the blocks
they compose are [../05-blocks/spec.md](../05-blocks/spec.md). Requirement IDs are
path-scoped in `./requirements.md`.

## Status

Draft.

## Template-selected body

The agent declares the template (decision 0014); it selects the body doctrine — the
kind's structure over the shared doctrine skeleton (HEADER → ASK → body → SETTLED,
[../04-doctrine/intuition.md](../04-doctrine/intuition.md)):

| Template | Body doctrine |
| --- | --- |
| review (architecture / design) | overview→zoom (C4-like) under a BLUF ask |
| design-interview | ask-led question set that round-trips verdicts (see below) |
| options-comparison | decision-tree — rejected branches first-class (the `fork` block) |
| plan / sign-off | flat ask list, thin body |
| telemetry-exploration | dashboard / overview→zoom; ask may be informational |
| code-recap | diff-narrative (what changed, why, risk); ask = approve/request-changes |

An app may be a **hybrid** (e.g. the `cl2-storm` arch+options app = BLUF ask +
overview→zoom map + decision-tree for the option axes) — one ask over more than one
kind's body.

## How a template composes

A template is a **real-React** app scaffold, not a tagged block (MED.TMPL-R04). It is
a curated component at *app scale*: `vista new --template <kind>` writes a starting
app directory whose body already leads with an `ask`, arranges the kind's blocks
(e.g. `system-explorer` + `decision-log` for a review, `fork` for options-comparison,
the telemetry blocks for telemetry-exploration, `diff`/`file-tree` for code-recap),
and is then edited by the agent. Because it is instantiated and edited (not resolved
by the renderer), a template is not a `_tag` union member — it is the app's own
`app.tsx` starting point.

`vista new` is **optional** (MED.TMPL-R03): a single
`vista publish <local-slug> --message <summary>`, resolved through `$ST_AGENT`, works end-to-end on a
hand-authored app; the template is sugar that puts the doctrine's
body in place so an agent starts from good structure rather than a blank file.

## Design-interview round-trip

The design-interview template is the one that carries a return path: it composes the
`ask` block over a bounded question set and wires it to the
[04-feedback interview](../../04-feedback/01-interview/spec.md) (FDB.IVW-R45). Because
every block and sub-entry already carries a stable id (VST-R04, MED.REND-R03), the
interview attaches to those ids with no data migration — the design-interview app
poses questions and receives verdicts against the same document the renderer draws.
