# Mermaid Block — Spec

Specifies the `mermaid-diagram` block. Builds on [requirements.md](./requirements.md);
the React/semantic-manifest boundary is [../../02-renderer/spec.md](../../02-renderer/spec.md);
packaging / theming is [../spec.md](../spec.md). Requirement IDs are path-scoped in
`./requirements.md`.

## Status

Draft.

## Mechanism

`mermaid-diagram` renders Mermaid source to an interactive (zoom/pan) diagram inside
the React host, resolving its source string by key (MED.REND-R04). Two Mermaid
hazards are contained behind the block boundary:

- **Global `mermaid.initialize` singleton (OQ-MERMAID-THEME).** Mermaid configures a
  process-global; the block owns initialization so theme/config does not leak or race
  across diagrams, and reconciles the Mermaid theme with the library's Geist-native
  tokens (MED.BLK-R07, decision 0036).
- **SSR / projection safety.** Mermaid's render touches browser globals; the block
  renders client-only behind the lazy boundary so a static import never enters the
  service's `ssrLoadModule` projection graph (the same isolation discipline the
  telemetry island uses, [../05-telemetry/spec.md](../05-telemetry/spec.md)).

The component renders canonical React output with a stable manifest/DOM identity
(MED.REND-R02).
