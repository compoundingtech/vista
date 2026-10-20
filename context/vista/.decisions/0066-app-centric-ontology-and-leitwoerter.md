# 0066 — App-centric ontology and leitwörter

Status: Accepted. Refines the vocabulary Vista's VRS uses across every artifact;
supersedes the "review / component-kit / archetype / graduation" term cluster.
Companion to [0067](./0067-compositional-restructure-contracts-and-realizations.md)
(the structural counterpart) — this record fixes the *words*; 0067 fixes the
*node tree* those words name.

## Context

Vista's vocabulary accreted term-by-term: `review` for the unit, `block` and
`component kit` for content, `archetype` for the kind, `doctrine` for the review
structure, `graduation` for the incubation pipeline, plus a large cluster of
block-specific terms (`lens`, `telemetry island`, `diff block`, …) that had leaked
up into the top glossary. The result read as a bag of coordinate terms rather than
a hierarchy. This decision re-derives the vocabulary as a small set of **leitwörter**
(guiding words that recur and carry the structure) plus explicit **conceptual
hierarchies**, so the ontology teaches itself.

## Decision

### Leitwörter

The domain vocabulary is anchored on a few guiding words. Everything else is
defined in terms of these; VRS prose uses them consistently.

| Leitwort | Meaning |
| --- | --- |
| **App** | The unit of everything. A Vista **app** is the named, versioned, publishable interactive artifact. |
| **Component** | The universal authoring substrate: a composable React component, low- or high-level. |
| **Block** | A *curated* component — Vista's shipped, typed, declarative, renderer-known library. |
| **Template** | A *curated app-scale* component — a per-kind app scaffold. |
| **Curated / Curation** | The axis (curated vs bespoke) and the pipeline that promotes a bespoke component into a block. |
| **Publish / Draft / Version** | The app lifecycle verbs and states. |

The top glossary carries only these — the app/component ladder plus the lifecycle.
Domain vocabulary that a single subsystem owns is a *local* leitwort defined in
that node's glossary, not at the top: **Provider** / **Live** / **Frozen** belong
to the data contract (`03-data-sources`); **Lens** to the block library
(`05-blocks`); **Ask** to `04-doctrine`. Glossary is inherited downward (0067).

### Conceptual hierarchies

**1. The component ladder (the core hierarchy).** Everything an app is made of is
a component; the terms name *curation* and *granularity*, not different kinds of
thing:

```
Component                      any composable React component (the substrate)
  ├─ curated, typed/declarative        →  BLOCK      Vista's shipped, tagged, renderer-known library
  │        └─ curated at app scale     →  TEMPLATE   a per-kind app scaffold (vista new --template <kind>)
  └─ bespoke, app-local (real React)   →  escape-hatch component
           └─ promoted (curation)      →  becomes a BLOCK
```

- A **block** is a curated component with a *typed, declarative, tagged* interface
  (a tagged-union member the exhaustive renderer knows — preserves the render
  contract, see 0067). "Just a React component" describes the substrate; the
  *curation* is what makes it a block.
- A **template** is a curated component at *app scale*: it scaffolds a whole app of
  a given kind and prescribes its body. It is not a tagged block; it is a real-React
  starting point instantiated by `vista new`.
- The **escape hatch** is authoring a *bespoke* (uncurated), app-local component
  when no block fits. **Curation** (formerly "graduation") is the pipeline that
  promotes a proven bespoke component into the curated block library.

**2. The app lifecycle.** `Draft` —(`Publish`)→ `Version`; `Latest` points at the
newest version; `Retire` withholds without deleting. Unchanged by this decision;
listed so the lifecycle reads as one hierarchy under **app**.

**3. Data durability.** `Live` vs `Frozen`; within frozen, `data-frozen` (every
app) vs `pixel-frozen` (telemetry). Owned by the data contract / telemetry block
(0067), not the top glossary.

### Renames

| Was | Now | Rationale |
| --- | --- | --- |
| **Review** (the unit) | **App** (Vista app) | "Review" was one *kind* stretched to name the whole medium; it already broke for telemetry-exploration / code-recap. "App" is what-it-*is*; the template is what-it's-*for*. Concept rename only — the `/r/<slug>` route and durable version links are unchanged (a stable-link guarantee, not a term). |
| **Archetype** (the kind) | **Template** | The kind is now *which template* an app was instantiated from. One concept instead of a floating label plus a scaffold. |
| **Component kit** / "the kit" | *(dissolved)* | With blocks extracted to their own realization node, "the versioned set of blocks" *is* that node; the render contract left behind is a *renderer*, not a kit. See 0067. |
| **Graduation** | **Curation** (verb: *curate* / *promote*) | Threads the "curated" leitwort: a block *is* a curated component, so promoting a bespoke component is *curating* it. |
| **Doctrine** (archetype→body + ask rules) | **Doctrine** (refined) | Kept — the word means *a body of guiding principles*, which is now exactly its scope: the cross-template composition principles (lead with an ask, drive a decision, subordinate rejected options). The per-kind body moved to templates (0067), leaving doctrine as principles only, where the name fits. |

### `vista new` and minimal ceremony (VST-R64)

`vista new --template <kind>` is **optional** scaffolding sugar. It generates a
starting app directory from a template, but `vista publish <dir>` alone still works
end-to-end on a hand-authored app. The happy path stays a single command; `new` is
never required. This is consistent with VST-R64 (which forbids a *mandatory*
scaffold step in the happy path, not the existence of an optional generator) and is
recorded as a justification against VST-R64 rather than a charter change.

## Consequences

- The top glossary keeps only the leitwörter and cross-cutting lifecycle terms;
  block/subsystem terms live in their owning node's glossary (glossary inherited
  downward — see 0067).
- `vision.md` still uses "review", "kit", "doctrine", "graduates". Vision is
  human-owned; the terminology update there is handed to the user, not applied by
  the restructure.
- Renames touch requirements, spec, glossary, and IDs; the structural half is
  0067. Old→new term and ID bridges live in
  [`mapping.md`](./mapping.md).
