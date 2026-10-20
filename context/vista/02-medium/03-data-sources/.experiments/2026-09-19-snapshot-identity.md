# Snapshot identity and schema evolution derisk — durable evidence

This durable copy records evidence established on 2026-09-19 in the disposable Vista data bakeoff at `tmp/vista-data-bakeoff/derisk2/schema-evolution/REPORT.md`; the working code lived beside that source report and is not part of the VRS.

## Question

How Schema-encoded arguments, hashes, schema projections, and version fields behave across data evolution.

## Method

Three identity schemes were tested on reordered objects, Date, brands, transforms, and five evolution scenarios, including poison-record restart behavior.

## Result

Schema encoding before canonical hashing is required; automatic JSON-Schema fingerprints collide or reject compatible additions. The later settled policy removes compatibility negotiation and relies on strict bundled-schema decode plus reload or re-publish.

## Conclusion

Schema encoding before canonical hashing is required; automatic JSON-Schema fingerprints collide or reject compatible additions. The later settled policy removes compatibility negotiation and relies on strict bundled-schema decode plus reload or re-publish.

## VRS Impact

Use sha256 of canonical Schema-encoded arguments, strict decode at every boundary, typed SchemaMismatch fallback, and no compatibility layer.

## Source Report

# Snapshot identity and schema evolution derisk

## Result

The working slice compares all three candidate identity schemes against the same fixtures and exercises the five required evolution scenarios. The evidence favors **B: Schema-encoded arguments plus an explicitly authored operation `contractVersion`**.

The important separation is:

1. **Invocation identity** hashes the operation and its Schema-encoded arguments. It deduplicates one operation call.
2. **Operation compatibility** is an authored `contractVersion`. It decides whether an immutable old AppVersion may call the currently mounted provider implementation.
3. **Persisted live-state compatibility** is an authored `schemaId` in the durable key. It decides whether folded state and cursor bytes may be decoded after restart.
4. The global `VISTA_API_VERSION` remains the outer, fail-closed platform envelope. It is not a substitute for operation-local compatibility: a global bump has a much larger blast radius, while an old AppVersion can meet a changed provider within one otherwise-current platform build.

Frozen entries continue to decode through the exact success Schema bundled into their AppVersion. Live calls negotiate the operation contract before decoding. A mismatch is a typed `ContractMismatch`; it never becomes a missing value or an empty/default panel.

## Fixture measurements

All schemes first call `Schema.encode(payloadSchema)(args)` and canonicalize the resulting JSON value. This fixes finding 10's decoded-value bug:

| Fixture | Observation |
| --- | --- |
| `gh.pullRequest` with nested `filters` and reordered object keys | All A/B/C keys are stable across top-level and nested key insertion order. Array order remains significant. |
| `Date`-carrying payload | `DateFromString` encodes the decoded `Date` to an ISO string. Equal instants have equal keys; `08:00Z` and `09:00Z` have different keys. Canonicalizing the decoded `Date` directly would reduce both to `{}`. |
| Branded + transformed payload | The branded repository id encodes to a string and the `string | int -> int` transform encodes to an integer before hashing. No custom prototype or brand implementation detail enters identity. |
| Invalid encoded JSON | The canonical writer rejects `undefined`, `bigint`, symbols, functions, non-finite numbers, symbol keys, custom prototypes, and cycles with typed `CanonicalJsonError`; it does not silently coerce them. |
| Semantic transform collision in C | A cents transform and a milliseconds transform both project to the same JSON Schema and therefore have the same 64-hex projection fingerprint and the same C key. B distinguishes them when their authored versions differ. |

Every key retains the readable `providerId::tag` prefix. The opaque component is a full 256-bit SHA-256 digest:

```text
A  gh::pullRequest::sha256-<64 hex>
B  gh::pullRequest::v1::sha256-<64 hex>
C  gh::pullRequest::schema-<12 hex display suffix>::sha256-<64 hex>
```

The C display suffix is only diagnostic; the complete fingerprint participates in its final digest.

## A/B/C comparison

