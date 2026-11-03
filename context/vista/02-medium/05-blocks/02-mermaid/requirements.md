# Mermaid Block — Requirements

The `mermaid-diagram` block realizes Mermaid-in-React: authoring architecture and
flow diagrams from Mermaid source, rendered as a semantic React component. It
is a realization over the [render contract](../../02-renderer/requirements.md).

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); the render contract is
[../../02-renderer/requirements.md](../../02-renderer/requirements.md); terms in the
[root ontology](../../../ontology.md). IDs are path-scoped (`MED.BLK.MERM-*`); each
requirement `refines:` its parent. Decision 0036 (Geist-native visual system);
OQ-MERMAID-THEME.

## Requirements

- **MED.BLK.MERM-R01 Mermaid-in-React diagram block:** The library must provide a
  `mermaid-diagram` block that renders Mermaid source as an interactive diagram
  (zoom/pan) inside the React host, resolving its source by string key
  (MED.REND-R04). Mermaid's global `mermaid.initialize` singleton and SSR-unsafe
  render path must be contained behind the block boundary (a lazy client-only render
  with the render-spike fixes), and its theme must be reconciled with the library's
  Vista UI-native tokens (MED.BLK-R07; decision 0036, OQ-MERMAID-THEME).
  `refines: MED.REND-R02`

> New requirement (no source ID): Mermaid was previously a roster entry in the kit
> spec ("the three Mermaid-in-React fixes from the kit-spike experiment"), not a
> numbered requirement. Extracted to its own block node per decision 0067.

## Acceptance

A `mermaid-diagram` block renders valid Mermaid source with zoom/pan, resolves its
source by key, does not break SSR/projection (client-only lazy render), and matches
the library's Vista UI-native theme in dark and light.
