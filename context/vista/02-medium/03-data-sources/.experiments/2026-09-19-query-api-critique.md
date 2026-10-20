# Adversarial review: query prototype API — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/CRITIQUE.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Which parts of the Query prototype conflict with accepted Vista contracts or create correctness and lifecycle hazards.

## Method

An adversarial architecture review compared the prototype against decisions, ontology, production seams, and canonical provider use cases.

## Result

The review identified the viable kernel as an RPC-derived operation, typed DataBinding, AppVersion-scoped runtime, and server-only implementation, while rejecting the public Query abstraction and bespoke runtime machinery.

## Conclusion

The review identified the viable kernel as an RPC-derived operation, typed DataBinding, AppVersion-scoped runtime, and server-only implementation, while rejecting the public Query abstraction and bespoke runtime machinery.

## VRS Impact

The settled design uses distinct contract/implementation halves, domain Blocks, native Effect atom primitives, strict schemas, and explicit policy.

## Source Report

# Adversarial review: query prototype API

## Verdict

**Do not adopt the prototype API as-is.** The experiment proves that a schema-carrying value can connect collection, capture, hydration, and an Effect Atom. It does **not** yet prove the contract Vista has accepted: a `DataBinding` derived by a typed domain Block, resolved by an RPC-first `Provider`, captured under freeze policy, attached to the owning `SemanticNode`, and rendered from an immutable `AppVersion` without crossing a server-only capability boundary.

The useful kernel is smaller than the proposed `Query` abstraction:

- an RPC-derived, client-safe **provider operation descriptor**;
- a typed `DataBinding` value pairing that operation with encoded/canonical arguments and capture policy;
- an app-version-scoped Effect Atom runtime;
- server-side provider cores that retain typed errors and requirements.

Severity below is relative to production adoption: **blocker** means the shape conflicts with an accepted Vista contract or makes a required use case impossible; **high** means it creates a correctness/security/lifecycle hazard; **medium** means the prototype works for its fixtures but leaves a contract that will fail under ordinary schema or composition growth.

## What the prototype actually proves

It proves a narrow vertical slice:

1. `defineProvider` can synthesize `Rpc` definitions from three Schemas.
2. a synchronous React server render can collect bindings whose arguments are already available before any provider result exists;
3. those independent bindings can be executed in-process and encoded;
4. an Effect Atom can start from a frozen value and later run an RPC.

It does not prove dependent queries, result-dependent conditionals, derived-query identity, typed error handling in the UI, Effect requirements supplied once by the mount, semantic-node ownership, freeze policy, secret rejection, published-version immutability, or Vite SSR's single-Effect-realm constraint.

## Findings

### 1. Blocker — `Query` is the wrong domain boundary

**Why:** Vista's ontology deliberately says that a `DataBinding` is an internal `SemanticManifest` record derived by a typed domain Block, and that a `Provider` is its internal resolver. `Query` is absent from that ontology, and decision 0027 explicitly says viewers author no queries. The generic `<Query of={gh.ops.pullRequest} ...>` component turns a transport operation into an author-visible rendering primitive and creates a second collection path beside `useDataBinding`. Its `SemanticBinding` is a detached global manifest with no owning `SemanticNode`, while the production seam appends the binding to `context.node.bindings`. That loses the reason a binding exists and cannot be merged into `extractSemanticManifest` without another source of truth.

`Query` also conflates three different things: an RPC definition, a binding/invocation of that RPC with arguments, and a client result. Keep those names separate. Use **RPC tag** for `Rpc._tag`, **operation** for the provider capability selected by a binding, and **DataBinding** for `(operation, args, policy)`. Avoid `op` in durable types; it is only acceptable as a short local namespace.

**Alternative A (recommended):**

```ts
export interface ProviderOperation<R extends Rpc.Any> {
  readonly providerId: string
  readonly rpc: R
  readonly group: RpcGroup.RpcGroup<Rpc.Any>
}

export interface DataBinding<R extends Rpc.Any> {
  readonly operation: ProviderOperation<R>
  readonly args: Rpc.Payload<R>
  readonly policy?: BindingPolicy
}

export const useDataBinding = <R extends Rpc.Any>(
  binding: DataBinding<R>,
): DataBindingResult<R>
```

**Alternative B:** retain a constructor, but name the produced value rather than the transport mechanism.

```ts
export const bind = <R extends Rpc.Any>(
  operation: ProviderOperation<R>,
  args: Rpc.Payload<R>,
  policy?: BindingPolicy,
): DataBinding<R>
```