| Property | A — encoded payload, no schema identity | B — A + authored `contractVersion` | C — A + JSON-Schema projection fingerprint |
| --- | --- | --- | --- |
| Key material | `[providerId, tag, encodedArgs]` | `[providerId, tag, contractVersion, encodedArgs]` | `[providerId, tag, successProjectionFingerprint, encodedArgs]` |
| Argument order / transforms / `Date` | Stable and correct | Stable and correct | Stable and correct |
| Cryptographic collision resistance | SHA-256; practical hash collision negligible | SHA-256; practical hash collision negligible | SHA-256; practical hash collision negligible |
| Semantic collision | Deliberately aliases schema generations | Only if an author fails to bump a breaking contract | **Observed:** distinct Effect transforms can have identical JSON-Schema projections |
| Readability | Provider/tag readable; compatibility invisible | Provider/tag/version readable | Provider/tag readable; schema token opaque |
| Breaking required result field | Cannot identify drift; old default decoder accepts and drops the new field | Version bump gives typed `ContractMismatch` | Projection changes and gives typed mismatch |
| Additive optional result field | Old decoder remains compatible | Keep version unchanged; old decoder remains compatible | Projection changes, causing a false `ContractMismatch` |
| Operational requirement | Safe only for self-contained frozen decode, or with a separate live compatibility mechanism | Small explicit policy surface; reviewable | Incidental Effect-to-JSON-Schema projection becomes a compatibility API |
| Recommendation | Insufficient for Vista's old-AppVersion/live-provider case | **Adopt** | Reject as contract identity |

B is not “schema hash by hand.” `contractVersion` is compatibility policy. It MUST increase for a breaking payload/success/error/live semantic change. It SHOULD remain unchanged for a backward-compatible additive optional result field. The review burden is real, but unlike C it reflects the compatibility promise Vista actually needs.

## Evolution scenario results

| Scenario | A | B | C |
| --- | --- | --- | --- |
| (i) Old AppVersion, unchanged provider | Frozen OK; live OK | Frozen OK; live OK | Frozen OK; live OK |
| (ii) Provider adds required success field | Frozen OK. Live decodes and drops the new field under Effect's default excess-property behavior, so A cannot prove compatibility. | Frozen OK. Provider v2 versus bundled v1 returns typed `ContractMismatch`. | Frozen OK. Changed projection returns typed mismatch. |
| (iii) Provider adds optional success field | Frozen/live OK; old reader drops the optional field. | Frozen/live OK when version remains v1. | Frozen OK; live is needlessly rejected because the projection changed. |
| (iv) Restart after folded state schema changes | Snapshot identity alone is insufficient; the required separate state `schemaId` causes a miss/resync. | Explicit state schema id/version causes a miss/resync; decode remains a defense in depth. | Detects this structural fixture, but can miss transform-only semantic changes just as above. |
| (v) Same operation/args in two AppVersions | With `(appVersionId, schemaId, snapshotKey)`, no durable state sharing. | Same | Same |

The test additionally poisons the new v2 live-state key with v1 bytes. Wake rejects the required-field decode, calls the upstream full-resync effect, persists only the v2 value, and reports `{ _tag: 'Resynced', reason: 'decode-failed' }`. No partially decoded state is observable.

## Recommended signatures and rules

```ts
interface ProviderOperation<R extends Rpc.Any> {
  readonly providerId: string
  readonly rpc: R
  readonly contractVersion: NonNegativeInt
}

const encodeBinding: <R extends Rpc.Any>(
  operation: ProviderOperation<R>,
  args: Rpc.Payload<R>,
) => Effect.Effect<{
  readonly encodedArgs: R['payloadSchema']['Encoded']
  readonly key: SnapshotKey
}, Schema.SchemaError | CanonicalJsonError>

const snapshotKey: <R extends Rpc.Any>(input: {
  readonly providerId: string
  readonly tag: R['_tag']
  readonly contractVersion: NonNegativeInt
  readonly encodedArgs: R['payloadSchema']['Encoded']
}) => Effect.Effect<SnapshotKey, CanonicalJsonError>

const liveStateKey: (input: {
  readonly appVersionId: AppVersionId
  readonly schemaId: LiveStateSchemaId
  readonly snapshotKey: SnapshotKey
}) => LiveStateKey
```

