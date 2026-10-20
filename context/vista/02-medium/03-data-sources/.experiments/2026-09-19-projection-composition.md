# Disk-index → projection → treemap derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk/treemap/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

When disk-index to treemap derivation should be a server Operation versus a pure client Projection.

## Method

Both paths were published and refreshed against the real semantic-disk-usage snapshot, with snapshot sizes and identity behavior measured.

## Result

A server Operation owns one final snapshot entry; a pure Projection adds no entry and inherits the source key while retaining its own in-memory identity.

## Conclusion

A server Operation owns one final snapshot entry; a pure Projection adds no entry and inherits the source key while retaining its own in-memory identity.

## VRS Impact

Adopt the server-operation/client-map composition rule and require browser-safe pure projection modules.

## Source Report

# Disk-index → projection → treemap derisk

## Result

The slice works against the real 2,174,667-byte `/var/lib/semantic-disk-usage/snapshot.json`. It reuses the existing `decodeSnapshotText`, `projectPerspective`, `degradedReasons`, `DiskIndexError`, `buildTreemapModel`, and `TreemapModelSchema`; it does not reimplement their validation or accounting rules.

Both composition styles publish and boot statically. The left card captures a server-derived `treemap` op. The right card captures `projection` and derives the identical treemap shape in a browser `Atom.mapResult`. Both showed the real snapshot `generation-1789823192486271225-3264038`, branched on the typed `degraded` outcome, and rendered the current partial-health evidence. Boot made zero `/_data` requests. Each refresh made one provider request: tag `treemap` for the server card and tag `projection` for the client card.

## Effect levers exercised

| Lever | Evidence |
| --- | --- |
| 1 — requirements via services/Layers | `DiskIndex` is a `Context.Service`. The raw op effects require `DiskIndex`; `diskIndex.layer` is supplied once by `buildHandler`. `makeDiskIndexFixtureLayer` substitutes the same service contract in Vitest, with the same ops and real decoder. |
| 2 — query composition | Server: `treemapOperation(args) = projectionOperation(args).pipe(Effect.map(toTreemap))`. Client: `clientTreemap = mapQuery(diskIndex.ops.projection, …)` and `Atom.mapResult` derives from the source atom. |
| 4 — typed outcomes | `ready | degraded | failure` are schema-tagged success values. `failure.reason` is `DiskIndexErrorReason`; `degraded.reasons` comes only from the production `degradedReasons`. The component branches on `_tag`, then displays `reason` without string parsing. |
| 6 — resilience/observability | The path is `Config.string('VISTA_DISK_INDEX_SNAPSHOT')` with the production default rule. Every op has `vista.provider.disk-index.<tag>` span; the read has its own span/path annotation. `Effect.cached` is request-local: projection asks for the snapshot twice (projection plus degraded evidence) but the fixture counter records one read. |

## Authored surface

Provider author:

```ts
export class DiskIndex extends Context.Service<DiskIndex, {
  readonly snapshot: Effect.Effect<DiskSnapshot, DiskIndexError>
}>()('VistaDerisk/DiskIndex') {}

const projectionOperation = (args: ProjectionArgs):
  Effect.Effect<ProjectionOutcome, never, DiskIndex> =>
  Effect.gen(function* () {
    const diskIndex = yield* DiskIndex
    const readOnce = yield* Effect.cached(diskIndex.snapshot)
    const snapshot = yield* readOnce
    const projection = yield* projectPerspective(snapshot, args.perspective, args.boundaryId)
    const reasons = degradedReasons(yield* readOnce)
    return reasons.length === 0
      ? { _tag: 'ready', value: projection }
      : { _tag: 'degraded', value: projection, reasons }
  }).pipe(/* typed failure conversion + span */)

const treemapOperation = (args: TreemapArgs) =>
  projectionOperation(args).pipe(Effect.map((value) => toTreemap(value, args)))

export const diskIndex = defineProvider({
  id: 'disk-index',
  layer: DiskIndexLive,
  operations: { snapshot, projection, treemap },
})
```

Client-derived declaration (the prototype function is named `mapQuery`; recommended API spelling is `Query.map`):

