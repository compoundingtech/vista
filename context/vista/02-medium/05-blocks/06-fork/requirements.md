# Fork Block — Requirements

The `fork` block realizes the decision-tree doctrine block: it scores option
branches on a shared driver set, subordinates the rejected branches to the chosen
path, and names the failed driver per rejection. It is the heavy member of the
doctrine-block set (`ask` / `fork` / `status-line` / `settled`) and a realization
over the [doctrine contract](../../04-doctrine/requirements.md).

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); the doctrine principles are
[../../04-doctrine/requirements.md](../../04-doctrine/requirements.md); terms in the
[doctrine glossary](../../04-doctrine/glossary.md) (`ask`). IDs are path-scoped
(`MED.BLK.FORK-*`); each requirement `refines:` its parent. Decisions 0020 (doctrine
block additions), 0021 (fork scores branches on shared drivers).

## Requirements

- **MED.BLK.FORK-R05 Doctrine-expressive fork block:** The `ask` / `fork` /
  `status-line` / `settled` blocks express the doctrine skeleton
  ([../../04-doctrine](../../04-doctrine/spec.md)); the `fork` block in particular
  scores option branches on a shared driver set, subordinates the rejected branches
  to the chosen path, roots the shared driver, and names the failed driver per
  rejection (a fork is invalid with fewer than two branches or without shared
  drivers) (decisions 0020, 0021).
  `refines: MED.DOC-R33`

## Acceptance

A `fork` block renders ≥2 branches scored on a shared driver set, marks the chosen
branch, subordinates each rejected branch with its failed driver named, and is
flagged by the advisory linter when it has fewer than two branches or no shared
drivers.
