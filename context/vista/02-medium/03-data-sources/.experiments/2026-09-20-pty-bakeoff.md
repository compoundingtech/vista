# LivePty transport bakeoff — durable evidence

This durable copy records evidence established on 2026-09-20 by the LivePty transport bakeoff harness under `tmp/pty-bakeoff/`; the harness, its result files, and `results/host-samples.jsonl` are retained in the working tree and are not part of the VRS.

## Question

Which LivePty transport architecture serves an interactive, read-only-by-default terminal — coalesced complete `ScreenState` replacement events over Effect WebSocket RPC (`screenstate-rpc`), a raw binary duplex channel beside typed control RPC (`duplex-channel`), or `ScreenState` over the existing HTTP NDJSON mount (`screenstate-http`) — and under which production boundaries?

## Method

One shared harness drove all three candidates through the same seven scenarios (S1 key-to-echo, S2 sustained output, S3 full redraws, S4 1/5/20/50-viewer fan-out, S5 reconnect after idle, S6 frozen seed paint, S7 typing under terminal-rate output) for five fixed-order round-robin iterations — 105 result files — with terminal-screen assertions per scenario, host-load/CPU/I/O-PSI bounding samples, and median [IQR] plus paired same-iteration deltas against `screenstate-rpc`, on a shared, heavily I/O-blocked host.

## Result

`screenstate-rpc` won the interactive paths that define the question: median S1 p95 **3.18 ms**, median 50-viewer p95 **5.09 ms**, median S7 p95 **3.85 ms**. `duplex-channel` delivered **6.80x** paired throughput and reconnected roughly **16x** faster but collapsed to **2,561.90 ms** S7 p95 and **450.40 MiB** process RSS at 50 viewers. `screenstate-http` was the smallest implementation (648 LOC) with the cheapest fan-out but a stable ~45 ms p95 latency floor. `screenstate-rpc` paid a **69.38 ms / 5,853 B** median reconnect and ~**1.03 MB/s** delivered throughput. Absolute numbers carry the host-load caveat: median load1 76.47, I/O PSI `some avg10` 70.66; the paired interleaved comparison is the usable signal.

## Conclusion

Winner: `screenstate-rpc` — coalesced, complete `ScreenState` replacement events over Effect WebSocket RPC with `attach` / `send` / `resize` / `release` in the same `RpcGroup` and the HTTP NDJSON mount retained as degraded fallback — adopted with eight non-negotiable production boundaries (bounded current screen, atomic current-state handoff, one PTY adapter and terminal fold per session, request-context actor with a short-lived single-writer lease and metadata-only audit, coalesce-before-hub persistence, one listener under one explicit upgrade dispatcher, fresh-current-screen resume, clean-host release gate). The raw binary data plane is retained as a measured fallback design, not a parallel default.

## VRS Impact

Decision 0096 (`LivePty uses ScreenState RPC with an attach command plane`) adopts this bakeoff's winner and boundaries. The root ontology gains `CommandOp`, `AttachLease`, `ScreenState`, and `CoalescedFrame`. The data-sources spec gains the "Command operations and LivePty" section. The charter is amended per decision Q16: VST-R01/T01 admit a narrowly declared, authority-gated live command-op surface, MED.DATA-R84 defines command ops, and MED.DATA-R49 gains the shared service-scoped PTY adapter/terminal-fold clarification. The six questions left for the principal are recorded as DQ2–DQ7 in the data-sources open questions.

## Source Report

# LivePty transport bakeoff

Date: 2026-09-20

## Decision

**Winner: `screenstate-rpc`.** Use coalesced, complete `ScreenState` replacement events over Effect WebSocket RPC, with `attach` / `send` / `resize` / `release` in the same `RpcGroup` and the HTTP NDJSON mount retained as a fallback.

It won the interactive paths that define Q11: median S1 p95 was **3.18 ms**, median 50-viewer p95 was **5.09 ms**, and median S7 p95 under terminal-rate output was **3.85 ms**. It also has the strongest fit with the RPC-first Provider spine, strict schemas, snapshot-first publication, viewer-shared work, and typed request context. Every delivered frame is independently usable, so coalescing does not corrupt the terminal fold.

