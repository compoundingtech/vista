# Semantic Diff — Spec

This document specifies the semantic diff family: the `SemanticDiff` Block, its
diff lenses, the shared diff frame, and the performance gates. It builds on
[requirements.md](./requirements.md); packaging and theming are in
[../spec.md](../spec.md); terms in [glossary.md](./glossary.md). Decision 0099
records the authoring shape, frame chrome, text renderer, defaults, and
promotion.

## Status

Accepted. Realizes MED.BLK.DIFF-R87 to R95; implementation in `flakes/vista/blocks/src/blocks/diff/`.

## Scope

Defines the subject union, dispatch and nesting, the change vocabulary, frame
chrome, arrangement inheritance, each lens's renderer and defaults, the image
comparison pipeline, per-lens virtualization, and the Scale-story perf gates.

Does not define the code-review `Diff` Block, `FileTree`, or pull-request review
([01-code](../01-code/spec.md)); how subjects are captured or published
([../../03-data-sources/spec.md](../../03-data-sources/spec.md)); or
SemanticManifest emission (DQ2).

```text
DiffInput{side, subject} ×2
        │
        ▼
  SemanticDiff ── dispatch on _tag ──┬─ ImageDiff      ─┐
        ▲                            ├─ PageSetDiff     │
        │ nested subject             ├─ TextDiff        │  each renders
        │ (embed / record field)     ├─ CodeDiff        ├─ inside DiffFrame
        └────────────────────────────┼─ RecordDiff      │  under DiffPage
                                     ├─ DocumentDiff    │
                                     ├─ TreeDiff        │
                                     ├─ TraceDiff       │
                                     └─ DiagramDiff    ─┘
```

## Public surface

This section realizes MED.BLK.DIFF-R87 and MED.BLK.DIFF-R88. Everything below is
exported from `@vista/blocks`.

| Export                                                                                                                                      | Role                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `SemanticDiff`                                                                                                                              | Data-first entry point; the default authoring surface                 |
| `DiffPage`                                                                                                                                  | Page-level arrangement scope with one switch                          |
| `ImageDiff`, `ImageCompareSet`, `PageSetDiff`, `TextDiff`, `CodeDiff`, `RecordDiff`, `DocumentDiff`, `TreeDiff`, `TraceDiff`, `DiagramDiff` | Diff lenses (escape hatch); each also exports its pure model function |
| `DiffFrame`, `useDiffArrangement`, `useDiffMode`, `useDiffFrameVisible`                                                                     | Frame for custom bodies and the hooks a body reads                    |
| `DiffSummary`                                                                                                                               | Aggregate change chips with an optional reconciling ledger            |
| `ChangeMark`, `ChangeLegend`                                                                                                                | Shared change-kind marking                                            |
| `DiffSubject`, `DiffInput`, `DiffSide`, `ChangeKind`, `ChangeCounts`, `DiffArrangement`, `DiffRelation`                                     | Contract types                                                        |

```ts
interface SemanticDiffProps {
  readonly id?: string
  readonly title: ReactNode
  readonly before: DiffInput
  readonly after: DiffInput
  readonly relation?: DiffRelation // default 'temporal'
  readonly arrangement?: DiffArrangement // controlled
  readonly defaultArrangement?: DiffArrangement
  readonly nested?: boolean // set automatically for nested subjects
}

interface DiffInput {
  readonly side: DiffSide
  readonly subject: DiffSubject | null // null = absent (added / removed)
}

interface DiffSide {
  readonly label: string
  readonly provenance?: string
  readonly basis: 'observed' | 'projected'
}

type ChangeKind = 'added' | 'removed' | 'changed' | 'moved' | 'unchanged'
type DiffArrangement = 'unified' | 'split' // UI: Combined | Side by side
type DiffRelation = 'temporal' | 'peer'
```

## Subject union

