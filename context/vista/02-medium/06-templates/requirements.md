# Templates — Requirements

A **template** is a *curated app-scale component* — a per-kind app scaffold that
prescribes an app's body and composes [blocks](../05-blocks/requirements.md).
Templates are the realization of the [doctrine contract](../04-doctrine/requirements.md)
the way blocks realize the render/data contracts: each template embodies the doctrine
principles for one kind of app. Ordered last in the medium because it composes
everything below it (decision 0067).

Builds on the [medium requirements](../requirements.md) and this node's
[spec.md](./spec.md); the doctrine principles are
[../04-doctrine/requirements.md](../04-doctrine/requirements.md); the blocks it
composes are [../05-blocks/requirements.md](../05-blocks/requirements.md); terms in
[glossary.md](./glossary.md). IDs are path-scoped (`MED.TMPL-*`); each requirement
`refines:` its parent — a doctrine principle (`MED.DOC-R*`), the render contract
(`MED.REND-R*`), or the charter (`VST-R*`). Decisions 0014 (template is
agent-declared), 0066 (archetype → template).

## Requirements

- **MED.TMPL-R01 Templates realize doctrine:** Each template is a curated app-scale
  component that embodies the [doctrine](../04-doctrine/requirements.md) principles
  (MED.DOC-R32–MED.DOC-R35) for one kind of app: it leads with the ask, makes
  locked/open first-class, keeps evidence reachable, and gives the kind a body
  structure that fits its purpose. The template is agent-declared (decision 0014).
  `refines: MED.DOC-R35`
- **MED.TMPL-R02 Per-kind scaffolds:** Vista must provide templates for its app kinds
  — review (architecture/design), design-interview, options-comparison, plan/sign-off,
  telemetry-exploration, and code-recap — each prescribing the kind's body doctrine
  and defaulting to decision-driving over comprehension-for-its-own-sake. An app may
  be a **hybrid** that composes more than one kind's body under one ask.
  `refines: VST-R03`
- **MED.TMPL-R03 Optional instantiation, never mandatory:** `vista new --template
  <kind>` generates a starting app directory from a template, but it is optional
  scaffolding sugar: a single `vista publish <local-slug>`, resolved through
  `$ST_AGENT`, still works end-to-end on a hand-authored app, so `new` never becomes
  a required step in the happy path
  (decision 0066).
  `refines: VST-R64`
- **MED.TMPL-R04 Compose blocks as real React:** A template composes the curated
  [blocks](../05-blocks/requirements.md) and the doctrine blocks into an app body. A
  template is an ordinary React starting point and domain composition — it is
  instantiated and then edited, not resolved by the renderer as a `_tag` case
  (MED.REND-R02).
  `refines: MED.REND-R02`
- **MED.TMPL-R05 Design-interview round-trip:** The design-interview template must
  carry the [04-feedback](../../04-feedback/01-interview/requirements.md) interview
  round-trip — a bounded structured-answer exchange attached to the app's stable block
  ids (VST-R04, MED.REND-R03) — so a design-interview app can pose questions and
  receive verdicts (FDB.IVW-R45) without a data migration. The medium *carries* the
  return path (stable ids); the feedback subsystem consumes it.
  `refines: VST-R04`

## Acceptance

`vista new --template <kind>` scaffolds each kind; a hand-authored app still publishes
with no `new` step; each template body matches its kind's doctrine and composes blocks
as real React; the design-interview template round-trips through the feedback interview
against stable block ids.