Domain Blocks call this internally; App authors continue to render `PullRequestViewer`, `TraceBlock`, or another typed domain component.

### 2. Blocker — `OperationSpec` duplicates `Rpc` and erases both `E` and `R`

**Why:** `operation({ payloadSchema, successSchema, errorSchema, handler })` is a parallel contract model immediately converted to `Rpc.make`. This violates the single-source-of-truth rule and gives every schema/tag change two representations. More seriously, `Query<TArgs, TValue>` drops the typed error entirely (`run: Effect<TValue, unknown>`), `callLive` casts the RPC client to `Effect<unknown, unknown>`, and `OperationSpec.handler` has no requirements channel. The three canonical sources in the derisk brief need `Effect<A, E, R>` so the mount can provide `HttpClient`, `FileSystem`, Tempo, OmpUsage, or DiskIndex services once and tests can replace a Layer. The current API forces requirements to be closed inside each handler and makes expected errors indistinguishable from defects at the client boundary.

The existing production seam already has the correct spine: authored `Rpc` definitions, a `RpcGroup`, and a `ProviderCoreOf` derived from those definitions. Extend that seam to retain requirements rather than synthesizing a second RPC model.

**Alternative A (recommended, RPC-first):**

```ts
export type ProviderCoreOf<Rpcs extends Rpc.Any, R> = {
  readonly [P in Rpcs as P['_tag']]: (
    payload: Rpc.Payload<P>,
  ) => Effect.Effect<Rpc.Success<P>, Rpc.Error<P>, R>
}

export const defineProvider = <Rpcs extends Rpc.Any, R, LE = never, LR = never>(p: {
  readonly id: string
  readonly purity: Purity
  readonly group: RpcGroup.RpcGroup<Rpcs>
  readonly core: ProviderCoreOf<Rpcs, R>
  readonly layer: Layer.Layer<R, LE, LR>
}): ProviderDefinition<Rpcs, R, LE, LR>
```

**Alternative B (if first-class operation values are retained):**

```ts
export interface ExecutableOperation<RpcDef extends Rpc.Any, R = never> {
  readonly providerId: string
  readonly rpc: RpcDef
  readonly run: (
    payload: Rpc.Payload<RpcDef>,
  ) => Effect.Effect<Rpc.Success<RpcDef>, Rpc.Error<RpcDef>, R>
}
```

In both options, `payloadSchema`, `successSchema`, `errorSchema`, tag, streaming shape, middleware errors, and requirements are read from the `Rpc`; there is no `BoundarySchema`/`ErasedRpc` model at the definition site.

### 3. Blocker — collection cannot represent dependent, conditional, or derived data flow

**Why:** during extraction, `<Query>` records itself and returns a placeholder without invoking its render child. Therefore a second binding whose args depend on the first value can never be observed. A result-dependent conditional has the same problem. `Query.map`/`zip`/`flatMap` do not exist, and adding them client-side would create an unresolved snapshot identity question. This is not an edge case: the brief's canonical trace path is search → getTrace.

The collector also globally deduplicates by snapshot key. Two SemanticNodes that bind the same operation and args must each retain their own `DataBinding`; only snapshot storage/capture may deduplicate execution. Global extraction dedup would erase ownership, and once mode/effectful policy is added it can silently discard two bindings with the same data key but different policies. `React.useMemo` identity must not affect any of this: memoization is a render optimization, not binding identity.

Vista should make the no-data extraction constraint explicit instead of pretending arbitrary client query composition can be discovered. Result-dependent work belongs in one server-side derived RPC/core operation. Pure client derivations may map already-captured data but do not create another binding.

**Alternative A (recommended):**

```ts
export interface ProviderHandler<R extends Rpc.Any, Env> {
  readonly rpc: R
  readonly handler: (
    payload: Rpc.Payload<R>,
  ) => Effect.Effect<Rpc.Success<R>, Rpc.Error<R>, Env>
}

export const defineDerivedRpc = <R extends Rpc.Any, Env>(
  handler: ProviderHandler<R, Env>,
): ProviderHandler<R, Env>
```

For search → getTrace, define one typed provider operation whose core composes both service calls; it has one declared payload, one success/error schema, and one snapshot entry.

**Alternative B (only for pure projection over captured inputs):**

