# Query client/server split derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/client-split/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

How Provider contracts remain client-safe while implementations retain server capabilities.

## Method

Three module-boundary variants were built and measured with Vite, including deliberate server-only mis-imports.

## Result

Separate *.query.ts and *.provider.ts modules produced the smallest correct graph and are enforceable before build; transforms and tree-shaking do not provide an equivalent capability boundary.

## Conclusion

Separate *.query.ts and *.provider.ts modules produced the smallest correct graph and are enforceable before build; transforms and tree-shaking do not provide an equivalent capability boundary.

## VRS Impact

Specify client-safe ProviderContract modules, server-only ProviderImplementation modules, and vista check enforcement across the resolved graph.

## Source Report

# Query client/server split derisk

## Result

**Recommend A: an explicit `*.query.ts` descriptor module plus a `*.provider.ts` implementation module, backed by `defineQueries` + `implement`, and enforced by `vista check` and the existing Vite runtime-policy plugin.** It is the only option that keeps the browser's *module graph* server-free rather than asking the final tree-shaker to repair an already-invalid graph. It also fits decision 0054's thin eager graph and decision 0045's fail-fast typed diagnostics.

The split is semantic, not merely a bundler optimization. The client needs provider id, operation tags, and payload/success/error Schemas; the server additionally needs handlers, Layers, and Node integrations. Therefore the old all-in-one `defineProvider({ operations: { handler } })` does need two phases. `defineProvider` may remain as server-only sugar around `implement`, but app code must receive the `QueryProvider` returned by `defineQueries`.

B proves a virtual-module transform can make a single `*.provider.ts` build cleanly and reject a named server export. It does **not** remove the need for a typed descriptor/implementation split: TypeScript sees the source module, not Vite's transformed module. If `gh` is typed as an implemented provider, `gh.handlers` type-checks even when the transform removes it. The working B prototype therefore exports client-safe `gh = ghQueries` and a separate server-only `ghProvider = implement(...)` from the same source file. Productionizing the textual transform would add AST/codegen, source-map, HMR, and TypeScript-resolution obligations for no capability A lacks.

C proves Vite 8/Rolldown eventually tree-shakes the server implementation from the emitted client chunk, but only after traversing 1,139 modules and emitting a large wall of Node-externalization warnings. A server-only mis-import still builds and then fails in the browser. Final-byte cleanliness is not a sufficient boundary.

## Prototype layout

- `shared/query-core.ts`: client-safe `Query`, `defineQueries`, and `implement` type/runtime proof.
- `shared/gh.schemas.ts`: the single schema source used in all variants.
- `variant-a/`: `gh.query.ts` plus `gh.provider.ts`.
- `variant-b/`: one `gh.provider.ts` plus `provider-client-plugin.ts`, which redirects client imports to a virtual descriptor-only module and rejects server-only named imports.
- `variant-c/`: one guarded `gh.provider.ts` using `import.meta.env.SSR`.

Every `gh.provider.ts` imports both `@effect/platform-node` and `node:child_process`; its handler uses both. Every app binds `gh.ops.pullRequest`, passes the inferred `{ repo, pr }` payload, and reads inferred `value.repository`, `value.number`, and `value.title`. The shared strict TypeScript build is the ergonomics proof; no cast or `any` is used.

## Measured comparison

Vite 8.2.2 production client builds, one emitted JS chunk per clean variant. Raw/gzip are exact byte counts from `bun run measure`; gzip is computed over the emitted JS file.

| Mechanism | Modules transformed / observed build time | Client JS raw / gzip | `child_process` | `NodeServices` | `platform-node` | Mis-import behavior | `provider.ops.pullRequest` types | App-local `providers/*` fit |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| **A. Convention split** | 194 / 1.16 s | **60,936 / 20,670 B** | absent | absent | absent | Vite alone accepts a direct `.provider.ts` import and produced a 1,520.22 kB / 422.47 kB chunk with Node warnings. The prototype `vista-check.ts` rejects it before build with a precise path/message. | Full payload/value/error inference from `gh.query.ts`. | Colocate `providers/foo.query.ts` and `providers/foo.provider.ts`; server discovery loads only the provider, app imports only the query. |
| **B. Vite virtual transform** | 194 / 1.02 s on final run | **60,936 / 20,670 B** | absent | absent | absent | `ghCore` import fails in the Vite transform after 3 modules / 76 ms: `server-only export(s) ghCore cannot be imported ... in a Vista client module`. | Full inference only because `gh` is already the descriptor export. A transform cannot safely change the TypeScript type of an all-in-one `gh`. | One app-local `.provider.ts` file works when every draft, publish, collector, and debug client graph uses the plugin. More magic and more integration points. |
| **C. `import.meta.env.SSR` guard** | 1,139 / 5.16 s | **61,054 / 20,704 B** | absent | absent | absent | Mis-import build succeeds (60.88 kB / 20.61 kB). Playwright reports `TypeError: Cannot read properties of undefined (reading 'pullRequest')` at runtime. | `gh.ops.pullRequest` stays fully typed, but `ghCore` is merely optional; a non-null assertion defeats the warning. | One file, but every app-local provider pollutes client graph traversal and warnings; side effects or less tree-shakeable imports can become shipped code. |

