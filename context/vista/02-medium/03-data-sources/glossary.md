# Data Sources — Glossary

Terms owned by the data contract are defined in the
[root ontology](../../ontology.md). This node refines their data-source
semantics; telemetry-specific terms live in
[05-blocks/05-telemetry](../05-blocks/05-telemetry/glossary.md).

## Provider

The resolver composed from a client-safe ProviderContract in `*.query.ts` and a
server-only ProviderImplementation in `*.provider.ts`. The authored RpcGroup is
the single contract for live transport and Snapshot capture.

## DataBinding

The internal `(Operation, Schema-encoded arguments, BindingPolicy)` record a
typed [Block](../../ontology.md#block) attaches to its SemanticNode. It is not
App-authored and never uses string-key resolution.

## Frozen

The BindingMode whose published value comes only from the immutable Snapshot.
It never starts Provider work or becomes live after publication.

## Live

The BindingMode that paints its immutable Snapshot value first, then refreshes
through the [standing service](../../ontology.md#standing-service) according to
BindingPolicy.

## Subscription

The BindingMode that paints captured folded state and cursor, connects
automatically, catches up, and remains live through a typed streaming Rpc.

## Data-frozen

The baseline durability tier: the Provider result is Schema-encoded into the
immutable Snapshot in a backend-faithful, library-independent form. It does not
promise pixel durability; telemetry Blocks may add the stronger
[pixel-frozen](../05-blocks/05-telemetry/glossary.md#pixel-frozen) tier.
