# OMP Usage provider derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/omp-usage/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Whether Provider-side Effect composition preserves OMP Usage trust semantics and typed degraded outcomes.

## Method

A real HTTP Layer combined health and lens reads, enforced freshness and coverage policy, published snapshots, and exercised alternate Layers for every typed outcome.

## Result

Domain-named composition belongs in one server Operation with one identity; trust states remain typed successes and transport/decode failures remain typed errors.

## Conclusion

Domain-named composition belongs in one server Operation with one identity; trust states remain typed successes and transport/decode failures remain typed errors.

## VRS Impact

Use server Operations for durable named behavior and keep policy out of Blocks.

## Source Report

# OMP Usage provider derisk

## Result

The query candidate can keep OMP Usage trust semantics in Effect-native provider logic. The working slice has an `OmpUsage` service, a live Layer over Effect `HttpClient`, schemas at the HTTP/RPC/snapshot boundaries, typed degraded success, bounded retry/timeout/spans, Layer-substitution tests, static publish, and independent browser refresh.

The important result is not merely that the HTTP request works. `lensChecked` is the read policy: it concurrently reads `/health` and the lens, finds the exact lens/window generation, applies the window freshness horizon, applies the fixed `0.95` gate to `coverage.account_share`, and represents HTTP 503 as `unmaterialized`. UI code exhaustively branches on `_tag`; it never reconstructs those rules from prose.

## Effect levers exercised

| Lever | What this slice exercised | Result |
| --- | --- | --- |
| 1 — services/Layers | `OmpUsage` is a `Context.Service`; `OmpUsageLive` is a Layer over `FetchHttpClient.layer`. `makeOmpUsageProvider(layer)` accepts a real replacement Layer. Every operation's handler retains an `OmpUsage` requirement until `defineProvider` supplies its declared Layer. | Works. The same provider contract ran against the live HTTP Layer and a canned alternate Layer. |
| 2 — query composition (light) | `projectDrilldown` uses concurrent `Effect.zip` over checked `spend_by_project@7d` and `spend_by_worktree@7d`, then projects the pair to repository rows and explicit `unDrilled` names. | Works as a server-derived operation and creates one derived snapshot entry. The base query substrate still lacks a first-class `Query.zip`; recommended API below. |
| 4 — typed outcomes | `LensChecked` is `ok | below-gate | stale | unmaterialized`. Network, HTTP (except 503), timeout, and decode failures are `OmpUsageError` on the Effect error channel. | Works through RPC/snapshot/browser. Four alternate-Layer tests cover every success tag. |
| 6 — resilience/observability | Each HTTP call uses `Effect.timeout`, exponential `Schedule` bounded to two retries, retry only for transient failures, and `vista.provider.omp-usage.*` spans. Base URL comes from `Config`; a hypothetical unused token is loaded by `Config.redacted` into `Redacted<string>`. | Compiles and runs against the live service. 503 is intentionally a success and therefore is not retried. |

## Real envelope inspected

The required live reads were made against loopback on dev3:

```sh
curl -s 'http://127.0.0.1:41031/api/v1/lens/spend_by_project?window=7d' | head -c 3000
curl -s 'http://127.0.0.1:41031/health'
curl -s 'http://127.0.0.1:41031/api/v1/lens/usage_over_time?window=30d&group_by=model' | jq '{top_keys: keys, row: .rows[0], rows: (.rows|length)}'
```

Observed evidence at implementation time:

- `spend_by_project@7d`: `coverage.account_share=0.999997902005272`, `coverage_gate=0.95`, `coverage_ok=true`, and 50 rows in the materialized generation.
- `/health`: `lens_version=7`, `schema_version=5`, `ledger_rows=744451`; exact generations existed for `spend_by_project@7d`, `spend_by_worktree@7d`, and `usage_over_time@30d`.
- `usage_over_time@30d&group_by=model`: 4,520 rows. A row includes `bucket`, `bucket_start`, `group`, `group_by`, `token_type`, `tokens`, `usd`, component USD fields, request/turn/prompt counts, session-start counts, `partial`, and omitted-bucket count.
- The shared envelope Schema consumes only the stable envelope, coverage, provenance, optional filter, and `rows`. Lens-specific rows are deliberately `Schema.Array(Schema.Record(Schema.String, Schema.Unknown))`; rendering uses checked accessors for the few fields consumed.

## Authored surface

Provider author — service construction owns health/lens composition and read rules:

