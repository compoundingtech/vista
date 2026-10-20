# Vista is a render-only visual medium

Status: accepted

## Context

Coding agents currently have one output channel for humans: text in the
terminal. That works for simple results but degrades badly as complexity grows —
relational, comparative, and evolving information (architecture, decisions,
options, live telemetry) becomes a wall of text that is expensive for a human to
review. We already own two annotation surfaces (`plannotator`, `agentation`) that
turn human UI annotations into structured feedback for agents. What we lack is a
good medium for the *other* direction: agent → human rendering.

## Decision

Vista is a **render-only** visual medium. An agent publishes a rich, interactive,
browser-viewable artifact (a review) that a human explores. Vista does **not**
build its own human → agent feedback capture; that responsibility stays with chat
or the existing annotation tools (decision 0010). Reviews are view-only with
interactive exploration (diagrams, comparison grids, decision logs, diagram
zoom/pan), but expose no write/mutation methods.

Vista is a general medium, not a single-purpose tool: it serves timeless-spec
rendering, in-flight plan/design review, and general review use. The data model
is designed so that structured-feedback capture *could* be added later without
re-architecting (see roadmap), but that is explicitly out of scope now.

## Consequences

- Vista avoids the heaviest, most fragile part of comparable platforms (anchored
  comment capture, surgical-patch feedback loops).
- Feedback composes from the outside: a human can still annotate a Vista view via
  `plannotator`/`agentation` without Vista owning that path.
- "Render-only" is a near-term boundary, not a permanent ceiling; the later
  feedback phase is a roadmap item (decision 0013 carves a bounded exception for
  answering the agent's own structured questions).

## Greenfield amendment: bounded-choice input

“Render-only” excludes general/freeform feedback and arbitrary viewer mutation;
it does not exclude the bounded structured-answer path accepted in decision 0013.
Current Apps may present explicit finite choices and submit the selected answer
through Vista. Chat and annotation tools remain the only general feedback paths.
Current shorthand is **view-first with bounded-choice input**.
