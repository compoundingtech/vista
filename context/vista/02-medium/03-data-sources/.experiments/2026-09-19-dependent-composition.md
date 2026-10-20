# Trace-chain derisk report — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/trace-chain/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Where dependent data chains belong under Vista's no-data semantic extraction constraint.

## Method

Server-composed operations, declared flatMap graphs, naive client chaining, and a two-pass collector were run through the real collection and snapshot flow.

## Result

Named server operations and declared dependent bindings work; ad hoc client chaining cannot be collected, and a two-pass renderer makes React an execution engine.

## Conclusion

Named server operations and declared dependent bindings work; ad hoc client chaining cannot be collected, and a two-pass renderer makes React an execution engine.

## VRS Impact

Specify server operations for named behavior, pure client projections, declared flatMap as the bounded escape hatch, and reject ad hoc chaining.

## Source Report

# Trace-chain derisk report

## Result

The query foundation handles OTel dependent reads cleanly when the dependency is either composed inside the provider or declared as a first-class query graph. Naive component-level chaining does not survive Vista's no-data Node collector. A two-pass collector can recover it, but makes rendering an execution engine and is not worth adopting.

The Effect 4.0.0-rc.112 stream RPC crosses `RpcServer.layerHttp` + `HttpRouter.toWebHandler` + `layerJson`: the browser POST returned 200, decoded all five `TraceSummary` values, changed the atom from frozen to live, and emitted no console error. It did **not** produce observable progressive React updates: even with 300 ms between server elements and `Stream.rechunk(1)` before the atom accumulator, browser sampling saw only `frozen:5` then `live:5`. The non-stream `RequestResolver` batch fallback is therefore the usable live path for this version.

No production file was changed. The working slice is entirely under this directory.

## Effect levers exercised

| Lever | What this slice proves |
| --- | --- |
| 1 — services/Layers | `Tempo` is a `Context.Service`; `Tempo.layer` reads `VISTA_TEMPO_URL` through `Config`, requires `HttpClient`, and is provided once by `defineProvider`. `FetchHttpClient.layer` is the concrete transport. Provider handlers only ask for `Tempo`. |
| 3 — dependent queries | All four strategies (a)–(d) were run through the actual `renderToStaticMarkup` no-data collector. Server composition and declared `flatMap` work; naive chaining does not; two-pass works with undesirable coupling. |
| 5 — streams | `searchTraces` is an actual `Rpc.make(..., { stream: true })`; its handler returns `Stream<TraceSummary>`. Freeze collects to an array while decoding each element through the same `TraceSummary` schema used by live RPC. HTTP RPC transport succeeds but coalesces the visible update in this stack. |
| 6 — resilience/observability | Every Tempo HTTP call has an 8 s timeout, exponential 20 ms retry bounded to 2 retries, and `vista.provider.trace.<operation>` spans. `latestTrace` uses one request-local `Effect.cached` effect from two concurrent consumers and annotates whether they received the same object. `searchTraceBatch` uses typed `Effect.request` values plus `RequestResolver.make` and concurrent `Effect.forEach`. |

## Authored surface

Provider author:

```ts
export const trace = defineProvider({
  id: 'trace',
  layer: Tempo.layer,
  operations: {
    search: operation({ payloadSchema: SearchArgs, successSchema: SearchResult, errorSchema: TraceError, handler }),
    getTrace: operation({ payloadSchema: GetArgs, successSchema: TraceResult, errorSchema: TraceError, handler }),
    latestTrace: operation({ payloadSchema: LatestArgs, successSchema: TraceResult, errorSchema: TraceError, handler }),
    searchTraces: streamOperation({
      payloadSchema: SearchArgs,
      successSchema: TraceSummary, // element schema, not Array(TraceSummary)
      errorSchema: TraceError,
      handler: ({ query, limit }) => Stream<TraceSummary>,
    }),
  },
})
```

App author, server-composed:

```tsx
<Query of={trace.ops.latestTrace} args={{ query }}>
  {(result) => <TraceCard {...result} />}
</Query>
```

App author, declared dependency:

```ts
const latestTrace = Query.flatMap(
  trace.ops.search,
  (result) => trace.ops.getTrace.with({ traceId: newest(result.traces).traceId }),
  { id: 'latest-trace/v1', successSchema: TraceResult },
)
```

