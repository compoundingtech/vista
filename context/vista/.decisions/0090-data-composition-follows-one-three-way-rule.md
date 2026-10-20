# Data composition follows one three-way rule

Status: accepted

## Context

Vista's semantic render discovers bindings without provider data. Arbitrary client chaining therefore cannot reveal a child binding whose arguments depend on a parent result. At the same time, forcing every pure lens into a server operation creates unnecessary snapshot entries and round trips.

## Evidence and Argument

The [dependent composition experiment](../02-medium/03-data-sources/.experiments/2026-09-19-dependent-composition.md) proves that named server composition and a declared dependency graph survive collection and freeze, while ad hoc hook chaining does not. The [projection experiment](../02-medium/03-data-sources/.experiments/2026-09-19-projection-composition.md) proves that a pure client projection can reuse one captured source key with no extra Snapshot entry. The [OMP Usage experiment](../02-medium/03-data-sources/.experiments/2026-09-19-omp-usage-composition.md) shows why trust-bearing, named behavior belongs in one server operation and one refresh boundary.

## Options

| Option | Tradeoffs |
| --- | --- |
| Server Operation / client Projection / declared DependentBinding | Preserves data-independent collection and avoids redundant captures; requires an explicit classification rule |
| Server Operations only | Has one simple identity rule but turns every pure view into a Provider capability and network boundary |
| Client-first hook chaining | Looks familiar but cannot be discovered by the no-data semantic render and makes render order an execution plan |

## Decision

Composition uses exactly three shapes:

1. Effectful, result-dependent, or domain-named behavior is a server Operation. It owns one RPC and one Snapshot identity for its final value.
2. Pure derivation over an already captured value is an `Operation.map` Projection. It creates no Snapshot entry, inherits the source snapshot key, and keeps projection arguments only in its in-memory identity.
3. `Operation.flatMap` creates a declared DependentBinding when an App genuinely owns a dependency graph. Capture stores the constituent entries and the SemanticManifest stores the stable graph edge. The derived edge identity is the parent key plus an explicit stable transform id; runtime output never enters it.

Ad hoc chaining in React render or hooks is rejected. A named server Operation is preferred when the chain expresses durable domain behavior.

## Consequences

- Semantic extraction remains data-independent and single-pass.
- Pure projections must live in browser-safe shared modules.
- Refreshing a Projection reruns its source only; refreshing a server Operation reruns the whole named behavior.
- DependentBinding adds manifest graph structure and multiple constituent entries intentionally, not accidentally.

## Verification

Conformance proves that server composition captures one final entry, Projection captures only its source and reproduces the same derived value in the browser, declared flatMap round-trips through constituent entries and a stable manifest edge, and ad hoc child binding discovery fails validation.