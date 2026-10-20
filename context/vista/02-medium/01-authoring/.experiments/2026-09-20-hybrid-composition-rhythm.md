# Experiment: hybrid composition rhythm (2026-09-20)

## Question

Which layer should own readable measure and vertical rhythm when an App mixes raw
semantic prose, local component wrappers, records, headings, and curated Blocks?

## Method

The production authoring path and CSS were inspected alongside screenshots of the
same report-record and Q7 decision content at a `56rem` desktop canvas and a
`24rem` narrow canvas. The Storybook `CompositionRhythmExplorer` held content,
colors, and production Blocks constant while switching among:

- **C1 — uniform gap:** one direct-child gap for every sibling;
- **C2 — role-aware flow:** ambient spacing selected from semantic roles; and
- **C3 — explicit authored grouping:** authored wrappers name each relationship.

## Result

### Screenshot symptoms

The production-shaped baseline showed a missing outer-rhythm owner. Browser
spacing had disappeared, adjacent records and Blocks crowded together, and a
heading-to-prose transition could read like the next peer rather than the start
of a section. Prose placed behind an ordinary local wrapper escaped the direct
Section-child treatment, so readable measure and spacing depended on incidental
DOM depth. The narrow screenshot amplified the hierarchy problem: equal or
missing gaps erased the distinction between prose continuation, one record's
parts, repeated records, and a new major section.

### Root cause

The source boundary explained the screenshots:

- `semantic-chrome.css` applies a universal reset with `margin: 0` and
  `padding: 0`, removing browser-authored fallback rhythm.
- Its Section fallback selects direct `p`, `ul`, `ol`, and `blockquote`
  children. A local wrapper between Section and those leaves breaks the
  selector, while Markdown works only because it supplies
  `data-vista-prose-flow` explicitly.
- Heading styling is attached to Vista heading metadata, but prose measure is
  not carried consistently through semantic text flows.
- Curated Block roots generally set their own outer margin to zero and correctly
  own only internal layout. Neither the leaf nor the reset can infer the
  relationship to the next sibling.

This is an ownership gap, not a request to restore browser margins or make every
Block choose its surroundings.

### C1 / C2 / C3

| Variant | Desktop and narrow result | Judgment |
| --- | --- | --- |
| C1 uniform gap | Predictable, but prose continuations were too loose while major transitions were too tight; records, headings, and Blocks looked like equivalent peers | Reject as the governing model |
| C2 role-aware flow | Recovered readable hierarchy with little author work; prose clusters, record parts, peer records, section leads, and Block stacks could use different tiers | Keep as the safe ambient default; do not rely on fragile tag adjacency |
| C3 explicit groups | Expressed compounds and unusual sibling relationships precisely and survived intermediate wrappers | Keep for relationships semantics cannot infer; reject as mandatory ceremony for ordinary prose |

C2 and C3 are complementary. C2 covers the common path and ensures unstyled
semantic text still reads correctly. C3 supplies authored relationship groups
at ambiguity boundaries. In both, leaf Blocks keep zero outer margins and own
only their internals.

The observed scale that preserved hierarchy across both canvases was:

| Tier | Relationship |
| --- | --- |
| `space-2` | prose continuation or a small compound |
| `space-4` | one record's parts or an ordinary Block stack |
| `space-6` | section lead to body |
| `space-8` | repeated substantial peers |
| `space-12` | major-section boundary |

## Conclusion

Select the hybrid C2+C3 model: ambient role-aware rhythm plus explicit
CompositionGroups where sibling meaning is not inferable. Shared prose measure
and heading hierarchy attach to semantic text flows rather than direct Section
children.

## VRS Impact

This evidence strengthens MED.AUTH-R78, adds MED.AUTH-R79, and supports
[decision
0098](../../../.decisions/0098-ambient-rhythm-and-explicit-composition-groups.md).