```tsx
<Query of={latestTrace} args={{ query, limit: 5 }}>
  {(result) => <TraceCard {...result} />}
</Query>
```

## Dependent-query decision table

| Strategy | Node collector | Freeze/snapshot | Browser hydration | Cost and verdict |
| --- | --- | --- | --- | --- |
| (a) Client chaining: `useQuery(search)` then `useQuery(getTrace, { traceId })` | Captures exactly `['search']`; child cannot render without the parent's value. | 1 entry: search only. | Search hydrates; derived child lookup fails with `missing frozen getTrace entry`. | **Reject.** It is incompatible with the no-data semantic render. |
| (b) Provider `latestTrace` op | 1 `latestTrace` binding. | 1 entry containing the final `TraceResult`. | Works from static snapshot; one live RPC refresh. | **Default for stable domain concepts.** Smallest snapshot/manifest and strongest encapsulation. |
| (c) Declared `Query.flatMap` | 1 derived semantic binding, with parent key + transform id in the manifest. | Freeze executes search then getTrace and writes 2 constituent entries. It deliberately writes no redundant third derived value. | Reads parent entry, deterministically reconstructs child args, then reads child entry. Unit test proves round-trip. | **Adopt as the escape hatch.** More reusable/inspectable than a bespoke provider op; costs one extra snapshot entry. |
| (d) Two-pass collector | Pass 1 captures search. Pass 2 receives resolved parent data and captures `['search', 'getTrace']`. | 2 entries after executing only the new second-pass binding. | Works after the publisher manages intermediate data. | **Do not adopt.** Measured 2 renders, 2 Tempo requests, 0.466 ms first render + 0.665 ms second render in the final run. The small CPU number hides the architectural cost: React render order becomes query scheduling, publish needs an iterative fixpoint/dedup loop, errors/cycles need policy, and semantic capture is no longer data-independent. |

The exact final collector evidence is committed as `public/proof.json`. The application manifest has four semantic bindings and five snapshot entries: one server-composed entry, two constituent flatMap entries, one collected stream array, and one batch-fallback entry.

## FlatMap key and snapshot rule

The derived identity is independent of the selected trace and therefore stable across data refreshes:

```ts
const derivedKey = `${parentSnapshotKey}::flatMap::${canonicalJson(transformId)}`
```

For this query the manifest key is:

```text
trace::search::{"limit":5,"query":"{ resource.service.name = \"oh-my-pi\" }"}::flatMap::"latest-trace/v1"
```

Rules:

1. Parent args are recursively canonicalized, so object property order does not affect identity.
2. `transformId` is explicit, stable, and versioned by the author. Changing dependency semantics requires changing it.
3. Runtime output (the chosen trace id) is never part of the derived key.
4. The derived key identifies the graph binding in the manifest; snapshot storage contains the parent and selected child entries. This lets hydration inspect/reuse both real operations and avoids a duplicate derived payload.
5. Freeze fails normally if the transform selects no valid child. The prototype's demo transform uses a sentinel only to keep its return type total; production should support an effectful/typed transform failure instead.

## Stream result

The declaration follows the actual Effect API from `effect/unstable/rpc/Rpc.d.ts`:

```ts
Rpc.make('searchTraces', {
  payload: SearchArgs,
  success: TraceSummary,
  error: TraceError,
  stream: true,
})
```

The server handler returns `Stream<TraceSummary, TraceError, Tempo>`. `RpcClient.make(group).searchTraces(args)` returns a stream. `freezeQuery` runs `Stream.runCollect`, then encodes `Schema.Array(query.successSchema)`. Live RPC decodes each chunk through `query.successSchema` before the atom sees it. The focused Vitest proves frozen/live element decode symmetry.

Transport observations:

- `POST /_data/trace/` returned 200 through `toWebHandler` + `layerJson`.
- The browser ended in `live` with five decoded items and no console errors.
- Polling every 50 ms while the server delayed each item by 300 ms observed only `['frozen:5', 'live:5']`; no `1,2,3,4` intermediate React counts appeared. `Atom.fn` updates once per pulled chunk (`Arr.lastNonEmpty` in this Effect version), and the HTTP stack exposed all five elements in one visible pull despite client `Stream.rechunk(1)`.
- The requirement's fallback is implemented as unary `searchTraceBatch`: search, issue typed `GetTraceRequest`s, resolve them with `RequestResolver.make` + concurrent `Effect.forEach`, and return two full trace records. Browser refresh returned `mode=live`, `count=2`, both with two spans.

