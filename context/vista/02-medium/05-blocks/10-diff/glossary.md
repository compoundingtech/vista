# Semantic Diff — Glossary

Terms owned by the semantic diff family. `block library` lives in the
[block-library glossary](../glossary.md); leitwörter in the
[root ontology](../../../ontology.md).

## Semantic diff

A comparison of two versions of one structured subject, shown in that subject's
own medium (pages as pages, a trace as a waterfall) rather than as a text diff of
its serialization. `SemanticDiff` is the data-first Block that renders one.

## Diff subject

One side's content as plain serializable data, tagged by `_tag` (`image`,
`pageSet`, `text`, `code`, `record`, `document`, `tree`, `trace`, `diagram`). The
tag selects the diff lens. A subject may contain subjects: a document embed or a
record field can hold one.

## Diff lens

The component that renders one subject kind as a semantic diff inside a diff
frame, e.g. `ImageDiff`, `TreeDiff`. Every diff lens also exports a pure model
function that computes its change counts.

_Ambiguity:_ the block-library [lens](../glossary.md#lens) is a serializable
projection `(model, lens) -> scene` over one model. A diff lens is a renderer
chosen per subject kind. Say "diff lens" in this family; never bare "lens".

## Diff frame

The chrome every diff lens renders inside: lens badge, title, the two side chips,
change counts, arrangement switch, mode picker, and collapse. Frames nest; a
nested frame renders compact.

## Side

One input of a comparison: a label, optional provenance, and a basis. The basis
is `observed` (captured real state) or `projected` (a proposed, dry-run, or mock
end state).

## Relation

How the two sides relate. `temporal`: the same thing over time, read as
Before → After. `peer`: two alternatives, read as A vs B with no order in time.

## Arrangement

The primary layout of a diff: `unified`, labeled **Combined** (one merged view),
or `split`, labeled **Side by side** (two aligned views). The names follow
`@pierre/diffs` `diffStyle`.

## Diff page

The page-level scope (`DiffPage`) that owns one arrangement switch for every
diff frame below it.

## Mode

A secondary, lens-specific view within one arrangement, e.g. the image lens's
Swipe, Overlay, and Difference under Combined.

## Change kind

The shared change vocabulary: `added`, `removed`, `changed`, `moved`,
`unchanged`. Every diff lens counts and colors changes with it, so nested diffs
read consistently.

## Kind change

A comparison whose two subjects have different tags. It counts as one `changed`
and shows each side through its own diff lens.

## Content hash

The digest of a subject's bytes carried as `contentHash` on images and pages. It
is the only identity of those subjects; locations are not identity.

## Verdict

The compact, cached result of a thumbnail-resolution pixel comparison of one
image pair: same bytes, compared (with kind and changed ratio), pending, or
failed.

## Scale story

A Storybook story that renders the family at dogfood scale (for example 40
frames or a 1,000-node tree) and carries the interaction whose cost a
performance budget bounds.
