# Authoring — Intuition

*For: why semantic React source is the medium's contract · Assumes: the medium
composition ([../intuition.md](../intuition.md)).*

Authors should use React's ordinary composition model without making Vista infer
meaning from arbitrary visual markup. Explicit semantic primitives resolve that
tension: the App remains normal React, while Vista can derive a small, portable,
auditable semantic manifest.

The canonical source is one `app.tsx` default-exporting one zero-prop App
component. Presentation components remain visually free. Semantic components
compose public markers for sections, asks, decisions, evidence, references, and
data/freeze bindings. Runtime behavior remains beneath stable Island markers.
Vista evaluates the trusted App synchronously at publish and derives the manifest;
the author maintains no parallel document, registry, metadata sidecar, or render
path.

Two properties keep this model compounding rather than sprawling:

- **Derived portability (MED.AUTH-R25):** the manifest records semantic identity
  and bindings, not React closures or a duplicate UI tree. Doctrine, indexing,
  bounded-choice targeting, and freezing share this nonvisual seam.
- **Curation (MED.AUTH-R24):** public primitives compose in ordinary shared or
  App-local components. Storybook makes proven components discoverable and
  auditable, but catalog admission grants no semantic privilege.

The evaluator is deliberately trusted and in-process. This matches Vista's
first-party author trust domain and is an operational determinism boundary, not a
security sandbox. An untrusted author model would require a different architecture.
