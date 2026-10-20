# Telemetry Block — Requirements

The telemetry block family realizes live and frozen telemetry views (metric
time-series, trace waterfall, flamegraph) via best-in-class isolated third-party
components. It is the block that most exercises *both* contracts: it refines the
[data contract](../../03-data-sources/requirements.md) (live telemetry sources,
backend-faithful freeze) and the [render contract](../../02-renderer/requirements.md)
(isolated render components, lazy loading). Containing that render+data complexity in
one vertical block subsystem — rather than splitting it across the data and render
contracts — is the reason this node exists (decision 0067).

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); the generic provider/freeze contract is
[../../03-data-sources/requirements.md](../../03-data-sources/requirements.md); terms
in [glossary.md](./glossary.md) (`telemetry island`, `pixel-frozen`). The telemetry
experiments are under `.experiments/`. IDs are path-scoped (`MED.BLK.TELEM-*`); each
requirement `refines:` its parent — the data contract (`MED.DATA-R*`), the render
contract (`MED.REND-R*`), the authoring lazy boundary (`MED.AUTH-R59`), or the
charter (`VST-R*`). Decisions 0040–0043, 0046, 0050.

## Requirements

- **MED.BLK.TELEM-R49 Live telemetry sources:** Live telemetry must be obtained from
  the fleet Grafana-stack backends — metrics from **Mimir** (PromQL range queries),
  distributed traces from **Tempo** (trace-by-id and TraceQL search) — through
  governed surfaces, with no credentials embedded in published artifacts (extends
  MED.DATA-R28/MED.DATA-R31 for telemetry).
  `refines: MED.DATA-R28`
- **MED.BLK.TELEM-R50 Backend-faithful durable snapshots:** A frozen telemetry
  snapshot must store standard, schema-validated backend formats — OTLP for traces,
  the PromQL `matrix` range result for metrics — never a rendering library's internal
  format, so a snapshot stays decodable independent of any UI library's version.
  `refines: MED.DATA-R29`
- **MED.BLK.TELEM-R51 Telemetry rendering reuses isolated SOTA components:**
  Telemetry blocks must reuse best-in-class third-party visualization components,
  isolated so their runtime / React-version incompatibilities and licensing
  obligations stay contained and cannot leak into unrelated apps or the
  publish/projection graph.
  `refines: MED.REND-R02`
- **MED.BLK.TELEM-R52 Heavy blocks load on demand:** Large/heavy blocks must load
  lazily behind a placeholder; deferring their render code must not break a frozen
  page's viewability.
  `refines: MED.AUTH-R59`
- **MED.BLK.TELEM-R53 Explicit freeze durability tiers:** Freeze must guarantee the
  data for every app; apps carrying heavy/frozen render substrates must additionally
  guarantee pixel durability via a self-contained built artifact. The viewer's mode
  indication must never claim more durability than a block actually has (refines
  MED.DATA-R29/MED.DATA-R30).
  `refines: MED.DATA-R29`
- **MED.BLK.TELEM-R54 Contained third-party licensing:** Copyleft or runtime-coupled
  third-party render code must be confined to a vendored unit that the shared block
  library never re-exports (CI-guarded), and any applicable source-availability
  obligation must be met at serve time. Predicated on Vista remaining internal and
  not externally distributed; external distribution requires revisiting
  (decision 0042).
  `refines: VST-R37`

- **MED.BLK.TELEM-R82 Honest metric ranges and live windows:** A metric Block must
  preserve the authored relative or absolute range and the resolved absolute
  interval represented by its samples. Relative ranges resolve at capture and at
  each live poll; live folding advances by sample cursor, removes samples outside
  the resolved window, and enforces the point cap. Query, requested range, step,
  and point cap participate in Snapshot identity, while capture time, resolved
  interval, cursor, mode, and refresh cadence do not. The visualization island
  must receive decoded series and must not own fetching, clocks, cursors, or
  retention.
  `refines: MED.DATA-R28`

## Acceptance

Metric / trace / flamegraph telemetry blocks render live from Mimir/Tempo through
governed surfaces with no embedded secrets; a frozen snapshot stores OTLP / PromQL
`matrix` and decodes independent of the render library version; the render substrate
loads lazily and its separate-React / licensing concerns never leak into the block-library
barrel or the projection graph; pixel-freeze holds for island-bearing versions and
the mode badge never overclaims. Frozen relative ranges remain fixed at
publication time; live ranges advance while preserving instant Snapshot paint; the
displayed requested and resolved ranges cannot overclaim the sampled interval.
