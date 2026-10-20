# Q7 client runtime derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk2/client-runtime/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Which client result contract and AppVersion isolation boundary Blocks should consume.

## Method

A three-runtime browser slice and focused tests exercised AsyncResult states, Suspense parity, typed failures with previous success, refresh restrictions, subscriptions, and disposal.

## Result

An AppVersion-scoped AsyncResult-first DataRuntime avoids module-global contamination and preserves explicit provenance and typed errors; Suspense is a thin adapter.

## Conclusion

An AppVersion-scoped AsyncResult-first DataRuntime avoids module-global contamination and preserves explicit provenance and typed errors; Suspense is a thin adapter.

## VRS Impact

Specify useBinding as AsyncResult<Resolved, DataError>, restrict refresh by policy, and own one registry per mounted AppVersion.

## Source Report

# Q7 client runtime derisk

## Result

Adopt an **AppVersion-scoped, `AsyncResult`-first data runtime with a Suspense adapter**. The working slice replaces the base prototype's `hydratedSnapshot`, `liveBaseUrl`, and `runtimes` module globals with one `DataRuntime` closure and one `AtomRegistry` per mounted AppVersion. Atom objects, decoded frozen values, refresh URLs, stream cursors, and cleanup all belong to that runtime.

The browser proof mounted three runtimes in one React page: the main demo plus AppVersions A and B using the same operation and binding key. A began at `snapshot A · 101`, B at `snapshot B · 202`; after both resolved live, refreshing only A changed A from `102` to `103` while B remained `203`. There was no snapshot or refresh-endpoint cross-contamination.

## Concrete contract

```ts
type Resolved<A> =
  | { readonly _tag: 'Frozen'; readonly value: A; readonly frozenAt: string }
  | { readonly _tag: 'Live'; readonly value: A; readonly observedAt: string }
  | { readonly _tag: 'CatchingUp'; readonly value: A; readonly frozenAt: string }

class FrozenDataError extends Schema.TaggedError<FrozenDataError>()(/* ... */) {}
class SchemaError extends Schema.TaggedError<SchemaError>()(/* ... */) {}
class TransportError extends Schema.TaggedError<TransportError>()(/* ... */) {}
type DataError<E> = E | FrozenDataError | SchemaError | TransportError

type BindingPolicy =
  | { readonly mode: 'frozen' }
  | { readonly mode: 'live' }
  | { readonly mode: 'subscription' }

interface DataBinding<Args, A, E, Policy extends BindingPolicy, Event = never> {
  readonly operation: Operation<Args, A, E, Event>
  readonly args: Args
  readonly policy: Policy
}

const bind: {
  <Args, A, E, Event>(operation: Operation<Args, A, E, Event>, args: Args):
    DataBinding<Args, A, E, { readonly mode: 'frozen' }, Event>
  <Args, A, E, Policy extends BindingPolicy, Event>(
    operation: Operation<Args, A, E, Event>,
    args: Args,
    policy: Policy,
  ): DataBinding<Args, A, E, Policy, Event>
}

interface DataRuntime {
  readonly appVersionId: string
  readonly atomRegistry: AtomRegistry
  readonly atomFor: <Args, A, E, Policy extends BindingPolicy, Event>(
    binding: DataBinding<Args, A, E, Policy, Event>,
  ) => Atom<AsyncResult<Resolved<A>, DataError<E>>>
  readonly dispose: () => void
}

declare const makeDataRuntime: (config: {
  readonly appVersionId: string
  readonly snapshot: SnapshotMode
  readonly dataBaseUrl: URL
}) => DataRuntime

declare const DataRuntimeProvider: React.FC<{
  readonly runtime: DataRuntime
  readonly children: React.ReactNode
}>

declare const useBinding: <Args, A, E, Policy extends BindingPolicy, Event>(
  binding: DataBinding<Args, A, E, Policy, Event>,
) => AsyncResult<Resolved<A>, DataError<E>>

declare const useBindingSuspense: <Args, A, E, Policy extends BindingPolicy, Event>(
  binding: DataBinding<Args, A, E, Policy, Event>,
) => Resolved<A>

declare const useRefresh: <Args, A, E, Policy extends LivePolicy | SubscriptionPolicy, Event>(
  binding: DataBinding<Args, A, E, Policy, Event>,
) => () => void
```

`bind(operation, args)` resolves statically to frozen policy. `useRefresh(frozenBinding)` therefore fails compilation; `src/refresh.types.test.ts` carries the required `// @ts-expect-error`, and `tsc` proves the error remains present. There is no frozen overload and no hidden write capability.

## Runtime and transport behavior

`Atom.family` is created inside `makeDataRuntime`, not at module scope. Its argument is an immutable `RuntimeBindingKey` implementing Effect structural `Equal` and `Hash`; the family therefore shares semantically equal bindings without the base prototype's mutable render-time `args.set(key, args)` side table. Policy is part of the atom cache key, while snapshot identity remains `providerId::tag::canonicalArgs`.

Unary live requests POST to the runtime's `dataBaseUrl` and return either `{ _tag: 'Success', value, observedAt }` or `{ _tag: 'Failure', error }`. Payloads, successes, and provider errors decode through the operation Schemas. Transport and schema failures are converted at the boundary to tagged `TransportError` and `SchemaError`.

