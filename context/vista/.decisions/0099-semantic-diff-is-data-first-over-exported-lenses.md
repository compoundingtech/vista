# Semantic diff is data-first over exported lenses

Status: accepted

Records: dskder → fugi4r (authoring shape), pf3lhb → it9z7w (frame chrome),
jluuwa → t3xc6k (text renderer), i5s4y6 → 58nkhm (per-lens defaults),
x60u7a → 1ieydo (promotion); request → answer, all answered by schickling.

## Context

Agents review changes to many kinds of content: page renders and scans,
extracted text, records, Notion-like documents, hierarchies, traces, diagrams,
and code. A text diff of the serialization hides what changed in each medium,
and a review page often holds dozens of comparisons, some nested inside others,
such as an embedded PDF inside a changed page.

An incubated family in `@vista/blocks` renders each kind through its own diff
lens inside one shared frame and one change vocabulary. Five questions had to
be settled before it could become public: the authoring shape, the frame
chrome, the text renderer, the defaults, and whether to promote the family at
all.

## Evidence and Argument

- Storybook exploration stories rendered 2026-09-26, captured under
  `tmp/vista-diff/shots/`: `incubator-diff-explore-diffframe--exploration.png`
  (header H1–H3, summary S1–S3, switch A1–A3),
  `incubator-diff-textrecordcode--prose-pierre.png` (prose through
  `@pierre/diffs` shows a "No newline at end of file" artefact and
  sentence-reflowed paragraphs), `incubator-diff-explore-textdiff--exploration.png`
  (inline prose), and `incubator-diff-explore-<lens>--exploration.png` for every
  lens's default and alternative variants.
- Performance reviews `tmp/vista-diff/perf-review.json` and
  `tmp/vista-diff/perf-review-2.json` with raw runs in
  `tmp/vista-diff/perf/after-scale-stories.jsonl`. After the fixes: hovering 12
  rows of a 1,000-node tree went from 16 long tasks totalling 26,180 ms to 0; a
  500-span trace toggle from 572 ms to 0; a 40-frame OCR page toggle from
  2,290 ms to 52 ms and 0; ten A4 Difference mounts from 2,173 ms to 0 with pixel
  work in a Worker. The second review also found an SVG decode regression in the
  Worker path (since fixed by main-thread decode) and unvirtualized page-set and
  record lists (since virtualized, not yet remeasured).
- tsc and oxlint were clean on the family on 2026-09-27.

The lens components already existed with pure model functions, so a data-first
dispatch layer costs little and makes nesting a property of the data: two Apps
that emit the same data render the same review. Keeping the lenses public
preserves lens-specific knobs and custom nesting slots.

A single-row header keeps nested frames light, and one page-level arrangement
switch replaces one switch per frame. The minimal header hid which side is
projected, which a review must show at a glance.

## Options

### Authoring shape

| Option                                         | Tradeoffs                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Lenses only                                    | Most flexible; each App wires nesting by hand, so equal data can render differently; 10 public components |
| Data-first `SemanticDiff` only                 | Agents emit plain data and nesting follows it; no escape hatch for lens-specific needs                    |
| Data-first `SemanticDiff` plus exported lenses | Data is the default and lenses the escape hatch; two surfaces to keep consistent                          |

### Frame chrome

| Option                                                            | Tradeoffs                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| H2 single row, S1 pills, A3 page-level switch that frames inherit | One header row per frame; arrangement set once per page with local override |
| H1 two rows, S1 pills, A1 switch per frame                        | Provenance always inline; nested pages become noisy                         |
| H3 title and counts, S2 git-style text, A2 icon toggle            | Densest; sides and projected basis visible only on hover or focus           |

### Text renderer

| Option                     | Tradeoffs                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Hybrid by shape            | Each text reads like its medium; two renderers and a `shape` hint                                 |
| `@pierre/diffs` everywhere | One renderer consistent with code; prose loses paragraph shape and needs git artefacts suppressed |
| Own inline everywhere      | Natural prose; long OCR text loses line numbers and hunk navigation                               |

### Defaults

| Option                                                                                                                                                                                                           | Tradeoffs                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Keep current defaults (image Difference, record table with folded count, document gutter bar and struck removals, tree ghost plus moves list, trace stacked bars in tree order, diagram accent plus change list) | Shows every change in context; already used by the dogfood App |
| Quieter defaults (swipe, region boxes, changed pages only, hidden unchanged rows, collapsed removal markers)                                                                                                     | Shorter reviews; context and removed content need expanding    |

### Next step

| Option                                       | Tradeoffs                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Promote: export, write VRS, add perf gates   | Any App can author diffs; a public contract other Apps depend on; new dev dependency |
| Keep incubating until dogfood v3 is reviewed | Reviewable without a public contract; waits on the Vista publish fix                 |
| Hold for another variant round               | More iteration; no known open design question requires it                            |

## Decision

- The public authoring surface is one data-first `SemanticDiff` over a tagged
  subject union; the diff lenses, frame, and summary are exported as the escape
  hatch.
- The frame chrome is H2 single-row header, S1 count pills, and A3: a page-level
  `DiffPage` switch that frames inherit, with local override. No other chrome
  variant is public.
- Text renders by shape: `lines` (the default) through `@pierre/diffs`, `prose`
  through Vista's inline word renderer. `@pierre/diffs` renders all line-shaped
  content, including code.
- Every lens keeps its current defaults; each remains an overridable prop.
- Every lens offers Combined and Side by side, and controls are React Aria.
- The family is promoted into `@vista/blocks` with Scale-story performance gates
  measured through `@overeng/meters`.

## Consequences

- The subject union becomes a public contract; adding a kind is additive, while
  renaming or reshaping a payload breaks Apps that emit it.
- Nesting follows the data, so Apps cannot vary nesting through
  `SemanticDiff`; they drop to a lens instead.
- A text subject needs the right `shape`; a missing hint renders prose as lines.
- Perf budgets become CI gates, so a regression at dogfood scale fails the build
  rather than surfacing in review.
- The requirements this decision implies are `MED.BLK.DIFF-R87` to
  `MED.BLK.DIFF-R95`, confirmed by Johannes on 2026-09-27.

## Verification

The model is specified in
[10-diff/spec.md](../02-medium/05-blocks/10-diff/spec.md); requirements are in
[10-diff/requirements.md](../02-medium/05-blocks/10-diff/requirements.md). The
Storybook stories under `Vista/Blocks/Diff` and `Vista/Blocks/Diff/Scale` render
every lens, both arrangements, and the dogfood-scale cases the gates measure.