```ts
export interface DerivedValue<A, E = never> {
  readonly dependencies: readonly DataBinding<Rpc.Any>[]
  readonly derive: (...values: readonly unknown[]) => Effect.Effect<A, E>
}

export const mapBinding = <R extends Rpc.Any, B>(
  source: DataBinding<R>,
  f: (value: Rpc.Success<R>) => B,
): DerivedValue<B>
```

This second option must not claim an independent Provider call or snapshot key. Extraction records each dependency on its owning SemanticNode; the derived value is a pure view.

### 4. Blocker — freeze policy is bypassed, and refresh changes a frozen publication into live data

**Why:** `collector.tsx` hard-codes every binding to `requestedMode: 'frozen'`, carries no `freezeEffectful`, and does not include provider purity. `publish.tsx` then executes every collected `runUnknown`, including the effectful `gh` provider, with no default-deny acknowledgement. That directly conflicts with decision 0031 and the production `captureFrozenEffect` guard.

At view time, every supposedly frozen query exposes `refresh`; after clicking it, the same panel flips to `mode: 'live'`. A frozen binding is not a cached live binding. A published AppVersion's frozen panel must remain the captured value; an explicitly live binding is a separate policy choice. This is especially disallowed for the pull-request surface: decision 0087 requires a read-only viewer over captured data with no fetching or refresh path. The current demo's primary success path demonstrates the opposite contract.

**Alternative A (recommended):**

```ts
export type BindingPolicy =
  | { readonly mode?: 'frozen'; readonly effectfulCapture?: 'acknowledged' }
  | { readonly mode: 'live' }

export const bind = <R extends Rpc.Any>(
  operation: ProviderOperation<R>,
  args: Rpc.Payload<R>,
  policy?: BindingPolicy,
): DataBinding<R>
```

The service resolves an omitted mode to the freeze default, refuses effectful capture without acknowledgement, and never gives a frozen result a live refresh action.

**Alternative B (make resolved provenance impossible to fake):**

```ts
export type ResolvedData<A> =
  | { readonly _tag: 'Frozen'; readonly value: A; readonly frozenAt: DateTime.Utc; readonly modeSource: 'default' | 'override' }
  | { readonly _tag: 'Live'; readonly value: A; readonly observedAt: DateTime.Utc; readonly modeSource: 'override' }
```

For the PR block specifically, keep the visual component data-only:

```ts
export const PullRequestViewer: React.FC<{ readonly data: PullRequestData }>
```

A domain-owned capture wrapper may bind the provider during authoring/publish, but the viewer itself never receives `refresh`.

### 5. High — the client runtime has process-global state and cross-version contamination

**Why:** `hydratedSnapshot`, `liveBaseUrl`, and `runtimes` are module globals. `installClientSnapshot` mutates the first two but does not rebuild atom families already cached in `runtimes`. If a browser shell navigates between two AppVersions using the same imported operation object and canonical args, the second root can receive the first snapshot's baked `initialValue`; a refresh can use whichever root most recently changed the global base URL. Multiple roots, tests, HMR, and embedded Vistas have the same collision. The registry scopes atom values, but the atom objects and their initial frozen values were created outside that scope.

`runtime.args.set(key, args)` is also a module-global mutation during React render. It is unnecessary if the atom family is keyed by an immutable binding that already carries canonical encoded args. Neither correctness nor cache identity should depend on `React.useMemo` preserving an object reference.

`RegistryProvider` belongs in the Vista-owned browser root/AppShell integration, beside the decoded AppVersion snapshot and data URL. It is not a Query component alias and should not be installed by domain Blocks.

**Alternative A (recommended):**

```ts
export interface DataRuntime {
  readonly appVersionId: AppVersionId
  readonly snapshot: SnapshotMode
  readonly dataBaseUrl: URL
  readonly operationAtom: <R extends Rpc.Any>(
    binding: DataBinding<R>,
  ) => Atom.Atom<AsyncResult.AsyncResult<ResolvedData<Rpc.Success<R>>, DataError<R>>>
}

export const DataRuntimeProvider: React.FC<{
  readonly runtime: DataRuntime
  readonly children: React.ReactNode
}>
```

Create one runtime and one Atom registry per mounted AppVersion; route changes replace the provider value and dispose the old runtime.

**Alternative B:**

```ts
export const makeDataRuntime = (config: {
  readonly appVersionId: AppVersionId
  readonly snapshot: SnapshotMode
  readonly dataBaseUrl: URL
}): Effect.Effect<DataRuntime, SnapshotLoadError, Scope.Scope>
```

