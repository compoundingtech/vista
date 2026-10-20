# Debug CLI is a thin agent-facing view over control RPC

Status: accepted

## Context

`vista debug ...` is primarily for coding agents diagnosing Vista while changing
Vista itself. It replaces ad-hoc curl/debug HTTP surfaces after the control plane
moves to `VistaControlApi`.

The command surface must be optimized for agent use: discoverable, stable,
scriptable with `--json`, terse on failure, and close to the service's real typed
boundary. At the same time, it must not expose raw RPC procedure names as the main
human/agent UX, because procedure names, payload shapes, and transport details are
implementation contracts, not good operational commands.

## Decision

`vista debug ...` is a purpose-built namespace backed by `VistaControlApi`, with a
thin descriptor/mapping layer colocated with the RPC definition:

- every debug command maps to one or more typed control RPC procedures;
- every debug command emits a schema-encoded JSON form under `--json`;
- command inputs are decoded through the same Effect Schema contracts as the RPC
  payloads;
- command coverage is mechanically checkable against `VistaControlApi.requests`;
- the default surface is named for agent tasks, not protocol internals.

Initial commands:

- `vista debug service [--json]` → `vista.service.info`
- `vista debug reviews [--json]` → `vista.reviews.list`
- `vista debug review <slug> [--json]` → `vista.review.get`
- `vista debug paths [--json]` → path-focused projection of `vista.service.info`
- `vista debug publish-plan <slug> [--json]` → `vista.publish.plan`

Near-term additions should follow the same pattern:

- `vista debug providers <slug> [--json]` once provider mount/capture diagnostics
  are first-class RPCs.

Implementation priority was service/control health first, then publish pipeline
preflight: `service`, `paths`, `reviews`, `review`, and `publish-plan` are the
first stable agent-debug commands.

A raw generic RPC invoker is not part of the stable command surface. If an escape
hatch is needed during implementation, it must be visibly unstable, e.g.
`vista debug rpc --unstable <procedure> --payload-json ...`, and omitted from
normal help/docs.

## Rationale

The Effect RPC group already exposes public metadata (`requests`) carrying the
procedure tags and schemas, so coverage and JSON-boundary validation can be
derived mechanically. That is enough to prevent drift between the debug namespace
and the service contract.

But a useful debug CLI needs intentful names, command-specific defaults, concise
rendering, redaction policy, and multi-RPC projections. Those are not derivable
from schemas alone. A tiny descriptor layer gives agents a better interface while
keeping the transport and boundary single-sourced in `VistaControlApi`.

## Tradeoffs

| Option                                                | Tradeoff                                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Purpose-built debug commands with descriptor coverage | Best agent UX and avoids legacy HTTP/debug API drift; requires a small mapping per command.                 |
| Raw generic RPC CLI                                   | Fastest to implement and maximally flexible, but leaks internals and tends to become accidental public API. |
| Fully generated CLI from RPC schemas                  | Strongest no-drift story, but poor names/defaults/rendering and awkward for multi-RPC diagnostics.          |

## Consequences

- Debug HTTP endpoints remain out of scope.
- Adding a diagnostic RPC should include a descriptor entry or an explicit note
  that it is not agent-debuggable.
- Tests should assert descriptor coverage for RPCs tagged as debuggable.
- `vista debug ... --json` is the preferred machine surface for coding agents.