The choice is not free. `duplex-channel` delivered **6.80x** the paired throughput and reconnected roughly **16x** faster than `screenstate-rpc`; `screenstate-http` was the smallest implementation and lowest measured 50-viewer CPU/RSS shape. The RPC winner paid a median **69.38 ms / 5,853 B** reconnect cost and about **1.03 MB/s** delivered throughput. Those are acceptable for a current-screen product, not proof that RPC preserves an unbounded byte history.

The strongest counter-argument is therefore the raw binary plane: if the product contract becomes lossless terminal byte fidelity or substantial scrollback rather than “current rendered screen,” `duplex-channel` has the bandwidth and framing advantage. In this implementation that advantage did not survive the interactive mixed workload: S7 p95 was **2,561.90 ms**, its 50-viewer process RSS was **450.40 MiB**, and a dropped raw frame can stale a client fold. Shipping the extra data plane now would buy complexity before the product has chosen the contract that needs it.

## Methodology

- One shared harness in `tmp/pty-bakeoff/harness/scenario.ts` drove all candidates through the same `Variant` / `Client` interface. Variants did not implement their own scenarios.
- Each variant passed the judge-run 10-second-budget selfcheck covering S1 and S5. Full one-iteration S1–S7 preflights then found and forced fixes for two lifecycle defects before measurement:
  - `screenstate-rpc`: an unhealthy release RPC could block local stream/scope/runtime cleanup;
  - `duplex-channel`: the S7 writer reused an expired 60-second capability.
- The judged run used five complete round-robin iterations in fixed `RPC → duplex → HTTP` order (`ABCABC…`). Every variant iteration used a fresh isolated `PTY_ROOT`, PTY session, listener, and server lifecycle.
- Host load and CPU/I/O PSI were sampled before and after each variant iteration. Each scenario result stores the mean of the bounding samples; raw endpoints are retained in `results/host-samples.jsonl`.
- There are **105 result files**: 3 variants × 7 scenarios × 5 iterations. Every scenario asserts its terminal screen against `pty peek --plain`. S4 additionally asserts exactly one active upstream PTY attachment at 1, 5, 20, and 50 viewers.
- S6 painted the frozen seed in Nix-managed headless Chromium and measured two animation frames after DOM insertion.
- Tables report **median [IQR]** over five iterations. IQR uses inclusive quartiles. “Paired Δ” is the median same-iteration difference from `screenstate-rpc`; throughput uses the median same-iteration ratio.

## Host-load caveat

This was a shared, heavily I/O-blocked dev3 run, not a clean-host acceptance test.

| Host measure | Median [IQR] | Range |
| --- | ---: | ---: |
| load1, bounding-sample mean | 76.47 [55.49] | 51.88–356.21 |
| CPU PSI `some avg10` | 9.19 [2.31] | 6.86–19.31 |
| I/O PSI `some avg10` | 70.66 [17.35] | 55.99–88.11 |

Thirteen of fifteen variant iterations had mean load1 above 60, but the run did **not** satisfy the literal “load1 > 60 for the whole run” rerun condition: its first endpoint samples were 49.12 and 54.63. No mandatory second latency set was added. Absolute latency and browser-paint numbers are not release thresholds. The interleaved, paired comparison is the useful signal, and even it can retain order effects because the round-robin order was fixed.

Two tail events show why medians need the raw JSON beside them: HTTP S5 took 32.81 s in iteration 4 when load1 peaked, and RPC S6 paint took 1.205 s in iteration 5. Both are visible in the retained results rather than silently discarded.

## Results

### S1 — key-to-echo latency, 200 keys

Milliseconds; lower is better.

| Variant | p50 [IQR] | p95 [IQR] | p99 [IQR] | Paired Δ p95 vs RPC |
| --- | ---: | ---: | ---: | ---: |
| ScreenState RPC | 1.79 [0.04] | 3.18 [1.04] | 9.64 [2.56] | baseline |
| Duplex channel | 5.87 [0.83] | 10.67 [1.32] | 21.03 [6.44] | +7.49 ms |
| ScreenState HTTP | 35.74 [0.45] | 45.56 [2.84] | 56.65 [5.66] | +42.58 ms |

