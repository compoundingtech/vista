# App Doctrine — Spec

This node owns cross-Template composition. Requirements are in
[requirements.md](./requirements.md); canonical terms in
[ontology.md](../../ontology.md).

## Shape

Every AppRoot opens with a context section under its page title, then follows
with the Template body and separates settled material. The context section
surfaces the ask before supporting detail. Each decision occupies one status.
Informational Apps explicitly declare an empty ask. Comparisons score
alternatives against shared drivers and name the failed driver for each rejection.

AskBlock and ForkBlock realize this shape; their visual contracts are owned by
the [block library](../05-blocks/spec.md).

## Universal context section

Realizing MED.DOC-R32 and MED.DOC-R34, the first screen at 1440×900 explains
the subject, current situation, reader ask, and history:

```text
Title
  CONTEXT · START HERE
  Anchors: breadcrumb + chips
  About | Situation | Ask (multiple questions: full-row Ask below)
  VISUAL SUMMARY | HOW WE GOT HERE
  TERMS AND SOURCES (collapsed)
```

The complete authoring contract, exact labels, honesty markers, data shapes,
time formatting, responsive behavior, and Explain rules live in the
[authoring skill](../../../../nixpkgs/ai/skills/vista.md#universal-context-section).
Every page uses the same section; at 390px cards stack, story follows the
visual, IDs wrap, and the section has no horizontal scroll. Ask previews show
explicit answers without registering an addressable Ask; the actual answer
destination is always named. No-ask pages display exactly
`Nothing needed. This page is for information.` and retain the explicit
informational declaration.

This is authoring guidance; a dedicated kit component is not yet shipped.
Decision [0102](../../.decisions/0102-universal-context-section.md) settles
H2 anchors, S2 card text, and A1/A4 ask presentation. **§9 of the guidance is
a proposed text budget, not a decision or a checker gate.**

**DQ1 — Text budget:** Johannes must decide the §9 proposal after reviewing
the reference scenarios; until then its numerical limits are not normative.

## Judgment

Structural diagnostics derive from SemanticManifest: ask presence, decision
partitioning, evidence reachability, comparison shape, citations, provenance,
and Template/shape agreement. Diagnostics cannot replace author and reviewer
judgment or browser judgment.

Reader-facing composition is specified in [taste.md](./taste.md), including
context, attention, text economy, visual hierarchy, and interaction affordances.

## Starter slots

The scaffold contains a context header, an ask referencing one primary-focus
evidence slot, and authoring guidance in JSX comments, not a canned visual.
Comments prefixed `vista-scaffold:context`, `vista-scaffold:reader-ask`, and
`vista-scaffold:primary-focus` mark unfinished slots; authors replace those
comments with actual context and content.

`vista check` reports a `scaffold-slots` warning while any slot comment remains.
The report stays `ready`: warnings are advisory and do not block publication.
Ready reports include a `warnings` array of stable `code` and human-facing
`message` pairs; the CLI displays warnings before the ready summary.
