# Reference: annotation / markdown-review prior art

Tools in the human→agent *annotation* space — the complementary direction to
Vista's agent→human *rendering*. Captured to fix the boundary (decision 0011) and
the supersession roadmap.

## roughdraft.md

Source: https://www.roughdraft.md/ (fetched 2026-06-20). Positioned as "markdown
reviews for coding agents" — a markdown-first review/annotation workflow where the
agent drafts and a human reviews/annotates markdown content, feedback flowing back
in a lightweight text-based format. Same neighborhood as `plannotator`. Relevant
to the roadmap: a roughdraft.md-style markdown-review layer on top of Vista's rich
rendering is a candidate path to superseding `plannotator` once Vista grows the
later feedback-capture phase.

## plannotator (in-repo, vendored)

A compiled Bun binary (backnotprop/plannotator), wired as Claude Code slash
commands `plannotator-review` (interactive review of current git changes) and
`plannotator-annotate <md>` (annotate a markdown file). The `!`-prefixed command
runs the binary; its structured annotations are injected back into the agent
prompt. Pure human→agent annotation; no agent→human rich rendering.

## agentation (in-repo, MCP)

Browser `<Agentation />` React component + MCP server (`bunx agentation-mcp
server`, registered for Claude Code + OpenCode). Captures live UI-element
annotations from a running app and exposes them to agents via MCP tools
(`get_pending`, `watch_annotations`, `acknowledge`, `resolve`, `reply`, …). The
model for Vista's *eventual* feedback phase and the proven template for the
bounded structured-answer round-trip (decision 0013): keep the agent surface tiny,
let the system do the work.

## Boundary for Vista

Vista renders (agent→human); these annotate (human→agent). They **compose** — a
human can annotate a Vista view via these tools — and Vista does not build its own
general capture near-term (decision 0011); only a bounded structured-answer for the
agent's own questions (decision 0013). Long-term, Vista + a markdown-review layer
may absorb `plannotator`'s niche (roadmap).
