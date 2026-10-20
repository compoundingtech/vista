# Vista VRS requirement-ID mapping (global → path-scoped)

The 2026-07-03 restructure moved Vista's VRS to a layered composition with
**path-scoped** requirement IDs. Numbers are preserved; only the owning-node
prefix was added (e.g. `R58` → `SVC-R58`). This table is the old→new bridge for
historical references (commits, issues, external notes).

Route examples using `/r/<slug>` are historical legacy shorthand. Decision 0077
amends current identity to `/r/<encoded-owner>/<local-slug>/...`.

| Node | Prefix | IDs (old `R<n>` → `<prefix>-R<n>`) |
| --- | --- | --- |
| Charter (root) | `VST` | R01, R02, R03, R04, R36, R37, R38, R39, R40, R41, R64, R65, R66 |
| 01-service | `SVC` | R05, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R55, R57, R58 |
| 02-medium/01-authoring | `MED.AUTH` | R22, R23, R24, R25, R59 |
| 02-medium/02-component-kit | `MED.KIT` | R26, R27, R42, R43, R44, R47, R48, R60, R61, R62, R63 |
| 02-medium/03-data-sources | `MED.DATA` | R28, R29, R30, R31, R46, R49, R50, R51, R52, R53, R54 |
| 02-medium/04-doctrine | `MED.DOC` | R32, R33, R34, R35 |
| 03-agent-interface/01-cli | `AGT.CLI` | R06, R08, R56, R67, R68, R69 |
| 03-agent-interface/02-skill | `AGT.SKILL` | R07 |
| 04-feedback/01-interview | `FDB.IVW` | R45 |
| 05-observability | `OBS` | R69, R70, R71, R72, R73 |

## 2026-07-03 ontology + compositional restructure (decisions 0066, 0067)

The second restructure separates **contracts** from **realizations** and adopts an
app-centric ontology. Nodes and IDs move as follows (old path-scoped → new):

