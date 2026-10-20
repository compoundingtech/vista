# Interview answer channel is live RPC with later receipts

Status: accepted

## Context

Vista interview answers need to work for coding agents: the agent asks a bounded,
structured question, blocks in a scriptable way, and resumes with a machine-readable
answer. The browser review is the human interaction surface, but chat must not
become a second answer store.

The coding-agent answer channel has three distinct lifecycle layers:

- live answer transport: `VistaControlApi` plus `vista await --json`;
- human-readable projection: optional chat summary after the agent resumes;
- durable receipt: future question/options/schema and answer artifacts for
  cross-session resume, service-restart survival, or multi-agent handoff.

## Decision

Keep the live `VistaControlApi` / `vista await --json` path as the canonical answer
channel now. Do not automatically mirror browser answers into chat as a canonical
source of truth.

Defer durable answer receipts until Vista interview sessions need to survive a
service restart, outlive one agent session, or be consumed by multiple agents. When
added, receipts should follow the coding-agents attachment-by-prefix shape rather
than introducing a second ad hoc chat protocol.

## Rationale

The current live RPC path is the smallest mechanism that satisfies the active use
case: one coding agent is blocked on one human decision rendered in a Vista review.
Adding durable receipts now would force unresolved lifecycle choices around review
versioning, cleanup, dedupe, schema versions, and export shape before those
requirements are proven.

Automatic chat mirroring is weaker than either live RPC or durable receipts because
it creates split-brain failure modes: the transcript can say answered while the
machine await path cannot resume, or the store can answer while the chat projection
fails. Chat is useful as a derived explanation after resume, not as a write path.

## Consequences

- `vista await --json` remains the agent-facing answer primitive.
- Browser `/_answer` writes to the service-owned interview store, not to chat.
- VRS and implementation should leave room for a later durable receipt layer.
- Debugging should expose current question/answer state through `vista debug ...`
  over `VistaControlApi`.
