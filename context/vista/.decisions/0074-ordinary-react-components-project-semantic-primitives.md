# Ordinary React components project explicit semantic primitives

Status: accepted

## Context

Semantic JSX needs a composition boundary for app-local and shared kits. Requiring
a recipe or branded `defineComponent` would add a second component model unless it
provided projection power ordinary React lacks.

## Options

| Option | Shape | Trade-off |
| --- | --- | --- |
| Mandatory definition | Require a Vista recipe/definition wrapper for every semantic component | Explicit metadata, but a second component model without demonstrated projection power |
| Ordinary React | Function components emit explicit public semantic primitives; definition metadata is optional | Idiomatic composition; evaluator guarantees must be specified independently |

## Decision

Choose option 2. Ordinary React function components compose and emit explicit
semantic primitives such as `Scope`, `Evidence`, `Decision`, and `Ref`. Visual-only
wrappers are transparent to intent projection. No mandatory recipe or
`defineComponent` ceremony is part of semantic authoring.

Optional definition metadata may later describe block-library identity, version,
or discovery, but cannot be required for projection or grant semantic privilege.
The canonical `app.tsx` default-exports one ordinary zero-prop React App; there is
no App definition helper or parallel semantic export.

## Evidence and Argument

Ordinary and defined function components produced byte-identical 14-concept intent.
Hooks, context, maps, conditionals, and nested components projected successfully;
tested nondeterminism, dangling refs, malformed nodes, Suspense/async output, and
thrown errors failed closed. `defineComponent` metadata was unused and added no
projection power.

Independent attack found the proof incomplete: valid-looking forged types passed,
literal children and source locations were lost, async/ref coverage was narrow,
double rendering did not isolate hidden effects, and fragments were untested. These
limit the production projection contract; they do not justify mandatory component
ceremony.

## Consequences

- Existing React composition remains idiomatic for app and kit authors.
- Semantic power comes from explicit public primitives, not catalog admission or
  component branding.
- The attack findings remain regression evidence for the fail-closed trusted
  evaluator contract recorded in the greenfield amendment below.

## Greenfield amendment: trusted evaluator boundary

Vista derives the semantic manifest and data/freeze bindings by synchronously
evaluating that App in the trusted service process. It fails closed on evaluation
errors, forged or malformed semantic nodes, dangling references, asynchronous or
nondeterministic topology, and manifest/DOM divergence. This is an operational
reproducibility boundary, not a sandbox or process-isolation claim: first-party
agents and Vista already share one trust domain. DQ4 is closed for the current
trusted-author system.

## Greenfield terminology amendment

The mutable source is AppSource and its zero-prop JSX default export is AppRoot.
Explicit durable facts are SemanticNodes; their derived projection is
SemanticManifest. Browser-only behavior belongs below RuntimeIsland. AskBlock and
ForkBlock are visual Blocks with distinct semantic roles.
