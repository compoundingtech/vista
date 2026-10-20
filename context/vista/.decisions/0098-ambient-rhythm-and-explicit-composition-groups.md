# Ambient rhythm plus explicit CompositionGroups own content relationships

Status: accepted

## Context

Vista removes browser margins, semantic prose can pass through arbitrary local
components, and leaf Blocks correctly own only their internal layout. Direct
Section-child selectors therefore cannot carry readable measure and rhythm for
every semantic text flow, while asking each Block to choose its outer spacing
would make reusable leaves depend on their surroundings.

One uniform parent gap is also insufficient. Prose continuation, parts of one
record, repeated records, a section lead, a stack of independent Blocks, and a
major section boundary are different relationships even when they appear as
siblings in JSX.

## Evidence and Argument

The [hybrid composition rhythm experiment](../02-medium/01-authoring/.experiments/2026-09-20-hybrid-composition-rhythm.md)
compared the same content at desktop and narrow widths under C1 uniform gap, C2
role-aware flow, and C3 explicit authored grouping. Source inspection tied the
screenshot symptoms to the universal margin reset, direct-child prose selectors,
and zero-margin Block roots.

C1 flattened hierarchy. C2 restored the common path with low author effort but
could not infer every compound relationship. C3 represented those relationships
precisely but imposed unnecessary ceremony when used alone. Combining C2 and C3
places ownership at the lowest layer with enough meaning.

## Options

| Direction | Tradeoffs |
| --- | --- |
| Uniform direct-child gap | Minimal API and deterministic output; collapses distinct relationships into one visual tier |
| Ambient role-aware flow only | Safe common-case rhythm with no author work; ambiguous compounds and incidental wrappers can defeat inference |
| Explicit groups only | Precise and structurally robust; makes ordinary prose and headings depend on author ceremony |
| Ambient flow plus explicit groups | Preserves a safe default and gives ambiguous relationships an owner; requires a small shared tier vocabulary |

## Decision

Vista uses a hybrid composition model. Ambient role-aware flow supplies readable
measure, heading hierarchy, and outer rhythm wherever semantic roles determine
the relationship. Authors add a CompositionGroup when roles alone cannot infer
the relationship among siblings. The explicit group owns only that boundary,
creates no semantic identity, and composes recursively.

The shared tiers are Tight (`space-2`), Component (`space-4`), Lead
(`space-6`), Sequence (`space-8`), and Boundary (`space-12`). Ambient flow uses
the narrowest tier justified by known roles; an explicit group chooses the tier
for its own members. Leaf Blocks retain zero outer margins and own all internal
spacing.

Shared prose styling attaches to semantic text flows rather than direct Section
children. Intermediate local components and CompositionGroups therefore cannot
escape the readable measure or the heading hierarchy; full-bleed Blocks remain
outside the prose measure.

## Consequences

- Ordinary authors receive coherent hierarchy without App-local spacing CSS.
- A CompositionGroup describes a relationship, not a layout-only wrapper,
  SemanticNode, heading, or outline entry.
- Outer rhythm never becomes a leaf Block concern, so the same Block remains
  reusable in prose, compounds, and full-width compositions.
- The tier vocabulary is intentionally small; new values require a distinct
  semantic relationship rather than local visual tuning.
- MED.AUTH-R78 expands from direct Section prose to all semantic text flows, and
  MED.AUTH-R79 makes composition ownership testable.

## Verification

The experiment records the desktop/narrow screenshot symptoms, reset and selector
root causes, and the C1/C2/C3 comparison selecting C2+C3. The implementable model
and tier mapping are specified under [Composition and semantic text
flows](../02-medium/01-authoring/spec.md#composition-and-semantic-text-flows).
