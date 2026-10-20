# Published versions are self-contained static directories

Status: accepted

## Context

Decision 0029 served immutable source through a shared Vite dev server. That keeps
published views dependent on source evaluation, ambient workspace dependencies,
and the service's current toolchain state. q8 settles a stronger publication seam.

## Options

| Option | Published serving | Trade-off |
| --- | --- | --- |
| Shared dev server | Evaluate immutable source through ambient Vite/runtime dependencies | Cheap publish, but published behavior depends on the live workspace |
| Static directory | Build once at publish and serve copied files | Publish does more work; serving is generic and independent of source evaluation |

## Decision

Choose a static directory. Every immutable version contains:

- canonical React source;
- a minimal, schema-versioned semantic manifest;
- content-addressed, self-contained JS/CSS/assets produced once at publish by the
  repository-current pinned Vite toolchain.

The build targets the version's canonical
`/r/<encoded-owner>/<local-slug>/vN/` base path (identity segments amended by
decision 0077). Its version-local receipt records toolchain provenance,
source/manifest inputs, an output inventory, and content hashes. Publication
stages and verifies the complete directory before atomically exposing it, then
writes a service-owned publication root outside the mutable version directory
that binds the receipt. Published requests verify the root/receipt pair and serve
only inventory-listed files from the copied `site/` directory through one generic
static-file runtime. A receiptless, malformed, or mismatched version returns HTTP
409 and is withheld; it never falls back to source evaluation or Vite. The
boundary detects isolated
version-directory mutation, but an actor able to rewrite both Vista state and the
service-owned root store remains inside the trust boundary.

The tool version is derived from the repository pin; VRS and app artifacts do not
hardcode a version. Draft authoring may continue to use Vite/HMR, and drafts are
the only live-serving surface. Canonical source is retained even when compiled
assets are present so a version can be inspected and rehydrated from its authority.

## Evidence and Argument

A bounded spike showed idiomatic React patterns with an explicit-marker-only
manifest and copied-directory static serving without server-side TSX evaluation;
the browser executed the bundle and source maps embedded sources. Two builds were
byte-identical within one root, while source maps varied across roots. Supplied
nondeterminism controls were caught, but this is not a general determinism proof.
Error-boundary recovery worked while logging the expected browser console error.

The evidence establishes feasibility, not complete self-containment or
cross-root determinism. The production gate must audit emitted references, base
paths, hashes, source-map policy, and absence of ambient/remote loads.

## Consequences

- Published serving no longer needs a per-version or global Vite dev-server path.
- Publication, not serving, owns dependency resolution and compilation failure.
- A version is relocatable as a copied directory under its declared base-path
  contract; content hashes make derived outputs independently verifiable.
- Decision 0029 remains the draft/HMR history but its published-serving and
  no-build clauses are superseded.

## Amendment 1 — Live state is an external overlay

A static AppVersion may declare live or subscription DataBindings without
weakening the immutability of its published directory. Their mutable folded
state and cursor form a service-owned LiveOverlay in the standing service state
directory, never a mutation of `site/`, Snapshot, manifest, receipt, or source.
The page paints from its immutable Snapshot before attaching to this overlay.

The AppVersion Scope owns the overlay's active runtime and closes it on
replacement publication or retirement. Artifact retention and live-runtime
availability are separate lifetimes: retaining a static version does not
authorize Provider work forever, and retiring live state does not rewrite or
delete the static directory.
