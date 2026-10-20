# The client data contract is AsyncResult-first

Status: accepted

## Context

Blocks need to render cold load, refresh-in-flight, typed provider failure, strict schema mismatch, previous success, and frozen/live/catching-up provenance. A bespoke result object duplicates part of Effect's atom state model and loses typed causes; a Suspense-only contract makes ordinary degraded states depend on ErrorBoundary control flow.

## Evidence and Argument

The [client runtime experiment](../02-medium/03-data-sources/.experiments/2026-09-19-client-runtime.md) proves explicit and Suspense views over the same binding, compile-time refusal of refresh for frozen bindings, typed failure with previous success, and isolation of simultaneous AppVersions. The [Effect idiom audit](../02-medium/03-data-sources/.experiments/2026-09-19-effect-idiom-audit.md) proves that `AtomRpc.Service`, `ReactHydration`, `Atom.serializable`, `AsyncResult.Schema`, `Reactivity`, and native React hooks replace the prototype's custom adapter.

## Options

| Option | Tradeoffs |
| --- | --- |
| AsyncResult-first with a Suspense adapter | Preserves typed failures, previous success, and in-place progress; Blocks handle the full intentional state space |
| Suspense-only | Makes simple loading concise but throws typed failures away from dense in-place surfaces |
| Bespoke value/mode/refresh object | Looks small but recreates async state poorly and exposes invalid actions such as refreshing frozen data |

## Decision

`useBinding(binding)` returns `AsyncResult<Resolved<A>, DataError<E>>`. `Resolved<A>` carries exactly one provenance tag: Frozen, CatchingUp, or Live. `AsyncResult` carries initial/loading state, waiting during refresh, typed causes, timestamps, and previous success; provenance is not inferred from `waiting` because a healthy long-lived stream remains in flight.

`useBindingSuspense(binding)` is a presentation adapter over the same atom and returns `Resolved<A>`. `useRefresh(binding)` exists only for statically live or subscription policies; a frozen binding has no refresh capability.

One DataRuntime owns one `AtomRegistry` and one `AtomRpc.Service.runtime` layer graph per mounted AppVersion. Frozen hydration uses `ReactHydration.HydrationBoundary`, `Atom.serializable`, and `AsyncResult.Schema`; live invalidation uses `Reactivity` keys. Runtime atoms, snapshots, URLs, cursors, and cleanup are registry-local. Vista adds only binding policy, Resolved provenance, visibility/cursor behavior, canonical identity, and strict-mismatch fallback where Effect has no fitting primitive.

## Consequences

- Blocks can display a retained value beside a typed failure or refresh state.
- Multiple mounted AppVersions cannot contaminate one another through module globals.
- Suspense remains available without becoming the data model.
- Client code depends on native Effect atom primitives rather than a Vista-owned atom framework.

## Verification

Conformance covers Initial, Frozen, CatchingUp, Live, refresh waiting with retained success, typed provider failure with previous success, Suspense parity, frozen refresh as a type error, simultaneous AppVersion isolation, and runtime disposal interrupting live work.