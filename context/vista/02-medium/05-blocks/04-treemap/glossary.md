# Treemap — Glossary

Terms owned by the `treemap` block. The `lens` term and `block library` live in the
[block-library glossary](../glossary.md); leitwörter in the
[root ontology](../../../ontology.md).

## Treemap block

The [block](../../../ontology.md#block) that renders a value-proportioned hierarchy
as nested, space-filling areas for interactive drill-down into deeply-nested data. It
resolves a typed hierarchy model by string key, inherits the drill-down doctrine
(semantic zoom, focus+context, [lens](../glossary.md) projection) validated by
`system-explorer`, and presents the same model through more than one space-filling
layout — an area-packed treemap or a **partition** layout (icicle / flame) that maps
depth to an axis so deep-narrow trees stay legible. Built on d3-hierarchy layout
primitives (decision 0055).

## Facet

A **categorical** attribute carried on a `TreemapNode` (`facets: Record<string,
string>`) — the categorical twin of the numeric `metrics`. Where `metrics` drives a
sequential value colour, a facet is a class label (e.g. `provenance`) that drives
group colour and, via a [lens](../glossary.md)'s `hiddenFacets`, default-hide/reveal.
The generic model never interprets a facet value; a builder or adapter stamps it and
the treemap stays domain-agnostic (decision 0068).

## Provenance

The well-known facet classifying a file's origin — `authored | generated |
vendored` — derived from git's own source of truth (`.gitattributes`
`linguist-generated` / `linguist-vendored`) by the `fromGitDiff` adapter at author
time. A typed closed enum at the adapter boundary that maps into the generic string
[facet](#facet); it lets a lens hide generated output (regenerated CI YAML,
`*.generated.ts`) by default while keeping it counted and revealable (decision 0068,
MED.BLK.TREE-R61).

## Hidden set

The consumer- or block-owned set of leaf identifiers excluded from the visible
projection. Exclusion happens before layout and re-sums the remaining
hierarchy; the underlying model and filter inventory remain intact so every
excluded leaf can be revealed.

## Solo

The visibility action that retains one selected node and excludes every leaf
outside it. It is the inverse-shaped counterpart to hiding one node, not a
selection or a new model.
