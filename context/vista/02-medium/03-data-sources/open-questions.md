# Data Sources — Open Questions

Only unresolved production choices remain here. T5 owns DQ5 and DQ7–DQ9.

## DQ3: Should the PTY protocol name its existing read-only stream as FOLLOW?

- Blocks: only whether the protocol should make the streaming role more discoverable; read-only observation is already daemon-enforced.
- Evidence: in both published `@myobie/pty@0.10.0` and the pinned Rust daemon (`compoundingtech/pty` revision `846f6eb59421178076825babbb060d34b925f949`), PEEK marks the client read-only, sends GEOMETRY plus SCREEN, and leaves the socket connected. Subsequent DATA broadcasts reach that socket while client DATA and RESIZE packets are rejected. The CLI's `pty peek -f` uses the same PEEK packet and merely keeps the client socket open; one-shot `pty peek` is a CLI disconnect policy, not a daemon limitation.
- Resolution signal: decide whether discoverability warrants a protocol alias or documentation change, without adding a second role with identical authority.
- Blocker: there is no distinct FOLLOW message, but there is no functional daemon gap: a persistent PEEK socket is the read-only streaming role.
- Lean: retain persistent PEEK and document its streaming lifetime and daemon-enforced input/resize denial rather than duplicate the protocol capability.

## DQ5: What is the production AttachLease and audit UX?

- Blocks: lease TTL, revocation triggers, release-on-disconnect, single-writer denial and deliberate takeover behavior, plus audit-event retention for `attach`, `send`, and `release`.
- Resolution signal: a principal security and interaction policy with concrete TTL, revocation, takeover, and retention values exercised against disconnect and expiry.
- Blocker: the server-held single-writer lease fails closed, but the block does not yet explain expiry, denial, or takeover and an abruptly closed viewer holds authority until expiry.
- Lean: short TTL, visible expiry, release on disconnect, explicit takeover confirmation, immediate revocation on identity or session loss, and metadata-only audit retention.

## DQ6: What happens when complete ScreenState cannot represent a terminal feature?

- Blocks: whether production enriches the ScreenState schema or permits the measured raw binary same-listener fallback.
- Resolution signal: a clean-host fidelity suite covering Unicode width, alternate screen, terminal modes, hyperlinks, cursor state, and representative full-screen applications, followed by a principal choice for every observed gap.
- Blocker: the spike's terminal fold proves the architecture but is not a production-fidelity implementation, so no concrete schema gap has yet been characterized.
- Lean: enrich ScreenState first; permit the raw plane only for a demonstrated requirement that bounded current state cannot represent.

## DQ7: Which managed Tailscale surface may prove viewer identity propagation?

- Blocks: LivePty's production release gate for trusted actor derivation on both HTTP requests and WebSocket upgrades.
- Resolution signal: a reconciler-owned disposable or temporary managed route records the exact identity headers delivered to loopback for HTTP and WebSocket requests and proves spoofed direct-ingress headers are rejected.
- Blocker: direct mutation of `svc:vista-dev3` is forbidden outside its reconciler, and no approved managed test surface currently exists.
- Lean: provision a disposable service identity rather than modify the production Vista service.

## DQ8: Which component owns Provider WebSocket upgrades?

- Blocks: the T5 low-latency command and subscription transport.
- Resolution signal: one listener-level dispatcher routes the exact Provider RPC path and Vite HMR protocol once each, rejects unmatched upgrades, and proves both routes concurrently.
- Blocker: the HTTP server leaves upgrades unmatched while each draft Vite server owns HMR; mounting another upgrade listener without an owner can intercept HMR or double-dispatch a socket.
- Lean: one service-level exact-path and exact-protocol dispatcher; Providers and Blocks never install upgrade handlers.

## DQ9: What is LivePty's durable ScreenState cadence?

- Blocks: enabling production attach and sustained active-session dogfooding without write amplification.
- Resolution signal: a clean-host exercise selects a maximum write frequency and lifecycle flush points, then proves the durable store observes that bound under continuous redraw.
- Blocker: the generic live hub persists every accepted subscription event, while LivePty coalesces in memory at 16 ms; that in-memory cadence is not a persistence policy.
- Lean: persist at a slower bounded cadence and at hibernation/lifecycle boundaries, always replacing one current ScreenState rather than storing frame history.