A and B produce byte-identical clean chunks. C's final chunk is only 118 raw / 34 gzip bytes larger, so the failure is not emitted size; it is graph correctness, diagnostic noise, build work (1,139 versus 194 modules), and runtime-only misuse detection.

## Authored surface

### A — recommended

Provider/query author writes the wire contract once in the client-safe half:

```ts
// providers/gh.query.ts
export const gh = defineQueries({
  id: 'gh',
  operations: {
    pullRequest: {
      payloadSchema: PullRequestArgs,
      successSchema: PullRequestData,
      errorSchema: GhError,
    },
  },
})
```

The server half imports that value and supplies only behavior/dependencies:

```ts
// providers/gh.provider.ts
import * as NodeServices from '@effect/platform-node'
import { spawn } from 'node:child_process'
import { gh as ghQueries } from './gh.query.ts'

export { GhError, PullRequestArgs, PullRequestData } from '../../../shared/gh.schemas.ts'
export const ghCore = { pullRequest }
export const ghProvider = implement(ghQueries, ghCore)
```

The re-export is optional discoverability; both halves import the same `gh.schemas.ts`, so no schema is duplicated. App code has one stable import and unchanged Query usage:

```ts
import { gh } from './providers/gh.query.ts'

<Query of={gh.ops.pullRequest} args={{ repo, pr }}>
  {({ value }) => <PullRequestCard title={value.title} />}
</Query>
```

### B — transform proof

The source file defines `ghQueries`, exports `gh = ghQueries` as its client contract, then places `ghCore` and `ghProvider = implement(...)` in the server section. The Vite plugin redirects `*.provider.ts` client imports to `\0vista-client-provider:<absolute path>`, removes server imports/core, rebases relative imports, and rejects named imports other than `gh`.

This works, but it is important that the source-level `gh` is descriptor-typed. Rewriting `export const gh = implement(...)` to `ghQueries` only at bundle time is runtime-correct but type-unsound. A production B would need a proper AST or generated-module protocol, explicit client export metadata, matching `.d.ts` resolution, HMR invalidation, and the same transform installed in draft, publish, collector, and debug paths.

### C — guard proof

```ts
const pullRequest = /* handler referencing NodeServices and spawn */
export const ghCore = import.meta.env.SSR ? ({ pullRequest } as const) : undefined
export const gh = ghCore === undefined ? ghQueries : implement(ghQueries, ghCore)
```

Rolldown substitutes the client `SSR` constant and removes the handler from final output. It still resolves and transforms the complete `@effect/platform-node` closure before tree-shaking, and a consumer can reach an undefined server export at runtime.

## Recommended production API shape

```ts
type BoundarySchema = Schema.Codec<unknown, unknown, never, never>

type OperationSchemas<
  TPayload extends BoundarySchema,
  TSuccess extends BoundarySchema,
  TError extends BoundarySchema,
> = {
  readonly payloadSchema: TPayload
  readonly successSchema: TSuccess
  readonly errorSchema: TError
}

type Query<TArgs, TValue, TError> = {
  readonly providerId: string
  readonly tag: string
  readonly payloadSchema: Schema.Codec<TArgs, unknown, never, never>
  readonly successSchema: Schema.Codec<TValue, unknown, never, never>
  readonly errorSchema: Schema.Codec<TError, unknown, never, never>
  readonly rpc: Rpc.Rpc<string, BoundarySchema, BoundarySchema, BoundarySchema>
}

declare const defineQueries: <
  const TOperations extends Readonly<Record<string, OperationSchemas<BoundarySchema, BoundarySchema, BoundarySchema>>>,
>(input: {
  readonly id: string
  readonly operations: TOperations
}) => QueryProvider<TOperations> // { id, group, ops: mapped Query values }

type HandlersFor<TOperations, TRequirements> = {
  readonly [TTag in keyof TOperations]: (
    args: PayloadOf<TOperations[TTag]>,
  ) => Effect.Effect<SuccessOf<TOperations[TTag]>, ErrorOf<TOperations[TTag]>, TRequirements>
}

declare const implement: <const TOperations, TRequirements>(
  queries: QueryProvider<TOperations>,
  handlers: HandlersFor<TOperations, TRequirements>,
) => ImplementedProvider<TOperations, TRequirements>

// Optional server-only spelling; it must not be exported from the client entrypoint.
declare const defineProvider: <const TOperations, TRequirements>(input: {
  readonly queries: QueryProvider<TOperations>
  readonly handlers: HandlersFor<TOperations, TRequirements>
}) => ImplementedProvider<TOperations, TRequirements>
```

