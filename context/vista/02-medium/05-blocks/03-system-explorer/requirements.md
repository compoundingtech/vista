# System Explorer — Requirements

The `system-explorer` block realizes multi-perspective exploration of a large
system: one typed structured model projected many ways through [lenses](../glossary.md).
It refines the charter's interactive-exploration requirement (VST-R02) and composes
over the [render contract](../../02-renderer/requirements.md).

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); terms in the [block-library glossary](../glossary.md)
(`lens`); the system-explorer spike is under `.experiments/`. IDs are path-scoped
(`MED.BLK.SYSX-*`); each requirement `refines:` its parent. Decision 0018
(system-explorer on React Flow with a typed-graph foundation); OQ-MULTIDIM.

## Requirements

### Must help tame complexity through multi-perspective exploration

- **MED.BLK.SYSX-R42 Structured foundation:** A large system must be representable as
  a structured model (a typed graph of components and relationships carrying
  multi-dimensional attributes — abstraction level, concern/aspect, ownership,
  deployment, trust boundary, telemetry) that can be projected many ways without
  duplicating it (decision 0018).
  `refines: VST-R02`
- **MED.BLK.SYSX-R43 Multi-perspective projection:** An app must be able to present
  one system from multiple perspectives/dimensions (data flow, control flow,
  ownership, deployment, security, telemetry) as [lenses](../glossary.md) over the
  same structured foundation.
  `refines: VST-R02`
- **MED.BLK.SYSX-R44 Interactive complexity reduction:** A human must be able to
  interactively reduce visible complexity — toggle aspects/dimensions, filter by
  attribute, semantically zoom across abstraction levels, focus a neighborhood —
  starting from a sensible zero-interaction default and varying only the dimensions
  they care about. Controls that do not change what the reviewer can understand must
  be omitted (the doctrine's interactivity gate).
  `refines: VST-R02`

## Acceptance

One system model renders as a `system-explorer` block resolving its model by key;
aspect-toggle and focus restyle a persistent scene for free; only a structural zoom
relayouts; the zero-interaction default is legible without any interaction.
