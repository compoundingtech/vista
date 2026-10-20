# Medium — Intuition

*For: understanding the app as one composed artifact · Assumes: the charter
([../requirements.md](../requirements.md)) and the service substrate
([../01-service](../01-service/requirements.md)) · Covers: how the document,
renderer, data, and doctrine contracts — and the block/template realizations —
compose into the medium.*

The medium is the thing Vista is *for*: the app an agent writes and a human
reads. Everything else is substrate (the service that hosts it) or approach (the
CLI/skill that produces it) or return path (feedback). The medium is where the
value compounds, because it is built from parts that keep growing.

The whole design rests on one move: **authored JSX projects to portable,
serializable semantics.** The projection names runtime/data
references by string key and every semantic record carries a stable id. Because
the projected intent is just data,
four independent things can act on it without stepping on each other:

Four of the children are **contracts** — what any block or template must satisfy:

- **Authoring** owns semantic JSX and its portable semantic projection.
- **The renderer** renders canonical React source and preserves stable-ID
  correspondence with the derived semantic manifest. There is one ordinary React
  render path; no tagged-block renderer remains.
- **Data-sources** own the *feeding* — providers resolve a block's data by key,
  live at view time or frozen into the immutable version, decoding through the same
  schema so live and frozen never diverge.
- **Doctrine** owns the *shape* — it doesn't render anything; it constrains what a
  good document looks like (ask-first, locked/open, evidence reachable) and is
  expressed through a few dedicated doctrine blocks plus an advisory linter.

Two children are **realizations** — the curated library and scaffolds that satisfy
those contracts:

- **The block library (05-blocks)** *realizes* the render/data/doctrine contracts as
  an actual versioned, Storybook-incubated library — and hosts the heavy blocks
  (code, mermaid, system-explorer, treemap, telemetry, fork) as their own vertical
  subsystems, each refining the contracts it uses.
- **Templates (06-templates)** *realize* doctrine as per-kind app scaffolds that
  compose blocks — a review, a design-interview, an options-comparison, and so on.

Read the children in order — authoring → renderer → data → doctrine → blocks →
templates — and the composition reads as one sentence: *semantic JSX with a
portable semantic projection, rendered from canonical React source, fed by data, shaped by doctrine, and realized by
a curated block library and per-kind templates.* The `MED-R*` requirements here are
the seams between the contracts; each child's requirements `refines:` a contract it
specializes (or the charter).