The exact B digest input is canonical JSON of `[providerId, tag, contractVersion, encodedArgs]`; the readable prefix is not the authority. `encodeBinding` MUST Schema-encode before keying. Capture MUST persist encoded args and encoded success, and every frozen read MUST decode the entry with the AppVersion's bundled payload/success Schemas.

A live request/response MUST carry `{ providerId, tag, contractVersion }`. The service compares the AppVersion's expected tuple with the mounted provider's actual tuple before treating a response as compatible:

```ts
class ContractMismatch extends Schema.TaggedError<ContractMismatch>()('ContractMismatch', {
  providerId: Schema.String,
  tag: Schema.String,
  expected: Schema.String,
  actual: Schema.String,
  message: Schema.String,
}) {}
```

`DataError<E>` should include `ContractMismatch`. If a refresh fails this check, `AsyncResult` may retain the prior frozen/previous success as presentation state, but it MUST expose the typed failure. It MUST NOT replace the panel with blank/default data.

### Persisted live-state rule

Use the Q4 key exactly as an ownership and compatibility boundary:

```text
(appVersionId, liveStateSchemaId, snapshotKey)
```

`liveStateSchemaId` MUST be explicitly authored/versioned for the folded state plus cursor schema. It MAY equal the operation `contractVersion` when those contracts are intentionally coupled; it MUST be separate when a subscription folds events into a different state shape.

Wake performs an exact-key lookup, then decodes the complete persisted record before publishing any value. A key miss or decode failure triggers an upstream full-state resync and writes a fresh record. It never publishes a partially decoded record.

Omitting `appVersionId` to use `(schemaId, snapshotKey)` does permit compatible AppVersions to share hibernated bytes; the test proves that alternate key restores successfully. Do not use it as the default. AppVersion scope owns authorization, retirement, retention, metrics attribution, and teardown. Cross-version durable sharing entangles those lifecycles and lets one version's cursor/history policy leak into another. Deduplicate active provider execution separately if needed; keep durable records version-owned.

## `vista check` enforcement

`vista check` should fail when:

1. an operation lacks a non-negative authored `contractVersion`;
2. a live/subscription operation lacks an authored folded-state `schemaId`;
3. a provider implementation's `{ providerId, tag, contractVersion }` does not match its imported client-safe contract;
4. an operation reuses a published version after a **breaking** payload/success/error semantic change;
5. a live-state schema changes incompatibly without changing `schemaId`;
6. a payload cannot encode to canonical JSON, or includes an unsupported/custom encoded representation;
7. a snapshot/live-state reader bypasses the operation/state Schema decode;
8. the generated contract manifest drifts from the authored RPC-first contract.

A JSON-Schema diff MAY help classify obvious structural changes, but MUST NOT author the identity. Required-field additions/removals and wire type changes require a version bump. An additive optional success field may retain the version after the compatibility check. Transform/refinement changes require explicit author review because JSON Schema cannot reliably classify them.

## Publish and service enforcement

Publish should:

1. Schema-encode args before computing B's key;
2. capture the operation tuple and encoded args/value in the manifest/entry;
3. self-decode each captured entry with the bundled Schemas before committing it;
4. retain the current global API envelope and its existing fail-closed `VersionSkew` behavior;
5. reject duplicate keys whose full encoded contract/args differ;
6. emit the operation and live-state ids needed by the standing service.

The standing service should:

1. reject a live call with typed `ContractMismatch` before returning provider data when the mounted operation tuple differs;
2. address persisted state by `(appVersionId, schemaId, snapshotKey)`;
3. decode the entire state/cursor record before making it visible;
4. full-resync and overwrite only the current key on miss/decode failure;
5. keep old immutable frozen entries readable by their old AppVersion and bundled decoder.

## Evidence

Run from this directory:

```sh
../../../../node_modules/.bin/tsc -p tsconfig.json --noEmit
# clean

../../../../node_modules/.bin/vitest run src/schema-evolution.unit.test.ts --reporter=verbose
# 1 file passed; 7 tests passed
```

The seven tests cover encoded identity for nested order, `Date`, brand and transform; key readability and a measured projection collision; and scenarios (i)–(v), including the typed live mismatch, additive compatibility, restart resync, poison-record defense, and the AppVersion-sharing tradeoff.