RPC won all three percentiles. HTTP’s intentional 0–16 ms batching window, request/audit path, and snapshot query compound into a stable ~45 ms p95. Duplex pays typed control-RPC and raw-fold scheduling even though its data frames are binary.

### S2 — sustained output for 10 seconds

Throughput is delivered representation bytes, not equivalent source semantics: raw PTY packets, RPC snapshots, and HTTP snapshots have different sizes. Higher throughput is better; dropped/coalesced frame counts are reported rather than treated as directly comparable quality scores.

| Variant | Delivered MB/s [IQR] | Delivered frames [IQR] | Dropped/coalesced frames [IQR] | Paired throughput vs RPC |
| --- | ---: | ---: | ---: | ---: |
| ScreenState RPC | 1.033 [0.055] | 5,976 [180] | 265,992 [20,018] | baseline |
| Duplex channel | 7.104 [0.471] | 1,684,411 [23,019] | 93 [191] | 6.80x |
| ScreenState HTTP | 0.086 [0.001] | 498 [30] | 543,888 [67,150] | 0.08x |

Duplex is the throughput winner. For the two screen-state candidates, a “drop” is safe coalescing because the later complete screen replaces the earlier one. For duplex, a dropped raw frame is qualitatively worse: it can stale that viewer’s fold until a reset seed.

### S3 — 200 full-screen redraws

Milliseconds to a screen consistent with `pty peek --plain`; lower is better.

| Variant | Consistent screen [IQR] | Paired Δ vs RPC |
| --- | ---: | ---: |
| ScreenState RPC | 6.43 [1.62] | baseline |
| Duplex channel | 32.53 [4.56] | +27.26 ms |
| ScreenState HTTP | 37.36 [3.54] | +32.89 ms |

Complete coalesced snapshots were faster to a trustworthy terminal state than folding the raw burst in the benchmark client.

### S4 — one upstream attach, 1/5/20/50 viewers

Echo p95 in milliseconds; lower is better. Every cell passed the exactly-one-active-upstream assertion.

| Viewers | RPC p95 [IQR] | Duplex p95 [IQR] | Duplex paired Δ | HTTP p95 [IQR] | HTTP paired Δ |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2.19 [2.10] | 3.51 [0.86] | +0.49 | 35.37 [1.27] | +32.50 |
| 5 | 2.75 [1.26] | 3.26 [0.36] | +0.84 | 36.09 [0.83] | +33.83 |
| 20 | 3.38 [0.22] | 5.00 [1.05] | +1.50 | 43.46 [6.63] | +40.18 |
| 50 | 5.09 [0.85] | 7.18 [0.50] | +1.86 | 38.97 [3.02] | +33.89 |

The latency ordering held through 50 viewers. Resource measurements are process-wide gauges reported by the variant; server and benchmark clients share a process, so they are directional rather than isolated server footprints.

| Variant at 50 viewers | CPU ms [IQR] | Paired CPU Δ | RSS MiB [IQR] | Paired RSS Δ |
| --- | ---: | ---: | ---: | ---: |
| ScreenState RPC | 50.00 [31.39] | baseline | 89.90 [15.15] | baseline |
| Duplex channel | 31.33 [12.34] | -20.79 | 450.40 [19.79] | +365.20 MiB |
| ScreenState HTTP | 16.07 [7.01] | -27.12 | 70.99 [6.25] | -24.81 MiB |

Duplex’s duplicated per-viewer headless folds dominate its process footprint. HTTP is cheapest at fan-out but materially slower.

### S5 — reconnect and catch-up after 30 seconds idle

Lower is better. Bytes are transferred to the reconnecting viewer before the first consistent screen.

