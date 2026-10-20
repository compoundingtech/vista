# Provider contracts are RPC-first and split from implementations

Status: accepted

## Context

A Provider operation needs one source of truth for payload, success, error, streaming shape, transport identity, and handler typing. A browser needs that contract but must not import handlers, credentials, Node integrations, or service Layers.

## Evidence and Argument

The [client/server split experiment](../02-medium/03-data-sources/.experiments/2026-09-19-client-server-split.md) proves that explicit `*.query.ts` and `*.provider.ts` modules keep the client graph server-free, while tree-shaking and virtual transforms do not provide an equivalent typed capability boundary. The [realtime experiment](../02-medium/03-data-sources/.experiments/2026-09-19-realtime-checks.md) authors streaming directly as an Effect `Rpc`. The [query critique](../02-medium/03-data-sources/.experiments/2026-09-19-query-api-critique.md) shows that a parallel OperationSpec duplicates Rpc and erases typed error and requirements channels.

## Options

| Option | Tradeoffs |
| --- | --- |
| Rpc-first contract plus separate implementation | Keeps one contract model and a strict capability boundary; authors write explicit Rpc definitions |
| OperationSpec that synthesizes Rpc | Can be terser but duplicates every transport feature and drifts as Effect RPC evolves |
| Full Rpc only for built-ins, separate ad hoc model for app-local Providers | Reduces some local ceremony but creates two capture, mount, telemetry, and migration paths |

## Decision

An authored `Rpc.make` and `RpcGroup` in a client-safe `*.query.ts` module are the sole Provider contract. `contract({ id, group })` produces the ProviderContract and derives its `.ops.<tag>` Operations. An Operation retains the authored Rpc and its typed payload, success, error, and stream semantics.

A server-only `*.provider.ts` module imports that contract and calls `implement(contract, { purity, handlers, live? })` to create the ProviderImplementation. Handler requirements remain in `Effect<A, E, R>`. `mountProvider(implementation, layer)` builds `R` once and installs the in-process core, RPC handlers, and AppVersion-scoped registration.

`vista check`, draft resolution, semantic collection, and publish enforce the resolved module graph: client code and the complete transitive closure of `*.query.ts` cannot import `*.provider.ts`, Node builtins, platform-node adapters, or other server-only modules. App-local Providers use the same adjacent file pair and server-only discovery; there is no second contract model.

## Consequences

- Blocks import only ProviderContract values and cannot reach server capabilities.
- Rpc tags and Schemas drive bindings, capture, transport, streams, and telemetry without duplicated declarations.
- Provider implementations can depend on Layers once at mount and can be replaced by alternate Layers in tests.
- Runtime discovery still checks provider ids, operation tags, and handler completeness because dynamic modules cross the TypeScript boundary.

## Verification

Conformance rejects direct and tunneled client imports of a ProviderImplementation, proves that a client bundle contains no server integration, confirms exact contract/handler tag agreement at discovery, and exercises both unary and streaming Rpc definitions through the same contract/implement/mountProvider path.