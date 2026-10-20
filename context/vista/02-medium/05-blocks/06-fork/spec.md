# Fork Block — Spec

Specifies the `fork` decision-tree doctrine block. Builds on
[requirements.md](./requirements.md); the doctrine it realizes is
[../../04-doctrine/spec.md](../../04-doctrine/spec.md); the React/semantic-manifest
boundary is [../../02-renderer/spec.md](../../02-renderer/spec.md). Requirement IDs
are path-scoped in `./requirements.md`.

## Status

Draft.

## Mechanism

The doctrine spine (HEADER → ASK → body → SETTLED, [../../04-doctrine/intuition.md](../../04-doctrine/intuition.md))
is expressed through four dedicated blocks. Three are thin roster entries (`ask`,
`status-line`, `settled`; see [../spec.md](../spec.md)); the `fork` block is the
heavy one this node specs:

- **`fork`** — renders an options decision-tree. It scores each option **branch** on
  a **shared driver set**, marks the chosen branch, and subordinates the rejected
  branches to the chosen path, naming the failed driver per rejection (decision
  0021). It roots the shared driver so the branches compare on one axis rather than
  ad-hoc criteria. A fork with fewer than two branches, or without shared drivers, is
  a doctrine smell the advisory linter flags (it does not block publish).

`fork` is an ordinary semantic React component with a stable manifest/DOM identity
(MED.REND-R02). It is what makes the doctrine's
"drive a decision, subordinate rejects" principle (MED.DOC-R33) a first-class,
renderable structure rather than prose.
