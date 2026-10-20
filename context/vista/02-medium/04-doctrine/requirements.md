# App Doctrine Requirements

Doctrine owns the **shape** in the medium composition: the cross-template
*principles* that make an app good rather than generated slop. It is a thin contract
of principles, not a runtime component and not the per-kind body — it constrains the
authoring document's structure (document → renderer → data → doctrine), is expressed
through the dedicated doctrine blocks (`ask` / `status-line` / `settled` in the
[block library](../05-blocks/spec.md) plus the [`fork`](../05-blocks/06-fork/requirements.md)
block) plus an advisory linter, and is *realized per kind* by the
[templates](../06-templates/requirements.md) (the per-kind body doctrine lives in
templates, decision 0067).

Composite context lives in the [medium requirements](../requirements.md);
system-level context, assumptions, and acceptable tradeoffs in the
[root requirements](../../requirements.md); terms in [glossary.md](./glossary.md)
(`ask`) and the [root ontology](../../ontology.md). IDs are path-scoped
(`MED.DOC-R*`); each requirement `refines:` its parent — the 02-medium contract
(`MED-R*`) or the charter (`VST-R*`).

## Requirements

### Must drive decisions, not produce slop (app doctrine)

> See [./intuition.md](./intuition.md) for the settled doctrine spine; a few
> refinements remain open (OQ-DOCTRINE).

- **MED.DOC-R32 Lead with the ask:** An app must surface what it needs from the reviewer
  (decisions to sign off, open questions) before its supporting detail; an app
  with no ask must be explicitly declared informational.
  `refines: MED-R04`
- **MED.DOC-R33 Locked/open is first-class:** Settled and unsettled decisions must be a
  first-class structural axis, not a status string buried in a flat list. Each
  decision occupies exactly one status bucket (locked | open | awaiting-sign-off)
  (decision 0019).
  `refines: MED-R04`
- **MED.DOC-R34 Evidence is reachable from the ask:** Supporting material (diagrams,
  tables, decisions) must be reachable from the question or claim it serves; an
  orphan section is a doctrine smell the system should be able to flag.
  `refines: MED-R04`
- **MED.DOC-R35 Structure fits purpose:** An app's structure must match its purpose
  (the situation/template), defaulting to decision-driving rather than
  comprehension-for-its-own-sake. The template is agent-declared (decision 0014).
  `refines: MED-R04`
