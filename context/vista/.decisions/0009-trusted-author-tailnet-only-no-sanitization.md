# Trusted-author, tailnet-only, no sanitization

Status: accepted (Q9)

## Context

Vista serves agent-authored React (including the real-React escape hatch,
decision 0008). Comparable hosted platforms invest heavily in HTML/JS
sanitization because they render untrusted, multi-tenant content. Vista's
situation differs: the author is a trusted first-party agent, the viewer is the
user, and transport is the private tailnet.

## Decision

Trusted-author model. Reviews are served **only** over Tailscale Service (never
public). Agent-authored React runs **as-is**, with **no** sanitization layer — it
is the same trust level as all other code the agent writes and we run.

## Consequences

- Lowest ceremony; no sanitization tax guarding a threat we don't have (the agent
  already writes code we execute, deploys, and touches infra).
- This is the near-term boundary, not permanent. Public or shared-with-untrusted
  review links would cross a real trust boundary and require revisiting (e.g. an
  iframe/CSP sandbox or sanitization) — tracked as a future concern, not built now.
- Pairs with decision 0003: tailnet-private by construction is a Vista
  differentiator vs hosted alternatives. Also bounds the security surface of the
  bounded structured-answer channel (decision 0013).