This makes lifetime and cleanup explicit and permits service Layers/ManagedRuntime to be owned once rather than rebuilt per refresh.

### 6. High — the hook throws away the Effect Atom result model and typed errors

**Why:** `useQuery` calls `useAtomSuspense`, which throws failures unless an error boundary catches the squashed cause, then repackages the success as `{ value, mode, frozenAt?, refreshing, refresh }`. The RPC error schema is already erased, snapshot/schema errors are synchronously thrown by `Effect.runSync`, and the UI cannot branch on a tagged provider error, display previous success after a failed refresh, distinguish initial/loading/failure, or inspect the `Cause`. The four bespoke fields duplicate part of `AsyncResult` while losing its strongest behavior.

Suspense is a presentation choice, not the only data contract. Vista's dense review UI often needs explicit in-place states. Expose the typed `AsyncResult` first; an optional Suspense helper can be layered on it for simple Blocks.

**Alternative A (recommended):**

```ts
export type DataError<R extends Rpc.Any> =
  | Rpc.Error<R>
  | FrozenDataError
  | Schema.SchemaError

export const useDataResult = <R extends Rpc.Any>(
  binding: DataBinding<R>,
): AsyncResult.AsyncResult<ResolvedData<Rpc.Success<R>>, DataError<R>>
```

**Alternative B (dual surface):**

```ts
export const useDataSuspense = <R extends Rpc.Any>(
  binding: DataBinding<R>,
): AsyncResult.Success<ResolvedData<Rpc.Success<R>>, DataError<R>>

export const useRefreshData = <R extends Rpc.Any>(
  binding: LiveDataBinding<R>,
): () => void
```

Only a statically live binding has a refresh action. Frozen bindings have no write capability.

### 7. High — provider values carry server capabilities into the browser graph

**Why:** `app.tsx` imports `gh` and `local` from their `.provider.ts` modules. Each operation value carries `run`, `runUnknown`, the complete group, and a handler Layer. Vite therefore retains code containing `Bun.spawn`, filesystem reads, and in-process provider handlers in the client closure. The report acknowledges the large bundle but understates the boundary: this is not merely dead weight. It makes a server capability object the public client descriptor and prevents static enforcement that secrets, server-only dependencies, and privileged actions stay behind the service.

The RPC definitions and Schemas are the safe shared contract. Provider core, Layers, credentials, process/filesystem adapters, and `handlers` must live in a server-only module that no Block imports.

**Alternative A (recommended split):**

```ts
export interface ProviderContract<Rpcs extends Rpc.Any> {
  readonly id: string
  readonly group: RpcGroup.RpcGroup<Rpcs>
}

export interface ProviderDefinition<Rpcs extends Rpc.Any, R>
  extends ProviderContract<Rpcs> {
  readonly purity: Purity
  readonly core: ProviderCoreOf<Rpcs, R>
  readonly layer: Layer.Layer<R>
}
```

`gh.contract.ts` exports only `GhApi` and `ghContract`; `gh.provider.ts` imports that contract and exports the server definition. Blocks import the contract only.

**Alternative B (operation-sized descriptors):**

```ts
export const operationOf = <Rpcs extends Rpc.Any, Tag extends Rpcs['_tag']>(
  contract: ProviderContract<Rpcs>,
  tag: Tag,
): ProviderOperation<Extract<Rpcs, { readonly _tag: Tag }>>
```

This descriptor contains provider id, group/RPC identity, and schemas—never `core`, `run`, handlers, Bun, environment access, or service Layers.

### 8. High — capture and serving omit the required secret and authority boundaries

**Why:** `publish.tsx` encodes provider results straight into `snapshot.json` without the schema-level Redacted/Sensitive rejection or encoded-value scan required by MED.DATA-R31 and decision 0031. `server.ts` then adds `Access-Control-Allow-Origin: *` to every provider response and permits cross-origin POSTs. If this shape were adopted for the standing service, an unrelated web origin could drive a loopback effectful provider backed by the user's `gh` credentials and read the response. Keeping the token string out of the bundle is not enough; the credentialed capability itself must not be exposed cross-origin.

Capture must use the same guarded service path as production, and provider HTTP routes must be same-origin/owner/version scoped with an explicit authorization policy. This is a non-negotiable adoption gate, not an optional hardening follow-up.

**Alternative A (capture contract):**