`QueryProvider` owns the RPC group/descriptors and all boundary Schemas. `ImplementedProvider` adds handler Layer/core and in-process execution. The query client, semantic collector, snapshot reader, and app import only `QueryProvider`; freeze/publish/server import `ImplementedProvider`. `defineProvider` should be server-only sugar, not the source of descriptors.

The exact production implementation should retain the base prototype's `Rpc.make`/`RpcGroup`, schema decoding, and handler Layer construction. This derisk intentionally reduced those internals to isolate module-graph behavior; it did not propose replacing Effect RPC.

## `vista check` and runtime-policy enforcement

Current `classifyVistaClientImport` calls every relative import `local`, so `./providers/gh.provider.ts` passes classification even though its resolved module is server-only. Extend the same typed classifier/plugin boundary rather than adding an unrelated lint:

1. Resolve client imports, then classify any `*.provider.{ts,tsx}` target as `server-module`, not generic `local`; reject it with the decision-0045 tagged diagnostic and guidance to import the adjacent `*.query.ts`.
2. Validate the complete transitive closure of every `*.query.{ts,tsx}`: no `node:` builtin, `@effect/platform-node`, service-private alias, `.provider.*`, or module classified server-only.
3. Apply the same classifier in source pre-scan (`vista check`/`vista debug imports`), Vite draft `resolveId`, semantic collection, and publish. Draft must fail on the first edit, not only in a production build.
4. Require app-local discovered implementations to match `providers/*.provider.ts`; permit their descriptors at `providers/*.query.ts`. Discovery imports implementations server-side only.
5. Check provider ids and operation tags for uniqueness and require implementation handler keys to exactly match descriptor keys. TypeScript handles authored code; runtime discovery must also report a typed mismatch for generated/dynamic cases.
6. Reject client re-exports that tunnel a provider module through a differently named local file; enforcement must use the resolved module graph, not suffix matching only at the direct app import.
7. Optionally assert emitted client chunks contain no known server module ids/builtins as a publish defense-in-depth check, but do not use byte grep as the primary boundary.

## Effect levers, composition, and snapshot consequences

- Exercised: Schema-first payload/success/error contracts; Effect-valued typed handlers; the separation between query metadata and implementation requirements.
- Not re-exercised: live RPC transport, Layers, retries, streams, derived/dependent query execution, and frozen hydration. They are unchanged from the base query prototype and were outside this module-boundary question.
- Composition remains on `Query` values. A descriptor-only `gh.ops.pullRequest` has the same provider id, tag, Schemas, and RPC identity as the implemented provider, so server-side derived queries and client-side pure projections do not acquire a second identity.
- Snapshot keys remain `snapshotKey(providerId, tag, args)` and schema fingerprints remain based on the same success Schema. A/B/C add **zero bytes** to `snapshot.json`; the size measurements above are client JavaScript only.
- Dependent query collection remains the base prototype's separate open question. None of these split mechanisms makes data available during the Node semantic render, and no mechanism here should be credited with solving it.

## Reproduction

From `tmp/vista-data-bakeoff/derisk/client-split/`:

```sh
bun run typecheck
bun run build
bun run measure
bun run check:a
bun run check:a:mis-import                 # expected exit 1
VISTA_MISIMPORT=1 bun run build:a          # succeeds, demonstrates convention needs check
VISTA_MISIMPORT=1 bun run build:b          # expected plugin failure
VISTA_MISIMPORT=1 bun run build:c          # succeeds; produces dist-misimport
../../../../node_modules/.bin/vite preview --config variant-c/vite.config.ts --outDir dist-misimport --host 127.0.0.1 --port 4188
playwright-cli -s=client-split-c open http://127.0.0.1:4188/mis-import.html
playwright-cli -s=client-split-c console
```

Observed clean builds all rendered `gh.pullRequest:{"repo":"schickling/dotfiles","pr":2910}` in Playwright. The only clean-page console error was the disposable pages' missing favicon. The C mis-import console contained the expected `Cannot read properties of undefined (reading 'pullRequest')` error.

## What could not work

- A without an enforced client-graph rule is only naming discipline; Vite happily bundles a mis-import and its large Node closure.
- B cannot safely turn an all-in-one implemented `gh` into a descriptor-only `gh` using only a Vite runtime transform, because TypeScript resolves the untransformed source type. It needs source-level separate exports or generated/conditional type resolution; once that split exists, A is simpler.
- The proof plugin uses explicit markers and a narrow import parser. It demonstrates the hook and failure timing, not a production parser. Regex source surgery must not ship.
- C's clean final bytes do not prove a clean graph. It incurs 945 extra transformed modules, Node externalization diagnostics, and runtime failure for server-export misuse. Tree-shaking is an optimization, not a server/client capability boundary.
