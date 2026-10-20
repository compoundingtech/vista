# Usage Blocks — Spec

This document specifies the `SpendByProject` and `UsageOverTime` Blocks and the
OMP Usage Provider behavior they expose. It builds on the
[block-library requirements](../requirements.md) and the
[data-source requirements](../../03-data-sources/requirements.md).

## Status

Active.

## Scope

This node owns the typed OMP Usage outcomes and their presentation as project
spend and usage chronology. It does not define billed cost, invoice truth, or
generic lens authoring.

```text
OMP Usage HTTP API
  -> OmpUsage service
  -> lensChecked trust policy
  -> publish-time Snapshot
  -> live DataBinding
  -> SpendByProject | UsageOverTime
```

## Provider operations

The client-safe `omp-usage` ProviderContract exposes four Operations; its
server-only implementation performs all HTTP, trust-policy, retry, and timeout
work.

| Operation | Arguments | Result and role |
| --- | --- | --- |
| `health` | empty payload | Materialization generations and service health |
| `lens` | `{ lens, window, groupBy? }` | Strictly decoded lens envelope without policy classification |
| `lensChecked` | `{ lens, window, groupBy? }` | Lens envelope classified by freshness, materialization, and coverage |
| `projectDrilldown` | `{ window }` | One server-composed repository projection from checked `spend_by_project` and `spend_by_worktree` reads |

`VISTA_OMP_USAGE_URL` configures the service base URL and defaults to the
loopback OMP Usage service. Requests use bounded timeout and retry only typed
transient failures. Network, timeout, non-503 HTTP, and Schema-decode failures
remain `OmpUsageError` on the error channel. HTTP 503 is a decoded
`unmaterialized` success because it is domain evidence the viewer can act on.

## Trust-classified lens result

`lensChecked` owns the OMP Usage read rules. It joins the requested lens with
health generation metadata, checks generation freshness for the requested
window, and applies the `0.95` `coverage.account_share` gate. The success
channel is a tagged union:

| Tag | Payload and meaning | Presentation obligation |
| --- | --- | --- |
| `ok` | `{ envelope }`; materialized, fresh, and at or above the gate | Render values, coverage, and the cost qualification |
| `below-gate` | `{ envelope, accountShare }`; materialized below the gate | Render the partial ranking with an explicit warning, coverage, and the cost qualification |
| `stale` | `{ envelope, computedAt, window }`; older than the window's freshness horizon | Hide values as unmeasured and identify the stale generation |
| `unmaterialized` | `{ lens, window }`; no materialized generation, including HTTP 503 | Name the unavailable lens/window and give materializer guidance |

Blocks exhaustively branch on `_tag`; they do not recompute the gate or infer a
trust state from row counts. `projectDrilldown` is likewise a named server
Operation. It requires both checked source lenses to be `ok` and returns:

```ts
interface ProjectDrilldown {
  readonly window: LensWindow
  readonly projects: ReadonlyArray<{
    readonly project: string
    readonly usd: number
    readonly requests: number
    readonly status: "drilled" | "un-drilled"
    readonly worktrees: ReadonlyArray<{
      readonly key: string
      readonly repo: string
      readonly branch: string
      readonly usd: number
      readonly requests: number
    }>
  }>
  readonly unDrilled: ReadonlyArray<string>
}
```

A repository absent from the worktree result is `un-drilled`, never zero spend.
The Operation owns one final-value Snapshot entry and one refresh boundary rather
than exposing a mixed-generation client join.

## Blocks

### `SpendByProject`

```ts
SpendByProject({
  window: "1d" | "7d" | "30d" | "all",
  refreshEvery?: number, // defaults to 60_000 ms
})
```

The Block binds `ompUsage.ops.lensChecked` for `spend_by_project` with live
policy, the selected cadence, and acknowledged effectful capture. `ok` and
`below-gate` render the decoded ranking as a table; the latter labels it partial.
Every materialized result includes coverage evidence and the exact qualification
**“API-equivalent cost, not billed spend.”** Stale values remain hidden as
unmeasured, unmaterialized state gives materializer guidance, and typed failures
remain visible rather than becoming empty rows.

Each project row is an inline disclosure. Opening a row renders the
`projectDrilldown` worktree result beneath it; Escape collapses the disclosure.
Publication freezes one bounded `projectDrilldown` result, but only the top five
ranked project rows consume that frozen projection. Those rows are labeled
`Captured`. Every lower row is labeled `Not captured — opens live`, invokes the
existing Operation's refresh boundary before exposing worktrees, and never
interprets frozen omission as zero usage. Loading and failure states remain in
the opened row, so a live-only request cannot masquerade as captured evidence.

### `UsageOverTime`

```ts
UsageOverTime({
  id?: string, // defaults to "usage-over-time"
  window: "1d" | "7d" | "30d" | "all",
  groupBy: "none" | "model" | "account" | "worktree",
  refreshEvery?: number, // defaults to 60_000 ms
})
```

The Block binds the same Operation for `usage_over_time`, the authored window,
and grouping with the same live and effectful-capture policy. It projects decoded
chronology into the existing `ChartBlock`, including the coverage line, and
selects the intended bucket and token-type series without summing incompatible
aggregate rows. Its trust-state presentation and exact cost qualification match
`SpendByProject`.

Both bindings publish a Snapshot before live work starts. Their refresh cadence
is BindingPolicy, not Snapshot identity; refreshing one Block does not advance
another binding. Provider output is decoded before it reaches table or chart
rendering, and neither Block performs HTTP, health lookup, freshness checking,
or coverage classification.
