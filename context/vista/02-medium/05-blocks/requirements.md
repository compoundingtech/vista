# Blocks — Requirements

The **block library** is the curated realization layer of the medium: Vista's
shipped, typed semantic React components. Where the contracts
(`02-renderer`, `03-data-sources`, `04-doctrine`) say what any block must satisfy,
this node *realizes* them as a versioned, packaged, Storybook-incubated library —
and hosts the heavy blocks that earn their own subsystem (code, mermaid,
system-explorer, treemap, telemetry, fork).

The requirements here are the cross-cutting concerns that span **all** blocks:
one importable versioned package, one shared Storybook, Vista UI-native theming, and
incremental reviewed delivery. Block-specific requirements live in the child nodes
and `refines:` the contract each specializes (render, data, or doctrine) — a block
node may carry requirements refining different contracts, which is what makes a
vertical block subsystem composable over the horizontal contracts (decision 0067).

System-level context, assumptions, and acceptable tradeoffs live in the
[root requirements](../../requirements.md); composite context in the
[medium requirements](../requirements.md); terms in this node's
[glossary.md](./glossary.md) and the [root ontology](../../ontology.md). IDs are
path-scoped (`MED.BLK-*`); each requirement `refines:` its parent — a charter
requirement (`VST-R*`) or the render contract (`MED.REND-R*`). Decisions: 0020
(doctrine blocks), 0024 (adopt @pierre), 0025 (genie composition), 0036
(Geist-native dark-first visual system), 0055 (treemap).

## Children

| Node | Scope | IDs |
| --- | --- | --- |
| [01-code](./01-code/requirements.md) | `diff` + `file-tree` blocks (wrap `@pierre`) | `MED.BLK.CODE-*` |
| [02-mermaid](./02-mermaid/requirements.md) | Mermaid-in-React diagram block | `MED.BLK.MERM-*` |
| [03-system-explorer](./03-system-explorer/requirements.md) | typed multi-dimensional graph + lenses | `MED.BLK.SYSX-*` |
| [04-treemap](./04-treemap/requirements.md) | value-proportioned hierarchy, partition layouts | `MED.BLK.TREE-*` |
| [05-telemetry](./05-telemetry/requirements.md) | Grafana island, data/pixel-frozen, licensing | `MED.BLK.TELEM-*` |
| [06-fork](./06-fork/requirements.md) | the decision-tree doctrine block | `MED.BLK.FORK-*` |
| [08-usage](./08-usage/requirements.md) | trust-preserving OMP usage and API-equivalent cost views | `MED.BLK.USAGE-*` |
| [09-terminal](./09-terminal/requirements.md) | read-only-first LivePty rendering and bounded attach UX | `MED.BLK.TERM-*` |
| [10-diff](./10-diff/requirements.md) | data-first semantic diff over exported lenses | `MED.BLK.DIFF-*` |

Thin blocks (`gh-previews`, `ask`, `status-line`, `settled`, and the trivial
declarative content blocks) do not earn a node; they are a flat roster in
[./spec.md](./spec.md). Provider-backed Blocks belong to the family that owns
their data: `PullRequestChecks` to `01-code`, `SpendByProject` and
`UsageOverTime` to `08-usage`.

## Requirements

### The block library is one importable, versioned package

- **MED.BLK-R01 Importable package:** The block library is a genie-composed
  pnpm-workspace package with a real export surface; the service and apps depend on
  it through the workspace, not via relative source paths (decision 0025,
  OQ-INTEGRATION-SEAM).
  `refines: VST-R40`
- **MED.BLK-R27 Independently versioned library:** The block library must be
  independently versioned and packaged so apps and the service consume a defined
  library version. It is a genie-composed pnpm-workspace package (`.genie.ts`), a
  real importable package the service and apps depend on through the workspace
  (decision 0025).
  `refines: VST-R40`

### The block library is incubated in one shared Storybook

- **MED.BLK-R26 Shared Storybook incubation:** The library must be developed and
  catalogued in the repo's shared Storybook (`/sk-storybook`) as its curation /
  incubation, screenshot-based visual-critique, and regression surface — one story
  per block with state variants (empty/loading/error · light/dark · dense/comfortable)
  plus composition stories (a full doctrine app, the options decision-tree, a
  hybrid). Storybook defaults to dark and must retain explicit light-mode coverage
  for affected stories (OQ-KIT-PACKAGING, decision 0036).
  `refines: VST-R40`
- **MED.BLK-R75 Catalog is not a semantic ceiling:** Storybook/catalog inclusion
  must not be required for a component or unprivileged kit to compose public Vista
  semantics and project an equivalent semantic manifest. The catalog remains the shared
  discovery, visual-audit, curation, and regression surface.
  `refines: MED.AUTH-R24`
- **MED.BLK-R77 Contract-driven Storybook coverage:** Each component's stories must
  cover the axes its contract exposes rather than a full Cartesian matrix. Across
  the catalog this includes a semantic-manifest inspector, interactions, keyboard,
  responsive layout, reduced motion, and failure states where applicable. Vista's
  Storybook build/test must participate in the shared serialized build and
  `check:all` CI surfaces, with explicit build dependencies for generated/island
  artifacts.
  `refines: VST-R41`

### The block library is Vista UI-native

- **MED.BLK-R07 Vista UI-native theming:** All blocks theme via
  `@vista/ui` styles, components, and tokens. `@pierre/diffs` /
  `@pierre/trees` (Shiki + Shadow DOM), Mermaid, and React Flow MUST be reconciled
  with Vista UI tokens so the whole library matches in dark/light — an acceptance gate
  (decisions 0024 and 0036).
  `refines: VST-R40`
- **MED.BLK-R10 Vista UI primitives first:** Shell controls, statuses, badges, tables,
  tabs, menus, inputs, and buttons use Vista UI components when available.
  Vista-specific blocks stay semantic but consume Vista UI tokens/classes and avoid a
  separate Vista brand accent.
  `refines: VST-R40`
- **MED.BLK-R48 Vista UI-native visual language:** Vista shell chrome and common UI
  primitives must use `@vista/ui` components when available.
  Domain-specific blocks remain Vista components, but must use Vista UI tokens/classes,
  dark-first density, restrained borders/radii, and semantic color only. Vista must
  not define a separate brand accent (decision 0036).
  `refines: VST-R40`

### The block library is type-honest and delivered incrementally

- **MED.BLK-R08 Type-honest:** `tsc` passes; type-safety claims are real (no `any`
  escape). Bespoke props are validated via effect Schema (decision 0016), and every
  semantic block emits schema-valid manifest records with stable IDs.
  `refines: MED.REND-R02`
- **MED.BLK-R09 Incremental, reviewed delivery:** The block library is delivered
  incrementally per block family; each family passes a sub-agent
  review/verify/visual-critique/refine pass against the Geist/Vercel target before
  it is accepted (decision 0036).
  `refines: VST-R41`

### Resizable viewports preserve useful space and intent

- **MED.BLK-R78 Useful resizable viewports:** Natural-flow content has no resize
  affordance. A finite-scroll Block's viewport is capped at its stable useful
  content extent, including when that cap falls below an authored minimum; a
  canvas Block has no content-derived cap because additional area remains
  useful. Authored policy, viewport safety, content semantics, and latent user
  intent remain independently observable inputs to the rendered size.
  `refines: VST-R02`

## Acceptance

An app can be authored using any block, rendered through the service, and
catalogued in Storybook with passing stories; the default dark theme is
Vista UI-native; light mode remains correct; diffs/trees match the library's
Vista UI-native theme; `tsc` and the Storybook build are green. Each heavy block's own
acceptance lives in its child node.
