# Interview await is RPC re-arm, not a long-lived stream

Status: accepted

## Context

Coding agents need to block on a human answer across minutes. The transport must
survive service, proxy, and shell idle behavior while keeping the agent-facing CLI
simple and scriptable.

The existing interview store already uses the important state model: each question
is stored by `(reviewId, questionId)`, answers are first-write-wins, and an await
first checks for an already-stored answer before parking a short waiter. That
stored-answer fast path is what prevents the gap race when the human answers
between two await calls.

The control-plane direction in
[0065](./0065-control-plane-rpc-boundary.md) moves agent operations to
`VistaControlApi`, so interview ask/await should use that same typed boundary
rather than separate command-shaped HTTP endpoints.

## Decision

Use `VistaControlApi` RPC procedures for interview ask/await:

- `vista.interview.ask` registers the structured `DecisionQuestion`.
- `vista.interview.await` is a single bounded `awaitOnce` window.
- The CLI implements `vista await` as a re-arm loop: call `awaitOnce`, re-issue on
  `pending`, return on `answered`, and stop only at the overall CLI deadline.

Do not make the human-answer await path a long-lived streaming RPC. Streaming RPC
remains available for future multi-event watch surfaces, but it is not the primary
primitive for a coding agent waiting on one human decision.

Keep browser answer and pending-question routes as viewer/product endpoints, not
agent command endpoints:

- `GET /_interview/pending?reviewId=...`
- `POST /_answer`

Those endpoints exist because immutable rendered reviews need a same-origin
browser bridge to the live service store. They are not a backwards-compatible
agent API.

## Rationale

The re-arm model makes the operational failure mode explicit: each server-side wait
is short, so idle timeouts and dropped connections resolve to `pending` or a retry,
not a lost human interaction. The authoritative state is the store, not the parked
connection, so an answer that lands between calls is returned by the next await.

Effect RPC streaming is technically supported, but for this use case it adds a
long-lived transport dependency without removing the need for stored state and
reconnection semantics. A stream that disconnects before the answer still needs the
same resume-from-store behavior. For a single eventual answer, bounded `awaitOnce`
is simpler to debug, easier for coding agents to run in shells, and already fits
the CLI JSON contract.

## Tradeoffs

| Option                             | Tradeoff                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| RPC `awaitOnce` plus CLI re-arm    | Most robust for coding agents and idle boundaries; repeated short requests add small overhead.                                    |
| Streaming RPC watch                | Cleaner push model for multi-event streams, but more sensitive to long-lived transport and still needs reconnect/store semantics. |
| Keep separate agent HTTP endpoints | Least migration work, but preserves a second agent command surface outside `VistaControlApi`.                                     |

## Evidence

- `service/src/interview/store.test.ts` proves pending timeout, parked-waiter wake,
  gap-race recovery, scoped answers, and first-write-wins.
- `service/src/control-rpc.test.ts` proves `vista.interview.ask` and
  `vista.interview.await` work over the typed control RPC.
- `service/src/interview/roundtrip.browser.test.ts` models a coding agent
  re-issuing bounded awaits while a real browser answers after the first await
  window has elapsed.
- `@effect/rpc` supports streaming RPC via `makeRpc(..., { stream: true })`, so
  streaming remains a later option for true watch feeds rather than a limitation of
  the chosen design.

## Consequences

- Remove `/_interview/ask` and `/_interview/await` as agent command endpoints when
  finishing the control-plane cleanup.
- Keep `/_interview/pending` and `/_answer` until the viewer bridge has an equally
  simple same-origin replacement.
- `vista await --json` is the canonical machine surface for coding agents.
- Debugging should inspect interview state through `vista debug ...` commands over
  control RPC, not by curling legacy endpoints.
