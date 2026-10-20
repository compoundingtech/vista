# Templates — Intuition

*For: why templates are their own realization layer · Assumes: the medium
composition ([../intuition.md](../intuition.md)), the doctrine principles
([../04-doctrine/intuition.md](../04-doctrine/intuition.md)), and the block library
([../05-blocks/intuition.md](../05-blocks/intuition.md)) · Covers: templates as
curated app-scale components that realize doctrine.*

A **template** is a curated component at *app scale*. Where a [block](../05-blocks/intuition.md)
is a curated component you drop *into* an app, a template is a curated scaffold for a
*whole* app of a given kind. It stands to [doctrine](../04-doctrine/intuition.md)
exactly as a block stands to the render/data contracts: doctrine says what makes any
app good (lead with the ask, drive a decision, subordinate rejects); a template
*realizes* those principles as the concrete body for one kind — a review, a
design-interview, an options-comparison, a telemetry-exploration, a code-recap.

**This is why the per-kind body left doctrine.** Keeping doctrine to principles and
moving each kind's body into a template is the contract/realization split applied to
shape (decision 0067): the doctrine contract stays thin and timeless, and adding a new
app kind is adding a template, not editing the principles.

**Templates compose everything below them.** A template arranges blocks — a
`system-explorer` and a `decision-log` for a review, a `fork` for options-comparison,
the telemetry blocks for telemetry-exploration — over the doctrine skeleton. That is
why this node is ordered *last* in the medium: it depends on the renderer, the blocks,
the data contract, and the doctrine all at once.

**The template is optional sugar, never a step.** `vista new --template <kind>`
generates a starting app directory so an agent begins from good structure. But a
single `vista publish <local-slug>`, resolved through `$ST_AGENT`, still works on a
hand-authored app — the template never becomes a mandatory ceremony (VST-R64). It is a real-React starting point the
agent edits, not a tagged block the renderer resolves.

**One template carries a return path.** The design-interview template wires the `ask`
into the [feedback interview](../../04-feedback/intuition.md). It works because the
document already carries stable ids on every block: the interview attaches to those
ids with no migration, so a design-interview app can pose questions and receive
verdicts over the very document the renderer draws.