```ts
export const captureBinding = <R extends Rpc.Any, Env>(
  mounted: MountedOperation<R, Env>,
  binding: FrozenDataBinding<R>,
): Effect.Effect<SnapshotEntry, Rpc.Error<R> | Schema.SchemaError | SecretBlocked, Env>
```

The implementation invokes the typed core, `Schema.encode`s the success, runs `assertNoSecrets` on the encoded value, and only then commits the entry.

**Alternative B (mount policy):**

```ts
export interface ProviderRoutePolicy {
  readonly authorize: (request: Request, app: AppVersionIdentity) => Effect.Effect<void, Unauthorized>
  readonly allowedOrigins: ReadonlySet<string>
}

export const mountProvider = <Rpcs extends Rpc.Any, Env>(
  provider: ProviderDefinition<Rpcs, Env>,
  policy: ProviderRoutePolicy,
): Effect.Effect<MountedProvider, MountError, Env | Scope.Scope>
```

No wildcard CORS default is valid for credential-bearing providers.

### 9. High — the prototype does not exercise the accepted Vite SSR/single-realm mount

**Why:** decision 0027 requires providers to load through the standing Vite server's `ssrLoadModule`, with Effect packages in `ssr.external`, so host and provider share one Effect/RPC realm. The prototype uses direct dynamic imports from Bun, and its `vite.config.ts` has no SSR configuration because Vite is only used for the browser build. That can prove the handler in a single Bun module graph; it cannot derisk app-local provider loading, HMR reload, or Context/RPC identity through the production boundary.

This matters more once requirements/Layers are admitted: services created in one Effect realm must be found by code loaded in the same realm. Production adoption should reuse `createProviderRegistry` rather than introduce a second discovery/mount path.

**Alternative A (recommended):**

```ts
export const loadProvider = (
  vite: ViteDevServer,
  modulePath: string,
): Effect.Effect<ProviderDefinition<Rpc.Any, unknown>, ProviderLoadError>

export const createProviderRegistry = <Env>(
  vite: ViteDevServer,
  root: string,
  runtime: ManagedRuntime.ManagedRuntime<Env, never>,
): Effect.Effect<ProviderRegistry, ProviderLoadError, Scope.Scope>
```

**Alternative B:** retain the existing production registry signature and make operation descriptors a derived view of each loaded `Provider`; do not give query code a loader at all.

```ts
export const operationsOf = <Rpcs extends Rpc.Any>(
  provider: Provider<Rpcs>,
): OperationsOf<Rpcs>
```

In either case, the accepted `ssr.external: ['effect', '@effect/platform-node']` policy remains service-owned and mandatory.

### 10. Medium — snapshot identity is computed from the wrong representation, and the fingerprint is not a compatibility contract

**Why:** `snapshotKey` canonicalizes the authored decoded `args` before applying the payload Schema. `recordBinding` even replaces the args with that generic canonical form, and `publish.tsx` subsequently calls `Schema.decodeUnknownEffect` on a value already typed as the Schema's decoded `Type`. This happens to work for identity Schemas containing strings/numbers. It breaks Schema transforms and rich decoded values: a `Date` canonicalizes to `{}`, a branded/transformed payload may be decoded in the wrong direction, cycles recurse forever, and `Map`, `Set`, `undefined`, `BigInt`, or custom prototypes do not have an honest JSON identity. The canonical production seam already validates serializability; the query path must instead key the **Schema-encoded wire payload**.

The success fingerprint is a 32-bit FNV hash of `Schema.toJsonSchemaDocument`. JSON Schema projection does not preserve every Effect Schema transform/refinement, the payload schema is excluded even though stored args are decoded, and collisions are cheap. In a self-contained AppVersion the bundled decoder already validates the captured value, so a fingerprint may be unnecessary. If cross-build compatibility is intended, it needs an explicit versioned contract or a canonical, cryptographic digest of a specified schema representation—not an incidental JSON Schema projection.

**Alternative A (recommended key, no fingerprint):**

```ts
export const encodeBinding = <R extends Rpc.Any>(
  operation: ProviderOperation<R>,
  args: Rpc.Payload<R>,
): Effect.Effect<{
  readonly encodedArgs: R['payloadSchema']['Encoded']
  readonly key: SnapshotKey
}, Schema.SchemaError>
```

The key is `SHA-256(providerId, rpc._tag, canonicalJson(encodedArgs))`. Capture persists `encodedArgs`; view recomputes from the same payload Schema. The AppVersion envelope and per-entry success decode fail closed without a second schema identity mechanism.

