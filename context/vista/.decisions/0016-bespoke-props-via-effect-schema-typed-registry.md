# Bespoke component props via effect Schema, keyed by a typed registry

Status: superseded by 0074

Ordinary React composition and derived semantic bindings supersede the typed
`custom` registry below. The registry remains rationale and evidence for the
retired serialized-document renderer; it is not a current App API.

## Context

The `custom` escape-hatch block (decision 0008) carries bespoke component props.
Because the doc is portable/serialized (MED.AUTH-R25), those props arrive as `unknown` JSON
at render time. How to type them before a component graduates into the kit
(OQ-CUSTOM-TYPING)? Options proven in code: module augmentation (compile-time
correlation only), untyped (no guarantee), or an `effect` Schema.

## Decision

Define each bespoke component's props as an `effect` `Schema.Struct`, registered
under a **typed-keyed registry** (`as const satisfies`). One definition yields:

- the compile-time prop type (`Schema.Type`),
- runtime validation of the deserialized `unknown` props at render (proven to
  catch a bad value with a precise path),
- author-time `componentKey` ↔ props correlation (from the typed-keyed registry),
- a trivial graduation lift — the schema *becomes* the first-class block's payload
  contract, reused verbatim.

This matches the house "schemas are the single source of truth" doctrine and
dominates module-augmentation (author-time only, blind to the wire value) and
untyped (no guarantee anywhere).

## Consequences

- The kit's renderer validates `custom.props` against the registered schema before
  rendering; failure is a bounded render error, not silent garbage.
- Couples to OQ-REGISTRY-KEYS: a generated union of registered keys would make the
  schema registry exhaustive at compile time (decide generated vs hand-maintained).
- The same Schema-first approach is the natural contract for data-backed blocks and
  the `system-explorer` model, keeping one validation idiom across the kit.

## Greenfield supersession

App-local and block-library components use ordinary typed React props and compose
directly. Semantic data/freeze bindings are declared through semantic component
props and derived into the manifest; Apps author no component, data, or model
registry.
