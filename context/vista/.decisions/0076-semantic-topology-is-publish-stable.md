# Semantic topology is publish-stable

Status: accepted

## Context

Ordinary React components may use hooks, effects, lazy loading, Suspense, and error
recovery. Durable doctrine, indexing, feedback, and frozen semantics cannot vary
with browser timing or runtime state.

## Options

| Option | Semantic extraction | Trade-off |
| --- | --- | --- |
| Browser-derived | Observe semantics after runtime React settles | Expressive, but timing and recovery can change durable meaning |
| Publish-stable | Extract synchronous semantic markers at publish; isolate runtime variation | Durable and auditable, with an explicit Island boundary |

## Decision

Choose publish-stable. Published semantic topology—node IDs, kinds, containment,
status, and references—is synchronous, deterministic, immutable, and derived from
canonical React source at publish. Browser-only behavior, effects, lazy/Suspense,
and error recovery may vary only visually beneath a stable semantic `Island`
boundary; they cannot introduce, remove, or mutate durable semantic nodes.

The schema-versioned manifest is derived evidence, not UI source of truth. Its core
node kinds are closed; extensions live in a namespaced envelope. Equivalence covers
the full semantic envelope and stable `data-vista-id` DOM targets, not IDs alone.
Provenance must be stable and logical; physical source file/line is not required
until source-location capture is proved.

## Evidence and Argument

The semantic-component spike exercised maps, conditionals, nesting, hooks, context,
async/Suspense, errors, malformed nodes, nondeterminism, and dangling refs. The
static publish verifier passed clean-copy routes/inventory/DOM parity/island cases
and red controls for missing/tampered assets, path leakage, base-path errors,
semantic divergence, and async topology.

The spike did not establish an independently privileged content root or tool
provenance: modified JS plus a regenerated manifest and forged tool version
passed. Publication therefore binds artifact hashes and the toolchain claim to a
service-owned root outside the mutable version directory; self-reported metadata
alone is insufficient. This detects isolated version-directory mutation but is
not protection from an actor able to rewrite both stores.

## Consequences

- Runtime capability views are visually expressive but semantically subordinate to
  their stable Island marker.
- Publish fails closed on asynchronous or divergent topology.
- Static artifact integrity and Vite provenance are bound to the service-owned
  publication root. Stronger privilege separation remains a residual question.

## Greenfield amendment: one App evaluation and derived bindings

The evaluated source is the module's default-exported ordinary zero-prop React
App. The same synchronous pass derives the semantic manifest and semantic
data/freeze bindings; Apps author no document, manifest, semantic side export, or
component/data/model registry. Evaluation occurs in-process under the
trusted-author model and makes no isolation claim.
