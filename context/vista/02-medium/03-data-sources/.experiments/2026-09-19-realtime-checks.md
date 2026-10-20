# Realtime PR-check subscriptions derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/realtime-checks/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Whether subscriptions can paint a snapshot immediately and then progressively catch up over Effect RPC.

## Method

A GitHub-checks slice compared JSON and NDJSON serialization, folded streamed events, retained a frozen value on endpoint failure, and exercised cursor replay.

## Result

NDJSON is required for progressive HTTP streaming in the tested Effect release; subscription bindings publish folded state, then auto-connect and catch up without discarding the snapshot.

## Conclusion

NDJSON is required for progressive HTTP streaming in the tested Effect release; subscription bindings publish folded state, then auto-connect and catch up without discarding the snapshot.

## VRS Impact

Define subscription as a BindingMode with snapshot-first Resolved provenance and retain cursor/fold semantics in the runtime.

## Source Report

# Realtime PR-check subscriptions derisk

## Result

**Effect RPC can carry a genuinely long-lived, progressively delivered `Stream` over ordinary HTTP in `effect@4.0.0-rc.112`, but the serializer matters.** `RpcServer.layerHttp({ protocol: 'http' })` + `HttpRouter.toWebHandler` + `layerJson` returned HTTP 200 yet buffered the nonterminating stream: the atom stayed at `cursor scripted-0` / `catching up` after the server had emitted delayed elements. Changing both ends to `layerNdjson` produced intermediate atom values in the browser (`scripted-0 → scripted-1 → scripted-2`) while the single POST remained open. SSE and WebSocket were not needed.

The resulting policy is: a declared-live subscription still publishes a folded snapshot for instant paint, then automatically opens one NDJSON RPC stream, catches up, and remains live. A manual-connect mode exists only to prove the network boundary precisely.

## Prototype layout

- `src/checks.schemas.ts`: `CheckRun`, `ChecksState`, `CheckEvent`, args, and typed errors.
- `src/gh-checks.query.ts`: browser-safe RPC descriptors (`*.query.ts`).
- `src/gh-checks.provider.ts`: `GhChecks` service, real `gh` Layer, scripted alternate Layer, handlers, and HTTP mount (`*.provider.ts`).
- `src/checks-fold.ts`: pure diff/fold logic.
- `src/snapshot.ts`: subscription binding/key and capture/read rule.
- `src/checks-client.tsx`: snapshot-hydrated stream atom and `<PullRequestChecks repo pr />`.
- `src/scripted-fixture.ts`: deterministic queued → in-progress → success/failure states and ring replay.
- `src/realtime.unit.test.ts`: the four required behavioral tests.

The split follows the client/server derisk recommendation: browser code imports `gh-checks.query.ts`; only server/publish code imports `gh-checks.provider.ts`.

## Effect levers exercised

1. **Services/Layers.** `GhChecks` is the behavior boundary. `GhChecksLive` uses Effect's `ChildProcessSpawner` and `gh`; `GhChecksScripted` is a real alternate Layer, not a mock. The same RPC handlers accept either Layer.
2. **Typed outcomes.** `GhChecksError` is the provider error schema; `ChecksSubscriptionError` is the client transport state. The endpoint-down page renders a typed failure while retaining the last snapshot.
3. **Realtime subscriptions (lever 7).** `Rpc.make('checksStream', { stream: true })` produces a client method returning `Stream<CheckEvent, ...>`. The stream is folded into state and changed-name highlights.
4. **Resilience/observability.** Real polling is `Stream.fromEffectSchedule(read(args), Schedule.spaced('10 seconds'))`, the rc.112 spelling available for repeated scheduled effects. The read effect is named `vista.provider.gh-checks.checksState`. A production implementation should also name the stream acquisition span.

The prototype does not claim query composition, dependent queries, batching, or caching. The only composition is the intentional pure event fold and the Layer swap.

## Actual GitHub model

Commands inspected on dev3:

```sh
gh pr list -R schickling/dotfiles --state open --limit 5 --json number,title
gh pr checks 2910 -R schickling/dotfiles --json name,state,bucket,startedAt,completedAt,link
gh pr checks 2918 -R schickling/dotfiles --json name,state,bucket,startedAt,completedAt,link
```

`#2918` was open and had both `IN_PROGRESS` and completed checks. The real Layer smoke test decoded 30 named checks: 29 `completed`, one `queued`. GitHub's JSON uses uppercase `state`, a coarse `bucket`, `link` rather than `url`, and `0001-01-01T00:00:00Z` for an absent completion time. The provider normalizes these into:

```ts
type CheckRun = {
  readonly name: string
  readonly status: 'queued' | 'in_progress' | 'completed'
  readonly conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly url: string
}
```

`Record<name, CheckRun>` is intentionally last-write-wins if GitHub returns duplicate names; production should either reject duplicates or key by a stable run id if the CLI exposes one.

