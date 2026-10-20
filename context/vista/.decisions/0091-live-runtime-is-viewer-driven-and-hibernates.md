# The live runtime is viewer-driven and hibernates

Status: accepted

## Context

Live and subscription bindings imply CPU, memory, upstream quota, mutable folded state, and teardown obligations. Keeping one worker per published binding running forever wastes quota; destroying all state at the last disconnect makes every return cold. Published directories remain immutable, so mutable liveness cannot reside inside them.

## Evidence and Argument

The [lifecycle experiment](../02-medium/03-data-sources/.experiments/2026-09-19-live-runtime-lifecycle.md) proves one shared poller for two viewers, zero upstream work after idle TTL, immediate wake from persisted state and cursor, and hard teardown when the AppVersion Scope closes. It also proves provider-wide budget sharing and shows that an AppVersion-only quota is insufficient. The [Effect idiom audit](../02-medium/03-data-sources/.experiments/2026-09-19-effect-idiom-audit.md) identifies `RcMap`, `Stream.share`, `SubscriptionRef`, `KeyValueStore.SchemaStore`, and `RateLimiter`/`HttpClient.withRateLimiter` as the native primitives.

## Options

| Option | Tradeoffs |
| --- | --- |
| Viewer-driven shared work with idle hibernation | Bounds idle cost and preserves fast resume; requires persisted overlay state, cursors, and explicit lifecycle ownership |
| Always-on work from publish to retire | Maximizes freshness but consumes external quota for unseen and long-lived versions |
| Viewer-only work with no grace or persistence | Minimizes machinery but every reopen cold-starts from the publish-time value |

## Decision

The DataRuntime acquires live work only for visible viewers. An AppVersion-scoped `RcMap` shares one poller or upstream stream per snapshot key; `Stream.share` supplies bounded fan-out where applicable. When the final viewer leaves, upstream calls stop immediately while the resource remains warm for an idle TTL. TTL expiry persists the latest folded state, cursor, and observation time through a strict Schema store, then releases the resource.

The persisted LiveOverlay resides in the standing service state directory and is keyed by AppVersion identity and snapshot key. It is disposable acceleration, never part of the immutable version directory. A wake serves a valid persisted value immediately and catches up from its cursor; a strict decode failure discards it and resynchronizes.

The AppVersion Scope owns the registry, pollers, streams, buffers, and overlay handles. Replacement publication, retirement, and draft closure close that Scope. A service-wide per-provider budget broker governs every AppVersion, using native rate limiting for remote quotas and semaphores for local concurrency; viewer count may influence cadence but never bypass the budget.

## Consequences

- An AppVersion has an immutable artifact lifetime and a separately governed optional live-runtime lifetime.
- Mutable overlay state never changes static publication bytes.
- Buffers, RcMap capacity, overlay retention, and shutdown flushing are bounded operational policy.
- Active work is shared within an AppVersion; sharing across AppVersions remains an explicit unresolved optimization.

## Verification

Lifecycle conformance covers two viewers sharing one upstream worker, no calls with zero viewers, warm return before TTL, durable wake after TTL and process reconstruction, cursor catch-up, service-wide budget throttling, bounded stream behavior, and immediate zero-worker teardown when the AppVersion Scope closes.