---
description: Publish a browser-viewable durable Vista App for architecture review, options comparison, plan sign-off, or live telemetry. Use when agent→human output is relational, comparative, or evolving; keep simple results in the terminal.
agents: [coding]
personas: [worker, generalist]
invocation: [model, user]
---

# Vista

Vista is for rich review: architecture/design, plans, options, live telemetry,
and code changes. Keep linear output in the terminal.

Shipped product release recaps belong in `.changelog` entries, not a new App.
Add one `flakes/vista/.changelog/YYYY-MM-DD-slug.ts` file exporting `entry`
with `satisfies ChangelogEntrySource` from `../service/src/changelog/contract.ts`.
The compiler discovers entry files directly; no index or generated inventory
needs editing. It validates dates and entry schemas and emits newest-first
history with descending IDs as the same-day tie-breaker.
In `contributors`, record every contributor's host-qualified `agentId`, `name`
only when verified, and optional short `repo/branch-leaf` `worktree` (never an
absolute path). Use multiple items for shared work. The product shows it in
expandable **Change context**. Use an App when the recap needs rich review
rather than release history.

## Taste

Apply the [taste contract](https://github.com/schickling/dotfiles/blob/main/context/vista/02-medium/04-doctrine/taste.md)
and [mental model](https://github.com/schickling/dotfiles/blob/main/context/vista/02-medium/04-doctrine/intuition.md):

- Start with what this is, why now, and what you need from the reader; say when
  no action is needed.
- Give each screen one primary focus. Visual weight must guide attention to it.
- Put visuals and structure before prose. Every sentence earns its place;
  drafts, logs, and long reference artifacts stay inspect-on-demand.
- Make hierarchy, sequence, and peer comparisons explicit, not implied by text.
- Use intentional semantic color and one consistent icon set, not decoration.
- Use real controls for bounded choices; zoom via cursor/icon, not repeated
  “Open full size” labels. Keep accessible names and keyboard operation.
- Keep the kit's familiar reading grammar; make the content and visual bespoke.
- Cut UI-explaining prose: the layout and affordances do that work.

Bad: equal-weight text cards, an unexplained verdict, “Ratify / Revisit” as prose.
Good: a what/why/ask header, one dominant comparison, real choice controls,
and evidence disclosed only when needed.

## Author

In the owning agent context, use `vista new <local-slug>` to resolve the
canonical AppSource, then author its `app.tsx` as ordinary TSX. Sources live at
`$XDG_STATE_HOME/vista/sources/<host>/<seat>/<local-slug>` (or the configured
`VISTA_SOURCES` root); VistaClient derives host and seat from `$ST_AGENT`:

`FRACTAL_AGENT` is accepted as the new identity name; supported sessions still
export `ST_AGENT`. VistaClient reads only `ST_AGENT`; use it in commands and
env reads until contraction (about 2026-11-01).

Default-export one zero-prop AppRoot. Compose `@vista/blocks` and local React
components. ID only addressable asks, decisions, cited evidence, reference/feedback
targets, and RuntimeIslands—not ordinary layout.

Typed domain Blocks derive DataBindings; do not author Provider or
SemanticManifest details. Keep browser-only behavior below a RuntimeIsland. Vista
owns the shell, bootstrap, and theme; App-local StyleX is allowed.

Taste kit: `ContextHeader` is an existing brief primitive, not the complete
universal context section specified below. Compose the section using the kit
and local React; the dedicated component is not shipped yet. `ChoiceCards`
provides bounded answer controls (`multiple` for pick lists), not context ask
previews. Other blocks include `RankedFindings` (causes by gap; `proof` or a
`next` experiment), `TimeTrack`, `Comparison`, `InspectRow` (detail on demand),
`Mark`, `MissionGraph` (steps as lanes × ranks; gates via `overlay`),
`ProgressLanes`, and `Note` (wrap an element with `text`; the shell's Explain
toggle shows notes). Icons: `import { Icon } from '@vista/blocks'`; never
`lucide-react` or esm.sh.

Lead with the decision, recommended lean, and evidence. Viewer input is limited
to bounded choices; general feedback stays in chat or annotation tools.

Act through tools, not a hypothetical scaffold. If blocked, state only the
missing prerequisite; never invent an API or source.

## Universal context section

Every Vista page opens with one context section directly under the page title.
A cold reader must learn what the page is about, where things stand, what is
asked of them, and how it got here without scrolling past the first screen at
1440×900.

Settled: card group; Explain off by default; story headlines and the last 5
steps; relative time plus short date; H2 breadcrumb and chips; S2 headline plus
2–3 sentences; A1 ask rows stacked as A4 for multiple asks. **§9 is a proposal,
not decided by Johannes.**

This is authoring guidance, not a shipped `ContextSection` API. The TypeScript
shapes below describe content, not imports from `@vista/blocks`. Compose existing
kit blocks and local React where needed until the kit support lands. Context
ask rows preview the source's questions and link to where answers belong; they
do not register a second addressable Ask. Real answer controls elsewhere remain
bounded, accessible controls. Preserve the explicit informational declaration
when there is no ask; the visible nothing-needed line does not replace it.

## 1. Order (fixed)

1. **Frame label** `CONTEXT · START HERE` (info icon). Section `aria-labelledby="context-title"`.
2. **Anchors** (H2, §2): a breadcrumb line, then one chip line.
3. **Three cards** in one row (card group). Below about 40rem they stack.
   | Card      | Icon      | Question (verbatim)       | Content                                                     |
   | --------- | --------- | ------------------------- | ----------------------------------------------------------- |
   | About     | package   | What is this about?       | Subject and scope; give the date if the page is a snapshot  |
   | Situation | hourglass | What is the situation?    | Current state, with numbers                                 |
   | Ask       | hand      | What do you need from me? | Purple (you) tone; the questions with explicit answers (§4) |
4. **VISUAL SUMMARY** (eye icon) beside **HOW WE GOT HERE** (clock icon). The picture takes flex `3 1 34rem` and the story `2 1 24rem`. On narrow screens the story wraps below the picture.
5. **TERMS AND SOURCES**: one InspectRow, collapsed by default, with the glossary and source links to pinned versions.

Labels are fixed small caps (uppercase, letter-spacing 0.06em, muted, 14 px icon). Never rename them per page.

## 2. Anchors (H2)

Where the work lives, in the vocabulary we already use (GitHub labels and the owner/agent structure).

- **Breadcrumb** (`<nav aria-label="Where this lives">`): `repo › primary label › owner agent`, then `with <other agents>`. Example: `example/project › area:review › agent/project/review`.
- **Chip line**: the remaining labels, extra repos, `|`, host chips, `|`, linked-work chips (PR/issue with state dot, mission, work subject, question handles).

Data:

```ts
type Label = { name: string; from?: string[]; suggested?: true } // from = the PRs/issues carrying it
type Work = { label: string; href?: string; state?: 'merged' | 'open' | 'draft' | 'closed' }
type Anchors = {
  repos: string[] // first = breadcrumb root
  labels: Label[] // real taxonomy only: system:*, area:*, type:*, state:*
  primary?: string // the system:/area: label for the middle crumb
  labelNote?: string // e.g. "smalltalk issues use none"
  owner: string // owner agent id, e.g. agent/project/review
  involved: string[] // other agents
  work: Work[]
  hosts: string[] // source-provided host identifiers, when appropriate to share
}
```

Rules:

- Labels are the ones the linked PRs/issues **carry today** (`gh pr view --json labels`). Colours come from `gh label list -R <repo> --json name,color`. The chip title names the carrier.
- No linked item carries a label → you may add the taxonomy label you would pick, marked `suggested` (dashed border plus "· suggested"). Never coin a label outside the taxonomy.
- An unknown anchor is left out; drop the separator with it. No primary label → the breadcrumb is `repo › owner`.

## 3. Card text (S2)

```ts
type CardText = { headline: string; text: ReactNode } // About and Situation
```

- **Headline**: the finding or the subject in one line, bold. No trailing period needed.
- **Text**: 2–3 plain sentences. About covers scope and why it matters. Situation gives the state, with numbers, units and the time they were measured.
- Define a term inline or put it under Terms. No insider shorthand, no "see below".

## 4. Ask card (A1, stacked as A4)

The Ask card asks a question and gives the answers, with the recommended answer marked. A sentence alone is not enough.

```ts
type AskOption = { id: string; label: ReactNode; tradeoff?: ReactNode; recommended?: true }
type AskWhere = { label: ReactNode; href?: string } // question, PR, #anchor, chat, terminal
type AskQuestion = {
  id: string // the source's own ID (D8, B4, fork-1)
  handle?: string // question handle when the source names one (Q50/Q51)
  q: ReactNode // the question in plain words
  options: AskOption[] // explicit answers, 2–4
  why?: ReactNode // one line, only when an option is recommended
  lean?: ReactNode // source leans to a process, not one of the options
  due?: string // deadline in the source's words or a §6 time
  ifNone?: ReactNode // what happens if you don't reply
  where: AskWhere // where the answer goes
}
type AskSet = {
  questions: AskQuestion[] // [0] = primary
  rest?: { label: string; where: AskWhere; items: { id: string; title: string; lean: string }[] }
  also?: ReactNode[] // asks that are steps, not choices
}
```

Rendering:

- **A1** (one question): the question, then one row per option with a hollow radio ring, the label and its one-line tradeoff. The recommended row has an accent border, an inset left bar and a blue "Recommended" badge. Below: **Why** line · due (clock) · "If no reply: …" · where-to-answer link. Footer: "+N more questions" / "Also yours".
- **A4** (two or more questions): the Ask card takes the full row below About and Situation. Each question is a compact A1 block (ID + handle in the head), grouped by `where`, in a responsive grid. `rest` sits in a `<details>` with each item's lean. `also` is a closing "Also yours" list.
- The ring is **always empty**. A recommendation must never look like a selection.

Honesty markers (exact strings):

- No option recommended → `No recommendation in source` chip, with no highlighted row. If the source leans to a process, show it as `Source lean: …` under the rows.
- Recommended but no reason given → `No reason in source.` in place of Why.
- A decline you add ("Not now", "Not yet") has no tradeoff unless the source states one.

**Nothing needed**: when there is no ask, the card holds one quiet muted line, the same on every page: `Nothing needed. This page is for information.` No options, no badge, no purple tone.

## 5. How we got here (story)

```ts
type StoryEvent = {
  at?: string // ISO UTC instant or day
  when?: string // 'Now' | 'Open' | 'Later' when there is no time
  planned?: boolean
  headline: string // ≤ 8 words, bold
  description: ReactNode // REQUIRED, 1–2 sentences, always visible
  tone?: 'you' | 'risk' | 'done' | 'recommend' | 'muted'
  who?: string[]
  subject?: ReactNode
  what?: ReactNode
  evidence?: { label: string; href: string }[]
}
```

- Oldest first, newest last; the last step is usually "Now". Each description says what happened and why it led to the next step.
- Steps show as headlines plus description. Who · Where · What · Proof live in the per-step expand (chevron). A step with none of them is not expandable.
- Show the **last 5 steps**. Older steps go behind one `Earlier steps (N)` expander at the top (dashed rail dot, `aria-expanded`, reads `Hide earlier steps` when open). `Open all` / `Collapse all` cover the earlier steps and every expand.

## 6. Time

- Computed in the browser at view time, in the reader's local time: `<relative> · <short date>`. Relative is one of `N min ago`, `today HH:MM`, `yesterday HH:MM`, `tomorrow`, `N d ago`, `in N d`, `N mo ago` (≥ 60 d). The date is en-GB `12 Oct`. A day-only `at` drops the clock.
- Render as `<time dateTime title>`. The title shows the exact `YYYY-MM-DD HH:MM UTC` or `Planned for …`.
- `planned` reads `due …`, then `was due …` once past. No known time → the `when` word. Never invent a time.

## 7. Visual summary

- Exactly one visual, titled by one plain sentence stating the finding.
- Kit tones only, with the same meaning on every page: purple = you, amber = risk/problem, green = done, blue = recommended, grey = background.
- Reuse kit visuals (Flow, rail, bars, TimeTrack, ProgressLanes). Arrows connect only real sequential steps; side facts go in a caption. Show only facts that are already on the page.

## 8. Explain

- One header toggle, "Explain this page", **off until pressed**. No per-region toggles.
- Every region has a kit `Note`: frame, anchors, cards, picture, story, terms and every body section. A note says what the region is and how to read it; it never restates the content.

## 9. Text budget — PROPOSAL, not decided (q11)

Johannes has not decided this proposal. The limits below are candidates, not authoring requirements; settled rules elsewhere (such as 2–4 options and the last 5 story steps) remain in force.

Measured against the five reference scenarios, whose longest S2 texts run 26–36 words. Proposed hard limits; if adopted, trim rather than wrapping into a fold.

| Element                                                                              | Budget                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Card headline                                                                        | ≤ 8 words (~60 chars), one line at 1440                  |
| Card text (About, Situation)                                                         | 2–3 sentences, ≤ 40 words                                |
| Ask question `q`                                                                     | ≤ 12 words                                               |
| Options per question                                                                 | 2–4 (A1); more → split the question                      |
| Option label                                                                         | ≤ 6 words                                                |
| Tradeoff / Why / If no reply                                                         | one line each, ≤ 15 words                                |
| A4 visible question blocks                                                           | ≤ 6; the rest go to `rest` (ID, title, lean)             |
| Story step                                                                           | headline ≤ 8 words, description ≤ 2 sentences / 30 words |
| Visible story steps                                                                  | 5                                                        |
| Chip line                                                                            | ≤ 10 chips; drop `involved` agents beyond 3 into "+N"    |
| Whole section, collapsed, excluding the visual                                       | ≤ 350 words                                              |
| Proposed overflow rule: if a page cannot fit, split the page; don't shrink the type. |

## 10. Rules

- **Never invent**: no recommendation, reason, deadline, consequence, label, handle, agent, host, time or link that the source does not state. Unknown → leave the field out.
- The recommendation must come from the source (Manager/owner text, review.json `lean`). If the source recommends a process, that is a `lean`, not a recommended option.
- Option text and tradeoffs paraphrase the source; keep its numbers and nouns.
- Every ask has a `where`. If the answer is "reply in chat" or "in the terminal", say so.
- One page, one ask card. Asks that are steps go in `also`, not in options.
- 390 px: cards stack, the A4 grid goes to one column, the story drops below the picture, there is no horizontal scroll inside the section, and long IDs wrap (`overflow-wrap: anywhere`).

## 11. Anti-patterns

- An ask written as prose ("Please decide whether …") with no explicit answers.
- Highlighting your own preference as "Recommended" when the source has none.
- Filled radios or check marks on the recommended row (they read as already answered).
- Different "nothing needed" wording per page, or an empty purple card.
- A1 with "+5 more questions" when the page really needs answers to all of them; use A4.
- A2-style option cards for every ask: they take the full row and push the visual summary below the fold.
- Folding the alternatives (A3) so only the recommended answer is visible.
- Labels that no linked item carries, shown without `suggested`; chips styled outside the GitHub label colours.
- Absolute timestamps only, or server-rendered relative time that goes stale.
- Per-region Explain toggles, or Notes that repeat the region's text.
- Story steps with only a headline, or more than 5 visible steps.

## 12. Reference scenarios

The guidance was exercised against five reference scenarios: a slowness root-cause
analysis with a recommended set of fix lanes; a mission with multiple questions
(A4); host saturation with a recommended restart; sidebar clustering with
`No recommendation in source`; and a morning briefing with a mixture of process
leans and recommendations without reasons (A4). The nothing-needed state was
also exercised. These scenarios select H2, S2, and A1 (A4 for multiple asks);
no private reference-app endpoint is required to apply this guidance.

## 13. Future kit support

The reference scenarios compose the section from kit tokens on the app side.
A future context component must provide:

1. **ContextSection** shell: frame label, fixed order, 40rem card wrap, and the
   picture/story flex split.
2. **Anchors**: breadcrumb, `LabelChip` (GitHub colours, dashed `suggested`
   variant, carrier title), `WorkChip` with state dot, host and agent chips.
3. **ContextCard** with tone and an S2 body.
4. **AskCard** rendering `AskSet` (A1/A4), hollow rings, Recommended badge,
   honesty markers, and the fixed nothing-needed line. It must not register an
   addressable Ask; `ChoiceCards` does and cannot be reused for these previews.
5. **Story** with Earlier steps, Open all / Collapse all, per-step expand, and
   **RelativeTime** following §6.
6. Registered Notes for every part, covering the section in Explain without
   app-specific wiring.

Tracked by [Kit: ContextSection component](https://github.com/compoundingtech/vista/issues/35).
Known kit defects seen in the reference scenarios at 390px:
[shell header overflow](https://github.com/compoundingtech/vista/issues/36),
[Explain callout overlap](https://github.com/compoundingtech/vista/issues/37),
[TimeTrack log-tick overlap](https://github.com/compoundingtech/vista/issues/38),
and [ProgressLanes detail truncation](https://github.com/compoundingtech/vista/issues/39).
The reference picker uses hidden native radios with associated labels; tests
click the label. This is test ergonomics, not evidence of a separate defect,
and is included in the component issue.

## Decision kit pattern

Use the decision kit when a reader needs to choose between bounded options.
Start with `vista new <local-slug>` and compose the blocks for the situation.

Define the cards once with `defineDecisions`; render its `Overview` and the
same cards with `DecisionCard`. Do not write a second summary table.
Each card states the situation, one visual, the next step and cost of every
option, a recommendation, reasons, risk, and folded evidence.
Keep the situation and reasons short; put supporting detail in evidence.

Construct the visual with `decisionVisual(Component, props)`. Use
`AnnotatedImage` for images, `CiChart` for interval estimates, or the existing
chart and Mermaid blocks. Use real data where available; label illustrations
and uncertainty honestly. An interval is not a confidence level unless the
source says so.

The card id identifies its Decision; `<id>-ask` identifies its Ask.
`vista check` rejects missing costs, authored overview rows, and raw images
in the visual slot through the public types, without a model call.

## Publish and judge

Author → `vista check [path]` → publish:

```text
vista publish <local-slug> --message "<what changed>"
```

Fix reported authored paths; publish repeats the checks server-side. Replace
scaffold slot comments with real context and content before sharing; `vista check`
warns when those slots remain.

Run App commands in the owning agent context; pass no owner or catalog path.
Open the pinned URL, judge the title, ask, content, evidence, diagrams, and
interactions; check the console and confirm it is static, not Vite/HMR. Share
only that browser-verified URL.

### Advisory critique

Run `vista review <slug|url>` on **first versions and structural rewrites only**,
not every edit. A URL may point to a local preview. The command captures the
first viewport at 1440×900 in light and dark using Vista's Nix-managed Playwright,
prints viewport word/visible-element counts and a context-header/brief heuristic,
and asks `anthropic/claude-opus-5-5` for at most five ranked taste findings.
It always exits successfully: findings and unavailable reviews are advisory,
not publish gates. The DOM context check is a heuristic, not proof of clarity.
`vista review` sends rendered screenshots of the publication to the model gateway (data egress); it is advisory and non-blocking, with unavailable or failed gateway reviews reported and exit status 0.

Set `AI_GATEWAY_URL` and `AI_GATEWAY_TOKEN` in the environment. Review sends both
screenshots to the gateway's OpenAI-compatible `/v1/chat/completions` endpoint;
review only content appropriate to send there. It does not provision credentials
or print the token. Taste comes from
`context/vista/02-medium/04-doctrine/taste.md` when available, otherwise the
rules below. Packaged Vista includes this skill as the fallback.

## Taste

- **T1 — Context first.** Start with an ELI5 brief: what this is, why it matters,
  and what the reader should do; offer progressive drill-down.
- **T2 — Clear hierarchy.** Make the main decision, recommendation, and evidence
  easy to find in the first viewport; avoid a wall of equally weighted content.
- **T3 — Honest choices.** Keep choices bounded; distinguish a recommendation
  from a selected choice, and make consequences explicit.
- **T4 — Evidence before claims.** Cite evidence. Render unproven findings as
  hypotheses with a concrete next step to prove or disprove them.
- **T5 — Legible in both themes.** Preserve contrast, spacing, readable type,
  and diagram labels in light and dark; avoid overflow and clipped content.
- **T6 — Simple overall.** Vista must not leak complexity. Prefer the smallest
  useful explanation and interaction; move detail behind progressive disclosure.

## Composes with

- `/sk-explainer` for audience-specific framing and diagrams;
- `/sk-agentation` for visual annotation feedback;
- `/sk-interview` for bounded structured-answer questions.
