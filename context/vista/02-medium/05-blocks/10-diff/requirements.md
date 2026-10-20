# Semantic Diff — Requirements

Status: Accepted (confirmed by Johannes, 2026-09-27; decision 0099).

The semantic diff family realizes reviewable comparisons of two versions of any
structured content — images, page sets, text, code, records, documents, trees,
traces, and diagrams — as one public data-first Block plus exported per-kind
lenses. Authors describe what they compare as data; the family chooses how to
show it.

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); terms in [glossary.md](./glossary.md). IDs are path-scoped
(`MED.BLK.DIFF-*`); each requirement `refines:` its parent. Decision: 0099
(semantic diff is data-first over exported lenses).

## Requirements

### One data-first surface over exported lenses

- **MED.BLK.DIFF-R87 Data-first SemanticDiff:** The library must export one
  `SemanticDiff` Block that takes two inputs, each a side (label, optional
  provenance, basis) plus a serializable subject from one tagged union covering
  image, page set, text, code, record, document, tree, trace, and diagram. The
  subject tag alone selects the rendering; the author never names a lens. Subjects
  nested in document embeds and record fields render as nested diffs; two subjects
  of different kinds render as one kind-changed comparison showing each side.
  `refines: MED.BLK-R01`
- **MED.BLK.DIFF-R88 Lenses are the escape hatch:** Every lens, the shared frame,
  and the aggregate summary must be exported from `@vista/blocks`. A lens rendered
  directly with its defaults shows the same comparison as `SemanticDiff` for the
  same data, and additionally accepts lens-specific options and nesting slots.
  `refines: MED.BLK-R01`

### Every comparison is explorable the same way

- **MED.BLK.DIFF-R89 Two arrangements with page inheritance:** Every lens must
  offer Combined and Side by side. A page-level switch sets the arrangement for
  every frame below it; a frame without its own choice follows its nearest
  ancestor, including nested frames; a reviewer's local choice changes only that
  frame and the frames nested in it.
  `refines: VST-R02`
- **MED.BLK.DIFF-R90 Peer and temporal relations:** A comparison must declare
  whether its sides are temporal (before → after) or peers (A vs B). A peer
  comparison must not present either side as earlier, later, added, or removed
  relative to time; a temporal comparison presents the direction of change.
  `refines: VST-R03`

### A diff never overstates what it knows

- **MED.BLK.DIFF-R91 Observed and projected sides are distinct:** Each side must
  declare whether it is observed (captured real state) or projected (a proposed,
  dry-run, or mock end state). A projected side must be identifiable at a glance
  in every frame, nested or top-level, expanded or collapsed, by text and not by
  color alone.
  `refines: MED.DATA-R30`
- **MED.BLK.DIFF-R92 Content identity, never location:** Image and page identity
  must come only from a content hash: equal hashes are the same content and need no
  pixel comparison; a URL never establishes sameness or difference. Other subjects
  compare by value. Equal renders of different bytes must be reported as such, and
  pairs whose comparison is pending or failed must not be reported as unchanged.
  `refines: MED.DATA-R30`

### Dogfood scale stays interactive

- **MED.BLK.DIFF-R93 Scale budgets:** The family must meet these budgets in its
  Scale stories, which gate CI. A long task is main-thread work over 50 ms; a
  dropped frame is a frame interval over 33 ms. Budgets sit above the
  measurements of the `Vista/Blocks/Diff/Scale` stories, taken as the
  [spec](./spec.md#performance-gates) describes (dev3 under load 65–533).

  | Scale story                                            | Interaction                              | Budget                   | Measured                               |
  | ------------------------------------------------------ | ---------------------------------------- | ------------------------ | -------------------------------------- |
  | `MixedFortyFrames`, `FortyOcrFrames`, `FortyCodeFiles` | page arrangement toggle, both directions | no long task over 100 ms | 0 long tasks                           |
  | `MixedFortyFrames`, `FortyOcrFrames`, `FortyCodeFiles` | mount                                    | no long task over 300 ms | max 261 ms                             |
  | `TreeOneThousand`                                      | hover 12 rows                            | 0 dropped frames         | 0                                      |
  | `TraceFiveHundred`                                     | page toggle; typing 4 filter keys        | no long task over 100 ms | 0 long tasks                           |
  | `DiagramOneHundredFifty`                               | select a change                          | no long task over 100 ms | 0 long tasks                           |
  | `TenA4ImageDiffs`                                      | mount in Difference mode; page toggle    | no long task over 100 ms | 0 long tasks (10 × A4 300 dpi harness) |

  `refines: MED.BLK-R77`

### Accessible and themed like the rest of the library

- **MED.BLK.DIFF-R94 Accessible controls:** Arrangement, mode, collapse,
  selection, and tree/list navigation controls must be React Aria components that
  are keyboard operable and carry accessible names; change kinds must be conveyed
  by text or glyph as well as color.
  `refines: MED.BLK-R10`
- **MED.BLK.DIFF-R95 Light and dark:** Every lens, including rendered difference
  images, code, and diagrams, must render correctly in both light and dark
  themes, with Storybook coverage of both.
  `refines: MED.BLK-R07`

## Acceptance

A `SemanticDiff` given a document whose embed holds a page set and whose
properties hold an image renders nested page-set and image diffs without the
author naming a lens; the same data through `DocumentDiff` with default slots
looks the same. One page switch flips 40 frames in both directions within
MED.BLK.DIFF-R93 and a locally switched frame keeps its choice. A projected side
reads `projected` in every frame; two images with equal hashes and different URLs
are the same, and two with equal URLs and different hashes are compared. A peer
comparison shows `A vs B`. Every control is reachable by keyboard, and every
lens has light and dark stories.
