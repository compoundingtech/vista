# Control plane uses Effect RPC; review serving stays route-owned

Status: accepted

## Context

Vista currently has two boundary styles:

- Provider data uses `@effect/rpc` with Effect Schema contracts.
- Service control routes are manually routed in `server.ts`.

The provider data model already proved the useful split: an `RpcGroup` is the
network boundary, while a plain Effect `core` remains the in-process surface for
freeze and internal composition. The control plane has the same typed-operation
shape when the consumer is the CLI, agent, or browser shell.

The route/static gateway has a different lifecycle: human URLs, redirects, Vite
internals, HMR, immutable published source, live drafts, and provider dispatch are
serving concerns rather than procedure calls.

## Decision

Introduce a `VistaControlApi` `RpcGroup` for service operations whose natural
consumer is the CLI, agent, or browser shell:

- `vista.reviews.list`
- `vista.review.get`
- `vista.publish`
- `vista.review.retire`
- `vista.draft.evict`
- `vista.interview.ask`
- `vista.interview.answer`
- `vista.interview.await` or `vista.interview.watch`
- `vista.service.info`

Each procedure uses Effect Schema for payload, success, and tagged expected
errors. Streaming or watch-style procedures use NDJSON serialization, following
the `service-hub` precedent.

Keep the route/static gateway outside control RPC:

- `/`, `/r`, `/r/<encoded-owner>/<local-slug>/<draft|latest|vN>/*`
- redirects and canonical human URLs
- Vite internals such as `/r/@vite/client`, `/r/@fs/*`, HMR paths
- provider data dispatch under
  `/r/<encoded-owner>/<local-slug>/<version>/_data/<provider>`
- minimal liveness HTTP such as `/health` where process supervision needs it

Do **not** keep backwards-compatible publish/debug HTTP shims. Operator and
agent debugging must be exposed through a `vista debug ...` CLI namespace backed
by the typed control RPC surface.

## Rationale

RPC is the right boundary for typed operations with expected errors, versioned
payloads, streaming awaits, and shared CLI/browser clients. It is the wrong
boundary for Vite middleware and human-facing asset routes.

Removing legacy HTTP command shims keeps there from being two operational
authorities for publish/list/interview flows. Debugging remains supported, but
through an intentional CLI namespace instead of accidental curl surfaces.

This keeps Vista aligned with the accepted provider-data architecture without
pretending every path is a procedure call.

## Tradeoffs

| Option                                                 | Tradeoff                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Effect RPC primary with no command HTTP shims          | Strongest type discipline and one operational command surface, but curl-based debugging must move to CLI tooling. |
| Effect RPC primary with permanent debug HTTP endpoints | Easier ad-hoc inspection, but creates a second API surface that can drift.                                        |
| Schema-owned plain HTTP only                           | Simpler outer server, but duplicates client wiring and leaves the control plane unlike the provider plane.        |

## Evidence

- Provider data architecture is already accepted in
  [0027](./0027-data-layer-schema-spine-two-tier-rpc.md).
- Local precedent: `service-hub` uses `RpcGroup` + `RpcServer.layerHttpRouter` for
  a typed control API plus non-RPC UI fallback.
- Research captured in
  [../.experiments/2026-06-26-control-plane-routing-rpc-research.md](../.experiments/2026-06-26-control-plane-routing-rpc-research.md).

## Consequences

- `vista publish`, `vista list`, `vista open`, `vista retire`, and interview
  commands should converge on `VistaControlApi`.
- Existing command HTTP endpoints such as `/_publish` should be removed rather
  than kept as migration shims.
- `vista debug ...` owns operator inspection and RPC diagnostics.
- Review serving remains an explicit HTTP/Vite gateway.