## Browser proof

From a clean `playwright-cli` session against the built static app and Bun data server:

- Static boot requested `snapshot.json` plus static assets and made **zero** `/_data` calls.
- Frozen UI rendered server-composed trace, flatMap trace, five stream summaries, and two batch-fallback traces.
- Stream refresh: one `POST /_data/trace/ => 200`, state `frozen:5 -> live:5`, no console messages.
- Batch fallback refresh: `mode=live`, `count=2`, `vista-service · 2 spans` twice.
- Server-composed refresh: `mode=live`, trace `e9b2553cb6f71b592d40f2d809e954da`, 1203 spans at observation.
- Declared flatMap refresh: `mode=live`, the same latest trace id, 1217 spans at observation (the live trace was still growing).
- Screenshot: `browser-proof.png`.

Commands:

```sh
../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
../../../../node_modules/.bin/vitest run src/query.unit.test.tsx
bun run publish
PORT=4331 bun src/server.ts
playwright-cli -s=trace-chain-batch open http://127.0.0.1:4331/
```

Final validation: strict typecheck clean; Vitest 1 file / 6 tests passed; publish collected 4 bindings and wrote 5 entries; Vite built 281 modules.

## API-shape recommendations for the interview

### Option 1 — explicit, serializable dependent query (recommended)

```ts
interface BoundQuery<TArgs, TValue, TError> {
  readonly query: Query<TArgs, TValue, TError>
  readonly args: TArgs
}

interface FlatMapOptions<TValue> {
  readonly id: string
  readonly successSchema: Schema.Codec<TValue, unknown, never, never>
}

declare const flatMap: <TArgs, TParent, TChildArgs, TValue, TError>(
  parent: Query<TArgs, TParent, TError>,
  select: (value: TParent) => BoundQuery<TChildArgs, TValue, TError>,
  options: FlatMapOptions<TValue>,
) => DerivedQuery<TArgs, TValue, TError>
```

Key rule: `derivedKey(parent, id) = parent.snapshotKey + '::flatMap::' + canonicalJson(id)`. `id` is required because function source/name is not a durable identity. Freeze stores constituent entries and the manifest stores the graph edge.

Production should make `select` return an `Effect` or typed selection result so empty search can fail with `TraceNotFound`, rather than requiring a sentinel:

```ts
declare const flatMapEffect: <TArgs, TParent, TChildArgs, TValue, TSelectError>(
  parent: Query<TArgs, TParent>,
  select: (value: TParent) => Effect.Effect<BoundQuery<TChildArgs, TValue>, TSelectError>,
  options: { readonly id: string; readonly successSchema: Schema.Codec<TValue> },
) => DerivedQuery<TArgs, TValue, TSelectError>
```

### Option 2 — provider composition for named domain behavior

```ts
latestTrace: operation({
  payloadSchema: Schema.Struct({ query: Schema.String }),
  successSchema: TraceResult,
  errorSchema: TraceError,
  handler: ({ query }) => Tempo.search(query, 5).pipe(
    Effect.flatMap(selectNewest),
    Effect.flatMap(Tempo.getTrace),
  ),
})
```

Choose this when the chain has a durable domain name and policy. It gives one RPC and one snapshot entry. Use `flatMap` when the app genuinely owns the composition or constituent cache reuse matters.

### Stream contract

```ts
interface StreamOperation<TArgs, TElement, TError, TServices> {
  readonly payloadSchema: Schema.Codec<TArgs>
  readonly elementSchema: Schema.Codec<TElement>
  readonly errorSchema: Schema.Codec<TError>
  readonly handler: (args: TArgs) => Stream.Stream<TElement, TError, TServices>
}

interface StreamQuery<TArgs, TElement, TError> {
  readonly live: (args: TArgs) => Stream.Stream<TElement, TError>
  readonly freeze: (args: TArgs) => Effect.Effect<readonly TElement[], TError>
  readonly frozenSchema: Schema.Codec<readonly TElement[]>
}
```

Name the field `elementSchema`, not `successSchema`, at the public API: live decodes each element; freeze derives `Schema.Array(elementSchema)`. Add an explicit transport capability result (`progressive | buffered`) or forbid claiming progressive UI until an integration gate observes at least two intermediate atom values. For rc.112 + HTTP JSON, retain the unary batch operation as the browser-live contract.
