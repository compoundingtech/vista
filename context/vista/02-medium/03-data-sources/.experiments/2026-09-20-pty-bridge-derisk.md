# Vista live PTY bridge derisk — durable evidence

This durable copy records evidence established on 2026-09-20 in the spike under `tmp/pty-bridge-spike/`; the spike code is reference only and is not part of the VRS.

## Question

Whether a live terminal fits Vista's subscription/live-hub contract at all — in which representation, with which transport, and under which protocol, security, and lifecycle gaps that must close first.

## Method

A spike mounted one `PtyApi` RPC group exposing server-folded screen frames and raw chunk variants through the real Vista service, the existing HTTP provider route, and Effect WebSocket RPC on one listener, plus a minimal binary WebSocket-to-PTY bridge benchmark, a multi-viewer fan-out probe, a 31-second hibernation/catch-up probe, a peek-protocol packet inspection, and a read-only inspection of the managed Tailscale service — run on a severely saturated shared host.

## Result

A live terminal fits only when the subscription value is a replaceable, bounded terminal-screen snapshot: complete `ScreenState` tolerates latest-state coalescing, freeze, and snapshot reconnect, while raw chunks grow without bound, corrupt the client fold when replay-0 sliding share drops one chunk, cannot replay from a byte offset, and would persist a full screen per PTY packet (redraw reached 72,960 packets/s). The 20-viewer fan-out cliff (235.323 ms wall) rejects per-viewer PTY attaches in favor of one shared upstream attach and fold. Snapshot catch-up after the hub's 30-second TTL is viable (reconnect 5.05 ms, 329 B, marker present). The prototype exposed the equal-cursor/replay-0 subscription join race, the PTY protocol's missing read-only streaming role (`PEEK` is one-shot; `ATTACH` is privileged), and that managed-ingress identity-header forwarding is not live-verified.

## Conclusion

Conditional go for a screen-state viewer plus audited unary input; no-go for full-fidelity raw PTY streaming on the unmodified live-hub contract. Prefer Effect RPC over WebSocket on the same listener for interactive mode if a clean-host benchmark proves adequate; keep a binary raw data plane only as a same-listener fallback behind an explicit upgrade dispatcher. Never accept `viewer` or `attached: true` from the RPC payload as authority; derive the actor from trusted request context behind a server-held, short-lived attach capability.

## VRS Impact

Established the representation and lifecycle constraints that decision 0096 adopts: bounded `ScreenState` as the subscription value, atomic subscribe-before-read handoff (seed `Synced` on every connect, including equal-cursor reconnects), coalescing before the live hub with bounded persistence, one service-scoped PTY adapter and terminal fold per session, request-context actor with a server-held attach capability, and fresh-screen resume. Its alternatives analysis became the bakeoff's three candidates, and its six questions for the principal are recorded as DQ2–DQ7 in the data-sources open questions.

## Source Report

# Vista live PTY bridge derisk

Date: 2026-09-20  
Branch: `schickling-assistant/2026-09-20-vista-pty-bridge-spike`  
Base: T3 `a8ce230b75`

## Executive conclusion

A live terminal **fits Vista's subscription model only when the subscription value is a replaceable terminal-screen snapshot**. It does not fit as a lossless raw-byte log without changing the live hub's delivery, persistence, cursor, and transport contracts.

Recommended shape:

1. Keep one Vista provider and one RPC group.
2. Model viewing as a `ScreenState` subscription with monotonic bridge-generated frame cursors. Coalesce output and publish latest full screen state; reconnect always catches up from a snapshot.
3. Keep input as unary `pty.send`, but authenticate the actor from trusted server request context and require a server-held, short-lived attach capability. Never accept `viewer` or `attached: true` as authority from the RPC payload.
4. Prefer Effect RPC over WebSocket on the same listener for interactive mode if a clean-host benchmark proves adequate. If schema/NDJSON framing or coalescing cannot preserve terminal fidelity, use a binary raw-WebSocket data plane on that same listener behind an explicit upgrade dispatcher; retain typed RPC for attach/send/audit control.
5. Do not expose raw PTY bytes through the current T3 subscription hub as-is.

This is a **conditional go** for a screen-state viewer plus audited unary input. It is a **no-go** for full-fidelity raw PTY streaming on the unmodified T3 live-hub contract.

## Prototype

The spike is under `tmp/pty-bridge-spike/`:

