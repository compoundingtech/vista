# Hybrid authoring: typed doctrine spine, MDX confined to prose leaves

Status: superseded by 0074

The ordinary React App contract in decisions 0074/0076 supersedes the typed
document spine, prose-leaf MDX boundary, and `custom` mechanism below. These
mechanisms remain rationale and evidence only.

## Context

Decision 0008 set hybrid authoring (declarative blocks + real-React escape hatch).
Open fork (OQ-RICHTEXT): should authoring be MDX (prose + embedded JSX) instead of
typed blocks? MDX is tempting (prose-first, and it would subsume the escape hatch),
but decision 0012 requires the doctrine invariants (ask, archetype, locked/open,
evidence-reachable, fork<2, provenance) to be **statically** checkable by the
advisory linter, and MED.AUTH-R25 requires a portable/serializable doc.

## Decision

Authoring is a **typed doctrine spine with MDX confined to prose leaves**:

- The structural skeleton — review metadata, `archetype`, sections, the ASK,
  decisions/options, evidence refs — is **typed data** (the tagged-union block
  model), so the linter projects it as a total function and finds every invariant
  with zero parsing.
- MDX/markdown is allowed **only inside `rich-text`/prose leaves**, where nothing
  doctrine-load-bearing lives.
- The escape hatch stays the typed `custom` block (decision 0008), **not**
  arbitrary inline JSX.

Rationale (proved, not asserted): MDX with imported data
(`<DecisionLog entries={data}/>`) makes **every** doctrine check go statically
**blind** — and you cannot force literal inlining. To make MDX safely checkable you
must hoist the spine out of expression-range into typed props — at which point
MDX-done-safely *is* this hybrid model. MDX also loses the graduation
forcing-function (no compile-time exhaustive switch) and breaks portability (it
compiles to `_jsx(...)`, surviving only as opaque source).

## Consequences

- The advisory linter is sound: a per-variant projector over typed data, no JSX
  parsing; a `blind` severity is reserved for un-auditable content (which is why
  full MDX is rejected — a clean run with blind spots silently skips the doctrine).
- A precise **prose-leaf MDX boundary** must be defined and linted: which inline
  components are allowed in prose, and that no ask/decision/options/evidence
  appears there (that constraint is what keeps hybrid checkable). Tracked in
  `03-authoring`.
- Agents author typed structure + markdown prose; no remark/unified toolchain in
  the lint path.

## Historical amendment (2026-08-10): JSX is syntax, intent is the spine

The doctrine spine is still typed, serializable, and statically auditable, but it
is authored through semantic JSX and exposed through a portable semantic projection. JSX children may
therefore express doctrine-bearing semantic structure without making the linter
parse arbitrary JSX source: the linter consumes the semantic projection. Markdown or
MDX remains prose-leaf content and cannot hide semantic records.

This preserves the original rejection of arbitrary expression evaluation as the
doctrine seam. It supersedes only the claim that the author must directly assemble
the tagged-union records or use `custom` for all JSX composition.

## Greenfield supersession

Current Apps express prose and doctrine through ordinary semantic React JSX.
Vista derives the minimal semantic manifest from explicit primitives; there is
no authored tagged spine, MDX-only leaf boundary, or `custom` registry path.