```ts
export const clientTreemap = mapQuery(diskIndex.ops.projection, {
  id: 'disk-index.client-treemap',
  payloadSchema: TreemapArgsSchema,
  successSchema: TreemapOutcomeSchema,
  mapArgs: ({ perspective, boundaryId }) => ({ perspective, boundaryId }),
  map: toTreemap,
})
```

App author, for either style:

```tsx
<Query of={diskIndex.ops.treemap /* or clientTreemap */} args={args}>
  {({ value, refresh }) => <TreemapOutcomeView value={value} onRefresh={refresh} />}
</Query>
```

## Composition comparison

Measured from the published real snapshot. Entry byte counts are compact `JSON.stringify(entry)` including entry metadata; `public/snapshot.json` is pretty-printed and contains both entries.

| Property | Server-derived op | Client-derived atom |
| --- | --- | --- |
| Captured source | Final `TreemapOutcome` | `ProjectionOutcome` |
| Snapshot entry bytes | **1,133 B** | **2,078 B** |
| Input file bytes | 2,174,667 B | 2,174,667 B |
| Persisted key | `disk-index::treemap::{"boundaryId":"bulk","lens":{"foldBelowFraction":0.002,"maxDepth":2},"perspective":"tool-artifact"}` | `disk-index::projection::{"boundaryId":"bulk","perspective":"tool-artifact"}` |
| Derived-value snapshot identity | Its own final-value entry/key and `TreemapOutcome` schema fingerprint | **No derived entry.** It inherits the source projection key; lens remains only in the derived atom cache key. |
| Refresh reruns | file read/decode → projection → `toTreemap` on server | file read/decode → projection on server, then `toTreemap` in browser `Atom.mapResult` |
| Pure code location | `src/treemap.ts`, server bundle | the same `src/treemap.ts`, browser bundle; no source duplication |
| Current captured shape | folded treemap with 1 root child | projection with 3 groups, then the same fold locally |

The combined pretty-printed snapshot is 5,444 B. Server derivation is smaller for this lens because fold/depth bounding happens before capture. Client derivation retains the more reusable projection: another local lens can reuse the same source atom and frozen entry without another RPC/snapshot entry.

### Snapshot-key rule proved

`collectBindings` resolves a mapped query to its source binding. Therefore only the source key appears in `query-manifest.json` and `snapshot.json`. At runtime the non-persisted mapped atom is keyed as:

```ts
`${map.id}::${sourceSnapshotKey}::${canonicalJson(derivedArgs)}`
```

This preserves one source fetch/cache identity while keeping two lenses from aliasing in memory. Writing to the mapped atom is forwarded by `Atom.mapResult` to the writable source atom, so refresh calls only the source RPC.

## Typed outcomes

```ts
type Outcome<A> =
  | { readonly _tag: 'ready'; readonly value: A }
  | { readonly _tag: 'degraded'; readonly value: A; readonly reasons: readonly string[] }
  | { readonly _tag: 'failure'; readonly reason: DiskIndexErrorReason; readonly message: string }
```

The provider converts only `DiskIndexError` into `failure`; the `reason` vocabulary remains `missing | unreadable | invalid | unsupported-schema | unknown-boundary`. The RPC contract still declares `DiskIndexError` on its typed error channel, while this block-facing operation deliberately makes expected availability/refusal states renderable success values. The fixture test proves `unknown-boundary` reaches the value unchanged. The real source currently yields `degraded`, and the browser showed its typed banner on both cards.

## Fixture Layer and request-local cache proof

`makeDiskIndexFixtureLayer(fixtureSnapshotText, onRead)` uses the same `decodeSnapshotText` and every production operation. The first Vitest case runs `snapshot`, `projection`, and `treemap` against that Layer. The fixture read counter is exactly 3: one per op, despite `projection` reading its cached effect twice internally. This is intentionally not a process-lifetime cache; separate refresh requests reread the mutable file.

## Commands and observed evidence

From `tmp/vista-data-bakeoff/derisk/treemap/`:

