# 0067 — Compositional restructure: contracts and realizations

Status: Accepted. Structural counterpart to
[0066](./0066-app-centric-ontology-and-leitwoerter.md) (the vocabulary). This
record fixes the *node tree*; 0066 fixes the *words*.

## Context

The 2026-07-03 layered-composition restructure kept layering by **concern**
(render, data, doctrine — all horizontal) but let each concern node carry both a
*contract* and heavy *block-specific* realizations:

- `02-component-kit` mixed the render contract (tagged-union renderer, resolve-by-key)
  with two heavy block specs (system-explorer, treemap).
- `03-data-sources` mixed the provider/freeze contract with the entire telemetry
  block (Grafana island, data/pixel-frozen, licensing) — its spec literally
  contained a "Rendering — Grafana island" section, proving the horizontal split
  was already broken for the telemetry block.
- The top glossary carried block-specific terms (`lens`, `treemap block`,
  `telemetry island`, `data-frozen/pixel-frozen`, `diff/file-tree block`).

Block-specific complexity leaked up into the concern contracts and the top
glossary. This decision separates **contracts** (what any block/template must
satisfy) from **realizations** (the curated blocks and templates themselves), so a
block's complexity is contained in its own subsystem and the contracts stay thin.

## Decision

### Contract / realization split

`02-medium` is decomposed into **four contract layers** and **two realization
layers**. A realization node's requirements `refines:` whichever contract(s) they
specialize — a block can refine more than one contract (`refines:` is per
requirement, not per node), which is exactly what makes a vertical block subsystem
composable over horizontal contracts.

```
02-medium  (the app = a component tree composed under contracts)
├── 01-authoring    CONTRACT   what a component/app IS — portable doc, node-safe, escape hatch, stable ids
├── 02-renderer     CONTRACT   render — tagged-union + exhaustive renderer, resolve-by-key   [was 02-component-kit]
├── 03-data-sources CONTRACT   data — dual-mode live/frozen, provider shape, freeze, no-secrets  [thinned]
├── 04-doctrine     CONTRACT   composition principles — lead with an ask, drive a decision, subordinate rejects
├── 05-blocks       REALIZE    the curated block library (+ packaging/Storybook/Geist) + heavy-block subsystems
│   ├── 01-code             diff + file-tree (@pierre wrappers, Shiki→Geist)
│   ├── 02-mermaid          Mermaid-in-React
│   ├── 03-system-explorer  React Flow + elkjs, lens
│   ├── 04-treemap          d3-hierarchy, partition/icicle, completeness
│   ├── 05-telemetry        Grafana island, data/pixel-frozen, licensing   [absorbs telemetry detail from data-sources]
│   └── 06-fork             the decision-tree doctrine block               [refines doctrine]
└── 06-templates   REALIZE    per-kind app scaffolds — review · design-interview · options-comparison ·
                              telemetry-exploration · code-recap; realizes doctrine, composes blocks
```

**Contracts are thin.** `02-renderer` keeps only the render contract (tagged-union
model, exhaustive `assertNever` switch, resolve-by-key, host registries).
`03-data-sources` keeps only the generic provider/freeze contract; all
telemetry-specific detail (live telemetry sources, the Grafana island, backend-faithful
snapshots, licensing containment, pixel-frozen) moves into `05-blocks/05-telemetry`.

**The block library owns packaging.** The cross-cutting concerns that span *all*
blocks — one versioned pnpm-workspace package, one shared Storybook (the curation /
incubation + visual-critique surface), Geist-native theming, incremental
per-family delivery — live at `05-blocks` (the composite over all blocks), not at
the renderer. Individual heavy blocks are child subsystems; thin blocks
(gh-previews, ask, status-line, settled, and the trivial declarative blocks) are a
flat roster in `05-blocks/spec.md`.

**Templates realize doctrine.** `06-templates` realizes the `04-doctrine` contract
the way blocks realize the render/data contracts: each template is a curated
app-scale component that embodies the doctrine principles for one kind. Ordered
last because it composes everything below it.

### Extraction threshold

A block earns its own subsystem node only with genuine own *requirements + spec +
decisions* depth. Nodes: `code` (diff+file-tree), `mermaid`, `system-explorer`,
`treemap`, `telemetry`, `fork`. Everything else stays a roster entry. This is
deliberately generous (per the interview) but still refuses thin nodes that would
merely restate the roster.

### ID scheme

Path-scoped IDs continue from 0066's predecessor. New realization nodes get
path-scoped prefixes; requirements that **move** are renumbered under their new
owner and bridged in `mapping.md`. Requirements that **stay** keep their IDs (IDs
are stable handles; a node's human name changing does not force a prefix churn),
except where a moved requirement's home makes the old prefix actively misleading.

| Node | Prefix |
| --- | --- |
| 02-medium/02-renderer | `MED.REND` (render-contract reqs formerly under `MED.KIT`) |
| 02-medium/05-blocks | `MED.BLK` (composite) |
| &nbsp;&nbsp;├ 01-code | `MED.BLK.CODE` |
| &nbsp;&nbsp;├ 02-mermaid | `MED.BLK.MERM` |
| &nbsp;&nbsp;├ 03-system-explorer | `MED.BLK.SYSX` |
| &nbsp;&nbsp;├ 04-treemap | `MED.BLK.TREE` |
| &nbsp;&nbsp;├ 05-telemetry | `MED.BLK.TELEM` |
| &nbsp;&nbsp;└ 06-fork | `MED.BLK.FORK` |
| 02-medium/06-templates | `MED.TMPL` |

### Glossary is inherited downward

The top glossary holds only leitwörter (0066) and cross-cutting lifecycle terms.
Each node's glossary owns the terms it introduces: `lens` → `05-blocks`
(shared by system-explorer + treemap); `telemetry island`, `pixel-frozen` →
`05-blocks/05-telemetry`; `provider`, `live/frozen`, `data source`, `data-frozen`
→ `03-data-sources`; `ask`, `archetype`→`template` → `04-doctrine` /
`06-templates`; `diff/file-tree block` → `05-blocks/01-code`; `treemap block` →
`05-blocks/04-treemap`.

## Consequences

- Telemetry's render+data complexity is contained in one vertical block subsystem
  instead of split across two contract nodes.
- Adding a heavy block is a local, additive operation: a new `05-blocks/NN-*` node
  refining the contracts it uses, with no change to the contracts or the glossary
  top.
- Cost: a second restructure on top of the path-scoped-ID one — ID renumber,
  `refines:` chains, and `mapping.md` all move with it. Staged into an
  app-rewrite commit (0066 vocabulary) then a node-extraction commit (this record).