## Effect RPC API verified

The installed declarations establish the contract:

- `Rpc.make(tag, { payload, success, error, stream: true })` wraps success/error in `RpcSchema.Stream` and makes the normal RPC error schema `Schema.Never` (`Rpc.d.ts:453-472`).
- A stream handler returns `Stream<element, error, services>` (`Rpc.d.ts:432-443`).
- `RpcClient.make(group)` maps that tag to a method returning `Stream`, not `Effect` (`RpcClient.d.ts:38-58, 110-122`).
- `RpcServer.layerHttp` registers the request route and supports streaming response bodies (`RpcServer.d.ts:79-99`). `makeProtocolWithHttpEffect` explicitly says it “streams or returns encoded RPC responses” (`RpcServer.d.ts:232-244`).
- `layerJson` has no framing and is for transports that already frame messages; `layerNdjson` adds newline framing for transports that do not (`RpcSerialization.d.ts:91-114, 152-176`). A long HTTP response body needs the latter for progressive messages in this version.

A practical routing detail caused an initial false negative: `RpcClient.layerProtocolHttp({ url })` POSTed to `/_data/gh-checks/` (trailing slash). An exact server match for `/_data/gh-checks` returned 503. Accepting both paths exposed the transport behavior above.

## Snapshot rule and binding policy

A subscription snapshot is **not an event list**. Publish starts the subscription and takes the first `Synced`, or calls `checksState` as a finite fallback, then stores the folded state and cursor under the logical binding key. The binding is explicitly `{ kind: 'subscription' }`. The cursor is not part of the key; it is the captured value used to catch up.

Published key:

```text
gh-checks::checksStream::{"pr":2918,"repo":"schickling/dotfiles"}
```

Measured artifacts:

```text
1202 public/snapshot.json
 269 public/query-manifest.json
1471 total
```

There is one entry containing two checks. Growth is proportional to the current folded state, not event history. `ChecksState` decodes the frozen value; `CheckEvent` decodes each live RPC element; folding decoded elements returns another `ChecksState`. The symmetry test exercises the actual Schemas rather than parallel JSON types.

A declared-live binding therefore means “ship snapshot + connect”, not “omit snapshot”. Frozen-only bindings never connect. Live/streaming bindings paint the frozen snapshot first, expose `catching up`, then become `live (streaming)` after the first decoded event.

## Catch-up strategies

### (i) Full `Synced` first

The real polled `GhChecks` stream ignores `since`, reads current GitHub state immediately, and emits `Synced { state }` first. The client compares that state with its published snapshot to highlight changes, then applies poll deltas. This is the honest default: GitHub CLI polling has no durable event history, so the server cannot reconstruct changes that occurred while no poller was observing.

### (ii) `since` plus in-memory ring replay

The scripted Layer keeps three deterministic states. A known cursor returns only subsequent `CheckUpdated` deltas; an unknown/evicted cursor returns a full `Synced` latest state. Tests prove both branches. This saves one full state only while a particular server process still owns a complete ring covering the cursor. It is an optimization, not the semantic contract. It must never silently treat a missing cursor as “no changes”.

Recommendation: keep `since?: Cursor` as a hint in the wire payload, require the server to fall back to `Synced`, and use strategy (i) for GH polling unless a durable polling coordinator owns the history.

## Client atom findings

The installed Atom API supports:

- `Atom.make(stream, { initialValue })` → an `Atom<AsyncResult<latestElement, E | NoSuchElementError>>` that starts when mounted.
- `Atom.fn(...stream..., { initialValue })` → a writable `AtomResultFn` useful for explicit/manual connect.
- `Atom.pull(stream)` → demand-driven accumulated batches, not the right default for a continuously folded subscription.

The production-shaped page uses `Atom.make` and starts automatically. `?manual=1` uses `Atom.fn` solely for the zero-request browser proof. A long-lived stream keeps `AsyncResult.waiting === true`; therefore `waiting` alone cannot mean “catching up”. The client state has its own phase and changes to `live` on the first event.

## Evidence

### Unit and type proof

```text
../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
# exit 0

../../../../node_modules/.bin/vitest run src/realtime.unit.test.ts
Test Files  1 passed (1)
Tests       4 passed (4)
```

The tests cover deterministic folds, frozen/live schema decode symmetry, final alternate-Layer success/failure state, and known/evicted/absent `since` semantics.

Real provider smoke:

```json
{"cursor":"2026-09-19T13:55:51.560Z","count":30,"statuses":{"completed":29,"queued":1}}
```

### Browser proof (`playwright-cli`)

Manual hydration/connect run, after a reload:

```json
{
  "frozen":{"status":"frozen as of 2026-09-19T14:00:00Z","cursor":"cursor scripted-0","rpcRequests":0},
  "catching":"catching up",
  "live":{"status":"live (streaming)","cursor":"cursor scripted-2","rpcRequests":1,"finished":0,"changed":2,"rows":["completed / failure","completed / success"]}
}
```