```ts
export interface OmpUsageService {
  health(): Effect.Effect<Health, OmpUsageError>
  lens(args: LensArgs): Effect.Effect<LensRead, OmpUsageError>
  lensChecked(args: LensArgs): Effect.Effect<LensChecked, OmpUsageError>
}

export class OmpUsage extends Context.Service<OmpUsage, OmpUsageService>()('OmpUsage') {}

const lensChecked = Effect.fn('vista.provider.omp-usage.lensChecked')(function* (args) {
  const [health, read] = yield* Effect.all([source.health(), source.lens(args)], { concurrency: 2 })
  // 503/unmaterialized, generation freshness, then 0.95 account_share gate
})
```

Provider registration exposes the raw and composed operations through the generic substrate:

```ts
export const makeOmpUsageProvider = (layer: Layer.Layer<OmpUsage>) => defineProvider({
  id: 'omp-usage',
  purity: 'effectful',
  operations: {
    health: operation({ payloadSchema: Empty, successSchema: Health, errorSchema: OmpUsageError, layer, handler }),
    lens: operation({ payloadSchema: LensArgs, successSchema: LensRead, errorSchema: OmpUsageError, layer, handler }),
    lensChecked: operation({ payloadSchema: LensArgs, successSchema: LensChecked, errorSchema: OmpUsageError, layer, handler }),
    projectDrilldown: operation({ /* concurrent Effect.zip + projection */ }),
  },
})
```

App author:

```tsx
<SpendByProject window="7d" />
<UsageOverTime window="30d" groupBy="model" />

<Query of={ompUsage.ops.lensChecked} args={{ lens: 'spend_by_project', window }}>
  {({ value, refresh, refreshing, mode }) => /* branch on value._tag */}
</Query>
```

The blocks show a table and browser-safe CSS bars, coverage on every materialized result, and the exact wording “API-equivalent cost, not billed spend.” `ChartBlock` was not imported because its StyleX/Recharts package boundary needs Vista's production transform/plugin setup; pulling that integration into this throwaway would test bundler plumbing rather than the query/provider decision.

## Composition, identity, and snapshot consequences

The mechanism that worked was server composition: `projectDrilldown({window:'7d'})` concurrently invokes the two checked service reads, requires both to be `ok`, and emits only its projection. A repository absent from the globally top-N worktree rows is marked `un-drilled`; absence is not presented as zero branch activity.

Its snapshot identity is:

```text
omp-usage::projectDrilldown::{"window":"7d"}
```

The child query keys are not separately persisted for this composition. That gives the derived value one refresh boundary and prevents the client from observing a mixed-generation pair. If the same source lenses are also rendered directly, as `spend_by_project` is in this demo, the live provider may read it twice during publish; production caching could deduplicate by source key without changing semantic identity.

Final artifact sizes:

- `public/snapshot.json`: 3,720,972 bytes pretty-printed.
- Compact per-entry JSON: `spend_by_project` 20,004 bytes; `usage_over_time` 2,113,571 bytes; `projectDrilldown` 3,804 bytes.
- `public/query-manifest.json`: 812 bytes.

The 4,520-row chronology dominates the snapshot. This proves generic envelope capture works, but production blocks should prefer a typed provider projection when only daily model totals are rendered. A projected operation preserves trust metadata while avoiding multi-megabyte snapshots. The UI filters `bucket='day'` and `token_type='input'`; summing hour/day/week/month rows together would double-count.

## Verification evidence

From this directory:

```sh
../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
../../../../node_modules/.bin/vitest run src/omp-usage.unit.test.ts
bun run publish
PORT=4328 bun src/server.ts
playwright-cli -s=omp-usage-derisk open http://127.0.0.1:4328
playwright-cli -s=omp-usage-derisk snapshot
playwright-cli -s=omp-usage-derisk click <SpendByProject refresh ref>
playwright-cli -s=omp-usage-derisk requests
playwright-cli -s=omp-usage-derisk screenshot --filename browser-proof.png
```

Observed:

- TypeScript completed with no diagnostics.
- Vitest: 1 file, 4 tests passed. The tests create an alternate `OmpUsage` Layer from canned source effects—no method mocks—and run the provider operation through that Layer. Outcomes: `ok`, `below-gate` at `0.949`, `stale` at eight days for a `7d` window, and `unmaterialized`.
- Publish collected exactly three bindings and Vite built 280 modules.
- Frozen boot showed real values: top project `schickling/dotfiles`, `$3236.20` API-equivalent, 37,759 requests; model bars; coverage lines; and 12 explicitly un-drilled repositories.
- Static boot issued `GET /snapshot.json` and no `/_data` call.
- Refreshing only `SpendByProject` issued exactly one `POST /_data/omp-usage/ => 200`; that block changed to `live` while the chronology and derived drill-down remained frozen.
- Visual proof is `browser-proof.png` in this directory.

