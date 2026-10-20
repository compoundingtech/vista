# Bounded structured-answer for the agent's decision-questions

> **Transport superseded by [0032](./0032-interview-round-trip-is-cli-driven-not-mcp.md) — the ask/await round-trip is CLI-driven over RPC, not MCP tools. The bounded-exception policy stands.**

Status: accepted (Q14); feasibility proven
([../04-feedback/01-interview/.experiments/2026-06-20-interview-question-roundtrip-feasibility.md](../04-feedback/01-interview/.experiments/2026-06-20-interview-question-roundtrip-feasibility.md))

Refines decision [0001](./0001-vista-is-a-render-only-visual-medium.md).

## Context

Vista is render-only and builds no feedback capture (decision 0001). But a major
use case is **interview sessions** (VRS or general): an agent interrogates a design
one structured question at a time. Vista can host these — render the complex
scenario visually *and* pose the decision-question — and the human could answer
**in place**, far better than reading chat. Answering the agent's explicit
structured question is categorically different from general freeform annotation.

## Decision

Carve a bounded exception to 0001:

- **Out (delegated, per 0001):** general/freeform feedback and annotation stay
  with chat / `plannotator` / `agentation`. Vista does not build that.
- **In (intended, staged):** Vista may surface the agent's **explicit structured
  decision-questions** (the review's "asks": question, options, tradeoffs,
  recommended default, single/multi-select, links to the in-review evidence) and
  let the human **answer them in place**, routing the answer back to the agent.
  The interview loop is the canonical use case.

**Staging:** the render-only foundation ships first with the **chat baseline** —
verdict given in chat, agent republishes a new version moving the fork open→locked
(the "what changed" between versions is the decision record). The in-Vista
structured-answer path layers on as the next phase.

## Consequences

- Vista does not take on general feedback-capture infrastructure; the exception is
  strictly the agent's own structured questions.
- The content model needs a typed "decision question" (the ask) that the answer
  mechanism binds to — aligns with the doctrine's ask-first skeleton (decision
  0012) and the stable-id feedback hook (decision 0008/VST-R04).
- Proven architecture (spike): the HTTP answer endpoint + question store live
  **inside the standing Vista service**, exposed via two MCP tools
  `vista_ask` / `vista_await` (a `watch`-style re-arm to survive human think-time).
  The `sk-grill-*` skill drives; Vista mirrors the question + scenario and collects
  the answer. Only the agentation-style MCP-store primitive is viable —
  AskUserQuestion needs Agent-SDK runtime ownership (absent in interactive
  `claude`), and MCP elicitation resolves in the CLI, not from the browser.
- `DecisionQuestion` contract: `question` + `options[]{id,label,tradeoff}` +
  `multiSelect` + `recommendedDefault` + `evidenceGaps` + `aboutBlockIds` (links
  to the rendered review's stable block ids).
- Tailnet-only and trusted-author (decision 0009) bound the security surface.
- When this ships, revisit the plannotator boundary (decision 0011).
