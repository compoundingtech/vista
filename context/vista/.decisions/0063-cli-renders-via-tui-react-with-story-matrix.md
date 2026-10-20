# The `vista` CLI renders via `@overeng/tui-react` with the tui-stories output matrix

Status: accepted

## Context

Decision 0030 requires the CLI to follow `/sk-cli-design` output *properties*
(dense, problems-first, no-emoji, `--json`). The implementation met those
properties by hand-rolling terminal output in `render.ts` — manual ANSI, bespoke
`padEndVisible` column math, hand-gated color, a bespoke `--json` bypass — and
therefore does not use `@overeng/tui-react`, the ecosystem's Effect-React TUI lib,
nor `@overeng/tui-stories` (the `TuiStoryPreview` + headless render-test matrix
`/sk-cli-design` is built around). This amends 0030's *output construction*; the
output properties are unchanged.

## Evidence and Argument

Feasibility de-risk came back GREEN. `@overeng/tui-react` maps 1:1 onto
`render.ts`'s primitives (`<Box>`/`<Text>` replace `padEndVisible`/ANSI/color-gating;
`useSymbols` for status glyphs; output-mode presets replace the bespoke `--json`).
`bun --compile` already ships the exact dep set (yoga/react-reconciler) — proven by
`@overeng/tui-stories` packaging with the same `mkPnpmCli` helper vista uses — and
the heavy `@xterm`/`@opentui` modules are lazy imports, so the barrel does not
eval-pull them. Dependency-clean: the CLI is a compiled Bun binary (0017), so its
deps are outside the closed `vista-deps` app surface that VST-R65/VST-R40/0006/0017
govern. `tui-stories` provides the `ALL_OUTPUT_TABS` (tty/ci/ci-plain/log/json/ndjson)
matrix + headless render tests vista's output currently lacks.

## Options

| Option | Tradeoffs |
| --- | --- |
| Full adopt tui-react + tui-stories (chosen) | Deletes hand-rolled ANSI/column/color code; gains the story-test matrix; one Effect-React idiom. Cost: ~15 render fns → view components + stories; moderate binary-closure growth. |
| Components only (renderToString, no stories) | ~60% of the win for ~40% of the effort; forgoes the ALL_TABS story tests. |
| Keep hand-rolled render.ts | Already meets 0030's properties; zero dep growth. Rejected: no story tests, bespoke ANSI/width code to maintain, diverges from the ecosystem TUI lib. |

## Decision

The `vista` CLI renders through `@overeng/tui-react`: each command computes a view
component (`<Box>`/`<Text>`/`useSymbols`), and commands adopt the
`createTuiApp` + `schema`/`view`/`app` structure so `@overeng/tui-stories`
`TuiStoryPreview` covers every command view across `ALL_OUTPUT_TABS` with headless
render tests. The hand-rolled `padEndVisible`/ANSI/color-gating and the bespoke
`--json` bypass are removed in favor of tui-react's output-mode presets.

**Invariant (supersedes 0030's output clause, does not weaken it):** the
agent-facing machine output (`--json`/`ndjson`) remains a **stable schema-derived
contract** independent of the presentation lib — it emits the control/RPC schemas
agents parse, never tui-react's internal view-state. Presentation may change; the
machine contract may not, except by an intentional versioned change (0061).

## Consequences

- `render.ts`'s bespoke terminal primitives are deleted; alignment/width/color are
  yoga/tui-react's job.
- Vista gains the `/sk-cli-design` story-test matrix it lacked; output modes
  (tty/ci/json/…) are tested uniformly.
- The compiled CLI binary grows moderately (yoga/reconciler/atom); no effect on the
  service `vista-deps` closure.
- Amends 0030 (output construction). The `--json` stability invariant is promoted
  to a CLI requirement.