## What did not work / limits

- A first-class `Query.zip` does not exist in the base prototype. The working implementation therefore registers one server-derived operation and uses `Effect.zip` inside it. This is behaviorally correct and gives the desired one-entry identity, but authoring a derived query still requires provider registration.
- Generic rows preserve forward compatibility and let one `lens` operation serve all lenses, but they move lens-row mistakes to checked projections. Production should add per-lens schemas for stable/high-value lens rows or a typed lens-to-schema registry.
- The live Layer is declared on each operation because that is the smallest extension to the base `defineProvider`. A production provider should declare requirements once and the mount should build/provide the Layer once.
- The demo does not prove retry timing with a failing socket. It does prove the typed policies with an alternate Layer and exercises the live HTTP path; the retry schedule itself is visible and typechecked.
- `ChartBlock` was not browser-safe in isolation without inheriting Vista's StyleX build setup, so minimal semantic HTML/CSS was used.

## Concrete API-shape recommendations

### 1. Degraded success versus error channel

Use degraded success when the request completed and the result carries domain evidence the block must explain. Use the error channel when no trustworthy domain result can be decoded.

```ts
type LensChecked<E> =
  | { readonly _tag: 'ok'; readonly envelope: E }
  | { readonly _tag: 'below-gate'; readonly envelope: E; readonly accountShare: number }
  | { readonly _tag: 'stale'; readonly envelope: E; readonly computedAt: string; readonly window: LensWindow }
  | { readonly _tag: 'unmaterialized'; readonly lens: string; readonly window: LensWindow }

interface OmpUsageService {
  readonly health: () => Effect.Effect<Health, OmpUsageError>
  readonly lens: (args: LensArgs) => Effect.Effect<LensRead, OmpUsageError>
  readonly lensChecked: (args: LensArgs) => Effect.Effect<LensChecked<LensEnvelope>, OmpUsageError>
}
```

Rule: 503, below-gate coverage, and stale/missing generation are typed successes; DNS/socket failure, non-503 HTTP failure, timeout, and Schema decode failure are `Schema.TaggedError`s. Never encode those states as empty rows or strings.

### 2. Provider requirements, Layers, and Config

Declare requirements once per provider, not once per operation, and build the Layer once at mount/publish/server startup:

```ts
interface ProviderDefinition<R, ELayer, Ops extends OperationMap<R>> {
  readonly id: string
  readonly layer: Layer.Layer<R, ELayer>
  readonly operations: Ops
}

declare const defineProvider: <R, ELayer, const Ops extends OperationMap<R>>(
  definition: ProviderDefinition<R, ELayer, Ops>,
) => Provider<Ops>

const ompUsage = defineProvider({
  id: 'omp-usage',
  layer: OmpUsageLive,
  operations: {
    lensChecked: operation({
      payloadSchema: LensArgs,
      successSchema: LensChecked,
      errorSchema: OmpUsageError,
      handler: (args): Effect.Effect<LensChecked, OmpUsageError, OmpUsage> =>
        Effect.flatMap(OmpUsage, (service) => service.lensChecked(args)),
    }),
  },
})
```

`OmpUsageLive` should read `Config.string('VISTA_OMP_USAGE_URL')` and `Config.redacted('VISTA_OMP_USAGE_TOKEN')` during Layer construction. Config/Layer-construction failure is a mount/startup failure; request-time transport and decode failures remain operation errors. Tests replace the complete Layer with `makeOmpUsageLayer(cannedSource, clock)`.

### 3. `Query.zip` and key rule

Add server-derived composition with explicit identity and one encoded output Schema:

```ts
declare const zip: <Args, A, B, C, EA, EB, RA, RB>(
  left: Query<Args, A, EA, RA>,
  right: Query<Args, B, EB, RB>,
  options: {
    readonly id: string
    readonly successSchema: Schema.Codec<C>
    readonly project: (pair: readonly [A, B]) => C
    readonly concurrent?: boolean
  },
) => Query<Args, C, EA | EB, RA | RB>
```

Key rule: a server-derived zip has exactly one durable identity, `derived::<options.id>::<canonical-json(args)>`, and one snapshot entry containing the projected result. Child keys are execution dependencies, not additional manifest entries. `options.id` must be globally stable and explicit; never synthesize identity from function source or display labels. A client-derived zip is a different API: it retains both child entries and has no third durable snapshot entry. For OMP Usage, prefer server-derived zip so both reads occur in one refresh and the browser cannot combine independently refreshed generations.
