# Data modes are author-declared and snapshot-first

Status: accepted

## Context

A published AppVersion must distinguish data that is intentionally fixed from data that remains current. Treating a frozen value as a cache that a viewer may turn live changes the meaning of a pinned review, while omitting initial values from live surfaces delays first paint and leaves them empty when the service is unavailable.

## Evidence and Argument

The [realtime checks experiment](../02-medium/03-data-sources/.experiments/2026-09-19-realtime-checks.md) proves that a subscription can paint a folded publish-time value, connect automatically, catch up through a cursor, and retain the snapshot when the endpoint fails. The [metric modes experiment](../02-medium/03-data-sources/.experiments/2026-09-19-metric-binding-modes.md) proves that frozen, refreshed-live, and subscription behavior fit real Mimir panels under one RPC-first contract. The [query critique](../02-medium/03-data-sources/.experiments/2026-09-19-query-api-critique.md) shows that viewer-triggered refresh on every frozen panel contradicts publication immutability.

## Options

| Option | Tradeoffs |
| --- | --- |
| Author-declared `frozen`, `live`, and `subscription` | Gives each binding stable semantics; live modes retain instant snapshot paint; authors must choose policy through the owning Block |
| Viewer may turn any frozen value live | Adds flexibility but makes a pinned review change meaning and broadens read-time authority |
| Published data is frozen only | Keeps the smallest runtime but cannot express current metrics or streaming checks |

## Decision

Every DataBinding has an author-declared BindingMode: `frozen`, `live`, or `subscription`; omission means `frozen`. A published frozen binding never starts a live call and exposes no viewer action that changes its mode. A live binding ships a publish-time Snapshot entry for instant paint and then refreshes according to its BindingPolicy. A subscription binding also ships a folded Snapshot entry, then connects automatically, catches up from its cursor, and remains live. Drafts resolve every mode against the current Provider while preserving the declared policy in the SemanticManifest.

Effectful capture remains governed by the existing explicit acknowledgement; the new modes do not weaken that gate.

## Consequences

- Frozen is a durable promise rather than a cache state.
- Live and subscription surfaces remain useful when the standing service is slow or unavailable because their published value paints first.
- Provenance is visible as Frozen, CatchingUp, or Live rather than inferred from network activity.
- Domain Blocks own sensible mode defaults; App authors do not access a generic transport surface.

## Verification

Conformance exercises all three modes from one published AppVersion: frozen performs no data request and cannot refresh; live first renders its snapshot and then refreshes; subscription first renders its folded snapshot, reports CatchingUp, and advances to Live after a decoded event. Endpoint failure retains the frozen value with a typed failure.