Subscription bindings use `Atom.make(ndjsonStream, { initialValue: CatchingUp })`. Each NDJSON `Event` decodes through `eventSchema`, folds into the last state, validates against `successSchema`, advances the cursor, and emits `Live`. A typed NDJSON `Failure` fails the stream. Effect Atom then retains the latest success in `AsyncResult.Failure.previousSuccess`; the demo renders the provider error by `_tag` beside the retained value.

The browser protocol follows the lifecycle prototype:

1. connect with `{ args, since, subscriberId }`;
2. on `document.hidden`, POST the explicit `/unsubscribe` handshake, cancel the reader, and abort the request;
3. on visibility, reconnect with the last folded cursor;
4. runtime/atom disposal removes the visibility listener and performs the same graceful close.

Playwright simulated hidden/visible after the stream reached `cursor-2`. Hidden produced `{ activeSubscriptions: 0, gracefulUnsubscribes: 2 }`; visible produced `{ activeSubscriptions: 1, lastSince: 'cursor-2' }`. The final browser console had 0 errors and 0 warnings.

## What Effect Atom supplied

| API | Result in this slice |
| --- | --- |
| `Atom.make(effect, { initialValue })` | Frozen snapshot paints synchronously; mounting starts live work; refresh preserves the prior success with `waiting: true`. |
| `Atom.make(stream, { initialValue })` | Progressive NDJSON values become successive successes; typed terminal failure retains `previousSuccess`. |
| `Atom.family` | Runtime-local atom identity and deduplication. Structural keys avoid reference-identity and render-mutation traps. |
| `AsyncResult` | `Initial`, `Success`, `Failure`, in-flight `waiting`, timestamps, typed `Cause`, and previous-success retention. |
| `autoDispose` | Unmounted live work is interrupted. `keepAlive` was deliberately rejected because it would keep browser subscriptions alive without viewers. |
| `refreshOnWindowFocus` | Unary live bindings refresh when the document becomes visible. Subscription visibility uses the stronger explicit unsubscribe/`since` protocol instead. |
| `useAtomValue` | Exact explicit-state contract used by `useBinding`. |
| `useAtomSuspense` | Thin presentation adapter used by `useBindingSuspense`; failures throw to an ErrorBoundary. It does not replace the raw result contract. |
| `RegistryProvider` / `RegistryContext` | The stock provider creates and hides its own registry. Because `DataRuntime` must own and dispose a known registry, `DataRuntimeProvider` supplies that registry through `RegistryContext.Provider`. |
| `Atom.fn` / `useAtomSet` | Evaluated but not used: refresh is not an argument-bearing command, so the registry's refresh capability is the narrower contract. |
| `Atom.mapResult` | Available for pure success projection while preserving failure/initial state; this prototype keeps operation-level decoding explicit instead of adding an incidental projection. |

Effect Atom did **not** supply snapshot lookup, canonical binding identity, Schema decoding, tagged boundary errors, provenance phases, NDJSON framing, event folding, cursor reconnect, or graceful visibility lifecycle. Those are the DataRuntime layer.

## Why `waiting` is not `CatchingUp`

The initial browser snapshot showed the subscription as `CatchingUp · cursor-0`; after the first NDJSON event it showed `Live`, while `AsyncResult.waiting` remained `true` because the stream was still open. This reproduces the realtime-checks finding directly: `waiting` describes in-flight atom work, not domain provenance. `CatchingUp` therefore belongs in `Resolved<A>`.

## Evidence

Scoped acceptance command from this directory:

```text
../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
# exit 0; includes refresh.types.test.ts and its frozen @ts-expect-error proof

../../../../node_modules/.bin/vitest run src/runtime.unit.test.ts --reporter=verbose
Test Files  1 passed (1)
Tests       3 passed (3)
```

The tests prove:

- two runtimes render different snapshots for the same binding, refresh through different base URLs, and do not contaminate one another;
- subscription `CatchingUp → Live` while the long-lived stream remains `waiting`;
- a typed `DemoProviderError` produces `Failure` with the preceding `Live` success retained.

Browser build and `playwright-cli` proof:

```text
../../../../node_modules/.bin/vite build
✓ 214 modules transformed; built successfully

Initial: Frozen; live snapshot baseline; CatchingUp cursor-0; Suspense fallback;
         isolation snapshots A=101 / B=202.
Settled: Live refresh 1; subscription Live cursor-2; DemoProviderError with
         “Previous retained: first progressive event · 1”; explicit and Suspense
         views show the same resolved binding.
Refresh: live refresh 2; isolation A 102→103 while B remained 203.
Lifecycle: hidden activeSubscriptions=0; visible activeSubscriptions=1,
           lastSince=cursor-2.
Console: 0 errors, 0 warnings.
```

## Recommendation for Q7

Choose **AsyncResult-first plus a Suspense adapter**, not Suspense-only.

The explicit result is necessary for Vista's dense block surfaces: it preserves frozen/live/catching-up provenance, exposes refresh-in-flight without blanking current data, allows `_tag`-specific provider error rendering, and retains previous success on failure. Suspense remains valuable for cold/simple blocks and composes naturally as `useBindingSuspense(binding)`, but making it the only surface would again squash typed causes and force ErrorBoundary control flow for ordinary in-place degraded states.

Tradeoff: Block implementations must handle a three-way `AsyncResult` and a three-way `Resolved` union. That is intentional state-space, not boilerplate; shared render helpers can reduce repetition without narrowing the contract. The runtime should remain AppShell-owned: construct it from the decoded immutable AppVersion, mount `DataRuntimeProvider`, and call `dispose()` when that AppVersion root is replaced or retired.