- `app/providers/pty.query.ts`: one `PtyApi` group with `screen` and `raw` subscriptions plus unary `send`.
- `app/providers/pty.provider.ts`: direct pty-rust Unix-socket driver, deterministic headless screen fold, raw chunk variant, and unary input.
- `app/app.tsx`: Vista subscription bindings with effectful capture acknowledged.
- `run-e2e.test.ts`: actual Vista service/HTTP-provider/publish experiment.
- `run-ws.test.ts`: same `PtyApi` mounted through Effect WebSocket RPC on one listener.
- `raw-ws-benchmark.mjs`: minimal binary WebSocket-to-PTY bridge and benchmark.
- `hibernation-probe.mjs`: disconnected 31-second snapshot catch-up probe.
- `raw-ws-results.json`: recorded raw bridge benchmark result.

The provider intentionally implements two representations:

### Variant A — server-folded screen frames

`ScreenState` is bounded: cursor, frame number, current screen, and cursor coordinates. Each event replaces the screen. This matches Vista's fold/freeze/reconnect semantics and tolerates latest-state coalescing.

The spike's tiny VT fold was sufficient to exercise shell output, CR/LF, cursor movement, and erase operations. It is evidence about the contract, not a production terminal emulator. Production must use the same terminal-state implementation as the PTY daemon or a mature headless terminal library; a second approximate emulator would drift on modes, Unicode widths, alternate screen, hyperlinks, and application-specific sequences.

### Variant B — raw output chunks

`RawState` contains a reset snapshot and appended chunks. It demonstrates the mismatch: state grows without bound, byte offsets are invented by the bridge, dropped chunks corrupt the fold, and the PTY daemon cannot replay bytes from an arbitrary offset.

## Fit against T3

| T3 seam | Fit | Evidence / gap |
|---|---|---|
| Provider contract / one RPC group | Good | `screen`, `raw`, and `send` coexist in one `RpcGroup`; unary and streaming operations are expressible. |
| `makeSubscriptionHub` current-state fold | Good for complete screen replacement | A full `ScreenState` is bounded and reconnectable. |
| `Stream.share({ capacity: 16, strategy: "sliding", replay: 0 })` | Unsafe for raw bytes | A dropped raw chunk permanently corrupts the client fold. Sliding is acceptable only for self-contained latest screen frames. |
| Initial `Synced` event | Mostly good, with a race | When `since !== current.cursor`, the hub emits current state before shared events. When cursors are equal, it omits the seed and joins a replay-0 shared stream; output between state observation and shared subscription can be missed. The prototype hit this while repeatedly opening short-lived subscriptions. A live screen subscription should always seed current state, or atomically join the stream before reading state. |
| Cursor semantics | Gap for raw PTY | pty-rust exposes current screen and future data, not replay by output offset. A bridge cursor can order screen generations but cannot promise byte replay. Resume must mean “fresh screen snapshot, then future frames,” not “all missed bytes.” |
| Persistence | Expensive for terminal rate | T3 stores folded state on every accepted event. Persisting full terminal screens at raw packet frequency amplifies writes. Coalesce before the hub and persist at a bounded cadence or only on hibernation/finalization. |
| Freeze / publish | Good for screen state | Freeze can capture a current screen. It must never capture input authority or imply historical byte completeness. |
| Browser subscription client | Good for state replacement | Existing AsyncResult/subscription machinery can fold validated screen events and reconnect on visibility changes. |
| HTTP NDJSON route | Correct but unproven for interactive latency | Unary send reached the existing route. Terminal-rate performance was not established on this host; see benchmark caveat. |
| Effect WebSocket RPC | Architecturally good | Effect's `layerProtocolWebsocket` and `layerProtocolSocket` mount the same group on one HTTP listener. The runnable spike is present, but the loaded host could not complete the Vitest transform in 10 minutes. |
| PTY read-only default | Protocol gap | Current PTY `PEEK` is a one-shot snapshot. Continuous DATA requires `ATTACH`, which is writable and participates in geometry. The Vista bridge can withhold input, but its daemon connection still has attach power. pty-rust needs a true read-only follow capability, or this trusted bridge must be explicitly accepted as the sole privileged attach boundary. |
| Shared terminal geometry | Gap | `ATTACH` supplies rows/cols and constrains the session. Multiple viewers need a declared geometry owner; passive viewers must not resize. |

## Important protocol finding

Current pty-rust adds a `GEOMETRY` packet (type 10) before the `SCREEN` packet for a peek. The bridge correctly ignores unknown non-data packets, but a production adapter should use the maintained `@myobie/pty/client` API or share the protocol implementation rather than duplicate numeric packet constants.

