# Medium Requirements (the app)

The **app medium** is Vista's compounding heart: the artifact an agent produces
and a human reads. An app is authored as semantic JSX and exposes a **portable,
serializable semantic projection** for doctrine, indexing, feedback targeting, and
freezing. Normal React source remains canonical UI. It is realized by this
node's six children, split into **four contracts** (what any block/template must
satisfy) and **two realizations** (the curated blocks and templates); the
requirements here are the cross-cutting contracts that bind those children into one
coherent medium (decision 0067).

System-level context, assumptions, and acceptable tradeoffs live in the
[root requirements](../requirements.md); terms in [ontology.md](../ontology.md).
IDs are path-scoped: this composite owns `MED-R*`; each requirement `refines:` a
charter requirement (`VST-R*`). Descendant requirements (`MED.AUTH-R*`,
`MED.REND-R*`, `MED.DATA-R*`, `MED.DOC-R*`, `MED.BLK-*`, `MED.TMPL-R*`) `refines:`
these `MED-R*` contracts, a sibling contract, or the charter directly — a
realization requirement refines whichever contract it specializes.

## Children

**Contracts** — what any block/template must satisfy:

| Node | Scope | IDs |
| --- | --- | --- |
| [01-authoring](./01-authoring/requirements.md) | the document / content model — the contract every other child realizes | `MED.AUTH-R*` |
| [02-renderer](./02-renderer/requirements.md) | render contract and source/projection equivalence | `MED.REND-R*` |
| [03-data-sources](./03-data-sources/requirements.md) | the live/frozen data half (providers) that feed data-backed blocks | `MED.DATA-R*` |
| [04-doctrine](./04-doctrine/requirements.md) | the composition principles that constrain the document's shape | `MED.DOC-R*` |

**Realizations** — the curated library and scaffolds that satisfy the contracts:

| Node | Scope | IDs |
| --- | --- | --- |
| [05-blocks](./05-blocks/requirements.md) | the curated block library (+ packaging/Storybook/Vista UI) and 6 heavy-block child subsystems | `MED.BLK-*` |
| [06-templates](./06-templates/requirements.md) | per-kind app scaffolds that realize doctrine and compose blocks | `MED.TMPL-R*` |

Within-medium order (authoring → renderer → data → doctrine → blocks → templates):
the semantic **projection is the portable contract**; the renderer preserves its correspondence to the UI; providers feed
its data-backed blocks; doctrine constrains its shape; the block library *realizes*
those blocks; templates *realize* doctrine as per-kind app bodies composed of blocks.

## Requirements

### The medium is a portable, serializable document

- **MED-R01 Portable, serializable semantics:** The app must project semantic JSX to
  serializable typed semantics that reference data and runtime components by stable
  **string key** only (never executable closures), and
  carries a stable `id` on every block and addressable sub-entry. This is what
  lets doctrine, indexing, feedback, and freezing share one semantic seam. It does
  not require that seam to contain the complete render tree.
  `refines: VST-R03, VST-R04`

### React rendering corresponds to the semantic manifest

- **MED-R02 Canonical React and manifest equivalence:** Normal React source must be
  the canonical UI. Its rendered semantic elements must correspond by stable ID to
  the minimal semantic manifest, and data/runtime bindings must follow one policy in
  draft and frozen versions. The manifest must not duplicate the visual tree.
  `refines: VST-R03`

### The medium is fed by data, live or frozen, behind one schema

- **MED-R03 Data-fed blocks, live or frozen:** A data-backed block's data must be
  bound by key to a server-side provider and resolvable in two modes — live at view
  time or frozen into the immutable published version — decoding through the **same**
  schema so live and frozen agree with no codegen, with the mode always explicit to
  the viewer and no secrets embedded in a published artifact.
  `refines: VST-R03`

### The medium's shape is governed by doctrine

- **MED-R04 Doctrine governs the document's shape:** The document's structure must be
  constrained by app doctrine — lead with the ask, locked/open as a first-class
  axis, evidence reachable from the ask, and structure that fits the app's
  template — taught and advisorily checked rather than hard-gated, so an app drives
  decisions instead of producing slop.
  `refines: VST-R03`
