# Effect-idiomatic Vista data runtime — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk2/effect-idioms/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Which data-runtime mechanisms Effect already supplies and which Vista-specific semantics remain.

## Method

Installed Effect and atom APIs were source-audited and a working slice exercised AtomRpc, ReactHydration, serializable atoms, AsyncResult, Reactivity, streaming RPC, and strict mismatch fallback.

## Result

Native primitives replace most custom transport, hydration, invalidation, cache, and lifecycle glue; Vista retains binding policy, canonical digest, provenance, visibility, cursor, and fallback semantics.

## Conclusion

Native primitives replace most custom transport, hydration, invalidation, cache, and lifecycle glue; Vista retains binding policy, canonical digest, provenance, visibility, cursor, and fallback semantics.

## VRS Impact

Require native Effect atom/RPC/resource primitives and keep only the documented Vista-owned glue.

## Source Report

# Effect-idiomatic Vista data runtime

## Verdict

The client runtime can delete most of the hand-built transport, resource, hydration, memoization, invalidation, and async-state machinery. The strongest center is:

- `AtomRpc.Service` for an atom-aware typed RPC client;
- one `AtomRegistry` plus one `Atom.runtime`/`AtomRpc.Service.runtime` layer graph per AppVersion;
- `ReactHydration` + `Atom.serializable` + `AsyncResult.Schema` for frozen values;
- `Reactivity` keys for mutation/stream-driven invalidation;
- ordinary `Stream` operators for subscription folding and reconnect cursors;
- `RpcGroup`/`RpcServer`/`RpcSerialization.layerNdjson` on the server;
- `RcMap` and `Stream.share` for provider-poller lifetime and fan-out.

Effect does **not** provide Vista's binding policy, canonical snapshot digest, Frozen/CatchingUp/Live domain state, visibility pause, cursor semantics, or live-schema-mismatch fallback. Those should remain small domain glue rather than be disguised as a framework.

## Settled contract incorporated

1. Snapshot identity is `sha256(canonicalJson([providerId, tag, Schema.encode(payload)(args)]))`. It deliberately excludes AppVersion and contract version. AppVersion isolation is supplied by the registry and snapshot file, not the key.
2. Every boundary decodes with the AppVersion-bundled schema and `onExcessProperty: "error"`.
3. A live/stream decode defect becomes typed `SchemaMismatch`; an already painted frozen value remains visible with a reload/re-publish remedy. There is no negotiation.
4. A hibernated snapshot decode failure becomes `SchemaMismatch` and is discarded/resynchronized rather than silently accepted.
5. RPC is the primary data plane, blocks are the only product-facing data abstraction, and `AsyncResult` is the client async-state primitive.

The spike encodes the digest exactly in `src/contracts.ts`, including `Schema.encodeSync(DemoArgs)`, canonical object-key ordering, UTF-8, and SHA-256. Strict annotations are on all RPC and snapshot schemas.

## Audit: hand-built piece → Effect primitive