`@myobie/pty`'s JavaScript client documents `PEEK` as one-shot read-only and `ATTACH` as the bidirectional stream. This is the key security mismatch with “read-only by default”: read-only is presently an application policy above a privileged daemon connection, not a daemon-enforced streaming capability.

## Transport results

### Environment caveat

The shared dev3 host was severely saturated during the run:

```text
load average: 99.36, 96.64, 93.06
```

Therefore these numbers establish order of magnitude and expose cliffs; they are not acceptance thresholds or a fair HTTP-vs-WebSocket comparison.

### Minimal binary WebSocket bridge

The bridge forwards PTY packets unchanged between a WebSocket and the Unix socket. Its benchmark-only unary acknowledgement is emitted after the Unix-socket write callback.

Recorded run (`raw-ws-results.json`):

| Measurement | Result |
|---|---:|
| Unary empty send, n=50, mean | 0.147 ms |
| Unary empty send, p50 / p95 / max | 0.109 / 0.219 / 1.112 ms |
| Key-to-echo, n=20, mean | 0.450 ms |
| Key-to-echo, p50 / p95 / max | 0.199 / 2.929 / 2.929 ms |
| Sustained shell output | 1,321,594 B in 9,323.7 ms |
| Sustained throughput | 141,746 B/s; 2,051 PTY packets/s |
| Redraw workload | 15,977 B in 11.14 ms |
| Redraw throughput | 1.434 MB/s; 72,960 PTY packets/s |

The high redraw packet rate is precisely why “one persisted Vista event per PTY packet” is the wrong unit. Frames must be coalesced before the hub.

### Fan-out

The raw bridge established independent PTY attaches for each viewer, then measured all viewers observing one marker:

| Subscribers | Wall | Process CPU | RSS delta |
|---:|---:|---:|---:|
| 1 | 0.934 ms | 0.959 ms | 0 B |
| 5 | 1.301 ms | 0.916 ms | +512 KiB |
| 20 | 235.323 ms | 62.679 ms | -1.996 MiB |

RSS deltas are noisy because they are process-wide and GC occurred. The 20-viewer latency cliff is real enough to reject “one PTY attach and one terminal fold per browser.” Vista should own one upstream attach/fold per session and broadcast shared screen state.

After the run, the isolated PTY process used 3,008 KiB RSS and its daemon 4,312 KiB RSS with zero clients.

### NDJSON overhead

A live 257-byte PTY screen snapshot encoded as the prototype `ScreenFrame` JSON event occupied 395 bytes plus the surrounding RPC envelope: 1.54× before HTTP framing. Base64 of those bytes alone was 344 bytes (1.34×). Escapes, full-screen size, and RPC envelope change the exact ratio. Binary PTY framing adds five bytes plus WebSocket framing and avoids JSON string escaping.

This does not by itself rule out NDJSON for coalesced full screens. It does rule out treating raw byte chunks as cheap JSON events.

### HTTP unary route

The actual Vista service accepted 50 sequential empty `pty.send` calls through its existing HTTP provider route. Server spans were 0–5 ms and mostly 0–2 ms. The end-to-end run then exposed the equal-cursor/replay-0 subscription race described above.

After correcting the driver to use `ATTACH` and changing the benchmark to one stable subscription, subsequent runs could not finish startup/transform under dev3's load; one HTTP run and the Effect WebSocket run were each stopped after 10 minutes without reaching benchmark code. No HTTP client percentile or Effect-WebSocket percentile is claimed.

A clean-host rerun is required before choosing Effect WebSocket over the raw binary fallback. The scripts are retained to make that rerun mechanical.

## Hibernation and catch-up

A real PTY was left without clients for 31 seconds, then queried with a one-shot read-only peek:

```json
{"idleMs":31000,"reconnectMs":5.050375000002532,"snapshotBytes":329,"markerPresent":true}
```

This proves snapshot catch-up after the T3 hub's 30-second resource TTL is viable at the PTY boundary. It does **not** prove byte-log replay: output emitted while disconnected is recoverable only insofar as it remains represented in the terminal's current screen/scrollback.

Required Vista semantics:

- persist or freshly query the latest screen snapshot;
- issue a new screen-generation cursor;
- send `Synced(currentState)` on every reconnect, including equal-cursor reconnects;
- then stream future replaceable frames;
- never claim that a cursor replays omitted raw bytes.

## Tailscale Services identity probe

Read-only inspection verified the existing managed service:

```text
svc:vista-dev3
  vista-dev3.tail8108.ts.net:443
  / -> http://127.0.0.1:5192
```

