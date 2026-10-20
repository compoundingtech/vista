# Hybrid authoring: declarative default + real-React escape hatch

Status: superseded by 0074

The greenfield App contract in decisions 0074/0076 supersedes the declarative
document, `custom` escape hatch, registries, two render paths, and authored
semantic export below. These mechanisms remain rationale and evidence only.

## Context

Two goals pull opposite ways: a standing service wants low-ceremony, portable,
declarative content; "the best view for *this* scenario / extended ad hoc" wants
arbitrary bespoke rendering. Picking one side loses something essential.

## Decision

Authoring is **hybrid**. The default surface is a **declarative document** of
typed blocks (a tagged union on `_tag`) rendered by a shared exhaustive-switch
renderer plus host registries (`dataSources`, `components`). When no block fits,
the agent writes a **real-React** component scoped to one review (`custom` block +
`componentKey`), composed through the *same* render path as first-class blocks —
not a constrained HTML sandbox.

Bespoke one-offs are the **graduation** pipeline: prove a component reusable
(incubated in Storybook) → lift its props into a typed block → the exhaustive
switch goes red until a `case` is added → authoring flips from stringly `custom`
to a typed block; the component is reused unchanged. Every block and addressable
sub-entry carries a stable `id` (feedback-readiness hook for a possible later
phase). Blocks reference data/components by **string key** only, keeping the doc
portable and enabling the live/frozen swap (see `05-data-sources`).

## Consequences

- 80% low-ceremony declarative; long-tail genuinely bespoke; the kit grows from
  proven one-offs — the compounding-asset mechanism.
- Two code paths (declarative renderer + bespoke component path) — accepted cost.
- Refined by 0015 (rich-text is hybrid: typed spine + MDX in prose leaves) and
  0016 (bespoke props via effect Schema + typed registry).

## Historical amendment (2026-08-10): JSX authors the declarative model

The distinction between the declarative path and the real-React path is no longer
an author-facing split. Authors compose React components with idiomatic JSX; Vista
projects semantic structure into a portable representation used by doctrine,
indexing, feedback targeting, and freezing. The tagged records remain evidence for
that semantic seam, not the primary authoring syntax. The projection is the minimal
manifest beside canonical React source. A full render IR is rejected absent a later
non-React-rendering or visual-transform requirement.

Public Vista primitives, shared semantic components, and unprivileged app-local
kits all participate in the same projection. Semantic records compose as JSX
children; scalar configuration and bulk/data references remain props. Runtime-only
interactive components stay explicit projection boundaries. The projection
question is now settled by decisions 0074/0076 and their greenfield amendments;
this historical amendment did not yet choose that contract.