| Hand-built piece | Effect-idiomatic replacement | Ruling / Vista remainder | Source reference |
|---|---|---|---|
| AppVersion-owned runtime and service graph | `AtomRegistry.make` plus `Atom.runtime` / `AtomRpc.Service.runtime` | Replace. A distinct registry gives the same atom identity distinct values, mounts, memoized runtime, scope, and protocol layer per AppVersion. | `node_modules/effect/dist/unstable/reactivity/AtomRegistry.d.ts:23-109`; `node_modules/effect/dist/unstable/reactivity/Atom.d.ts:285-406` |
| Binding cache and key map | `Atom.family`, backed by `MutableHashMap` and Effect `Equal`/`Hash` | Replace the cache. Prefer Schema/Data values or a tiny structural key. The spike's `BindingKey` exists only to include policy mode explicitly. | `node_modules/effect/dist/unstable/reactivity/Atom.d.ts:509-562`; `node_modules/effect/dist/unstable/reactivity/Atom.js:635-659`; `node_modules/effect/dist/Equal.d.ts:109-168` |
| Manual hydration registry and JSON folding | `ReactHydration`/`HydrationBoundary`, `Atom.serializable`, `AsyncResult.Schema` | Replace. Keep only Vista's manifest lookup and strict preflight. `Atom.serializable` already converts the schema through the JSON codec. | `node_modules/@effect/atom-react/dist/ReactHydration.d.ts:10-35`; `node_modules/@effect/atom-react/dist/ReactHydration.js:36-88`; `node_modules/effect/dist/unstable/reactivity/Atom.d.ts:1418-1572`; `node_modules/effect/dist/unstable/reactivity/Atom.js:1415-1424` |
| Bespoke loading/success/error/previous-value state | `AsyncResult` and `AsyncResult.Schema` | Replace. `previousSuccess`, `waiting`, timestamps, cause mapping, and wire schema are built in. Keep only `Resolved = Frozen | CatchingUp | Live`. | `node_modules/effect/dist/unstable/reactivity/AsyncResult.d.ts:107-126`; `node_modules/effect/dist/unstable/reactivity/AsyncResult.d.ts:154-271`; `node_modules/effect/dist/unstable/reactivity/AsyncResult.d.ts:559-572` |
| Frozen fallback after a failed live request | No complete primitive | Keep a small adapter. `Atom.withFallback` substitutes only while the primary is `Initial`; it does not attach a fallback as `Failure.previousSuccess`. The spike uses `AsyncResult.value` + `replacePrevious`. | `node_modules/effect/dist/unstable/reactivity/Atom.js:668-680`; `node_modules/effect/dist/unstable/reactivity/AsyncResult.d.ts:222-240` |
| Custom RPC fetch, request encoding, response decode, abort scope | `AtomRpc.Service` over Effect RPC | Replace. `Service` exposes a flattened client, runtime, mutation/query constructors, stream pull constructor, hydration keys, and TTL options. | `node_modules/effect/dist/unstable/reactivity/AtomRpc.d.ts:29-79`; `node_modules/effect/dist/unstable/reactivity/AtomRpc.js:36-109`; `node_modules/effect/dist/unstable/rpc/RpcClient.d.ts:110-122` |
| Manual query invalidation graph | `Reactivity.withReactivity` / `invalidate` / `mutation` | Replace. Use provider/entity key arrays. Stream events and mutations invalidate keys; live query atoms rerun. | `node_modules/effect/dist/unstable/reactivity/Reactivity.d.ts:19-65`; `node_modules/effect/dist/unstable/reactivity/Reactivity.d.ts:68-193` |
| Manual browser adapter and refresh callbacks | `useAtomValue`, `useAtomRefresh`, `useAtomSuspense`, `refreshOnWindowFocus` | Replace ordinary React wiring. Focus refresh is not visibility suspension. | `node_modules/@effect/atom-react/dist/Hooks.d.ts:21-195`; `node_modules/effect/dist/unstable/reactivity/Atom.d.ts:1205-1242`; `node_modules/effect/dist/unstable/reactivity/Atom.js:1123-1134` |
| Hidden-tab pause and cursor resume | No fitting primitive | Keep. A small readable visibility atom should switch the subscription to `Stream.never`; the domain cursor resumes it. `refreshOnWindowFocus` only increments on visible and does not suspend work. | `node_modules/effect/dist/unstable/reactivity/Atom.js:1123-1134`; `node_modules/effect/dist/Stream.d.ts:5942-6008` |
| Continuous subscription consumption | `Atom.runtime.atom(Stream)` and normal `Stream` operators | Replace execution/fiber cleanup. Keep event fold and cursor because they are domain semantics. Do **not** use `AtomRpc.stream`'s pull atom for an always-mounted subscription: pull is demand-driven. | `node_modules/effect/dist/unstable/reactivity/Atom.d.ts:225-284`; `node_modules/effect/dist/unstable/reactivity/Atom.d.ts:303-406`; `node_modules/effect/dist/unstable/reactivity/AtomRpc.d.ts:64-79` |
| Hand-rolled NDJSON parsing/folding | `RpcSerialization.layerNdjson` plus typed streaming RPC | Replace framing, encoding, decoding, and request multiplexing. Keep the business event fold. | `node_modules/effect/dist/unstable/rpc/RpcSerialization.d.ts:100-114`; `node_modules/effect/dist/unstable/rpc/RpcSerialization.d.ts:164-183`; `node_modules/effect/dist/unstable/rpc/Rpc.d.ts:65-104` |
| Server RPC dispatch and HTTP endpoint | `RpcGroup.toLayer` / handlers and `RpcServer.layerHttp` or `toHttpEffect` | Replace. Handlers remain ordinary Effects/Streams with typed success/error schemas. | `node_modules/effect/dist/unstable/rpc/RpcGroup.d.ts:31-71`; `node_modules/effect/dist/unstable/rpc/RpcGroup.d.ts:118-160`; `node_modules/effect/dist/unstable/rpc/RpcServer.d.ts:79-99`; `node_modules/effect/dist/unstable/rpc/RpcServer.d.ts:232-280` |
| Provider poller hub with reference counts and idle TTL | `RcMap` | Replace. It is a keyed, scoped, reference-counted resource map with idle TTL and Effect `Equal`/`Hash` keys. | `node_modules/effect/dist/RcMap.d.ts:207-319`; `node_modules/effect/dist/RcMap.d.ts:635-681`; `node_modules/effect/dist/RcMap.d.ts:897-944` |
| Per-provider subscriber set, replay, disconnect cleanup | `Stream.share` (or `broadcast` when a separately scoped fan-out is required) | Replace. `share` already tracks consumers, can retain a scope for a TTL, and can replay. | `node_modules/effect/dist/Stream.d.ts:11290-11374`; `node_modules/effect/dist/Stream.d.ts:11377-11480` |
| Mutable latest provider state | `SubscriptionRef` | Replace if a poller needs current value plus change stream. It atomically exposes `get/set/modify` and `changes`. | `node_modules/effect/dist/SubscriptionRef.d.ts:32-36`; `node_modules/effect/dist/SubscriptionRef.d.ts:69-128` |
| JSON overlay store and typed persistence | `KeyValueStore.SchemaStore`; optionally `Persistence` for request/Exit caches | Replace serialization and backend plumbing. Keep Vista's overlay precedence and retention policy. `Persistence` stores `Exit` with TTL; it is not a replacement for product history. | `node_modules/effect/dist/unstable/persistence/KeyValueStore.d.ts:164-246`; `node_modules/effect/dist/unstable/persistence/KeyValueStore.d.ts:273-334`; `node_modules/effect/dist/unstable/persistence/Persistence.d.ts:57-110` |
| Per-provider fetch budget/rate limiting | `RateLimiter` / `HttpClient.withRateLimiter` | Replace generic limiting. Keep provider-specific quota policy and keys. Persistent limiting is available when processes must coordinate. | `node_modules/effect/dist/unstable/persistence/RateLimiter.d.ts:34-127`; `node_modules/effect/dist/unstable/persistence/RateLimiter.d.ts:431-447`; `node_modules/effect/dist/unstable/http/HttpClient.d.ts:678-825` |
| RPC tracing and trace propagation | Built-in RPC client/server spans; typed middleware for attributes/auth | Replace manual transport spans. Keep Vista semantic attributes and AppVersion identity. | `node_modules/effect/dist/unstable/rpc/RpcClient.js:44-76`; `node_modules/effect/dist/unstable/rpc/RpcClient.js:97-101`; `node_modules/effect/dist/unstable/rpc/RpcServer.js:217-229`; `node_modules/effect/dist/unstable/rpc/RpcMiddleware.d.ts:43-76` |
| Payload validation and typed mismatch | `Schema`, `Schema.TaggedError`, parse-option annotations | Replace validation machinery. Keep the boundary adapter that turns RPC response-decode defects into `SchemaMismatch`, because response decode failures are defects rather than the declared RPC error channel. | `node_modules/effect/dist/Schema.d.ts:1153-1803`; `node_modules/effect/dist/Schema.d.ts:9870-9908`; `node_modules/effect/dist/Schema.d.ts:10914-10946`; `node_modules/effect/dist/unstable/rpc/RpcClientError.d.ts:1-47` |
| Canonical JSON + cryptographic snapshot digest | No complete Effect primitive | Keep one audited identity module. `Schema.encode` supplies the encoded arguments, but Effect's structural `Hash` is not SHA-256 and JSON object-key canonicalization is not a snapshot-key API. | `node_modules/effect/dist/Schema.d.ts:1153-1227`; `node_modules/effect/dist/Schema.d.ts:10218-10252`; `node_modules/effect/dist/Hash.d.ts:48-86` |

