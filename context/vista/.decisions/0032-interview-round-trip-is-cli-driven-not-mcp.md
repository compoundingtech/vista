# Interview round-trip is CLI-driven, not an MCP server

Status: accepted

Refines decision [0013](./0013-bounded-structured-answer-for-agent-questions.md).

## Context

Decision 0013's feasibility spike landed on an agentation-style MCP store
(`vista_ask`/`vista_await` MCP tools) as the way an agent poses a structured
decision-question and reads the human's in-browser answer. The first
implementation shipped a `@vista/mcp` package. But we already have the `vista`
CLI (decisions 0028/0030) and the `/sk-vrs-interview` skill for refine/align — an
MCP server duplicates that surface, adds an `@effect/ai` dependency, and needs a
contended root-workspace registration.

## Decision

The bounded structured-answer / interview round-trip is **CLI-driven via
`/sk-vrs-interview`, not an MCP server.** Drop the `@vista/mcp` package.

- The agent poses + reads answers through **CLI commands** — `vista ask <review>
  <question…>` registers a `DecisionQuestion`; `vista await <review> <questionId>`
  blocks (the `watch`-style re-arm, OQ-AWAIT-TRANSPORT) until the human answers in
  the browser. Both hit the service's existing `/_interview/*` HTTP endpoints.
- **`/sk-vrs-interview`** orchestrates the refine/align flow (the one-question-at-a-
  time interview), optionally rendering the scenario in Vista and collecting the
  structured answer via the CLI.
- The **service-side endpoints + question UI** from the interview integration stay
  (they are the round-trip core); only the MCP wrapper is removed.

## Consequences

- Simpler: no MCP server, no `@effect/ai` dependency, no root-workspace
  registration of an MCP package; keeps "thin CLI, thick service" (decision 0002).
- The re-arm await transport (OQ-AWAIT-TRANSPORT) now lives in `vista await`.
- Boundedness (decision 0001/0013) is unchanged: the CLI only conveys the agent's
  explicit structured question + the closed `{chosenOptionIds}` answer; freeform
  annotation stays delegated.
- `@vista/mcp` is removed from the build; the interview integration's value (in-Vista
  answering of the agent's own questions) is preserved through the CLI.
