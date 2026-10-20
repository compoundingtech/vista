# Telemetry metric viz migrates to Scenes/VizPanelRenderer

Status: accepted

## Context

OQ-GRAFANA-TIMESERIES waited on upstream. Verdict 2026-09-12: no lean
successor exists — 13.2.0 still ships `graveyard/TimeSeries`; only
Graph/Gauge left in v13.0. The exact 13.1.0 pin has headroom but no future.

## Evidence and Argument

q14 chose migration over stay-pinned despite cost: clear the deprecation
preemptively with full re-proof rather than accrue watched debt on a
graveyard deep-import (build-time alias because the exports map blocks the
specifier — safe only under the exact pin).

## Options

| Direction | Tradeoffs |
| --- | --- |
| Stay pinned + Notion blocker | Zero churn; debt watched |
| Migrate to Scenes | Preemptive; heavy coupling + full re-proof |

## Decision

Rebuild the metric island viz on Scenes/VizPanelRenderer: replace the
`dist/esm/graveyard/TimeSeries/TimeSeries.mjs` deep-import, re-prove the
full Grafana closure (metric/trace/flamegraph browser lane), keep the
hermetic-island architecture (decision 0046) intact.

## Consequences

- Tracked as migration work (issue); OQ-GRAFANA-TIMESERIES closes into it.
- The trace/flamegraph proofs rerun against the migrated closure — shared
  with OQ-TELEMETRY-ISLAND-COVERAGE's rerun, which additionally needs the
  lane repair below first.
- The spec-mandated Notion blocker is moot (migration supersedes tracking).