## Refined client design

### AppVersion boundary

```ts
interface DataRuntime {
  readonly appVersionId: AppVersionId
  readonly registry: AtomRegistry
  readonly atomFor: (binding: DataBinding) => Atom<AsyncResult<Resolved<Value>, DataError>>
  readonly dispose: () => void
}
```

Create exactly one registry per mounted AppVersion. Seed a private runtime-config atom in that registry with its RPC URL and snapshot metadata. `AtomRpc.Service.protocol(get)` reads that atom, so the service runtime and transport are memoized **inside that registry**. Nest each AppVersion subtree in `RegistryContext.Provider` and `HydrationBoundary`. Do not use a process-global runtime and do not put `appVersionId` into snapshot keys.

`ScopedAtom` is not the AppVersion boundary: its provider owns a single atom and changing its `value` does not recreate that atom (`node_modules/@effect/atom-react/dist/ScopedAtom.d.ts:56-116`). Registry ownership is the correct isolation primitive.

### Binding identity and snapshot identity

A data binding contains the query definition/tag, typed payload, and policy (`frozen | live | subscription`). Its atom-family identity also includes policy because the execution behavior differs. The snapshot lookup key is only:

```ts
sha256(canonicalJson([providerId, tag, Schema.encode(payloadSchema)(args)]))
```

