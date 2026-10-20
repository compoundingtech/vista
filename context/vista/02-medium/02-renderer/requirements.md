# Renderer — Requirements

The renderer owns the **render contract** in the medium composition: canonical
semantic React source must render a UI corresponding to its derived semantic
manifest. It is a thin contract that every block-library or App-local component
must satisfy.
The curated block library that realizes this contract lives in
[05-blocks](../05-blocks/requirements.md); the templates that compose blocks live
in [06-templates](../06-templates/requirements.md).

Builds on the [medium requirements](../requirements.md) and this subsystem's
[spec.md](./spec.md); system-level context in the
[root requirements](../../requirements.md); terms in
[ontology.md](../../ontology.md); the renderer spike under `.experiments/`. IDs are
path-scoped (`MED.REND-R*`); each requirement `refines:` its parent — the 02-medium
contract (`MED-R*`) or the charter (`VST-R*`). Decisions 0074 and 0076 define
ordinary React composition and publish-stable semantic topology.

## Requirements

- **MED.REND-R02 SemanticNode/SemanticManifest correspondence:** Rendered UI
  preserves the full SemanticNode envelope in the derived SemanticManifest:
  kind, relationships, status, refs, DataBindings, extensions, and matching
  `data-vista-id` targets. It preserves one data/runtime resolution policy.
  `refines: MED-R02`
- **MED.REND-R03 Addressable stable IDs:** Stable IDs are required only for
  addressable asks, decisions, cited evidence, reference or feedback targets,
  and RuntimeIslands. Ordinary Blocks and layout require no ID.
  `refines: MED-R01`
- **MED.REND-R04 Derived DataBindings:** Typed domain Blocks derive serializable
  DataBindings into SemanticManifest and resolve them uniformly in mutable and
  AppVersion views. AppSource declarations and executable component references
  never enter SemanticManifest.
  `refines: MED-R01`

## Acceptance

Rendered UI and derived SemanticManifest agree on every stable SemanticNode and
DataBinding. Acceptance exercises AppSource/SemanticManifest/DOM correspondence
with an equivalence-breaking control.
