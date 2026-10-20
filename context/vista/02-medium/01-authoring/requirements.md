# Authoring Requirements

Authoring owns AppSource, AppRoot, SemanticNode, and SemanticManifest shape.
Composite context lives in the [medium requirements](../requirements.md);
canonical terms in [ontology.md](../../ontology.md). IDs are path-scoped
(`MED.AUTH-R*`).

## Requirements

- **MED.AUTH-R22 AppSource and AppRoot:** Canonical authoring is the AppSource
  `app.tsx`, default-exporting one ordinary zero-prop AppRoot. AppRoot props own
  App metadata. Public Blocks use the sole `@vista/blocks` import; Templates and
  local components compose through ordinary TSX. No second authoring model or
  extra declaration is required.
  `refines: MED-R02`
- **MED.AUTH-R23 Local React:** Authors may compose local React components when
  no Block fits. App-local StyleX is allowed. Vista owns the document shell,
  bootstrap, and global theme/base styles. Browser-only behavior stays below a
  RuntimeIsland and follows MED.AUTH-R59.
  `refines: MED-R02`
- **MED.AUTH-R24 Curation:** A proven local semantic component may become a
  shared Block without changing JSX meaning. Curation adds ownership, discovery,
  and regression evidence, not semantic privilege.
  `refines: MED-R02`
- **MED.AUTH-R25 Derived SemanticManifest:** Vista derives the serializable
  SemanticManifest from AppSource. It contains App metadata, SemanticNodes,
  relationships, provenance, and derived DataBindings. Authors never assemble
  SemanticManifest, DataBinding, Provider, or Snapshot details. Typed domain
  Blocks own DataBinding derivation through JSX props.
  `refines: MED-R01`
- **MED.AUTH-R74 Derived classification:** Builder classification derives from
  a machine-readable source of truth. The git-diff builder derives file
  provenance from `.gitattributes` at author time; rendered and pure model
  layers never invoke git.
  `refines: MED.AUTH-R25`
- **MED.AUTH-R76 Stable SemanticNodes:** Stable IDs are reserved for addressable
  asks, decisions, cited evidence, reference or feedback targets, and
  RuntimeIslands. Ordinary layout has no ID. Published SemanticNodes, their
  relationships, derived DataBindings, and matching `data-vista-id` targets are
  deterministic and immutable. Browser-only effects cannot add durable
  semantics.
  `refines: MED.AUTH-R25`
- **MED.AUTH-R59 No module-scope browser globals:** AppSource and its eager
  imports must not access browser globals at module scope. Browser-only
  dependencies belong behind a lazy RuntimeIsland. Evaluation runs trusted
  first-party AppRoot code in-process; this is a reproducibility boundary, not
  a security sandbox.
  `refines: MED.AUTH-R01`
- **MED.AUTH-R77 Outline identity:** Every semantic section carries an explicit
  stable `id` and an explicit human `label`. The `id` is the identity:
  navigation, deep links, and manifest matching key on it, and it never
  follows label renames. The `label` is nominal display text and never an
  identity. Presence is enforced by TypeScript required props; uniqueness,
  slug shape, and Markdown rules are enforced by `vista check` and publish,
  which delegate to `tsc` diagnostics wherever TypeScript can express the
  rule instead of reimplementing validation. Markdown headings keep the
  stable-slug-plus-dedup convention as the derived case. The existing
  corpus migrates in one pass with no legacy tiers; migration edits
  sources only and publishes nothing.
  `refines: MED.AUTH-R76`
- **MED.AUTH-R78 Shared prose styling:** Every semantic text flow receives the
  same ambient readable measure, body treatment, and heading hierarchy,
  regardless of whether its prose is a direct Section child, nested in a local
  component, or rendered from Markdown. Full-bleed Blocks remain unconstrained
  by the prose measure.
  `refines: MED.AUTH-R25`
- **MED.AUTH-R79 Composition ownership:** Authored content has coherent outer
  rhythm without App-local styling: known semantic roles receive safe defaults,
  authors can declare a relationship group when roles alone cannot determine
  spacing, and leaf Blocks own their internal spacing while contributing no
  outer margin.
  `refines: MED.AUTH-R22`
