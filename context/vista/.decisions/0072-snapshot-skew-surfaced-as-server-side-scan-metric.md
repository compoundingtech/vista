# Snapshot darkness is surfaced loudly as a server-side scan-time gauge

Status: accepted

## Context

OQ-FROZEN-SKEW-VISIBLE has two halves. The **visible** half — a dark published
snapshot (a version skew or a malformed envelope) renders a visible `unsupported`
notice, never silently live — is the frozen seam (decisions 0068 and 0069). The
**loud** half — an operator *seeing* which published versions have gone dark, whether
from a global-`apiVersion` bump or a corrupt frozen `snapshot.json` — is a separate
concern: the persisted read path resolves the discriminant for the browser but the
page-level notice is not an operator signal. The question is where the loud signal
lives.

## Evidence and Argument

The service already scans every version's persisted state from disk (`scanApp`), and
already exports `OtelMetric` instruments over the shared telemetry spine (0062). A
darkness signal therefore rides an existing path with zero new transport — no browser
beacon, no new HTTP endpoint. The scan seam is the natural owner: it is the one place
that already reads every version's frozen `snapshot.json`, so it can classify each as
`ok` / `skew` / `malformed` without a second walk.

Darkness is STATE, not an event — it answers "how many published versions are dark
right now", not "how many times was the list read". So the instrument is a **gauge**
`set` each scan, not a counter incremented per read RPC (which would conflate
dark-state with list-call frequency).

Two things could ride a gauge here: a per-version series (tagged `slug` + `version`)
or a per-`reason` COUNT. A per-version series inflates cardinality with one series per
dark version AND leaves a stale series behind when an app is retired — nothing resets a
`slug`/`version` that stops being scanned. A **count tagged by `reason` only**, `set`
for BOTH reasons every scan (to `0` when none), has neither problem: cardinality is
bounded to exactly two series, and a reason that drops back to zero is explicitly
reset, so no series lingers. This costs the WHICH-version-is-dark detail at the metric
— but that detail belongs in a log, not in labels, so it rides a structured warn line
at the same seam.

## Decision

- **Emit the loud half server-side, at the scan seam.** Publish a `vista.snapshot.skew`
  `OtelMetric` **gauge** (exported as the `vista_snapshot_skew` series, per OBS-R72),
  `set` each scan to the COUNT of currently-dark published versions, tagged by `reason`
  (`skew` | `malformed`) ONLY.
- **Set both reasons every scan.** Both `skew` and `malformed` are `set` on each scan
  (to `0` when none), so a reason that drops back to zero is explicitly reset and no
  series lingers; cardinality is bounded to exactly two series.
- **Cover both dark reasons.** `skew` (a present frozen snapshot declaring a
  non-current `apiVersion`) AND `malformed` (present but not a well-formed envelope,
  including non-JSON) are first-class dark outcomes (0069) — both render `unsupported`,
  so both are counted; a draft (no snapshot) and a current-version `ok` are excluded.
- **Keep the WHICH-version detail in a log, not labels.** For each dark version the
  scan seam emits one structured warn (`Effect.logWarning` annotated with `slug`,
  `version`, `reason`) — the queryable "which published version is dark" signal, kept
  off the metric so `slug`/`version` never inflate cardinality.
- **Reuse the existing spine.** Over the OTel export the service already runs (0062) —
  no browser beacon, no new HTTP endpoint.
- **The signal answers one question:** how many published versions are dark and why
  (count), with a companion log for which.

## Consequences

- Dark published versions are countable and alertable server-side, closing the "loud"
  gap 0061 left open, over the loud/visible split with 0068/0069: this decision makes
  darkness visible to the operator; the seam makes it visible in the page.
- Setting both reasons every scan means the gauge is self-healing: cardinality is fixed
  at two series and there is no stale series to leave behind when an app is retired —
  the count simply drops. No scheduler or expiry is needed; each `apps.list` scan
  reconciles the gauge.
- The per-version detail moves to a structured warn log at the seam, so an operator
  still queries `slug`/`version`/`reason` for a dark version without paying for them as
  metric labels.
- The metric is an `OtelMetric` added to the OBS-R72 metric inventory (dot-form
  instrument `vista.snapshot.skew`, exported series `vista_snapshot_skew`).
- Cross-references: 0061 (loud-skew intent + data-loss contract), 0062 (OTel spine),
  0068/0069 (visible half + malformed as first-class dark), OBS-R72 (metrics).
