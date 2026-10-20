# Renderer — Spec

This node owns SemanticNode/SemanticManifest correspondence. Requirements are in
[requirements.md](./requirements.md); AppRoot shape in
[01-authoring](../01-authoring/spec.md).

## Correspondence

Vista evaluates AppRoot and derives a schema-versioned SemanticManifest.
Addressable SemanticNodes produce matching stable `data-vista-id` targets;
presentation-only React produces none.

SemanticManifest contains App metadata, SemanticNodes and relationships,
provenance, and derived DataBindings. It is nonvisual evidence, not a render
tree or UI authority. Malformed nodes, duplicate IDs, dangling references,
nondeterministic topology, and SemanticManifest/DOM divergence fail validation.

Typed domain Blocks derive DataBindings. AppSource supplies neither DataBindings
nor Providers. Provider resolution belongs to
[03-data-sources](../03-data-sources/spec.md).

Browser-only behavior varies only below a RuntimeIsland. It cannot add, remove,
or mutate SemanticNodes. Evaluation runs trusted first-party code and is not a
sandbox.

## AppVersion rendering

Publish produces one self-contained immutable AppVersion from validated
AppSource. The static runtime serves only verified AppVersion files and never
evaluates TSX or resolves ambient repository, dependency, or network input.
Invalid publication state fails closed rather than falling back to the mutable
AppSource. Publication mechanics are owned by the service contract.
