# Typed domain Blocks are the only public data surface

Status: accepted

## Context

The data substrate needs internal values for Provider operations, binding policy, capture, and runtime results. Exposing those transport-oriented values directly in App JSX would create a second authoring vocabulary beside Vista's typed semantic Blocks and would detach bindings from their owning SemanticNode.

## Evidence and Argument

The [query API critique](../02-medium/03-data-sources/.experiments/2026-09-19-query-api-critique.md) shows that a generic Query component conflates an Rpc definition, invocation, and client result and loses semantic-node ownership. The [data ontology research](../02-medium/03-data-sources/.experiments/2026-09-19-data-ontology-research.md) reconciles the required internal terms without introducing Query. The [realtime checks experiment](../02-medium/03-data-sources/.experiments/2026-09-19-realtime-checks.md) demonstrates the intended author surface as one domain Block.

## Options

| Option | Tradeoffs |
| --- | --- |
| Typed domain Blocks only | Preserves one semantic authoring surface and node-owned capture; each app-local Provider needs a small companion Block |
| Domain Blocks plus generic Bound escape hatch | Speeds one-off views but exposes transport policy and creates long-lived migration pressure |
| Public Query/useQuery surface | Familiar to application developers but contradicts Vista's semantic model and conflates three distinct concepts |

## Decision

Typed domain Blocks are the only public data surface in AppSource. A Block internally selects an Operation, constructs a DataBinding with arguments and BindingPolicy, attaches that binding to its SemanticNode, and consumes the DataRuntime result. An app-local Provider ships a companion typed Block beside its `*.query.ts` and `*.provider.ts` modules.

`Query`, `useQuery`, generic `<Bound>`, and direct App-authored DataBinding values are not Vista concepts. Internal APIs use Operation, DataBinding, BindingPolicy, Projection, DependentBinding, Resolved, and DataRuntime according to the ontology.

## Consequences

- Data policy remains governed by the domain Block rather than scattered through App JSX.
- Semantic collection has one binding path and always retains ownership.
- One-off app-local data incurs deliberate companion-Block ceremony.
- A future generic escape hatch requires a new decision because its adoption would be difficult to reverse.

## Verification

Public package entrypoints and scaffolded Apps expose domain Blocks but no Query, useQuery, Bound, bind, Operation, or BindingPolicy authoring API. Semantic extraction proves every captured DataBinding belongs to the SemanticNode emitted by its owning Block.