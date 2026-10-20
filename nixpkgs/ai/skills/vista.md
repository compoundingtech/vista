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
with `satisfies ChangelogEntrySource` from `../changelog/contract.ts`.
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

```tsx
import { AppRoot, ChoiceCards, ContextHeader } from '@vista/blocks'

export default function Review() {
  return (
    <AppRoot title="Review title" template="architecture-review" scope="review">
      <ContextHeader what="…" why="…" you="Pick the first fix." />
      <ChoiceCards id="decision" options={[{ id: 'a', label: '…', recommended: true }]} />
    </AppRoot>
  )
}
```

Default-export one zero-prop AppRoot. Compose `@vista/blocks` and local React
components. ID only addressable asks, decisions, cited evidence, reference/feedback
targets, and RuntimeIslands—not ordinary layout.

Typed domain Blocks derive DataBindings; do not author Provider or
SemanticManifest details. Keep browser-only behavior below a RuntimeIsland. Vista
owns the shell, bootstrap, and theme; App-local StyleX is allowed.

Taste kit: `ContextHeader` (open every page; `verdict` for the bottom line),
`ChoiceCards` (bounded choices; `multiple` for pick lists), `RankedFindings`
(causes by gap; `proof` or a `next` experiment), `TimeTrack`, `Comparison`,
`InspectRow` (detail on demand), `Mark`, `MissionGraph` (Fractal steps as lanes ×
ranks; gates via `overlay`), `ProgressLanes`, `Note` (wrap an element with
`text`; the shell's Explain toggle shows notes). Icons: `import { Icon } from
'@vista/blocks'`; never `lucide-react` or esm.sh.

Lead with the decision, recommended lean, and evidence. Viewer input is limited
to bounded choices; general feedback stays in chat or annotation tools.

Act through tools, not a hypothetical scaffold. If blocked, state only the
missing prerequisite; never invent an API or source.

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
