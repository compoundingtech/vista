# Treemap block: d3-hierarchy layouts, resolve-by-key model, system-explorer drill doctrine

Status: accepted (treemap drill-down spike + design review)

## Context

Reviews need to show a large, deeply-nested hierarchy where relative magnitude
and containment are the question — bundle composition, disk usage, cost
breakdowns, coverage, any value-weighted tree (MED.BLK.TREE-R60). The `system-explorer` block
(decision 0018) covers a typed *graph*; it does not cover a value-proportioned
*hierarchy*, and `chart` is Cartesian. A spike
([../02-medium/02-renderer/.experiments/](../02-medium/02-renderer/.experiments/)) proved a
d3-hierarchy-based space-filling foundation and a single-level interaction bar
(rollup-plugin-visualizer parity); a design review found that a single zoom level
breaks down on deep/large trees — depth stacks header rows off-canvas, tiny nodes
vanish silently, and there is no findability or durable orientation.

The reframe that anchors this decision: interactive drill-down is already
vista doctrine (MED.BLK.SYSX-R44) and already validated for graphs by `system-explorer`
(semantic zoom, focus+context, a pure `project(model, lens) -> scene` with a
`layoutSignature` relayout key). The treemap **inherits** that doctrine rather
than growing a bespoke pile of controls. The one genuinely hierarchy-specific
addition is **layout switching** across space-filling layouts.

## Decision

- **Value-proportioned hierarchy, resolve-by-key.** A `treemap` block
  `{ _tag, id, modelKey, lenses, defaultLensId?, caption? }` resolves a typed
  `TreemapModel` (`TreemapNode {id, label, value?, children?, metrics?}`) from the
  host models registry by string key, decoded via effect `Schema` at the block
  boundary (like `system-explorer`), keeping the document portable (MED.AUTH-R25/KR04).
  Search needs the whole tree client-resident, so the seam is by-key, not inline.
- **Rendering = d3-hierarchy layout primitives.** Geometry comes from
  d3-hierarchy's `treemap()` and `partition()` layout functions, rendered as custom
  SVG. Chosen over recharts' built-in Treemap for control, and over visx's
  `@visx/hierarchy` render-prop components because those recompute the layout on
  every render and would defeat the `layoutSignature` memoization (below); the same
  `d3-hierarchy` primitives give both an area-packed treemap and a partition
  (icicle / flame) layout over the same model at **no additional dependency**. A
  partition layout maps depth to an axis, so deep-narrow trees stay legible where a
  treemap's stacked header rows cannot (MED.BLK.TREE-R63). Layout is view-state and never
  changes the model or its schema.
- **Inherit the system-explorer projection pattern.** A **lens** is a pure
  serializable projection selecting the zero-interaction default (layout, depth
  cap, color encoding, root). The scene restyles for free on focus / hover /
  search-mute / re-color; only a structural change (zoom root, depth cap, layout
  kind) pays a relayout, keyed on a `layoutSignature`. Live zoom / query /
  selection / layout are component-local state seeded from the default lens. Color
  encoding is a selectable restyle — categorical grouping recomputed relative to
  the current zoom root, by depth, or a sequential/diverging scale over `value` or
  a `metrics` field; near-monochrome categorical color on realistic data carried no
  signal, so this is a stated mechanism, not deferred.
- **Completeness under aggregation (MED.BLK.TREE-R61).** Depth-bounded rendering, summarized
  containers, and small-sibling folding are how the block survives large trees —
  but they must fold into a labelled, countable, drillable aggregate, never drop a
  node silently. The default view must not misrepresent the tree as complete.
- **Focus and custom detail (MED.BLK.TREE-R62).** Click-to-focus selects a tile as an
  interaction distinct from drilling into it, and drives a pinned detail panel.
  The detail presentation (panel and hover card) accepts an optional
  caller-supplied component so a review can render a domain-specific preview; that
  component is a render-time binding, not document data.
- **Mechanisms that earn their place (MED.BLK.SYSX-R44 gate).** Semantic-zoom drill, search-to-
  zoom with path-to-root reveal, a sibling-aware breadcrumb, the pinned detail
  panel, and layout switching. A minimap is cut — for a space-filling layout the
  zoomed canvas plus the sibling breadcrumb already deliver overview+detail without
  changing what the reviewer can understand.

## Consequences

- Adds `d3-hierarchy` (deduped to v3) to the kit dependency set; the `vista-deps`
  closure and a kit genie runtime-policy slice (`publicImportRoots`) must include
  it (decisions 0017, 0025).
- d3-hierarchy is pure JS and the block renders plain SVG (no eval-time `window`),
  so it is a normal `React.lazy` arm behind the `Renderer` exhaustive switch
  (decision 0054) — not a
  foreign-React `LazyBlock` island like the Grafana telemetry blocks. Adding the
  `_tag: 'treemap'` variant turns the switch red until a `case` is added (the MED.AUTH-R24
  graduation trip-wire).
- Geist-token theming is an acceptance gate (KR07, decision 0036); the SVG scene
  themes off the kit's `data-theme` tokens in dark and light.
- No shared search / detail-panel primitive exists in the kit; both are net-new
  block-local components. If a second block later needs them they graduate to
  shared primitives then — not pre-abstracted now.
- Open: a sunburst (polar partition via `d3-shape` `arc`, one small dep) and a
  measured-node-budget `<canvas>` fallback are deferred until real large-input
  evidence demands them; label bbox scale-to-fit (maximising font within a tile)
  and 2-D spatial arrow-key navigation are deferred in favour of threshold +
  search-to-jump. Clipping and ellipsis-truncation of every label to its tile
  bounds is not deferred — it is a correctness mechanism (see spec "Treemap
  model" / MED.BLK.TREE-R61).
