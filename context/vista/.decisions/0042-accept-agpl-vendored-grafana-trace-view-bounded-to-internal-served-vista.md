# Accept AGPL-vendored Grafana trace view for publicly distributed Vista

Status: accepted (data-sources telemetry interview Q3)

## Context

The trace waterfall (decision 0040) uses Grafana's Jaeger `TraceTimelineViewer`,
which is **not published to npm** — it must be vendored as ~100 `.tsx` source files
from the grafana repo. Grafana relicensed that repo to AGPL in 2021; the vendored
`v13.1.0` trace source is **AGPL-3.0-only**, not `LICENSE_APACHE2`. Uber-origin
Apache-2.0 headers are retained. Vista is a served application, so AGPL §13's
network-use clause applies. The metric (`@grafana/ui`) and flamegraph
(`@grafana/flamegraph`, Apache-2.0) legs do not carry this; the trace view is the
sole AGPL leg.

## Decision

Accept the AGPL-3.0-only vendored Grafana trace source for publicly distributed
Vista. Johannes approved public distribution on 2026-10-20 (Q347 / Axe Q10),
superseding this decision's former internal-only scope. Vista's own source is
Apache-2.0; the vendored subtree remains AGPL-3.0-only.
The clean-licensed alternatives (first-party trace waterfall; vendoring upstream
Apache Jaeger source) were considered and declined in favour of maximum Grafana
visual parity and reuse of the proven, feature-rich component.

## Consequences

- **Public source availability.** The public Vista repository provides the
  Corresponding Source. Operators who serve a modified island to remote users
  other than themselves must offer that source to those users (for example,
  a link to the public repository). Johannes's fleet deployment serves first-party
  users only. No serve-time link is added in this release; a UI source link is a
  possible later product change, not a legal conclusion about every deployment.
- **The boundary is architectural, not a licensing exemption.** The AGPL source
  stays in a clearly marked vendored subtree consumed by the lazily imported,
  client-only island. Other dotfiles members that do not link it are unaffected;
  the island manifest records `Apache-2.0 AND AGPL-3.0-only` rather than implying
  that the containing program is wholly Apache-2.0.
- **Maintenance is a managed liability.** No npm version to bump; upstream tracking
  is manual re-copy + re-diff against local stubs (3 no-op app-glue stubs + a
  ~45-prop wrapper) on each Grafana upgrade, across a non-API boundary that can break
  silently. The vendored revision is pinned and recorded.
- `CREDENTIALS.md` is unaffected (no secret); the vendored tree's provenance
  (grafana rev + license) is recorded at its root.
