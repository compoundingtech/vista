# Feedback Requirements

The `04-feedback` node owns Vista's **staged human→agent return path** — the way a
human's response flows back to the agent after an app is rendered. Vista is
render-only (VST-R01, decision 0001); feedback returns in staged
scope per the [roadmap](../roadmap.md), and **the only realized capability is
the bounded structured-answer**: the agent poses an explicit decision-question and
the human answers it in place. General/freeform feedback stays delegated to the
existing annotation tools (VST-R38); Vista does not build a general capture surface.

This composite node is **thin by design**: it carries no cross-cutting requirement
of its own — its single child holds the concrete requirement, and the whole return
path attaches to the medium's feedback-ready content model (VST-R04). System-level
context, assumptions, and acceptable tradeoffs live in the
[root requirements](../requirements.md); terms in [ontology.md](../ontology.md).
Requirement IDs are **path-scoped** to their owning child (`FDB.IVW-R*`); each
declares `refines:` the charter requirement it specializes so the tree reads upward.
A net-new `FDB-R*` would be added here only if a genuine feedback-level, cross-cutting
requirement emerged (e.g. a durable receipt layer spanning multiple return
mechanisms) that no single child owns.

## Subsystem requirements

| Node | Scope | Requirement IDs |
| --- | --- | --- |
| [01-interview](./01-interview/requirements.md) | bounded structured-answer / interview integration | `FDB.IVW-R45` |

The return path attaches to the medium's stable per-block IDs (VST-R04), which is
what lets a feedback phase bind to a rendered app without a data migration.
