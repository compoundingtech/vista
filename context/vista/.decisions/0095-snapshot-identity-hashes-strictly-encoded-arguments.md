# Snapshot identity hashes strictly encoded arguments

Status: accepted

## Context

A Snapshot entry must identify one Provider invocation across collection, capture, and hydration. Decoded values such as Date objects do not have a stable JSON representation, automatic schema fingerprints are not compatibility promises, and old AppVersions are normally short-lived enough that negotiation machinery costs more than it protects.

## Evidence and Argument

The [snapshot identity experiment](../02-medium/03-data-sources/.experiments/2026-09-19-snapshot-identity.md) proves that payload Schema encoding preserves Date, brands, transforms, and recursive object-order stability before hashing; it also demonstrates collisions and false incompatibilities in JSON-Schema projection fingerprints. The [Effect idiom audit](../02-medium/03-data-sources/.experiments/2026-09-19-effect-idiom-audit.md) proves strict decoding and frozen fallback across snapshot, live response, stream event, and hibernated state boundaries.

## Options

| Option | Tradeoffs |
| --- | --- |
| Hash canonical Schema-encoded args; strict decode; reload or re-publish on mismatch | Small, deterministic, and fail-closed; deliberately provides no long-lived compatibility negotiation |
| Add authored contract and state versions | Makes compatibility explicit but adds author policy, negotiation, and re-keying machinery for short-lived AppVersions |
| Include an automatic JSON-Schema fingerprint | Detects some shape changes but collides across transforms and rejects compatible optional additions |

## Decision

The snapshot key is the lowercase SHA-256 digest of canonical JSON for `[providerId, rpcTag, encodedArgs]`, where `encodedArgs` is produced by the authored Rpc payload Schema before canonicalization. Canonical JSON recursively sorts object keys, preserves array order, accepts only JSON values, and rejects unsupported values with a typed error. AppVersion identity, mode, refresh interval, cursor, capture time, and schema fingerprints are not key material.

The Snapshot envelope, every entry, encoded arguments, encoded success value, live response, stream event, and persisted LiveOverlay record decode with the AppVersion-bundled Schema and `onExcessProperty: 'error'`. A live or stream mismatch becomes typed `SchemaMismatch`; the Block retains its frozen value and states that reload or re-publication is required. A mismatched hibernated record is discarded and resynchronized. Frozen absence remains a distinct typed error.

There is no operation-version negotiation, compatibility arm, legacy decoder, schema fingerprint, or migration layer. A changed contract is resolved by reloading a matching AppVersion or publishing a new one.

## Consequences

- Equivalent encoded invocations deduplicate regardless of authored object property order.
- Hashes reveal no raw arguments and remain fixed-width for telemetry.
- Strict excess-property rejection prevents silent drift that Effect's default decoding would otherwise tolerate.
- Compatibility across independently evolving, long-lived AppVersions is intentionally not provided.

## Verification

Conformance covers nested object order, arrays, Date and transform encoding, rejection of non-JSON encoded values, exact key agreement across collector/publisher/browser, strict extra and missing fields at every boundary, live mismatch retaining frozen previous success, hibernated mismatch resynchronization, and absence of compatibility fallback code.