# The `vista` CLI is Effect-native and follows the CLI-design conventions

> **Amended by [0063](./0063-cli-renders-via-tui-react-with-story-matrix.md) (output construction via `@overeng/tui-react`) and [0064](./0064-cli-build-identity-via-shared-versioning-contract.md) (build identity). The Effect-native / cli-design core stands.**

Status: accepted

## Context

The `vista` CLI (decision 0028) is the agent's only operational surface (AGT.CLI-R06). It
should be built to our standards, not as an ad-hoc script.

## Decision

The `vista` CLI embraces two conventions:

- **/sk-effect (construction):** built with Effect and `@effect/cli` — Effect
  services + `Schema` for inputs/outputs (reusing the data-layer's effect-Schema
  contracts, decision 0027), tagged errors (not thrown defects), Layers for the
  HTTP/daemon client to the standing service, and spans where useful. A compiled
  binary is fine, but the implementation is Effect-native and matches the repo's
  `@effect/cli` / `@effect/platform` idioms.
- **/sk-cli-design (output):** readable dense layouts, problems-first /
  status-and-severity markers, no emoji, sensible truncation + spacing, and
  schema-derived machine output for agents. TUI-backed commands use `--output
  json` or `--output ndjson`; `publish`, `ask`, and `await` retain `--json`.
  `vista list` renders the global owner/local-slug index cleanly: version · status
  line · template · updated, with retired shown distinctly.

Every app-scoped command accepts the owner-local `<local-slug>` and derives the
owner from `$ST_AGENT`; no command accepts an owner or source path. `vista list`
and fleet diagnostics are global (decisions 0028, 0077).

## Consequences

- The CLI composes with the rest of the Effect stack (kit Schemas, provider RPC
  contracts) — one type/validation idiom end to end.
- Output is consistent with our other CLIs and dual-use: human-readable plus an
  explicit schema-derived machine mode for agents.
