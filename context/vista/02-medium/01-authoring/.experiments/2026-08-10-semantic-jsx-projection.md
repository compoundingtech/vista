# Experiment: semantic JSX projection (2026-08-10)

## Question

Idiomatic JSX can be canonical UI while a minimal serializable semantic manifest
serves nonvisual consumers. Public semantic primitives
can support higher-level unprivileged components without making the shared catalog
a semantic ceiling.

## Method

Four bounded experiments exercised the actual seams. The old/new comparison used
base `06b99f401f5af2f6a96e4e71e0a041c47a083b2b`, a two-section/four-block review, normalized projection equality, an
intent-breaking positive control, and rendered-byte comparison. Primitive
evaluation compared the first six cases before/after public primitive composition,
then applied a deliberately fixed-kit control to all 14 concepts. Storybook was
audited from checked-in stories/config. The recipe prototype
ran accepted/rejected cases and adversarial counterexamples.

## Result

| Seam | Exact result | Consequence |
| --- | --- | --- |
| Old/new projection | `sameDoc=true`, `projection=true`, `render=true`; positive control caught; HTML `3744/3744` bytes and broken control `3754` | JSX can preserve tested projection/render behavior; it does not justify persisting the full tree |
| Primitive evaluation | First six cases `56/56`; adversarial fixed-kit control `10/14` concepts, with two duplicate prop bundles and primitive soup | Public primitives are viable, but kit composition needs contract tests; catalog presence is not proof |
| Storybook audit | 21 variants were all direct stories across 26 files; 13 `AllStates`; zero `play`, `argTypes`, viewport, or story-level a11y; Vista was absent from the shared serialized-build and Netlify lists, its test was outside `check:all`, and the island artifact had no explicit build-task dependency | Storybook supplies visual examples, not a complete semantic or behavioral admission gate |
| Recipe expansion | Focused suite: `9` passed, `0` failed, `14` assertions; nevertheless accepted a hidden side effect, `document` access, a forged node containing a function, and a nested dangling ref; TypeScript config failed | Recipe validation is partial evidence; its trust/isolation and type contracts are not established |

Semantic records read naturally as children. Scalars, configuration, bulk payloads,
and data references remain props; treating bulk data as children obscures structure
and weakens schema diagnostics.

## Conclusion

Adopt canonical React source + minimal semantic manifest and the public-primitive -> common-component ->
unprivileged-kit layering. Ordinary React function components emitting explicit
semantic primitives are settled (decision 0074); no mandatory recipe or
`defineComponent` is required. DQ4 covers only the production evaluator's trust or
isolation guarantee and its hooks, context, async, determinism, diagnostics,
reference-integrity, literal-child, fragment, and forged-node guarantees.

### Ordinary versus defined function components

Ordinary and defined function components produced byte-identical 14-concept intent.
Hooks, context, maps, conditionals, and nesting worked; tested nondeterminism,
dangling refs, malformed nodes, Suspense/async output, and thrown errors failed
closed. `defineComponent` metadata was unused and supplied no projection power.

The independent attack found valid-looking forged types passed, literal children
and source locations were lost, async/ref coverage was narrow, double rendering did
not catch hidden effects or provide isolation, and fragments were untested. This
supports ordinary components as the authoring capability (decision 0074) while
leaving the production projection contract open.

### Static source artifact and stable topology

A bounded spike built idiomatic React source with an explicit-marker-only manifest
and served a clean copied directory without server-side TSX evaluation. The browser
executed the bundle and source maps embedded sources. Clean-copy serving, routes,
inventory, DOM parity, and Island cases passed. Red controls for missing/tampered
assets, path leakage, wrong base paths, semantic divergence, and async topology also
passed. Builds were byte-identical within one root but source maps varied across
roots; supplied nondeterminism controls are not a general proof.

Authenticity and tool provenance failed adversarially: modified JS plus a regenerated
manifest and forged Vite version passed. Decision 0076 therefore requires an
externally trusted root binding rather than self-reported artifact metadata.

## VRS Impact

Amends decisions 0008 and 0015, updates MED.AUTH-R22/R24/R25 and adds MED.BLK-R75,
defines the semantic manifest in the ontology, leaves DQ4 open, and records DQ5 as
resolved by decision 0075.
