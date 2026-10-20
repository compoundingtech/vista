# Client imports fail fast with typed errors

Status: accepted (infra interview Q3/Q4/Q5)

## Context

Decision 0044 makes the runtime manifest the source of truth for what a Vista
review may import: provided import roots, first-party aliases, optimize deps, CSS
imports, workspace closure dirs, and allowed remote escape hatches.

If Vista only validates imports at publish or package-build time, agents can spend
time authoring against accidental local dependencies that will fail later. If Vista
lets Vite resolve anything it can find, the manifest becomes documentation rather
than a boundary. The trusted-author model means this is not a security sandbox; it
is an operational and reproducibility boundary.

## Decision

Draft serving must fail fast when review client code imports a bare specifier that
is neither:

- local/relative;
- provided by the composed runtime manifest;
- matched by an allowed pinned remote escape-hatch pattern such as
  `https://esm.sh/zod@3.25.76`.

The failure must be an expected, typed boundary error, not an opaque Vite resolver
stack. The validation boundary should use Effect Schema-rich data and tagged
expected errors:

- a schema-described import classification result;
- a `Schema.TaggedError` carrying at least the specifier, importer/source path when
  available, classification, allowed roots/patterns summary, and a human-facing
  message;
- Vite draft middleware/rendering projects that error into a concise browser and
  CLI/debug message;
- `vista debug imports <specifier>` and/or `vista debug deps` uses the same
  classifier so agents can diagnose without loading a browser.

Publish still validates, but publish validation is a second guard, not the first
time a disallowed import is discovered.

The authoritative runtime integration point is a Vite plugin over module
resolution (`resolveId`/load pipeline): it sees the real module graph, including
dynamic imports and plugin-expanded imports, and can fail before Vite falls into
opaque resolver errors. A source pre-scan is still useful for `vista debug` and
fast CLI diagnostics, but it is a projection over the same classifier and error
schema, not a second source of truth.

The validator must distinguish external review imports from Vite/plugin internals:
virtual modules, `node:` imports, Vite client modules, CSS transform internals,
and service-owned aliases are not rejected merely because they are not user-level
package roots. This is part of the validator contract, not an ad-hoc plugin
exception list hidden in service code.

Remote ESM imports are allowed only when pinned. For `esm.sh`, the review import
specifier must name an explicit package version (for example
`https://esm.sh/zod@3.25.76`); unpinned URLs such as `https://esm.sh/zod` fail with
the same typed import error. This keeps the escape hatch useful without allowing a
published Vista version to drift because the CDN resolves a package name
differently later. Vendoring remote ESM into a published version is a future
promotion path if remote imports become common, but it is not required for the
current escape hatch.

## Options

- **A. Warn during authoring/debug, fail at publish.** Good ergonomics, but lets
  agents iterate against invalid reviews and makes publish the surprise boundary.
- **B. Fail immediately in draft serving with good typed errors.** Chosen. It keeps
  the manifest as a real boundary while preserving agent ergonomics through useful
  messages and debug commands.
- **C. Allow anything Vite can resolve.** Flexible, but collapses the manifest into
  non-binding documentation and permits accidental workspace leakage.
- **D. Only enforce in packaged/Nix builds.** Catches release issues, but too late
  for normal agent loops and not useful to `vista debug`.
- **E. Pre-scan plus authoritative Vite plugin.** Chosen integration refinement.
  A single Effect Schema classifier/error model powers both: pre-scan gives agents
  fast debug feedback, while the Vite plugin is the hard boundary for actual draft
  serving.
- **F. Allow only pinned `esm.sh` URLs.** Chosen remote-import refinement. It keeps
  the remote escape hatch available while preventing unpinned CDN/package drift in
  published versions.

## Consequences

- Runtime import validation becomes part of the authoring loop, not only release
  hygiene.
- Import errors must be designed like product/debug errors: the agent needs to know
  which specifier is invalid, why it is invalid, and which fixes are valid
  (add package contribution, use a provided import, or use a pinned
  `https://esm.sh/<pkg>@<version>` URL).
- Vite plugin code should translate validation failures into the typed Vista error
  shape as early as possible; unexpected resolver crashes remain defects.
- The manifest classifier must become richer than `'provided' | 'remote-esm' |
  'local' | 'reject'` if the UI/debug surface needs actionable fixes and source
  locations.
- The implementation should use Effect-style boundaries where it pays off:
  `Schema.TaggedStruct`/rich schemas for import classifications, `Schema.TaggedError`
  for expected invalid-import failures, and `Effect.fn` spans around pre-scan and
  validation functions. It should not force-cast effect errors or collapse them to
  `unknown`/`any`.
- The remote classifier should distinguish `remote-pinned` from `remote-unpinned`
  (or equivalent tagged classifications) so the error message can explain the
  precise fix instead of reporting a generic rejected import.
