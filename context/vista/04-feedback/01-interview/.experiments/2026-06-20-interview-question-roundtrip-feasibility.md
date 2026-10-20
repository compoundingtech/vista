# Experiment: interview / decision-question round-trip feasibility (2026-06-20)

Feasibility + mechanism proof for decision
[0013](../../../.decisions/0013-bounded-structured-answer-for-agent-questions.md): host a
interview loop in Vista — agent poses a structured decision-question, the human
answers in the Vista browser, the answer routes back to the agent. Proof built with
Bun, no global installs. (Spike source was under `tmp/proto-grill-integration/`,
since reclaimed.)

## Verdict on the three primitives

Discriminator: can the question be answered *from* an external browser without
owning the agent harness or the MCP client UI?

- **agentation-style MCP store — the ONLY viable one.** Agent writes via an MCP
  tool; the browser reads/writes via HTTP; the browser surface is decoupled from
  both the harness and the MCP client, so it works with Claude Code as it runs
  today.
- **AskUserQuestion — not viable.** Its external-UI (`canUseTool`) path only
  exists if Vista owns the Agent-SDK `query()` runtime; that's absent in
  interactive `claude` (where the `sk-grill-*` skills run) and in subagents.
- **MCP elicitation — not viable as the answer path.** It works in interactive
  Claude Code and URL mode opens a browser, but the human's decision resolves by
  "confirm in the CLI" — the answer does not return *from* the browser page. The
  disqualifier is the answer path, not the render location.

## Recommended architecture

Reuse agentation's shape (one process, shared question store, two faces) but put
the HTTP answer endpoint + store **inside the standing Vista service** (not a
separate process), with two new MCP tools:

- `vista_ask(reviewId, DecisionQuestion)` — register a pending question.
- `vista_await(reviewId, questionId)` — the `watch` analogue; short bounded
  server-side blocks the agent re-issues until answered.

Interview **drives** Vista: the `sk-explore-interview` / `sk-vrs-interview` skill stays the
brain and one-question-at-a-time logic, and simply calls `vista_ask` + `vista_await`;
Vista mirrors the question (with the rendered scenario) and collects the answer.

## Data contract (`DecisionQuestion`)

A superset of all three primitives' shapes: `question` + `options[]{id, label,
tradeoff}` + `multiSelect` (AskUserQuestion shape) + `recommendedDefault` +
`evidenceGaps` (grill-me shape) + `aboutBlockIds` linking the question to the
rendered review's stable block ids (the no-migration attach point from VST-R04 /
decision 0008). Answer shape is the closed `{ chosenOptionIds }`.

## Boundedness (holds decision 0001/0013 line)

Captures ONLY the agent's explicit structured questions (closed
`{question,options}`→`{chosenOptionIds}`), distinct from freeform annotation
(stays with agentation/plannotator). A tightly bounded extension — an HTTP POST
endpoint + a store + two MCP tools — not a re-architecture. Security aligns with
decision 0009: tailnet-only, bind to the tailnet interface, scope answers to
`(reviewId, questionId)`.

## What was proven / what was painful

Proven: mock agent registers a question and **blocks** on await; browser renders
scenario + structured question; human clicks; agent resumes and prints the choice.
The load-bearing **await→resume** works and survived a 14s block.

Painful (the real design point): the held await connection. Bun's default 10s
`idleTimeout` reset the agent's long-poll; a human takes minutes. The principled
fix is the **`watch` re-arm pattern** (short bounded server-side blocks the agent
re-issues), not a bigger timeout — exactly why agentation exposes
`watch_annotations`.

## Open decisions (→ open-questions.md)

1. **Await transport** — re-arm `watch` (proven) vs SSE/WebSocket push vs
   Agent-SDK `defer`. (OQ-AWAIT-TRANSPORT)
2. **Answer channel** — mirror the answer to chat too, or Vista-only?
   (OQ-ANSWER-CHANNEL)
3. **Store durability** — in-memory vs Vista's on-disk per-review convention.
4. **`vista-mcp` native vs bending agentation** — agentation's element-annotation
   vocabulary is wrong for a decision-question; a small native MCP server is
   cleaner but copies its transport.
