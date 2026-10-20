# Runtime composition is a Genie-projected Vista policy

Status: accepted (infra interview Q1/Q2/Q6/Q7)

## Context

Decision 0006 established the zero-install dependency principle: reviews do not
carry their own `package.json`, install, or `node_modules`; the standing service
owns the runtime dependency set. That remains correct.

The stronger 0006 implementation claim that Vite can resolve every bare
specifier through only a shared root `node_modules` and "no alias map" has been
falsified by packaged Vista. `@overeng/geist-design-system` is a first-party
workspace package with pnpm injected-package semantics. It exists in the packaged
workspace, but not at the shared root resolution point Vite uses for reviews.
The packaged service only resolved it after adding explicit Vite aliases for the
first-class workspace package source paths.

The runtime already has an Effect Schema-backed `vistaRuntimeManifest` proof
covering provided imports, optimize deps, CSS imports, workspace closure dirs, and
the `https://esm.sh/` escape hatch. The packaged proof exercised a review importing
both `react-aria-components` and `https://esm.sh/zod@3.25.76`.

However, a standalone Vista manifest risks becoming a second package-composition
system beside Genie. Existing Genie idioms already make `catalog.compose(...)` +
`packageJson(data, composition)` the crisp boundary where emitted dependencies and
workspace closure metadata stay coupled. Vista should not duplicate that with a
parallel package graph.

The old runtime-manifest path is rebuildable projection/dev state, not durable
product authority. Per the migration-avoidance pattern, Vista should create a fresh
runtime-policy namespace from the new contract rather than migrate or compatibility
bridge the old authored manifest.

## Decision

Vista's runtime composition contract is **Genie-projected**:

- **Genie owns package composition.** Package deps, workspace deps, peer deps,
  injected workspace-package semantics, closure dirs, and Nix install closure stay
  in Genie composition (`catalog.compose(...)`, `packageJson(data, composition)`).
- **Vista owns runtime policy.** First-party runtime packages attach typed Vista
  runtime metadata at the package-composition boundary: provided import roots,
  optimize deps, CSS imports, remote import escape hatches, and first-party
  workspace source aliases.
- **The runtime manifest is a projection, not an independent source.** Vite config,
  scaffold/import validation, `vista debug`, and Nix/Genie closure checks consume the
  projected Vista runtime manifest emitted/validated from the Genie composition
  graph.
- **Cut over by contract namespace, not by compatibility.** The new authored surface
  is package-level Vista runtime metadata at the Genie package boundary, e.g. a typed
  `vistaRuntime(...)` contribution helper or equivalent. The old standalone
  `runtime-manifest.ts` authoring model is removed in the same breaking change; there
  are no fallback reads, old/new dual-write paths, or command shims.
- bare external packages still resolve through the service-owned shared
  `node_modules`; aliases are reserved for first-party workspace/runtime packages
  whose package-manager layout is not a stable public contract.

This supersedes only the "no alias map" implementation detail in decision 0006.
It does not reopen zero-install authoring, service-owned dependencies, or React
singleton dedupe.

The default contribution owner is the **package**, not the individual block:
`@vista/kit`, Geist, and future first-party runtime/provider packages each own
their baseline runtime surface beside their Genie package composition. Block-level
or provider-level contribution slices are valid only when that block/provider has an
independent lifecycle, optional loading boundary, or separate package boundary.
Until then, block dependencies roll up through their owning package's contribution.

## Options

- **A. First-class workspace packages are manually aliased; externals resolve from
  shared deps.** Good immediate repair and matches the package proof, but drift is
  likely as new kit/runtime packages appear.
- **B. Require every provided package to be root-hoisted into the shared
  `node_modules`.** Simpler Vite config, but brittle with pnpm injected workspace
  packages and already falsified by Geist.
- **C. Standalone Vista manifest drives dependency provisioning and Vite/runtime
  surfaces.** Rejected as the long-term ideal. It preserves composition locally, but
  risks making Vista runtime policy a second package manager.
- **D. Bundle internal workspace packages before serving.** More standalone, but
  adds a build layer that cuts against Vista's serve-from-source default and makes
  publish/debug loops heavier.
- **E. Hard-check a standalone manifest against Genie package closure.** Rejected.
  It is a compatibility/migration rung for state that is not authoritative; keeping
  it would leave two authored lists and conceal incomplete cutover.
- **F. Genie package composition carries typed Vista runtime metadata.** Chosen
  ideal. It embraces existing Genie composition and adds Vista runtime policy as a
  projection over the same graph, not a competing graph.

## Consequences

- The runtime manifest remains the service/debug/Vite consumable artifact, but it is
  generated or validated as a projection from Genie package composition.
- Runtime policy state uses a fresh contract namespace owned by the Genie/Vista
  projection. Old standalone manifest state is intentionally discarded/recomputed,
  not migrated in place.
- Adding a first-party runtime package should mean adding Genie package composition
  plus package-level Vista runtime metadata at the same boundary, not touching several
  unrelated arrays.
- Adding a normal block family inside `@vista/kit` should update the kit package's
  contribution. It should not create a separate contribution unless the block has
  its own lifecycle or optional loading boundary.
- The debug namespace can expose `vista debug runtime`, `vista debug deps`, or
  `vista debug imports <specifier>` as derived views rather than raw Vite or HTTP
  internals.
- VRS, tests, and implementation must stop treating "no aliases" as the ideal.
  The ideal is "no arbitrary per-review alias map"; first-party workspace aliases
  are valid when they are derived from manifest contributions.
- A remaining implementation delta exists until the current standalone
  `runtime-manifest.ts` and hard-coded service aliases are removed and replaced by a
  Genie-projected Vista runtime metadata path.
