# Treemap — Spec

Specifies the `treemap` model — a value-proportioned hierarchy with partition
layouts, the second model-backed exploration block. Builds on
[requirements.md](./requirements.md); the React/semantic-manifest boundary is
[../../02-renderer/spec.md](../../02-renderer/spec.md); it inherits the lens/scene
projection pattern from [../03-system-explorer/spec.md](../03-system-explorer/spec.md).
Requirement IDs are path-scoped in `./requirements.md`.

## Status

Draft.

## Treemap model

A large value hierarchy is one typed tree: `TreemapNode {id, label, value?,
children?, metrics?}` resolved by key into a `TreemapModel`, decoded via effect
`Schema` at the block boundary (like `system-explorer`; search needs the whole tree
resident, so the seam is by-key, not inline). The model is authored data
(MED.AUTH-R25), produced inline or by the library's node-safe builders — a generic
`buildTreemapModel(entries)` (path→tree, full tree by default; depth-cap /
sibling-fold are opt-in for frozen snapshots only) plus thin adapters `fromGitDiff`
(a `git diff --numstat`) and `fromDu` (a `du -k` snapshot) that attach domain metrics
(insertions/deletions, own-size residuals) — so any path-keyed magnitude becomes a
treemap without hand-rolling the tree. A **lens** ([../glossary.md](../glossary.md))
is a pure serializable projection selecting the zero-interaction default (layout,
depth cap, color encoding, root). Rendered space-filling from d3-hierarchy's
`treemap()` and `partition()` layout functions as custom SVG: an area-packed
**treemap** or a **partition** layout (icicle / flame) over the *same* model,
switchable at view-time (layout is view-state, never the model; both layouts come
from `d3-hierarchy` — one dependency). Focus, hover, search mute, and recoloring
are paint-only restyles. Structural changes — root, depth cap, layout, hidden
set, or canvas dimensions — recompute the scene. Tile position and size are SVG
geometry attributes; only paint properties transition. Container resize
suppresses transitions until one frame has painted at the new dimensions, so a
drag cannot leave overlapping or stale tiles.
Mechanisms inherited from MED.BLK.SYSX-R44 are semantic-zoom drill
with depth-bounded rendering and summarized containers; small-node folding into a
labelled, countable, drillable aggregate, and an internal node's own residual value
(e.g. a directory's own files under cumulative sizing) surfaced as a synthetic
labelled leaf so leaf values sum to the exact total (completeness, MED.BLK.TREE-R61);
search-to-zoom with path-to-root reveal; a sibling-aware breadcrumb; click-to-focus
selection distinct from drill driving a pinned detail panel with an optional
caller-supplied detail-preview component (MED.BLK.TREE-R62). Every tile label is
clipped and truncated (ellipsis) to its own bounds so no label renders outside its
tile or overlaps a sibling, and a container header's value label is right-aligned and
never collides with its name. Color is a selectable free restyle — categorical
recomputed relative to the current zoom root (not the whole-tree root), by depth, or a
sequential/diverging scale over the node value or a `metrics` field. Exposed as a
`treemap` block resolving its model by key (MED.REND-R04); a heavy viz closure, so a
`React.lazy` renderer arm (SSR-safe, not the Grafana island; decision 0054).
Geist-token theming is an acceptance gate (MED.BLK-R07, 0036). A sunburst
(polar partition via `d3-shape` `arc`) and a measured-node-budget `<canvas>` fallback
are out of scope until data demands them (decision 0055).

## Categorical facets and facet-scoped default-hide (decision 0068)

`TreemapNode` also carries `facets?: Record<string, string>` — the **categorical
twin** of numeric `metrics` (`facet` / `provenance`, [glossary.md](./glossary.md)).
The generic model never interprets a facet value; it is a domain-agnostic label the
git adapter or any builder stamps on leaves, so the same block serves disk/bundle
models and classes like test/lockfile with no change. Decoded in the same
`Schema.suspend` `TreemapNode` boundary as the rest of the model (optional,
additive).

A **lens** may declare `hiddenFacets?: Record<string, readonly string[]>` (e.g.
`{ provenance: ['generated'] }`), the zero-interaction default hiding policy. At
projection time a facet match resolves to a leaf-id set that seeds the existing
`excludedIds` filter. Exclusion removes leaves before layout and re-sums the
visible hierarchy. The original model and filter inventory retain every hidden
leaf, the resting `"N hidden"` badge exposes the incomplete view, and the
reviewer can reveal any leaf. Container-emptying (an all-generated directory)
falls out of re-sum; there is no container-level facet. A lens without
`hiddenFacets` hides nothing.

The git adapter binds the source of truth (decision 0068, [authoring
requirements](../../01-authoring/requirements.md)): `fromGitDiff` accepts a
`FileChange { path, insertions, deletions, provenance }[]` (keeping the
`numstat`-string overload for the no-attributes case) and stamps
`facets.provenance` on leaves. `provenance` (`'authored' | 'generated' | 'vendored'`)
is a typed closed enum only at the adapter boundary, derived from `.gitattributes`
`linguist-generated` / `linguist-vendored` via one batched `git check-attr` at author
time and frozen into the review; the pure layers never call git. The treemap itself
stays git-blind.

## Consumer contract

The block exposes these composition seams:

| Seam | Contract |
| --- | --- |
| `chrome` | `full` renders search, breadcrumb, detail, legend, and controls; `compact` omits standalone search/detail/legend and places the breadcrumb in the controls row |
| `rootId` | Controlled display root; `undefined` means the model root. A changed value re-roots the map and clears its local selection |
| `excludedIds` + `onExcludedIdsChange` | Controlled hidden leaf-id set. Exclusion occurs before layout, so visible values and geometry are re-summed |
| `onSelect` | Receives the real model node for an explicit pin, drill, or breadcrumb action, and `undefined` when cleared |
| `onActivate` | Receives a leaf opened by Enter or double-click; containers drill instead |
| `onHide` | Receives a node excluded by Option/Alt-click or Delete |
| `onSolo` | Receives the sole node retained by Option/Alt+Shift-click |
| `filter` | Shows or suppresses the hierarchical hide/show control; defaults on in `full` chrome and off in `compact` chrome |
| `filterRenderValue` | Replaces the filter row's value cell while preserving hierarchy and selection behavior |
| `controls` | Inserts consumer-owned controls in the controls row after the filter |
| `canvasHeight` | Sets any CSS height for the canvas. `"100%"` fills a bounded parent through the figure, stage, and canvas chain |

`rootId` and `excludedIds` let a composition own scope and visibility while the
standalone block keeps both as local view state. Selection callbacks resolve
synthetic aggregate tiles to their real model node, so consumers never receive
projection-only identities.

## Provider-derived disk treemap

`DiskTreemap` is the domain Block for the `disk-index` Provider's server-derived
`treemap` Operation:

```text
disk snapshot
  -> projection({ perspective, boundaryId })
  -> buildTreemapModel(projection, lens?)
  -> ready | degraded | failure
  -> DiskTreemap -> Treemap
```

The Block binds `diskIndex.ops.treemap` with a declared `host`, `perspective`,
`boundaryId`, and an
optional `{ maxDepth?, foldBelowFraction? }` lens. It uses frozen mode with
acknowledged effectful capture. This is a named server Operation rather than a
client Projection: it owns the projection policy, model construction, typed
availability outcome, and one final-value Snapshot entry. Its key is computed
from the full Schema-encoded argument object, including the lens when present.

`ready { value }` and `degraded { value, reasons }` both carry a decoded
`TreemapModel`. `DiskTreemap` renders that model through the existing `Treemap`;
for `degraded` it also renders every Provider reason in a partial-index banner.
`failure { reason, message }` renders the typed error instead of manufacturing an
empty hierarchy. The Block does not read the disk-index file or reconstruct
degraded evidence in the browser.

`Operation.map(diskIndex.ops.projection, …)` remains the supported pure-client
alternative when an App needs to reuse the source projection under several local
lenses. It adds no derived Snapshot entry and is not the implementation of the
public `DiskTreemap` Block.
