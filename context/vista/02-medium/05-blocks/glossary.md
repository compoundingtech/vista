# Blocks — Glossary

Terms owned by the block library. Cross-cutting leitwörter (`app`, `component`,
`block`, `template`, `curation`) live in the [root ontology](../../ontology.md);
per-block terms (`diff block`, `treemap block`, `telemetry island`, `pixel-frozen`)
live in the owning child node's glossary. Glossary is inherited downward
(decision 0067).

## Block library

Vista's curated, versioned, Storybook-incubated library of [blocks](../../ontology.md#block)
— the realization layer over the render / data / doctrine contracts. A single
genie-composed pnpm-workspace package the service and apps consume by version. The
compounding asset of Vista: bespoke one-offs are [curated](../../ontology.md#curation)
into it over time.

## Lens

A pure, serializable projection over a structured model — the `system-explorer`
graph or a [treemap](./04-treemap/glossary.md) hierarchy: `(model, lens) -> scene`.
A lens names which aspect/dimension/layout to surface and how to focus, without
duplicating the underlying model — the same model is shown many ways by varying the
lens. Shared by the two model-backed exploration blocks
([03-system-explorer](./03-system-explorer/requirements.md),
[04-treemap](./04-treemap/requirements.md)).

## Geist-native visual system

Vista's accepted product visual language: the block library consumes
`@overeng/geist-design-system` components, styles, and tokens directly; defaults to
dark; keeps light mode explicit; and uses grayscale by default with color only for
semantic meaning. Vista has no separate brand accent (decision 0036).