```ts
type DiffSubject =
  | ({ _tag: 'image' } & ImageSource) // src, contentHash?, alt?
  | ({ _tag: 'pageSet' } & PageSetSide) // pages[], pageCount?
  | { _tag: 'text'; text: string; shape?: 'lines' | 'prose' } // default 'lines'
  | { _tag: 'code'; path: string; contents: string; lang?: SupportedLanguages }
  | { _tag: 'record'; fields: RecordFields }
  | ({ _tag: 'document' } & DocumentSubjectSnapshot)
  | { _tag: 'tree'; roots: TreeSnapshot }
  | ({ _tag: 'trace' } & TraceData)
  | ({ _tag: 'diagram' } & DiagramGraph)

type RecordFieldValue = RecordValue | { _tag: 'subject'; subject: DiffSubject }
interface SubjectEmbedBlock extends EmbedBlock {
  subject?: DiffSubject
}
```

`RecordFields` is an ordered key → field map; key order is display order. A
`DocumentSubjectSnapshot` carries title, location, `properties: RecordFields`,
and blocks whose embeds (at any depth, including list-item and toggle children)
may carry a `subject`. The payload types are the lens modules' own TypeScript
interfaces; only `TraceData` is also an Effect Schema (DQ1).

## Dispatch and nesting

This section realizes MED.BLK.DIFF-R87.

1. Both subjects `null`: render an `empty` frame.
2. Both present with different tags: render a `kind changed` frame counting one
   `changed`. Its body shows the before subject as a removed-only nested diff and
   the after subject as an added-only nested diff, stacked under Combined and in
   two columns under Side by side. Each nested child starts Combined.
3. Otherwise dispatch on the present tag to its lens; an absent side renders as
   all-added or all-removed.
4. **Record.** Fields where neither side is a subject render as record-lens rows.
   Each field where either side is a subject becomes one nested `SemanticDiff`
   below the rows, in the same record frame. A plain value paired with a subject
   is lifted to a subject (`text` → prose text, `code` → code, other → a
   one-field record) so the kinds compare.
5. **Document.** Each subject embed is lowered to a document embed whose
   fingerprint is the subject's content hash (image) or a 32-bit FNV-1a of its
   value key, so a changed subject makes a changed embed. A changed embed renders
   a nested `SemanticDiff` for its subject pair. Properties render as a nested
   record diff.
6. Nested diffs reuse the parent's sides and relation, render compact, and take a
   derived id `<parent-id>-<slug>`.

Counts are in the lens's own units (pages, lines, rows, blocks, spans, nodes). A
record row holding a subject counts once, by the nested pair's overall kind.

## Frame chrome

This section realizes MED.BLK.DIFF-R89, MED.BLK.DIFF-R90, MED.BLK.DIFF-R91, and
MED.BLK.DIFF-R94. The shipped chrome is H2 / S1 / A3 (decision 0099); no
variant is public.

