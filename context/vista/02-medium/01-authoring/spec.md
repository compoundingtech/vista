# Authoring — Spec

Vista has one authoring model: an AppSource containing ordinary React whose
default export is AppRoot. Requirements are in [requirements.md](./requirements.md);
terms in [ontology.md](../../ontology.md).

## AppSource

The AppSource is `app.tsx` within
`$XDG_STATE_HOME/vista/sources/_owned.v1/<encoded-owner>/<local-slug>`.
`VISTA_SOURCES` overrides the sources root. New publishes use the exact st v3
managed subject in `$ST_AGENT`, with grammar `^agent(/<label>)+$`; labels are
lowercase alphanumeric words joined by single hyphens, as defined by
`managedAgentSubjectRegex` in
`nixpkgs/home-manager/modules/ai/session/identity.nix`. Host placement is not
identity. Humans and CI publish through a seat; `person/*` is never an owner.
Dotted legacy owners retain their exact identity without aliases or
re-attribution, but are serve-only; publishing under one is refused with a hint
to run as a seat (SVC-R14, AGT.CLI-R56).
One shared owner-identity module validates owners and losslessly encodes them
as RFC 3986 path segments for source storage; no first-dot directory split or
catalog lookup participates in source resolution. Storage and resource-URI
encodings remain separate from the HTTP `o-<hex>` owner segment (decisions
0005, 0077).

```tsx
import { AppRoot, Ask } from '@vista/blocks'

export default function Review() {
  return (
    <AppRoot title="Review title" template="architecture-review" scope="review">
      <Ask id="decision">{/* recommendation and bounded choices */}</Ask>
    </AppRoot>
  )
}
```

`@vista/blocks` is the sole public component import. Local components compose
through TSX without extra declarations. AppRoot props own title, Template, and
scope. Vista owns the HTML shell, React bootstrap, dependency wiring, global
theme/base styles, compilation, and publication metadata; App-local StyleX is
allowed.

## Document heading and labels

The AppRoot title is the document's single semantic `h1` and belongs to the
document, not to shell chrome. Prose and Block headings render below it, so an
App has exactly one top-level heading regardless of what the shell displays
(decision 0078).

Every semantic marker accepts an optional human label, carried on its
SemanticNode and on its DOM target. A label is nominal only: it names an entry
in the shell outline and never creates, renames, or substitutes for a stable ID.
Where no label is authored, the outline uses the heading that titles the marker,
and failing that a humanized form of the marker's ID. The field is optional and
additive, so it does not advance the SemanticManifest schema version.

## Composition and semantic text flows

This section realizes MED.AUTH-R78 and MED.AUTH-R79.

```text
AppRoot
└── ambient role-aware flow
    ├── semantic text flow
    ├── CompositionGroup (when sibling relationships are authored)
    │   ├── semantic text flow
    │   └── leaf Block
    └── leaf Block
```

Composition is hybrid. Vista applies ambient spacing and typography when the
roles of adjacent content are unambiguous. An author adds a CompositionGroup
only where a wrapper or a compound relationship prevents that inference. The
group names the relationship among its children; it does not create a
SemanticNode, stable ID, heading, or outline entry. An explicit group replaces
the ambient relationship at that boundary, and nesting groups composes the
same rule recursively.

Every semantic text flow carries the shared prose measure, body ink and
leading. Heading rank derives from semantic nesting, not direct DOM ancestry,
so local components and relationship groups cannot escape either the readable
measure or the App's one-`h1` hierarchy. A full-bleed Block is outside the prose
measure unless it contains a text flow of its own.

The spacing scale has five relationship tiers:

| Tier | Space | Relationship |
| --- | --- | --- |
| Tight | `space-2` (8px) | paragraphs, list/quote continuations, or the members of a small compound |
| Component | `space-4` (16px) | parts of one record or independent Blocks in an ordinary stack |
| Lead | `space-6` (24px) | a section heading/lead followed by its body |
| Sequence | `space-8` (32px) | peer records or repeated substantial items |
| Boundary | `space-12` (48px) | major sections or unrelated composition groups |

Ambient flow selects the narrowest tier justified by known roles. A
CompositionGroup selects one tier for the relationships it owns; it never
changes descendant typography or a leaf Block's internal layout. Leaf Blocks
own all internal spacing and render with zero outer margin, leaving outer
rhythm to their ambient flow or nearest CompositionGroup (decision 0098).

## Semantic projection

Evaluation derives SemanticNodes from explicit semantic composition and records
their SemanticManifest. Stable IDs identify only addressable asks, decisions,
cited evidence, reference or feedback targets, and RuntimeIslands. Matching
`data-vista-id` targets expose SemanticNodes; layout remains ordinary React.

Typed domain Blocks derive internal DataBindings. AppSource does not declare
Providers, DataBindings, Snapshots, or SemanticManifest records. The
SemanticManifest is schema-versioned nonvisual evidence, not a render tree or
UI authority.

Browser globals must not be touched at module scope in the eager AppSource
graph. Browser-only dependencies, effects, lazy loading, Suspense, and recovery
stay beneath RuntimeIslands and cannot add SemanticNodes. Evaluation fails
closed on invalid or nondeterministic semantics, dangling references, and
SemanticManifest/DOM mismatch; it is not a security sandbox.

Blocks and Templates are owned by [05-blocks](../05-blocks/spec.md); Provider
mechanics by [03-data-sources](../03-data-sources/spec.md); correspondence by
[02-renderer](../02-renderer/spec.md).
