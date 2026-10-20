# Reference: Claude Code Artifacts

Source: https://claude.com/blog/artifacts-in-claude-code (fetched 2026-06-20).

External feature that overlaps heavily with Vista. Captured to inform the Vista
vision boundary ("why build our own"), not as a dependency.

## What it is

- Live, interactive web pages generated inside a Claude Code session, using the
  full session context (codebase, connectors, conversation).
- Requested in-session ("build an artifact listing every dependency and its
  license"); Claude Code generates and publishes it.
- Opens in the browser or the Claude Code desktop app; accessed via a shareable
  URL.

## Model (notably convergent with Vista)

- **"Every publish is a new version at the same URL, with version history so you
  can restore at any time, and a gallery lets you browse and manage all
  artifacts."** Auto-republishes as work progresses.
- This mirrors Vista decision 0004 (immutable versioned reviews + moving
  `latest`) and the `vr` CLI (`publish`/`list`). Independent convergence is
  evidence the versioning model is right.

## Constraints / divergence drivers

- **Org-private only; no public sharing.** Admin-configured retention, role-based
  access, compliance API.
- **Beta, Claude Team / Enterprise only.** Hosted by Anthropic; not self-owned.
- Generic: not integrated with our infra (OTel/Prometheus/GitHub data),
  devnet/Tailscale, our VRS, or an idiom-tuned reusable component kit.
- Tied to Claude Code specifically (not provider-neutral across our agents).

## Implication for Vista

Artifacts validates the publish/version/gallery shape but does not remove the
reason for Vista: Vista is self-owned, provider-neutral, tailnet-private,
integrated with our telemetry and devnet, and carries a reusable, idiom-tuned
component kit plus an explicit review doctrine. The build-vs-buy boundary is
resolved by decision 0003 (proceed self-owned; Artifacts is prior art) and stated
in `vision.md` ("What this is not").
