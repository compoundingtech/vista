# App Doctrine — Spec

This node owns cross-Template composition. Requirements are in
[requirements.md](./requirements.md); canonical terms in
[ontology.md](../../ontology.md).

## Shape

Every AppRoot leads with its ask, follows with the Template body, and separates
settled material. Each decision occupies one status. Informational Apps declare
an empty ask. Comparisons score alternatives against shared drivers and name the
failed driver for each rejection.

AskBlock and ForkBlock realize this shape; their visual contracts are owned by
the [block library](../05-blocks/spec.md).

## Judgment

Structural diagnostics derive from SemanticManifest: ask presence, decision
partitioning, evidence reachability, comparison shape, citations, provenance,
and Template/shape agreement. Diagnostics cannot replace author and reviewer
judgment or browser judgment.

Reader-facing composition is specified in [taste.md](./taste.md), including
context, attention, text economy, visual hierarchy, and interaction affordances.

## Starter slots

The scaffold contains a context header, an ask referencing one primary-focus
evidence slot, and authoring guidance in JSX comments, not a canned visual.
Comments prefixed `vista-scaffold:context`, `vista-scaffold:reader-ask`, and
`vista-scaffold:primary-focus` mark unfinished slots; authors replace those
comments with actual context and content.

`vista check` reports a `scaffold-slots` warning while any slot comment remains.
The report stays `ready`: warnings are advisory and do not block publication.
Ready reports include a `warnings` array of stable `code` and human-facing
`message` pairs; the CLI displays warnings before the ready summary.
