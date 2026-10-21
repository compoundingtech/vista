# Treemap — Requirements

The `treemap` block realizes a value-proportioned hierarchy as nested, space-filling
areas for interactive drill-down into deeply-nested data. It extends the
system-explorer interactivity doctrine (MED.BLK.SYSX-R44) to a value hierarchy and
refines the charter's interactive-exploration requirement (VST-R02), composing over
the [render contract](../../02-renderer/requirements.md).

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); terms in [glossary.md](./glossary.md) (`treemap block`) and
the [block-library glossary](../glossary.md) (`lens`). IDs are path-scoped
(`MED.BLK.TREE-*`); each requirement `refines:` its parent. Decision 0055 (treemap
block on d3-hierarchy with drill-down).

These requirements state intent that MED.BLK.SYSX-R42–MED.BLK.SYSX-R44 (which are
graph-shaped) do not already cover; the concrete mechanisms are in
[./spec.md](./spec.md) and decision 0055.

## Requirements

### Must render a deeply-nested value hierarchy as a drillable treemap

- **MED.BLK.TREE-R60 Value-proportioned hierarchy block:** The library must provide a
  space-filling block that renders a hierarchical model as nested areas proportioned
  by a node value, so a reviewer reads relative magnitude and containment across a
  large tree at a glance. The model is resolved by string key and decoded at the
  block boundary, keeping the document portable (MED.AUTH-R25, MED.REND-R04;
  decision 0055).
  `refines: VST-R02`
- **MED.BLK.TREE-R61 Completeness under aggregation:** When the block bounds what it
  draws — capping render depth, summarizing deep subtrees, or folding small siblings —
  it must not silently drop nodes. Every node in the resolved model must remain
  represented (at least inside a labelled aggregate), countable, and reachable by
  drilling or search. The zero-interaction default must not misrepresent the tree as
  complete when it is not. Where an internal node carries value of its own not
  attributable to any listed child (e.g. a directory's own files under cumulative
  sizing), that residual is represented as a synthetic labelled leaf so leaf values
  sum to the node's true total. Labels must not misrepresent tile ownership either:
  every rendered label is clipped and truncated to its tile's bounds, never bleeding
  into or overlapping a neighbouring tile.
  `refines: VST-R02`
- **MED.BLK.TREE-R62 Tile focus and custom detail preview:** A reviewer must be able
  to focus (select) an individual tile as an interaction distinct from drilling into
  it, and the focused/hovered tile's detail presentation must accept an optional
  caller-supplied component so an app can render a domain-specific preview instead of
  the default value/percentage readout. The block's serializable model stays
  data-only; the custom preview is a render-time component binding, not document data
  (MED.AUTH-R25).
  `refines: VST-R02`
- **MED.BLK.TREE-R63 Multiple space-filling layouts over one model:** The same
  hierarchical model must be presentable through more than one space-filling layout —
  an area-packed treemap and a partition layout (icicle / flame) that maps depth to an
  axis so deep-narrow trees stay legible — chosen interactively. Layout choice is view
  state and must not change the model or its schema; the authored default layout is
  declarative (decision 0055).
  `refines: VST-R02`
- **MED.BLK.TREE-R73 Facet-scoped projection:** A node may carry categorical *facets*
  alongside its value; a lens must be able to hide a facet value by default, and the
  reviewer must be able to reveal it. Default-hiding is a projection, not a deletion —
  hidden nodes remain present and countable in the original model and in the filter
  inventory, are revealable by the reviewer, and the zero-interaction default must
  surface that some nodes are hidden; the visible hierarchy re-sums without them. It
  inherits and must not weaken the completeness guarantee (MED.BLK.TREE-R61). The classification is opaque categorical
  data on the model; the block never interprets a facet's meaning (decision 0068).
  `refines: VST-R02`

- **MED.BLK.TREE-R81 Provider-derived disk treemap:** The library must provide a
  disk-usage Block whose server Operation projects an indexed snapshot into a
  decoded `TreemapModel` and returns typed ready, degraded, or failure evidence.
  A degraded model remains explorable with its reasons visible; a failure must
  not masquerade as an empty hierarchy. The named Operation owns one final-value
  Snapshot identity, while pure client projections remain available for Apps
  that intentionally reuse one captured source under several local lenses.
  `refines: MED.DATA-R30`

## Acceptance

A `treemap` block renders a value hierarchy resolved by key; no node is silently
dropped under aggregation; a focus interaction is distinct from drill; an optional
caller detail-preview component renders; both treemap and partition layouts render
over the same model with layout as view-state; a lens-hidden facet value is hidden by
default yet counted and revealable; Vista UI-native theming holds. `DiskTreemap`
renders ready and degraded models through the same Treemap, exposes every degraded
reason, and renders a typed failure without inventing an empty model.
