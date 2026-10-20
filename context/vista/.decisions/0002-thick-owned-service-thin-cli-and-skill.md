# Thick owned service, thin CLI and skill

Status: accepted

## Context

Comparable systems (e.g. BuilderIO `visual-plan`) put a very large behavioral
contract in the agent-facing skill (~490 lines) and depend on a hosted
third-party platform reached over MCP. We want the opposite ergonomics: the agent
should focus on *content*, not operations, the way `agentation` keeps the agent
surface tiny while a real system does the work. We also want to own the system
rather than depend on a hosted third party.

## Decision

Vista is a **thick, owned standing service** fronted by a **thin CLI** and a
**thin skill**. The standing service (a Nix-managed service, served over Tailscale
Service, following our existing infra idioms) owns all heavy lifting: watching the
standardized authoring location, mounting and serving reviews via Vite, dependency
provisioning, versioning, and the data proxy. The CLI is the agent's only
operational surface (publish/list/open/retire). The skill carries only when-to-use
guidance plus a one-line publish.

Convention over configuration: the agent drops a review into a standardized
location; the CLI registers it; the service watches, mounts, and serves it. It
should "just work" across scenarios with no per-review setup ceremony.

## Consequences

- The agent's cognitive load is content, not infrastructure.
- We take on real, ongoing maintenance of a standing service — a knowing,
  deliberate cost, justified by removing per-session ceremony across many uses.
- Standing infra also unlocks live data (`05-data-sources`) and the ambition to
  widen Vista toward a default channel as ceremony drops (0010).
- The skill stays small and stable; behavior lives in the system, where it can be
  tested and evolved without rewriting prompts.