| Was | Now | Notes |
| --- | --- | --- |
| `02-medium/02-component-kit` (`MED.KIT`) | split | render contract → `02-renderer` (`MED.REND`); realizations → `05-blocks` |
| kit `KR02` / `KR03` / `KR04` (render contract) | `MED.REND-R02` / `MED.REND-R03` / `MED.REND-R04` | tagged-union + exhaustive renderer, stable ids, resolve-by-key — stay in the renderer (the kit's 2nd/3rd/4th reqs, not literal `MED.KIT-R02/03/04`) |
| kit `KR01` (importable package) | `MED.BLK-R01` | composite |
| `MED.KIT-R26` + kit `KR06` (shared Storybook) | `MED.BLK-R26` | **merged** — both were "shared Storybook incubation" |
| `MED.KIT-R27` (versioned kit) | `MED.BLK-R27` | composite |
| kit `KR07` / `KR10` (Geist theming / primitives) | `MED.BLK-R07` / `MED.BLK-R10` | composite |
| `MED.KIT-R48` (Geist visual language) | `MED.BLK-R48` | composite |
| kit `KR08` (type-honest) | `MED.BLK-R08` | refines `MED.REND-R02` |
| kit `KR09` (incremental delivery) | `MED.BLK-R09` | composite |
| kit `KR05` (doctrine-expressive blocks) | `MED.BLK.FORK-R05` | the doctrine *block* becomes a realization refining `MED.DOC-R33` |
| `MED.KIT-R47` (diff + file-tree) | `MED.BLK.CODE-R47` | refines `MED.REND-R04` |
| `MED.KIT-R42/R43/R44` (system-explorer) | `MED.BLK.SYSX-R42/R43/R44` | refine `VST-R02` |
| `MED.KIT-R60/R61/R62/R63` (treemap) | `MED.BLK.TREE-R60/R61/R62/R63` | refine `VST-R02` |
| `MED.DATA-R49/R50/R51/R52/R53/R54` (telemetry detail) | `MED.BLK.TELEM-R49/R50/R51/R52/R53/R54` | Grafana island, data/pixel-frozen, licensing move out of the data contract; refine the specific data/render/authoring-lazy/charter parents |
| `MED.DATA-R28/R29/R30/R31/R46` (generic provider/freeze) | unchanged | stay as the thinned data contract |
| (new) Mermaid-in-React block | `MED.BLK.MERM-R01` | **new** — was a roster/spec entry in the kit, not a numbered requirement |
| (new) per-kind app scaffolds | `MED.TMPL-R01..R05` | **new** — `06-templates` realizes `MED.DOC` and absorbs the "archetype"→template concept; the per-kind body doctrine moved here from `04-doctrine` |
| `MED.DOC-R32..R35` (principles) | unchanged | `04-doctrine` keeps the principles; the fork *block* and per-kind bodies move to realizations |

Decision ID-token updates (in-tree cross-references only, no narrative change):
`0018` `MED.KIT-R42–R44 → MED.BLK.SYSX-R42–R44`; `0055`
`MED.KIT-R44/R60/R61/R62/R63 → MED.BLK.SYSX-R44 / MED.BLK.TREE-R60/R61/R62/R63`;
`0017` `MED.KIT-R27 → MED.BLK-R27`; `0054` `MED.DATA-R52 → MED.BLK.TELEM-R52` (R52
reads generically but follows the literal telemetry mapping). This table and `0067`
retain `MED.KIT`/`MED.DATA` tokens deliberately as the old→new bridge.

Term renames (decision 0066): **review → app**, **archetype → template**,
**component kit → dissolved** (the versioned block set is `05-blocks`; the render
contract left behind is the *renderer*), **graduation → curation**, **doctrine →
refined to principles-only**. These are concept renames. Historical
`/r/<slug>` examples name the legacy/unmanaged namespace; decision 0077 defines
managed identity and routes as owner × local slug.

Current greenfield authoring is one ordinary zero-prop React App component
default-exported from `app.tsx`; Vista derives the semantic manifest and bindings.
The following accepted mechanisms are explicitly historical:

| Decision | Historical mechanism | Current replacement |
| --- | --- | --- |
| 0008 | declarative document plus React escape hatch; two render paths | ordinary React composition through one App path |
| 0015 | typed authored spine plus prose-leaf MDX | semantic React source plus derived manifest |
| 0016 | typed `custom` component registry | ordinary typed React props plus derived semantic bindings |
| 0029 | published source served by Vite | receipt-backed self-contained immutable static version |
| 0034 | definition helper, registry props, scaffolded bootstrap, metadata sidecar | default App component; Vista-owned bootstrap and derived metadata |
| 0053 | project-local source and directory-derived identity | owner catalog source, exact owner/local slug, and derived App projection |
| 0054 | definition-helper thin shell | default App with stable lazy Islands |
| 0057 | optional authored shell and parallel bespoke path | Vista-owned bootstrap and one ordinary React path |
| 0058 | legacy document metadata projection | trusted App evaluation plus static-build smoke in one transaction |
| 0059 | `custom` plus published Vite/remote resolution | ordinary App-local React plus self-contained static publication |

## Decisions

Decision records keep their **global numbers** and live in the hidden root
[`.decisions/`](.). Attribution to an owning node is by the decision's own
`Status:`/prose, not by physical location (most decisions are cross-cutting).

Decision
[0088](./0088-pull-request-review-composes-parts-and-zoom-is-scope.md)
owns the `pull-request` composition boundary and the zoom-is-scope contract.

Decision
[0097](./0097-content-aware-block-viewports.md) owns the separation of
authored policy, viewport safety, content semantics, and latent resize intent.

Decision
[0098](./0098-ambient-rhythm-and-explicit-composition-groups.md) owns the
hybrid ambient-plus-explicit composition model and its shared spacing tiers.

Decision
[0099](./0099-semantic-diff-is-data-first-over-exported-lenses.md) owns the
data-first semantic diff surface, its H2/S1/A3 frame chrome, the text shape
rule, and the per-lens defaults.


> Note: the former `0036` number-collision is resolved — the control-plane
> decision is now `0065-control-plane-rpc-boundary`; `0036` is solely
> `0036-geist-native-dark-first-visual-system`.
