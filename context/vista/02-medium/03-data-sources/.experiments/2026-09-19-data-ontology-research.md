# Vista data-layer vocabulary draft — grounds Q6 (public authoring surface + terms) — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk2/ONTOLOGY-DRAFT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

Which terms cleanly separate Provider contracts, implementations, operations, bindings, liveness, and client results without introducing Query.

## Method

The draft reconciled existing Vista ontology and decisions with every bakeoff report and critique finding, then compared three public-surface options.

## Result

The term system distinguishes ProviderContract, ProviderImplementation, Operation, BindingPolicy, LiveDriver, Projection, DependentBinding, Resolved, LiveOverlay, and DataRuntime; domain Blocks remain the only public surface.

## Conclusion

The term system distinguishes ProviderContract, ProviderImplementation, Operation, BindingPolicy, LiveDriver, Projection, DependentBinding, Resolved, LiveOverlay, and DataRuntime; domain Blocks remain the only public surface.

## VRS Impact

Adopt these internal terms and their Avoid lists; keep Query absent and amend Provider, DataBinding, Snapshot, and Structure.

## Source Report

# Vista data-layer vocabulary draft — grounds Q6 (public authoring surface + terms)

Sources: `context/vista/ontology.md` (existing terms); `tmp/vista-data-bakeoff/DERISK2-CONTEXT.md` (Q1–Q4 + settled vocab); `derisk/CRITIQUE.md` findings 1/2/4/5/6/7; report tails `derisk/lifecycle` (LiveDriver, overlay, 0075), `derisk/realtime-checks` (subscription, catch-up), `derisk/trace-chain` (flatMap identity), `derisk/treemap` (map key rule), `derisk/client-split` (*.query.ts/*.provider.ts), `derisk/o11y` (hashed-arg keys); decisions 0027 (VST-R01 "viewers author no queries"; DataBinding/Provider/Snapshot "not a public authoring surface"), 0031/0075 (frozen immutability), 0087 (read-only PR viewer).

## Term system

Anchors: **Provider** (leitwort *Provider*), **DataBinding** (leitwort *Binding*), plus one liveness leitwort *Live* spanning declaration → mechanism → state → observation. Modes are declarations; Resolved tags are observations.

| Term | Definition | Avoid | Structure |
|---|---|---|---|
| **ProviderContract** | Client-safe half of a Provider: `contract({ id, group })` with derived `.ops.<tag>`; the only Provider value a Block may import (client-split; CRITIQUE f7) | ProviderDefinition, QueryProvider, ImplementedProvider, descriptor module | partOf Provider |
| **ProviderImplementation** | Server-only realization: `implement(contract, { purity, handlers, live? })`, wired once by `mountProvider(impl, layer)` (treemap/lifecycle) | ImplementedProvider, defineProvider output, provider object | partOf Provider; dependsOn ProviderContract |
| **Operation** | One typed capability of a ProviderContract, named by its RPC tag (`Rpc._tag`); schemas + stream shape come from the Rpc, never a handler (CRITIQUE f1/f2) | Query, OperationSpec, op (in durable types; fine as `.ops` accessor), rpc, procedure | partOf ProviderContract; selected by DataBinding |
| **DataBinding** (amend) | The immutable `(Operation, canonical args, BindingPolicy)` record attached to its owning SemanticNode | existing Avoid + BoundQuery, invocation, query | derived by typed Block (edge unchanged) |
| **BindingPolicy / BindingMode** | Author-declared policy: `mode: frozen (default) \| live \| subscription` + effectful-capture ack (0031). frozen = captured at publish, never live; live = snapshot paint + refresh; subscription = snapshot + auto stream catch-up; drafts resolve live (Q2) | capture options, refresh flag, realtime/streaming mode, cached/static | partOf DataBinding |
| **bind** | Constructor `bind(operation, args, policy?) → DataBinding`; Block-internal unless Q6 opens it (CRITIQUE f1 alt B) | useQuery, query(), `of=` | makes DataBinding |
| **LiveDriver** | Server-only mechanism advancing a live/subscription binding: `pollable { initial, poll, fold, cursor }` \| `subscribable { initial, stream, fold, cursor }`; shared per snapshotKey, viewer-counted (lifecycle) | Poller, Watcher, StreamOperation, subscription, hub (debug surface only) | partOf ProviderImplementation (`live` field) |
| **Projection** | Pure client derivation `Operation.map(op, { id, mapArgs, map })`; no Snapshot entry, inherits the source snapshotKey; `mapArgs` keeps lens args out of the key (treemap) | DerivedQuery, DerivedValue, derived binding, client map, useMemo | derives from Operation; no Provider call |
| **DependentBinding** | Declared escape hatch `Operation.flatMap(op, select, { id, successSchema })`; isa DataBinding whose capture stores constituent entries + SemanticManifest edge; `key = parent::flatMap::id` (trace-chain). Prefer a named server Operation for durable chains (Q3) | chained/nested query, DerivedQuery, BoundQuery | isa DataBinding; dependsOn source DataBinding |
| **Resolved** | Client success value, provenance-tagged: `Frozen { value, frozenAt }` \| `CatchingUp { value, frozenAt }` \| `Live { value, observedAt }`; failures ride AsyncResult as `DataError<E>`, no error tag (CRITIQUE f6; realtime) | ResolvedData, Result, QueryResult, snapshot value | yielded by useBinding |
| **LiveOverlay** | Service-owned mutable folded state + cursor for live/subscription bindings, keyed `(appVersionId, schemaFingerprint, snapshotKey)`; active → warm (idle TTL) → hibernated → wake; never mutates the static AppVersion (0075; lifecycle) | **live snapshot** (banned — Snapshot is immutable), cache, persisted state, hub state | produced by LiveDriver; consumed by DataRuntime |
| **DataRuntime** | Per-mounted-AppVersion client runtime: decoded Snapshot, data base URL, atom registry; installed via `DataRuntimeProvider`, Scope-owned teardown, no module globals (CRITIQUE f5); hooks `useBinding`, `useBindingSuspense` | QueryClient, registry, bare "runtime", island | partOf AppVersion lifetime |

Snapshot identity (Q8 owns evolution): snapshotKey = `(providerId, tag, sha256(args))`, schemaFingerprint from the success Schema (o11y).

## Flagged clashes

- **`Query` family** (QueryProvider / DerivedQuery / StreamQuery / QueryClient in the reports): absent from the ontology; 0027 pins VST-R01 and "None is AppSource configuration or a public authoring surface" — every report-era name re-spells onto the table above.
- **Snapshot vs LiveOverlay**: "live snapshot" breaks immutability (0031/0075) — banned in LiveOverlay's Avoid.
- **Provider**: reports used it for a `defineProvider` return; ontology keeps it the umbrella resolver; the two halves get the qualified names.
- **RuntimeIsland ≠ DataRuntime**: island = semantic boundary; runtime = per-version data machinery. Never name the runtime an island.
- **`Live` leitwort appears 4×** (mode / Driver / Overlay / Resolved tag): deliberate family, disambiguated by role — keep, don't rename.
- Normalize realtime's `catching-up` → `CatchingUp` (one spelling).
- **SemanticManifest** keeps DataBinding as its record type; DependentBinding's edge is a manifest record (ontology line unchanged).

## Structure tree (deltas to ontology `## Structure`)

```text
# replaces: typed Block -> DataBinding -> Provider -> Snapshot -> AppVersion
typed Block -> DataBinding -> Provider -> Snapshot -> AppVersion   # Provider = the two halves
Provider -> ProviderContract -> Operation          # client-safe; the only half a Block imports
Provider -> ProviderImplementation -> LiveDriver   # server-only; implement + mountProvider
DataBinding -> BindingPolicy -> BindingMode        # frozen | live | subscription
BindingMode(live|subscription) -> LiveDriver -> LiveOverlay
Operation.map -> Projection                        # no Snapshot; inherits source snapshotKey
Operation.flatMap -> DependentBinding              # isa DataBinding; constituents + manifest edge
AppVersion -> DataRuntime -> useBinding -> Resolved -> RuntimeIsland
```

## Q6 options — public authoring surface

### A — domain Blocks + generic `<Bound>` escape hatch
Adds: `Bound` (generic data Block, public); flips `bind`/`Operation`/`BindingPolicy` to author-facing. `Bound` carries DataBinding's stem without exposing the manifest record type.
```tsx
<PullRequestChecks repo="schickling/dotfiles" pr={2918} />            // default path
<Bound binding={bind(disk.ops.treemap, { root }, { mode: 'live' })}>
  {(r) => <Panels value={r.value} />}
</Bound>
```
Risk: a second collection path unless `Bound` is pure sugar over node-attached DataBinding + `useBinding` (CRITIQUE f1); VST-R01 needs re-reading ("no queries" vs "no author-visible bindings"); policy authoring escapes per-Block governance.

### B — domain Blocks only, no generic component
Adds: zero public terms; one structural rule — an app-local provider ships a companion domain Block beside `providers/*.query.ts` + `*.provider.ts` (client-split discovery shape).
```tsx
<PullRequestChecks repo="schickling/dotfiles" pr={2918} />
<DiskTreemap root="/srv/bulk" />                  // app-local provider's own Block
```
Risk: ceremony — every one-off captured value needs an authored Block; pressure escapes into hand-rolled RuntimeIsland fetches (the un-captured path 0027 forbids); per-provider Block count grows.

### C — `Query` as a public authored concept
Adds: `Query`, `useQuery`, `QueryResult` public; DataBinding/Provider demoted to plumbing beneath them.
```tsx
<Query of={gh.ops.pullRequest} args={{ repo, pr }} mode="live">
  {(q) => <PullRequestViewer data={q.value} />}
</Query>
```
Risk: contradicts 0027/VST-R01 and the ontology's internality lines; conflates RPC definition, binding, and client result (CRITIQUE f1 blocker); imports TanStack cache mental model with no frozen/live provenance; requires amending an accepted decision. Present as reductio only.

**Read for the interview**: B is the faithful default (0027, 0087; realtime's "App author writes only `<PullRequestChecks …/>`"). A is the bounded compromise if app-local one-offs prove common — the crux Q6 must settle: is VST-R01 about *transport* (A survives) or about *any author-visible binding* (B only). C rejected.
