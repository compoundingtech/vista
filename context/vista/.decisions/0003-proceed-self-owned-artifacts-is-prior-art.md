# Proceed with a self-owned Vista; Claude Code Artifacts is prior art

Status: accepted

## Context

Claude Code Artifacts ([../.reference/claude-code-artifacts.md](../.reference/claude-code-artifacts.md))
ships a near-identical publish → new version at the same URL → version history →
gallery model. It is, however, hosted by Anthropic, org-private-only,
Team/Enterprise-gated, Claude-Code-specific, and not integrated with our
telemetry/devnet/VRS or any idiom-tuned component kit. This raises an honest
build-vs-buy question the vision must answer.

## Decision

Proceed with Vista as a **self-owned** system. Claude Code Artifacts (and
BuilderIO `visual-plan`) are treated as **prior art / inspiration**, recorded in
`.reference/`, not as dependencies or replacements.

Artifacts' independent convergence on our versioning model is taken as
**validation** of decision 0004 (immutable versioned reviews + moving `latest`),
not as a reason to adopt it.

The differentiators that justify building Vista despite Artifacts existing:

- **Self-owned**, no enterprise gate, no hosted-third-party dependency.
- **Provider-neutral** — works across all our coding agents, not only Claude Code.
- **Integrated with our infra** — live OTel/Prometheus/GitHub data, devnet,
  Tailscale, VRS.
- **A reusable, idiom-tuned component kit** plus an explicit **review doctrine**.
- **Tailnet-private** by construction.

## Consequences

- The vision's "What this is not" must state explicitly why Vista is not just
  Claude Code Artifacts, citing the differentiators above.
- Also-publishing to Artifacts as an optional distribution target is a possible
  future roadmap nicety, not part of this decision.
- Vista must keep earning these differentiators: a Vista that is *only* a generic
  renderer (no infra integration, no doctrine, no idiom-tuned kit) would not
  justify itself over Artifacts.