The publisher writes `Hydration.DehydratedAtomValue[]` keyed by that digest. The client strictly decodes the snapshot envelope, then decodes every value through `Schema.toCodecJson(AsyncResult.Schema(...))`. This codec step matters: `AsyncResult.Schema` is a declaration schema; its JSON representation is obtained through `Schema.toCodecJson`.

### Frozen, live, and subscription policies

- **Frozen:** return the serializable snapshot atom. No transport runtime is started.
- **Live:** create an `AtomRpc.Service.runtime.atom` around the unary client call, attach a `Reactivity` key, and optionally refresh on focus. Map typed RPC errors normally. Catch response-decode defects at the RPC boundary and fail with `SchemaMismatch`. Overlay the frozen result as `previousSuccess`, preserving the visible value and exposing the failure/remedy.
- **Subscription:** read the frozen baseline and cursor, then run the typed streaming RPC as a continuous runtime atom. Fold domain events, persist the most recent cursor in a registry-owned atom, and invalidate the entity key after each accepted event. On hidden, switch to `Stream.never`; on visible, restart from the cursor. A stream decode defect follows the same typed mismatch/frozen-fallback rule.

A hibernated strict decode failure is converted to a serialized `AsyncResult.fail(SchemaMismatch)` before hydration. Mounting live/subscription policy therefore resynchronizes; frozen-only UI reports that the publication must be reloaded or republished.

### React surface

Use `useAtomValue` for ordinary rendering, `useAtomRefresh` for explicit refresh, and `useAtomSuspense` only at an intentional Suspense boundary. `AsyncResult` remains the state model; hooks do not invent a parallel request-state model.

## Refined server design

