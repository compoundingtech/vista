# Wire live data sources now (otel, gh, system graph)

Status: accepted (kit-scope interview Q3)

## Context

The data-backed blocks (`otel-panel`, `gh-previews`, `system-explorer`) can render
from frozen authored data or fetch live. This build wires **live** now (rather than
frozen-only), so reviews can explore real current data, per requirement MED.DATA-R28's
dual-mode interface.

## Decision

Implement live data adapters in this kit build, all behind the dual-mode
`dataSource` / `modelKey` seams (decisions 0008, 0018) so a frozen snapshot still
works for durable review (freeze-on-publish, MED.DATA-R29):

- **`otel-panel`:** live adapter via our existing query surfaces — `gcx` /
  Prometheus / `axe otel` (see `/sk-grafana-gcx`, `/sk-prometheus`, `/sk-otel`) —
  plus the frozen adapter.
- **`gh-previews`:** live via the `gh` CLI (PR diff + changed-file tree, issue),
  feeding the `diff` and `file-tree` blocks (decision 0024); plus frozen.
- **`system-explorer`:** model generated from the **`axe vrs` graph-JSON
  extractor** (resolves the OQ-MULTIDIM model-source residual — generated, not only
  hand-authored), plus a hand-authored path.

## Consequences

- The kit build pulls in infra integration (`gcx`/Prometheus/`axe otel`, `gh`,
  `axe vrs`) and their auth/governance (`op-proxy`/`CREDENTIALS.md` where secrets
  apply, MED.DATA-R31). No secrets embedded in published artifacts.
- Live is fresh but non-durable; `freeze()` snapshots into the published version so
  the mode is always explicit (MED.DATA-R30, T06).
- Larger build than frozen-only; sequenced as its own sub-milestone(s) after the
  rendering roster so live-fetch failures never block the visual kit.
- The `dataSource`/`modelKey` interface means live and frozen are swappable per
  block without rework.