```sh
../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
# clean

../../../../node_modules/.bin/vitest run src/disk-index.unit.test.ts
# 1 file passed, 2 tests passed

bun run publish
# collected 2 source query bindings in Node
# Vite build succeeded

bun src/server.ts
playwright-cli -s=treemap-derisk open http://127.0.0.1:4319
playwright-cli -s=treemap-derisk requests
# GET /snapshot.json only; zero /_data on boot

# click "Refresh Server derived", then "Refresh Client derived"
playwright-cli -s=treemap-derisk requests
# POST /_data/disk-index/ => 200 twice
playwright-cli -s=treemap-derisk request-body 5
# tag: treemap; includes lens
playwright-cli -s=treemap-derisk request-body 6
# tag: projection; excludes lens
```

After both clicks, both cards reported `live`; the model and degraded reasons stayed equal. Static boot showed both as `frozen as of 2026-09-19T13:40:26.855Z` before refresh.

## What did not work / limitations

- Vite warns that `node:fs/promises` is externalized because the provider object still carries server implementation into the client graph. It is dormant and static boot works, but this repeats the base prototype's descriptor/core coupling. Production should generate/export a client-safe descriptor separately from handler code.
- The full production Treemap React block was not imported. This slice uses the production model builder and runtime schema, then renders a minimal ranked treemap-like list so the experiment stays focused on data composition and typed outcomes.
- `Effect.cached` is deliberately scoped to one operation execution. A process-lifetime cache would make per-query refresh fail to observe a new on-disk generation.
- A mapped query cannot have an independently frozen value under the recommended rule. If the mapping itself becomes nondeterministic or needs historical versioning, it must become a server op with its own key/schema fingerprint.

## Concrete API-shape recommendations for the interview

### Provider requirements and Layers

The proven shape keeps the raw op effect honest (`R` is visible) and makes the mount own provision exactly once:

```ts
interface OperationSpec<Payload, Success, Error, R> {
  readonly payloadSchema: Schema.Codec<Payload>
  readonly successSchema: Schema.Codec<Success>
  readonly errorSchema: Schema.Codec<Error>
  readonly handler: (payload: Payload) => Effect.Effect<Success, Error, R>
}
type Operations<R> = Readonly<Record<string, OperationSpec<unknown, unknown, unknown, R>>>


declare function defineProvider<R, const Ops extends Operations<R>>(spec: {
  readonly id: string
  readonly operations: Ops
}): Provider<Ops, R>

declare function mountProvider<Ops, R>(
  provider: Provider<Ops, R>,
  layer: Layer.Layer<R>,
): MountedProvider
```

Preferred production call site:

```ts
const diskIndex = defineProvider({ id: 'disk-index', operations }) // infers R = DiskIndex
const mounted = mountProvider(diskIndex, DiskIndexLive)
const testProgram = diskIndex.ops.treemap.run(args).pipe(Effect.provide(DiskIndexFixture))
```

This is slightly better than the prototype's `defineProvider({ layer: DiskIndexLive, … })`: definition and live wiring remain separate, while tests do not need to replace a baked-in default. If a default is wanted, make it an optional convenience on `mountProvider`, not part of the query descriptor.

### Derived query / `Query.map`

```ts
declare namespace Query {
  function map<SourceArgs, Source, Args, Value>(
    source: Query<SourceArgs, Source>,
    options: {
      readonly id: string
      readonly payloadSchema: Schema.Codec<Args>
      readonly successSchema: Schema.Codec<Value>
      readonly mapArgs: (args: Args) => SourceArgs
      readonly map: (source: Source, args: Args) => Value
    },
  ): DerivedQuery<Args, Value>
}
```

Recommended snapshot contract:

```ts
snapshotKey(derived, args) = snapshotKey(
  derived.source,
  derived.mapArgs(args),
)
// No derived snapshot entry and no derived schema fingerprint.
// In-memory atom key = map id + source key + canonical full derived args.
```

`mapArgs` is required rather than assuming identical args: here `lens` affects only the browser transform and must not fragment projection snapshots or be sent to the projection RPC. `id` must be stable and unique within the app because it separates in-memory derived atoms; changing it does not invalidate the persisted source entry.
