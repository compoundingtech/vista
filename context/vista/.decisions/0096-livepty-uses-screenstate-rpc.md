# LivePty uses ScreenState RPC with an attach command plane

Status: accepted

## Context

LivePty must be interactive from its first release, while passive viewing/subscription is read-only by default and explicit attachment grants a viewer bounded write authority under the live-control exception in VST-R01 and T01, realized by MED.DATA-R84. A raw PTY byte stream does not satisfy Vista's snapshot-first subscription contract: the PTY daemon exposes current screen plus future bytes rather than cursor-relative byte replay, and losing one raw chunk can permanently corrupt a client-side fold. The architecture therefore has to preserve terminal interaction without introducing an unbounded byte log or a second behavior contract.

## Evidence and Argument

The [PTY bridge derisk experiment](../02-medium/03-data-sources/.experiments/2026-09-20-pty-bridge-derisk.md) established that a bounded current screen fits Snapshot capture, coalescing, hibernation, and reconnect, while raw chunks do not fit the replay-0 sliding hub. The [transport bakeoff](../02-medium/03-data-sources/.experiments/2026-09-20-pty-bakeoff.md) exercised three implementations through seven shared scenarios and 105 result files. Despite a heavily loaded host, the interleaved comparison consistently favored ScreenState RPC on the interactive paths and exposed the duplex design's mixed-load and memory costs.

The principal's recorded decisions constrain the choice: Q11 requires interaction from the start; Q12 makes passive viewing/subscription read-only by default, grants bounded write authority only through explicit attachment, derives the actor from tailnet identity, and requires per-viewer audit; Q13 requires contract and security findings to be fixed in the tier that introduces them rather than deferred; Q14 reframed the initial architecture choice into the bakeoff; and Q15 selected `screenstate-rpc` with the eight production boundaries below.

## Options

| Scenario | `screenstate-rpc` | `duplex-channel` | `screenstate-http` |
| --- | ---: | ---: | ---: |
| S1 key-to-echo p95 | **3.18 ms** | 10.67 ms | 45.56 ms |
| S2 sustained delivered throughput | 1.03 MB/s | **7.10 MB/s** | 0.09 MB/s |
| S3 200 redraws to consistent screen | **6.4 ms** | 32.5 ms | 37.4 ms |
| S4 50-viewer p95 / process RSS | **5.1 ms / 90 MiB** | 7.2 ms / 450 MiB | 39.0 ms / **71 MiB** |
| S5 reconnect after 30 seconds idle | 69 ms | **4 ms** | 7 ms |
| S6 frozen seed | **451 B** | 478 B | **451 B** |
| S7 typing under output p95 | **3.85 ms** | 2,562 ms | 48.3 ms |

| Option | Tradeoffs |
| --- | --- |
| Coalesced `ScreenState` subscription and command ops in one RpcGroup over Effect WebSocket RPC, with HTTP NDJSON fallback | Best interactive behavior and strongest fit with strict schemas, snapshot-first publication, and shared live work; pays typed reconnect overhead and cannot claim lossless byte history |
| Raw binary duplex WebSocket beside typed RPC control | Highest throughput and fastest reconnect, but adds a second protocol, duplicates the terminal fold, makes dropped frames state-corrupting, consumed 450 MiB at 50 viewers, and reached 2.6 s p95 under mixed output/input |
| `ScreenState` over HTTP NDJSON with HTTP unary commands | Smallest and cheapest fan-out implementation, but its 45–48 ms input latency floor is materially worse for an interactive terminal |

## Decision

Adopt `screenstate-rpc`. LivePty exposes a coalesced subscription whose value is the complete bounded current `ScreenState`, plus `attach`, `send`, `resize`, and `release` command ops in the same authored RpcGroup. Effect WebSocket RPC is the primary live transport on the existing listener. The same contract remains available through HTTP JSON for unary commands and HTTP NDJSON for the subscription as a degraded fallback.

The raw binary duplex plane is not a parallel default. It remains a measured fallback design only if a later product decision requires lossless bytes or substantial scrollback and accepts the extra transport, reset, telemetry, and memory obligations.

## Production Boundaries

1. The published and reconnectable value is a bounded current `ScreenState`, never a byte log. Every connection and reconnection receives a full seed, including an equal-cursor reconnect.
2. The current-state-to-stream handoff is atomic. Subscribe-before-read or a sequence handshake must close the gap that `Stream.concat(current, replay-0 changes)` leaves.
3. One server-side PTY adapter and one terminal fold serve a session. Passive viewers never gain input authority and never resize.
4. The actor comes from trusted request context. A short-lived server-held lease is bound to actor and session, admits only one writer, and gates `send`, `resize`, and `release`. Attach, release, send, and resize are audited without recording input contents.
5. Terminal output is folded and coalesced before the live hub. Persistence occurs only for bounded screen state at a bounded cadence or lifecycle boundary, never once per PTY packet.
6. WebSocket and HTTP mounts derive from the same RpcGroup on one listener. One explicit upgrade dispatcher owns routing; HTTP is a degraded transport fallback, not a second behavior contract.
7. Resume means a fresh current screen followed by future frames. LivePty never promises replay of bytes the PTY daemon cannot supply.
8. Release is gated on proof that the managed Tailscale ingress supplies trustworthy viewer identity to both HTTP and WebSocket requests, and on clean-host latency and terminal-fidelity thresholds. The loaded-host bakeoff selects the architecture but does not define production SLOs.

## Consequences

- Command ops realize MED.DATA-R84 as an explicit live-only, authority-gated Provider concept. They are never DataBindings, captured Snapshot entries, or published capabilities.
- The typed LivePty Block remains the only App-facing surface; authors and viewers do not receive a generic mutation API.
- Subscription joining, coalescing, identity propagation, leasing, audit, and upgrade ownership are correctness boundaries rather than optional optimizations.
- Exact viewport/scrollback scope, daemon read-only following, geometry ownership, lease policy, fidelity fallback, and the managed identity-test surface remain explicit open questions in the data-sources VRS.

## Amendment 1 — AppVersion read authority and same-origin commands

On 2026-09-22, Q27 selected manifest-bound session reads: the mounted
AppVersion admits `screen(session)` only when its SemanticManifest declares a
`pty.screen` binding for that session; otherwise the Provider fails with typed
`SessionNotDeclared` (MED.DATA-R85).

On 2026-09-22, Q28 selected the allowed-origin command policy. A WebSocket
upgrade capable of dispatching commands requires an `Origin` matching
`VISTA_PUBLIC_URL` or an allowed loopback development origin. HTTP commands
require the same allowed `Origin` and `Sec-Fetch-Site: same-origin`. Missing or
foreign browser intent evidence denies commands, including from non-browser
clients, without restricting their read access.

On 2026-09-22, Q29 scoped VST-R01 and T01's mutation prohibition to App and
document mutation and named this authority-gated terminal plane as the sole
freeform-control exception. It may mutate neither App state nor publication nor
any resource absent from the AppVersion manifest. The LivePty realization is
owned by MED.BLK.TERM-R86 under `05-blocks/09-terminal`.