| Variant | First consistent screen ms [IQR] | Paired Δ | Bytes transferred [IQR] | Seed bytes [IQR] |
| --- | ---: | ---: | ---: | ---: |
| ScreenState RPC | 69.38 [6.27] | baseline | 5,853 [1,637] | 523 [1] |
| Duplex channel | 4.04 [0.75] | -65.91 | 397 [0] | 397 [0] |
| ScreenState HTTP | 7.26 [4.23] | -60.34 | 439 [0] | 349 [0] |

This is RPC’s clearest loss. Its generated client/socket/group startup transfers and processes substantially more than the actual seed. HTTP had the best typical resource shape but also the run’s 32.81 s saturation outlier; reconnect needs a bounded deadline and frozen fallback regardless of transport.

### S6 — frozen publication seed

Bytes lower is smaller. Paint is headless-Chromium decode + DOM insertion + two animation frames; lower is better.

| Variant | Seed bytes [IQR] | Decode + paint ms [IQR] | Paired paint Δ vs RPC |
| --- | ---: | ---: | ---: |
| ScreenState RPC | 451 [0] | 25.00 [12.10] | baseline |
| Duplex channel | 478 [0] | 26.40 [22.20] | +11.20 ms |
| ScreenState HTTP | 451 [0] | 23.10 [119.40] | +10.00 ms |

All seeds are small and publication-suitable. Browser scheduling under host pressure dominates the tiny payload differences; no transport earns a product advantage from S6.

### S7 — typing during terminal-rate output

Echo p95 in milliseconds; lower is better. The load continuously rewrites a separate screen row so each typed marker remains independently observable rather than being scrolled out before a coalesced frame.

| Variant | p95 [IQR] | Paired Δ vs RPC |
| --- | ---: | ---: |
| ScreenState RPC | 3.85 [10.92] | baseline |
| Duplex channel | 2,561.90 [182.38] | +2,548.36 ms |
| ScreenState HTTP | 48.29 [6.92] | +45.69 ms |

This scenario decides the interactive recommendation. Duplex’s client must consume and fold the raw firehose while also finding input echo boundaries; its S2 bandwidth advantage becomes head-of-line pressure. Complete screen replacement lets RPC discard obsolete work and prioritize a current screen. HTTP also remains self-healing but retains its request/coalescing latency floor.

## Contract and operational tradeoffs

| Axis | ScreenState RPC | Duplex channel | ScreenState HTTP |
| --- | --- | --- | --- |
| Interactive latency | Best S1/S3/S4/S7 | Close on unloaded echo, catastrophic S7 | Stable but 7–18x slower than RPC on paired interactive paths |
| Fidelity | Complete logical screen; safe coalescing; depends on one maintained terminal fold | Highest raw-byte fidelity while no drops occur; raw drops can stale client; server + client folds duplicate terminal semantics | Complete logical screen; safe coalescing; lowest event cadence |
| Q2 — declared frozen/live/subscription | Strong: one subscription plus frozen seed | Qualified: frozen Provider seed plus separate raw live plane | Strong: existing NDJSON subscription shape |
| Q3 — composition rule | Strong: effectful input is named unary server RPC beside subscription | Qualified: typed unary control follows rule; raw view bypasses Provider stream | Strong: same group owns subscription and named unary input |
| Q4 — viewer-owned hybrid hibernation | Strong ownership fit; S5 startup is slower | Reset seed makes wake possible, but raw stream has no cursor replay | Strong and operationally simple; S5 typical path is fast |
| Q5 — RPC-first source of truth | Exact fit: same `RpcGroup` over WS and HTTP fallback | Control/seed are RPC-first; binary view is a deliberate exception | Exact operation group over existing HTTP NDJSON route |
| Q6 — Blocks-only public surface | Fits an internal LivePty Block binding | Fits, but Block owns a custom runtime channel as well as binding | Fits an internal LivePty Block binding |
| Q7 — AsyncResult-first client | Natural `AsyncResult<Resolved<ScreenState>>` subscription | Seed/status fit; raw stream needs custom state/failure/backpressure projection | Natural existing subscription-client fit |
| Q8 — strict schema boundary | Strong: screen/control events strictly schema-driven | Control/seed strong; raw PTY packets are protocol-validated, not Effect-Schema events | Strong: every NDJSON event/op schema-driven |
| Q11 — interactive from start | Best measured fulfillment | Supports it, but mixed load currently fails the latency goal | Supports it with a clear latency floor |
| Q12 — read-only default, explicit attach, per-viewer audit | Yes: transport-context actor, server lease, single writer, audit | Yes on typed control plane; raw plane remains read-only | Yes: transport-context actor, server lease, single writer, audit |
| Upgrade ownership | One Effect WS route plus identical HTTP fallback on one listener; needs one top-level dispatcher with Vite HMR | Best explicit exact-path `noServer` dispatcher, but adds a second protocol | No WebSocket ownership at all |
| Catch-up semantics | Always seed full current screen, then future replacements; never claims byte replay | Seed/reset then future raw bytes; a gap requires reset | Always seed full current screen, then NDJSON replacements |
| Frozen seed | 451 B median; direct subscription-state shape | 478 B median; separate frozen `pty.seed` op | 451 B median; direct subscription-state shape |
| Observability / budget | Typed RPC spans and one shared attach; coalescing/drop metrics still required | Typed control spans plus a separate raw-plane queue/drop/fold telemetry model | Reuses existing HTTP observability; easiest admission/accounting |
| Implementation cost | 764 candidate LOC; new WS mount/request context/lease/coalescing primitives | 857 candidate LOC; highest lifecycle and protocol surface | 648 candidate LOC; smallest and most familiar operational surface |
| Tailscale Services deployment | One root-mounted service/listener if upgrades preserve identity | One root-mounted service/listener via explicit dispatcher; no second service needed | Safest current deployment because it needs only ordinary HTTP |