```text
DiffPage   All diffs                                  [Combined|Side by side]
┌──────────────────────────────────────────────────────────────────────────┐
│ ▾ DOCUMENT Inbox cleanup  [Before Live] → [After Dry run·projected]      │
│            2 added  4 removed  13 moved                   [mode picker]  │  ← one row, wraps
│ ┌ nested ─────────────────────────────────────────────────────────────┐  │
│ │ ▾ PAGE SET Scan.pdf  [Before] → [After·projected]  1 changed        │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Part           | Contract                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H2 header      | One row: collapse chevron, lens badge, title (the collapse trigger, inside an `h3`), side chips, counts, controls. Nested frames drop the outer border and shrink the header  |
| Side chips     | Role (`Before`/`After`, or `A`/`B` for peers) plus label. The relation glyph is `→` for temporal and `vs` for peer. Provenance is in a keyboard-reachable tooltip on the chip |
| Projected side | Dashed chip border plus a visible `projected` text tag in every frame, nested or collapsed; the chip's accessible name states projected or observed                           |
| S1 counts      | One tinted pill per non-zero change kind, `<n> <kind>`, in `changeKinds` order                                                                                                |
| A3 switch      | No per-frame arrangement switch when a `DiffPage` owns it; a frame outside any `DiffPage` renders its own segmented switch                                                    |
| Mode picker    | A React Aria `ToggleButtonGroup` shown only when the active arrangement has more than one mode                                                                                |
| Collapse       | React Aria `Disclosure`; collapsed frames keep header and counts; frames are isolated from an enclosing lens's `DisclosureGroup`                                              |

Change kinds use Geist semantic colors — added green, removed red, changed amber,
moved blue, unchanged gray — each with a non-color cue: removed inline text is
struck through, moved content has a dashed outline, and every count pill names
its kind.

## Arrangement inheritance

This section realizes MED.BLK.DIFF-R89.

```text
active = arrangement prop (controlled)
       ?? local choice (defaultArrangement, then the reviewer's pick)
       ?? nearest ancestor frame's active arrangement, else DiffPage's
       ?? 'unified'
```

A frame provides its active arrangement to its body and to every frame nested
in it, so a local pick propagates down but never up or sideways. `DiffPage`
applies a toggle as a React transition. Modes are scoped by arrangement: a frame
shows only modes of its active arrangement and falls back to the first one when
the requested mode does not belong to it.

## Lenses

This section realizes MED.BLK.DIFF-R88 and MED.BLK.DIFF-R89. `@pierre/diffs` is
used where content is line-shaped; every other lens owns its renderer because its
medium is not lines.

| Lens              | Content                              | Renderer                                                                             | Combined                                        | Side by side                                  | Why                                                                                           |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ImageDiff`       | Screenshot, page render, scan        | Own (canvas + `img`)                                                                 | Stage with modes Swipe, Overlay, Difference     | Two panes, synced zoom and scroll             | Pixels are not lines                                                                          |
| `ImageCompareSet` | One reference vs N candidates (peer) | Own                                                                                  | Reference plus candidate grid                   | Same                                          | N-way peer comparison                                                                         |
| `PageSetDiff`     | Ordered PDF/scan pages               | Own; selected pair opens a nested `ImageDiff`                                        | Merged page cards or filmstrip                  | Two aligned page columns                      | Pages are images; `pageCount` keeps unrendered pages visible                                  |
| `TextDiff`        | Text                                 | `@pierre/diffs` for `lines`, own inline for `prose`                                  | Unified                                         | Split                                         | See text shape rule                                                                           |
| `CodeDiff`        | Source file pair                     | `@pierre/diffs`, lazy-loaded                                                         | `diffStyle: unified`                            | `diffStyle: split`                            | Line-shaped; same renderer and theme as the `Diff` Block; the frame switch is the only switch |
| `RecordDiff`      | Key/value, JSON, config              | Own React Aria `Table`/`GridList`; long text nests `TextDiff`, code nests `CodeDiff` | `before → after` in one column                  | Before and after columns                      | Leaf-path rows, list chips with move detection                                                |
| `DocumentDiff`    | Notion-like block tree + properties  | Own; inline word marks                                                               | One document, removed ghosted                   | Two aligned columns, one grid row per pair    | Rendered prose, not lines; embeds and properties nest lenses                                  |
| `TreeDiff`        | Keyed hierarchy                      | Own React Aria `Tree`                                                                | Merged tree, moved node with ghost at old place | Two literal trees, counterpart highlight      | Moves, renames, splits                                                                        |
| `TraceDiff`       | Two OTel traces                      | Own waterfall                                                                        | One waterfall, before/after bars per span       | Two waterfalls on a shared axis, rows aligned | Time geometry, not lines                                                                      |
| `DiagramDiff`     | Typed graph                          | Mermaid with change classDefs                                                        | One merged graph                                | Two graphs, same ids and order                | Graph layout; raw Mermaid source is never parsed                                              |

Matching rules per lens: images and pages by content hash (MED.BLK.DIFF-R92);
text by paragraph and unique-word anchors, then linear-space Myers; documents by
block `id`, then content signature (LCS per sibling list), then same-type word
similarity, with out-of-order or reparented blocks as `moved`; trees by stable
id; trace spans by structural path (service + span-name chain, disambiguated by
sibling ordinal in start order); diagrams by node and edge id.

### Text shape rule

`shape` on the text subject selects the renderer (decision 0099):

| `shape`           | For                               | Renderer                                                                                                                               |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `lines` (default) | OCR, logs, extracted text, config | `PierreDiff` in plain-text language: line numbers, word-level highlights, folded hunks, wrapping                                       |
| `prose`           | Paragraph-flowing text            | Own inline renderer: struck removals and marked insertions in flowing paragraphs, unchanged stretches folded to whole-sentence context |

The shape of the after side wins, else the before side's. A plain `text` record
value lifted to a subject is `prose`.

### Per-lens defaults

What `SemanticDiff` renders without options (decision 0099). Each is an
overridable lens prop.

| Lens     | Default                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------- |
| Image    | Difference mode; changed pixels in the highlight color over a dimmed base; page sets as a filmstrip |
| Record   | Table layout; unchanged rows folded behind a count                                                  |
| Document | Colored gutter bar; removed text struck inline; embeds as thumbnail + link card                     |
| Tree     | Ghost at the old location plus a moves list; unchanged subtrees collapsed                           |
| Trace    | Stacked before/after bars; tree order; absolute milliseconds                                        |
| Diagram  | Accent stroke plus badge on changed elements; change list beside the graph                          |

## Identity and verdicts

This section realizes MED.BLK.DIFF-R92.

- `subjectKey` is a subject's canonical identity. An image keys as
  `image|<contentHash>` and a page set as `pageSet|<pageCount>|<page hashes>`; a
  URL, alt text, or label never enters a key. An image or page without a
  `contentHash` anywhere in the subject, including record fields and document
  embeds, leaves the subject without a key, so it never short-circuits to
  `unchanged` and waits for its pixel verdict instead. Other subjects key by
  their JSON value, with nested image and page-set subjects replaced by their
  keys. Equal keys are `unchanged` without further work.
- An image pair with equal `contentHash` is `SameBytes`: one render, no pixel
  work. Unequal hashes are `different` bytes; a missing hash is `unknown`. A pixel
  comparison below `minChangedRatio` (default `0.00005`) with equal dimensions is
  `unchanged`; if bytes differ it reads "same render, different bytes".
- A page-set pair with pending or failed verdicts has no overall kind rather than
  `unchanged`; image pairs count nothing until compared.

## Image pipeline

```text
frame body enters viewport + 600px ─► useLoadedImage (both sides, main thread)
                                          │ both Loaded
                                          ▼
                     scheduleImageTask ─► queue (≤ 4 in flight)
                                          │
              decode on main thread (SVG-safe; reuse displayed <img> if readable)
                                          │
              createImageBitmap resized to the shared frame
                                          │ transfer
                                          ▼
                     Worker: rasterize, computePixelDiff, compose difference
                                          │ on any worker failure
                                          ▼
                     main-thread fallback in row bands between animation frames
```

1. The comparison starts only when the frame body is expanded and near the
   viewport (`useDiffFrameVisible`), and only after both sides load; load
   completion re-triggers the job.
2. Each job fits both images into one letterbox frame capped at `maxPixels`,
   decodes on the main thread (Chromium rejects `createImageBitmap` of an SVG
   blob in a worker), transfers frame-sized bitmaps, and runs the diff in a
   module Worker that is terminated after one job.
3. Page and compare-set thumbnails use verdicts instead of full comparisons. A
   thumbnail registers with a shared `IntersectionObserver` (`rootMargin 600px`)
   and enqueues only on first intersection, so collapsed or distant pairs never
   queue. Verdicts compare at 240,000 pixels and keep no masks.
4. The verdict store is keyed per pair by `sourceKey` (`h:<contentHash>`, else a
   per-object token) plus tolerance and `minChangedRatio`. It deduplicates
   in-flight comparisons, keeps up to 512 verdicts in least-recently-used order
   (reads and subscriptions refresh recency), never evicts a key with a live
   subscriber, and notifies only the listeners of changed keys in one batched
   animation frame.

## Deferral and virtualization

This section realizes MED.BLK.DIFF-R93.

Every frame registers with one shared `IntersectionObserver` (`rootMargin
600px`). A body mounts the first time its frame comes near and stays mounted;
while off screen it holds the arrangement and mode it last rendered, so a page
toggle re-renders only frames near the viewport. Expensive models run in the
body, never in the outer lens component.

| Lens               | Virtualization                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Code, text `lines` | Pierre virtualizer above 400 total lines; pierre is lazy-loaded                                                   |
| Text `prose`       | Unchanged stretches fold; no windowing                                                                            |
| Record             | React Aria `Virtualizer` above 50 rows; `content-visibility: auto` below                                          |
| Page set           | React Aria `Virtualizer` above 24 pages (list for filmstrip and columns, grid for cards)                          |
| Tree               | React Aria `Virtualizer` with `ListLayout` (estimated row 34 px); keyboard navigation survives windowing          |
| Trace              | Own windowing: measured row heights, 440 px viewport, overscan 5; arrangement and filter text are deferred values |
| Document           | Embed images load lazily and decode async; no windowing                                                           |
| Diagram            | None; selection is local state and does not re-layout                                                             |

## Performance gates

This section realizes MED.BLK.DIFF-R93.

Scale stories live under `Vista/Blocks/Diff/Scale` and render the family at dogfood scale
from deterministic generators: `MixedFortyFrames`, `OcrTenPercent`,
`OcrThirtyPercent`, `FortyOcrFrames`, `TraceFiveHundred`, `TreeOneThousand`,
`PageSetTwoHundred`, `MoreThanFiveHundredTwelveImagePairs`, `TenA4ImageDiffs`,
`DocumentThreeHundred`, `RecordTwoHundred`, `DiagramOneHundredFifty`,
`FortyCodeFiles`, and `AllStates`. Each page is wrapped in `DiffPage`.

A gate is one interaction in `tests/diff-perf.pw.test.ts` against the Scale
stories served by the Storybook dev server (React development build, which the
React Profiler commit counts require) in Chromium:

1. Wait for the story to mount and settle. In the frame lane, before **each**
   measurement, including each story load, poll the one-minute host load until
   it is at most the available core count. Fail with a quiet-host error after
   10 minutes; never skip frames.
2. Acquire a scoped public `@overeng/meters` measurement through the Scale
   stories' dev/test-only DOM bridge after frame evidence is `Value` and
   `Calibrated` and every declared Profiler boundary has emitted a callback.
   The bridge shares the host's instrumentation registry, holds scopes behind
   opaque tokens, and revokes authority on unmount. Wait for comparison work
   and 30 quiet render-commit frames before ending with five settlement frames.
   Decode the wire result and accept only `Complete`, eligible evidence with
   captured frames; missing counter evidence is an error, never zero. Dense
   zero deltas require matching declared cumulative reads before and after.
   Collect long tasks using the existing `longtask` observer; mount long-task
   brackets start at the `vista-diff-scale-mount` mark, before fixture generation.
3. Enforce exact or budgeted render commits and completion/settling, with no
   failure alert on image pages, in both lanes. Frame drops and long tasks are
   timing gates: log them in both lanes and enforce them in the frame lane.

| Lane          | Task                                                          | Gate                                                                                                                                            | CI                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic | `test:vista-diff-perf`                                        | Commit budgets and all comparisons settled; timing results annotated `frame-gates-deferred-to-perf-lane` without frame or long-task assertions. | Every PR via the Storybook deploy job, before publication; also included in `test:run` / `check:all`.                                                                                                                                    |
| Frames        | `test:vista-diff-perf-frames` (`VISTA_DIFF_PERF_LANE=frames`) | All deterministic gates plus the R93 long-task and dropped-frame budgets and per-class frame-drop budgets on a quiet host.                      | Dedicated `Vista Diff Frame Performance` workflow on pushes to `main` that touch `flakes/vista/blocks`, its genie source, or `pnpm-lock.yaml`, and manual dispatch; serialized with non-cancelling `vista-diff-perf-frames` concurrency. |

Every R93 row is a gated interaction. `RecordTwoHundred` and `PageSetTwoHundred`
page toggles have no R93 row but carry commit and frame-drop budgets from their
measured baselines. The other Scale stories remain available for measurement but
are not gated.

## Design questions

- **DQ1 Subject schema:** MED.BLK-R08 asks for effect-Schema-validated bespoke
  props, but the subject union is plain TypeScript over the lens modules' types.
  Resolved by either confirming a TypeScript-only union as an accepted tradeoff
  or defining the union once as Schema and deriving the lens types from it.
- **DQ2 SemanticManifest records:** MED.BLK-R08 requires schema-valid manifest
  records with stable IDs; the family emits none. Resolved by deciding whether a
  diff is addressable evidence (MED.REND-R03) and, if so, what its SemanticNode
  carries.
- **DQ5 Two code-diff entry points:** the `Diff` Block (01-code) carries its own
  view toggle while `CodeDiff` maps the frame arrangement to pierre. Resolved by
  deciding whether `Diff` becomes a `CodeDiff` without frame or stays separate.