This proves instant snapshot paint with zero data requests, then one response whose request body remains unfinished while intermediate/final updates render. A separate 850 ms sample observed `cursor scripted-1`, one highlighted check, then `scripted-2`, two highlights. Default declared-live mode automatically changed `catching up → live (streaming)` after reload.

Endpoint-down run:

```json
{
  "status":"frozen (stream unavailable)",
  "cursor":"cursor scripted-0",
  "rows":["queued","queued"],
  "errorPrefix":"ChecksSubscriptionError: ChecksSubscriptionError: ~effect/rpc/RpcClientError: Rp"
}
```

The component did not crash or blank; it retained the published state and rendered a typed error. The browser console also reports the expected failed HTTP resource.

### Transport comparison

- `layerJson`: POST 200 after the trailing-slash route fix, but after 3.25 seconds the UI was still `catching up`, cursor `scripted-0`, zero changed rows. Because the stream never ends, no buffered payload becomes visible.
- `layerNdjson`: the same handler and delayed scripted Layer produced `scripted-1` and `scripted-2` progressively; Playwright observed one response and zero `requestfinished` events after 3.5 seconds.
- SSE/WebSocket: not attempted because NDJSON HTTP satisfied progressive delivery, typed Effect RPC, cancellation, and one-open-request requirements without another protocol.

## Authored surface

Provider author writes the client-safe descriptor:

```ts
// gh-checks.query.ts
export const checksStreamRpc = Rpc.make('checksStream', {
  payload: ChecksArgs,
  success: CheckEvent,
  error: GhChecksError,
  stream: true,
})
```

and the server behavior behind a service/Layer:

```ts
// gh-checks.provider.ts
export class GhChecks extends Context.Service<GhChecks, GhChecksShape>()('Vista/GhChecks') {}

export const GhChecksLive = Layer.effect(GhChecks, Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const checksState = /* run and schema-decode gh pr checks */
  return {
    checksState,
    checksStream: (args) => pollingStream(checksState, args),
  }
}))
```

App author writes only:

```tsx
<PullRequestChecks repo="schickling/dotfiles" pr={2918} />
```

## Recommended concrete contracts

```ts
// Subscription operation: client-safe *.query.ts contract.
interface SubscriptionOp<TArgs, TState, TEvent, TError> {
  readonly kind: 'subscription'
  readonly providerId: string
  readonly tag: string
  readonly payloadSchema: Schema.Codec<TArgs, unknown, never, never>
  readonly stateSchema: Schema.Codec<TState, unknown, never, never>
  readonly eventSchema: Schema.Codec<TEvent, unknown, never, never>
  readonly errorSchema: Schema.Codec<TError, unknown, never, never>
  readonly rpc: Rpc.Rpc<
    string,
    Schema.Codec<TArgs, unknown, never, never>,
    RpcSchema.Stream<
      Schema.Codec<TEvent, unknown, never, never>,
      Schema.Codec<TError, unknown, never, never>
    >,
    typeof Schema.Never
  >
  readonly fold: (state: TState, event: TEvent) => TState
}

type ChecksStreamArgs = {
  readonly repo: string
  readonly pr: number
  readonly since?: Cursor // optimization hint; unknown/evicted MUST fall back to Synced
}

type ChecksStream = (
  args: ChecksStreamArgs,
) => Stream.Stream<CheckEvent, GhChecksError>

// Snapshot rule: every declared-live binding still ships current folded state.
type SubscriptionSnapshotEntry<TArgs, TState> = {
  readonly binding: {
    readonly kind: 'subscription'
    readonly provider: string
    readonly operation: string
    readonly args: Omit<TArgs, 'since'>
    readonly snapshotKey: string // excludes cursor
  }
  readonly value: TState // includes cursor
}

declare const captureSubscription: <TState, TEvent, TError>(options: {
  readonly stream: Stream.Stream<TEvent, TError>
  readonly isSynced: (event: TEvent) => event is TEvent & { readonly state: TState }
  readonly fallbackState: Effect.Effect<TState, TError>
}) => Effect.Effect<TState, TError>

// Client atom: snapshot is the initial success; first event establishes live phase.
type SubscriptionClientState<TState> =
  | { readonly _tag: 'frozen'; readonly state: TState; readonly frozenAt: string }
  | { readonly _tag: 'catching-up'; readonly state: TState; readonly frozenAt: string }
  | { readonly _tag: 'live'; readonly state: TState; readonly changedSinceSnapshot: ReadonlySet<string> }
  | { readonly _tag: 'error'; readonly state: TState; readonly error: ChecksSubscriptionError }

declare const subscriptionAtom: Atom.Atom<
  AsyncResult.AsyncResult<SubscriptionClientState<ChecksState>, ChecksSubscriptionError>
>
```