**Alternative B (if cross-version compatibility is a requirement):**

```ts
export interface ProviderOperation<R extends Rpc.Any> {
  readonly providerId: string
  readonly rpc: R
  readonly contractVersion: NonNegativeInt
}

export interface SnapshotEntry<R extends Rpc.Any> {
  readonly contract: { readonly providerId: string; readonly rpcTag: R['_tag']; readonly version: number }
  readonly encodedArgs: R['payloadSchema']['Encoded']
  readonly encodedValue: Rpc.SuccessEncoded<R>
}
```

The version is deliberate API policy reviewed with the RPC contract; it is not inferred from a lossy projection.

## Maintainer rejection gates

A Vista maintainer should reject production adoption until all of these are true:

1. there is exactly one contract spine—the authored `Rpc`/`RpcGroup`—with no parallel `OperationSpec` schemas;
2. bindings are attached to their owning SemanticNodes through the existing semantic extraction pass;
3. effectful capture is default-deny, encoded results are secret-checked, and frozen panels cannot silently become live;
4. browser imports cannot reach provider core/handlers/server dependencies;
5. errors and requirements remain typed end to end, and provider Layers are mounted once;
6. dependent calls have an explicit server-composition rule rather than relying on no-data render discovery;
7. runtime state is scoped to one AppVersion/Atom registry, with no mutable module globals;
8. app-local providers are loaded through the production Vite SSR single-realm path.

## Ranked interview decisions

### 1. What is the single source of truth for an operation?

- **A — RPC-first (recommended):** author `Rpc` values + `RpcGroup`; derive core types, client descriptors, binding schemas, and handlers from them.
- B — `OperationSpec`-first: author parallel payload/success/error fields and synthesize `Rpc` values.
- C — two tiers with different definitions: full RPC for built-ins, schema-only operation specs for local providers.

Offer A versus B/C explicitly. A is the only option aligned with decision 0027 and preserves streaming/middleware/error information without another model.

### 2. Is `Query` a public concept, and where does composition live?

- **A — no public Query (recommended):** typed domain Blocks derive `DataBinding`s; dependent/effectful composition is one server-side provider operation; pure view derivation maps captured values.
- B — first-class authored Query DSL with `map`/`zip`/`flatMap`, requiring a new ontology term, static dependency graph, snapshot identity rules, and semantic-owner integration.
- C — generic `<Query>` only, with runtime discovery from React render.

A preserves the accepted ontology. C must be rejected because dependent queries are uncollectable; B is viable only if Vista intentionally adopts a query language.

### 3. What does frozen/live mean at the component boundary?

- **A — immutable resolved mode (recommended):** omitted mode freezes; live is an explicit binding override; effectful freeze requires acknowledgement; frozen values have no refresh action.
- B — frozen initial cache with an optional per-panel live overlay/refresh.
- C — always live in drafts and always frozen after publish, with no per-binding live mode.

A matches decision 0031. Independently, the PR viewer is always captured/read-only under decision 0087 even if other Blocks may opt live.

### 4. Which client result contract should Blocks consume?

- **A — raw typed `AsyncResult` plus optional Suspense adapter (recommended):** explicit initial/success/failure/waiting/previous-success states and typed causes.
- B — Suspense/error-boundary only, returning a success value once resolved.
- C — bespoke `{ value, mode, frozenAt, refreshing, refresh }` for every Block.

A composes with Effect Atom instead of partially reimplementing it. Provenance (`Frozen`/`Live`) belongs inside the success value; refresh is available only for a live binding.

### 5. What is snapshot identity and compatibility policy?

- **A — encoded-payload key + per-entry decode (recommended):** SHA-256 the canonical Schema-encoded payload; rely on the AppVersion envelope and exact bundled success decoder; no schema fingerprint.
- B — encoded-payload key + explicit authored `contractVersion` for supported cross-build reads.
- C — hash a projected schema automatically at runtime.

Choose A unless a concrete cross-build reader is required; then choose B. Reject C until a complete canonical Effect Schema identity specification exists.

## Bottom line

Keep the experiment's evidence that Effect Atom hydration and RPC-backed refresh are mechanically possible. Do not carry forward `Query<TArgs, TValue>`, `OperationSpec`, the separate collector, module globals, or provider objects in the client graph. The production direction should be **RPC-first Provider contracts + first-class typed DataBindings + semantic-owner extraction + app-version-scoped AsyncResult atoms**, with derived/dependent behavior composed in Effect on the server.