## Recommendation and production boundary

Adopt `screenstate-rpc` with these non-negotiable boundaries:

1. The published and reconnectable value is a bounded current `ScreenState`, not a byte log. Always emit a full seed before changes, including equal-cursor reconnects.
2. Fix T3’s current-state handoff atomically. `Stream.concat(current, replay-0 changes)` is not sufficient; subscribe-before-read or a sequence handshake must make the join gap-free.
3. Use one server-scoped PTY adapter per session and one terminal fold. Passive viewers never acquire input authority and never resize.
4. Derive the actor from trusted request context. Keep a short-lived, server-held, actor/session-bound single-writer lease; audit attach, release, send, and resize without storing input contents.
5. Coalesce before the live hub. Persist only bounded screen state at a bounded cadence or lifecycle boundary, never one full screen per PTY packet.
6. Mount WS and HTTP from the same authored group on one listener under one explicit upgrade dispatcher. Keep HTTP as degraded fallback, not a second behavior contract.
7. Treat disconnect resume as “fresh current screen, then future frames.” Never promise replay of bytes that the PTY daemon cannot supply.
8. Gate release on the managed Tailscale identity proof and on clean-host latency/fidelity thresholds. This run selects relative architecture; it does not set production SLOs.

Do not ship the raw binary data plane as a parallel default. Retain it as the measured fallback design if a principal later chooses lossless bytes/scrollback and accepts the extra transport, telemetry, reset, and memory obligations.

## Open questions for the principal

1. Is LivePty’s product contract the **current rendered viewport**, or a terminal with bounded scrollback/history? The recommendation assumes the former.
2. May the PTY daemon gain a true read-only streaming `FOLLOW` role, or is a privileged Vista bridge accepted as the sole enforcement boundary for read-only viewers?
3. Who owns geometry with multiple viewers: session creator, current attached writer, or fixed session dimensions?
4. What are the production attach TTL, revocation triggers, single-writer takeover UX, and audit-retention policy?
5. If a clean-host fidelity test exposes terminal features that complete `ScreenState` cannot represent, is a raw binary same-listener exception acceptable, or must the screen schema be enriched instead?
6. Which managed Tailscale test surface may verify loopback identity headers on both HTTP and WebSocket upgrade requests without mutating `svc:vista-dev3` outside its reconciler?