1. Define every block query/mutation/subscription as an `Rpc` in a provider `RpcGroup`; payload, success, domain errors, and stream events are schemas.
2. Implement handlers as Effects/Streams and expose the group through `RpcServer.layerHttp` with `RpcSerialization.layerNdjson`.
3. Acquire a provider poller from `RcMap<ProviderKey, Poller>`; release occurs when the handler/subscriber scope ends. Use the idle TTL for churn absorption rather than a custom timer/ref counter.
4. Inside a poller, keep latest state in `SubscriptionRef` when current+changes are both needed. Expose updates through `Stream.share({ capacity: 1, timeToLive })` when multiple RPC streams consume the same source.
5. Apply provider rate limits at the provider HTTP client boundary. Use persistent rate limiting only when quota must coordinate across processes.
6. Persist typed provider overlays through `KeyValueStore.SchemaStore`. Persistence, cache, and product history remain separate concepts.
7. Let RPC produce/propagate transport spans. Middleware adds auth and stable Vista attributes; handlers add provider-operation spans.

This deletes the prior bespoke hub, subscriber bookkeeping, NDJSON parser, transport request map, abort plumbing, hydration map, and most cache bookkeeping. It deliberately retains the blocks ontology, snapshot publication, digest algorithm, overlay semantics, policy state, event fold, cursor, and visibility policy.

## Working slice

`src/` is a runnable client+server proof:

- `demo.query.ts`: strict RPC payload/value/event schemas and `RpcGroup`;
- `rpc-server.ts`: unary + NDJSON stream handlers and debug counters;
- `contracts.ts`: bindings, domain states/errors, exact snapshot digest;
- `snapshot.ts` / `publish.ts`: JSON-codec snapshot publication;
- `data-runtime.tsx`: per-AppVersion registry/service runtime, hydration, unary invalidation, subscription fold/cursor/visibility, strict mismatch normalization, frozen fallback;
- `app.tsx`: frozen/live/subscription/Suspense adapters plus two simultaneous AppVersions;
- `runtime.unit.test.ts`: focused behavioral proof using a real in-process HTTP RPC server.

## Proof

- `../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit` — passed.
- `../../../../node_modules/.bin/vitest run src/runtime.unit.test.ts` — 5/5 passed. It proves instant hydration, stream folding + Reactivity invalidation, two registry/protocol layers staying isolated, strict live response mismatch becoming `SchemaMismatch` while retaining frozen `previousSuccess`, and strict hibernated mismatch discard + subscription resynchronization.
- `bun run publish && bun run build` — snapshot published and Vite production build completed (277 modules).
- Playwright CLI loaded `http://127.0.0.1:4387/` with zero console errors/warnings. The navigation snapshot shows the immutable frozen card, live unary frozen value, subscription `CatchingUp`, strict-mismatch frozen fallback, and A/B AppVersion snapshots before network completion: `.playwright-cli/page-2026-09-19T16-31-10-393Z.yml`.
- Settled browser state showed unary/stream/A/B all `Live`; clicking **Refresh unary** advanced `main unary 3` to `main unary 4`.
- A deliberately excess-property RPC response retained `safe frozen fallback` and rendered `Live schema mismatch. Reload or re-publish this AppVersion.`: `.playwright-cli/mismatch-fallback.png`.
- Forced hidden visibility produced `document hidden; stream paused` and `/_debug.activeStreams === 0`: `.playwright-cli/hidden-paused.png`.
- Restoring visible resumed from the cursor with `activeStreams === 1` and `streamStarts === 2`: `.playwright-cli/resumed-clean.png`.

## Practical cautions found during the experiment

1. `ReactHydration` applies entries as atoms register during render; it is not a general manifest validator. Strictly validate the envelope and values before handing them to the boundary.
2. Use `Schema.toCodecJson` when manually decoding an `AsyncResult.Schema` wire value. Decoding the declaration schema directly rejects the JSON object as “expected AsyncResult”.
3. `Atom.withFallback` does not preserve a frozen value across live `Failure`; use `AsyncResult.previousSuccess` explicitly.
4. A response schema decode failure can arrive as an RPC defect, not a declared RPC error. Normalize defects at the client boundary; do not weaken schemas or accept excess fields.
5. `AtomRpc.stream` returns a pull atom. It is excellent for demand-driven pulls, but a continuously mounted subscription should use a stream-valued runtime atom so scope/mount controls the fiber.
6. `refreshOnWindowFocus` is a refresh trigger, not a hidden-tab resource gate. Keep the small visibility switch.
