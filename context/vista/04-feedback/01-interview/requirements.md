# Interview Integration Requirements

Subsystem-scoped requirements for Vista's interview integration — the only
realized capability of the staged [feedback](../requirements.md) return path: the
agent surfaces a bounded structured decision-question and the human answers it in
place. System-level context, assumptions, and acceptable tradeoffs live in the
[root requirements](../../requirements.md); terms in [ontology.md](../../ontology.md).
Requirement IDs are **path-scoped** to this node (`FDB.IVW-R*`); each declares
`refines:` the charter requirement it specializes so the tree reads upward.

## Requirements

### Must compose with, not duplicate, existing systems

- **FDB.IVW-R45 Bounded structured-answer (staged):** Vista must not capture general or
  freeform feedback (that stays delegated, VST-R38). It may, as a staged capability,
  surface the agent's explicit structured decision-questions and route the human's
  answer back through `VistaControlApi`: `ask` registers the question, `awaitOnce`
  is a short bounded RPC window, and the CLI re-arms until answered (decision
  0038). The browser bridge may keep same-origin pending/answer routes into the
  same service store, but those routes are viewer/product endpoints, not a second
  agent command API. AskUserQuestion / MCP elicitation are not viable as the answer
  path. The canonical answer is the structured machine result returned to
  `vista await --json`; chat is at most a later human-readable projection, not a
  second answer store. If interview questions need to survive service or
  agent-session boundaries, Vista must add a durable receipt layer aligned with the
  coding-agents attachment-by-prefix pattern (question/options/schema + answer
  artifact), rather than auto-mirroring into transient chat. The render-only
  foundation uses the chat baseline (verdict in chat → republish moves
  the fork open→locked) (decision 0013). Interview sessions are the canonical use
  case.
  `refines: VST-R04`
