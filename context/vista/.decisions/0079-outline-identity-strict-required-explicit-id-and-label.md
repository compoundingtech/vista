# Outline identity is strict and explicit: every semantic section carries id and label

Status: accepted

## Context

The Outline derives from semantic nodes and raw headings with silent
fallbacks (explicit label, otherwise heading text, otherwise humanized id).
Silent fallback means authors never notice when their outline reads like
`Agent run viewer`, and authoring agents get no signal until a human opens
the gutter of a frozen build. The question is how much structure Vista
demands up front, and which half of identity (human-readable label vs
stable anchor) the author owes.

## Evidence and Argument

Interviewed the principal as decisions q1 (enforcement strategy) and q2
(identity shape); both answers are recorded in the decision tree and
promoted here. q1 chose strict-required over safe-defaults and
hybrid-gated: perfect outlines are worth fix-and-retry loops, with the
explicit follow-up that the required path must be streamlined via
component design and type safety. q2 chose both-required over
label-only and label-plus-optional-id: stable anchors must survive label
renames, accepting two coordinated strings per section.

Code evidence: `collectOutlineEntries` resolves labels explicit-first,
then heading text, then humanized id — the silent fallback this decision
removes as an accepted state. `OUTLINE_QUERY` already treats semantic
nodes and raw headings as distinct sources. `Ask`/`Fork`/`Evidence`
already require `id` via `AddressableProps`, and markdown headings
already mint stable slugs with dedup suffixes — both halves of the new
contract extend precedent rather than inventing it.


## Options

| Enforcement | Tradeoffs |
| --- | --- |
| Strict-required: missing identity fails check and publish | Perfect outlines guaranteed; every violation is a fix-and-retry loop for the authoring agent |
| Safe-defaults: optional props with smart derivation | Zero loops; quality rests on heuristics and mediocre humanized ids linger |
| Hybrid-gated: required for semantic blocks, free markdown, warn-then-error | Guaranteed traceable structure with no day-one churn; needs a migration window |

| Identity shape | Tradeoffs |
| --- | --- |
| Label only, id auto-slugged | One string to write; renaming a label breaks deep links |
| Both required | Explicit stable anchors independent of label text; two coordinated strings per section |
| Label required, id optional override | One-field default with a rename-proof hatch; check validates only explicit ids |

## Decision

Strict-required with both required: every semantic section carries an
explicit stable `id` and an explicit human `label`, enforced so missing
identity fails rather than degrading silently. The `id` is the identity —
navigation, deep links, and manifest matching key on it and it never
follows label renames. The `label` is nominal display text and never an
identity, per the Outline ontology. Markdown headings keep the established
convention (stable slug plus dedup suffix) as the derived case.

Strictness is deliberately paired with streamlining: the required path
must be effortless via component and composition design plus type safety,
so the gate rarely fires.

## Amendment 1 — enforcement points and foundation delegation (q3)

Presence is enforced by TypeScript required props (instant author-time
feedback); uniqueness, slug shape, and markdown rules are enforced by
`vista check` and publish. Architectural rule: embrace each foundation —
whatever TypeScript can enforce, vista check delegates to instead of
reimplementing (e.g. the gate surfaces tsc diagnostics on the AppSource
rather than maintaining a parallel presence validator). Each gate does
what the other cannot; neither duplicates the other.

## Consequences

- Authoring contract gains an outline-identity rule (MED.AUTH-R77).
- No legacy tiers: the whole corpus migrates in one off pass (q5 reframe),
  so the gate ships strict from day one with nothing to grandfather.
- The silent humanized-id fallback stays only as a last resort, never as
  an accepted authoring state.

## Amendment 2 — one-off migration, no backwards complexity (q5)

q5 was answered as a reframe rejecting all phased options: no
grandfathering, no warn-then-error window, no codemod-accept cycle with
per-app review bandwidth. A subagent migrates every existing AppSource to
explicit id and label in one pass, now. Migration edits sources only and
publishes nothing — new versions of others' reviews are a separate,
owner-scoped decision, never a side effect of migration.