A live header-echo path was not installed. Agent policy correctly rejected direct `tailscale serve` mutation because `managed-tailscale-services` owns the node-global ingress config and an ad-hoc serve command can clobber managed mounts. Thus header forwarding is **not live-verified** by this experiment.

The safe follow-up is a managed, temporary echo route or a separate disposable service identity reconciled through the owning configuration. It must record which headers reach loopback and whether WebSocket upgrade requests carry the same identity.

Security contract regardless of header names:

- only trust identity injected by the known loopback Tailscale proxy;
- strip any identity-looking headers on direct/untrusted ingress;
- derive actor identity in server middleware, never from provider payload;
- bind attach capability to actor + session + expiry;
- audit every transition into attach mode and every input batch with the derived actor;
- fail closed if proxy identity is absent or ambiguous.

## Alternatives

### 1. Coalesced screen snapshots over existing HTTP NDJSON

Best fit with T3 and freeze semantics. Lowest implementation risk. Suitable for monitoring and moderate interaction if a clean-host latency test passes. Not a lossless terminal byte stream.

### 2. Same provider/group over Effect WebSocket RPC

Recommended interactive default to test next. Preserves typed RPC, one listener, authentication middleware, and one group for screen plus send. Removes per-request HTTP connection/framing behavior. Still requires screen coalescing and may retain JSON/NDJSON overhead depending on serialization.

### 3. Binary raw WebSocket data plane plus typed RPC control plane

Best measured fidelity and latency. Use only if option 2 cannot meet terminal behavior. It must share the existing HTTP listener via one explicit upgrade owner/router. Forge's prior two-listener split was forced by competing upgrade owners and Tailscale `--set-path` not carrying WebSocket upgrades; reproducing that topology would violate the current one-service goal.

Control operations—attach grant, send authorization, audit, freeze metadata—remain typed RPC. The raw socket carries only PTY protocol packets.

## Recommended production contract

### View state

```text
PtyScreenState
  session
  generation cursor
  rows / cols
  cells or terminal snapshot
  cursor position
  terminal modes needed by renderer
  capturedAt
```

Events should replace the full logical screen or carry independently applicable frame deltas with an explicit reset generation. Prefer complete replacement first. Coalesce to a bounded frame rate and measure 10/20-viewer fan-out from one upstream fold.

### Input

```text
requestAttach(session) -> short-lived capability
send(session, capability, bytes) -> audited acceptance
releaseAttach(session, capability)
```

The capability is server state, not a client boolean. Read-only subscriptions never acquire it. Viewer identity comes from trusted transport context. Sending input never mutates the subscription cursor.

### Lifecycle

- First viewer: one trusted upstream PTY attach and one terminal fold.
- Additional viewers: share folded screen state; no additional PTY attach.
- No viewers: hibernate after policy TTL, persisting at most the bounded screen state.
- Reconnect: query/restore current screen, always send a seed, then future frames.
- Freeze: capture current screen only; omit attach capability and live input.

## Questions for the principal

1. May the PTY daemon/client protocol gain a true read-only streaming `FOLLOW` role, or is a privileged Vista bridge attach accepted as the sole read-only enforcement boundary?
2. Is the product contract “current rendered screen” or “terminal with scrollback/history”? The latter needs bounded scrollback semantics and storage limits; it still should not promise raw-byte replay.
3. Who owns terminal geometry when multiple viewers exist: session creator, current attached actor, or a fixed session size? Passive viewers should never resize.
4. What are attach capability TTL, revocation triggers, single-writer policy, and audit retention? These must be decided before enabling keystrokes.
5. If Effect WebSocket RPC fails the clean-host threshold, is a binary data-plane exception on the same listener acceptable while typed RPC remains the control plane?
6. Which managed Tailscale test surface may be used to verify viewer identity headers and WebSocket upgrade forwarding without mutating `svc:vista-dev3` outside its reconciler?

## Required follow-up proof before implementation approval

Run `run-e2e.test.ts` and `run-ws.test.ts` on a normally loaded host and record, for HTTP NDJSON and Effect WebSocket RPC:

- 50 unary sends: mean/p50/p95;
- 20 key-to-echo samples on one stable subscription;
- sustained output and redraw bytes/s and frames/s after coalescing;
- one upstream driver/fold with 1/5/20 viewers: CPU, RSS, and latency;
- reconnect just before and after the 30-second hibernation TTL;
- managed Tailscale identity headers on ordinary HTTP and WebSocket upgrade.

Do not use the loaded-host results as a performance gate. They are sufficient to establish the representation and lifecycle constraints above.
