# Heavy/interactive components via esm.sh + lazy boundary (no per-review build)

Status: accepted

This decision rests on VST-R65's closed, zero-install dependency surface and
MED.AUTH-R59/decision 0054's thin-shell lazy boundary. It supersedes the earlier
“per-review island build by convention” direction and treats decision 0043's
telemetry island as a legacy special case.

> **Greenfield amendment:** Ordinary App-local React components replace the
> `custom` escape-hatch path. The stable lazy Island boundary remains, but
> publication now performs one generic static build and copies every dependency
> into the self-contained `site/`; published versions never resolve `esm.sh` or
> use Vite at serve time. Statements below about a standing published Vite server
> are historical.

## Context

FB-118: authoring a new heavy / browser-only / interactive component (the MED.AUTH-R23
escape hatch at its richest) required hand-copying source into the service tree,
a service-internal `vite build`, and a service restart — the most ceremony for the
highest-value reviews, the exact inversion VST-R64 forbids.

An earlier draft proposed closing this by generalizing decision 0043: have the
*service* run a scoped per-review `vite build` (by an `island/` convention),
content-address the chunk, and pin it. That removes the restart, but it adds a new
build mechanism, a new discovery convention, and per-publish latency — more
machinery to serve the same goal.

Under VST-R65, that machinery is unnecessary. VST-R65 makes `esm.sh` the **universal**
dependency escape hatch: any dependency not in the exposed `vista-deps` set —
including heavy, browser-only, or AGPL libraries — is reached by pinning it from
`esm.sh`. And MED.AUTH-R59/decision 0054 already require heavy/browser-only code to sit
behind a **lazy boundary** so the publish-time node projection stays safe.

## Decision

A heavy/interactive bespoke component is authored as an ordinary **lazy-loaded
review component** whose dependencies are **pinned `esm.sh` imports** (VST-R65). No
service-side build, no convention, no restart:

- The agent writes the component `.tsx` alongside `review.tsx` and references it
  through a lazy boundary (`React.lazy` / the thin-shell pattern, decision 0054),
  importing any non-exposed dependency from a pinned `esm.sh/<pkg>@<version>` URL.
- The standing Vite dev server transforms the `.tsx` on the fly and **already
  code-splits the lazy import into its own chunk** (decision 0029); the browser
  fetches the `esm.sh` deps at load. The lazy boundary keeps the component out of
  the eager graph, so the node projection (SVC-R57) never evaluates it (MED.AUTH-R59 satisfied).
- Therefore it publishes through the **existing one-command path** (`vista publish
  <review-dir>`) with no restart — the same path a closure-legal review uses. This
  is the whole of FB-118's fix: heavy components were never a separate tier; they
  are a lazy component + `esm.sh` deps.

Durability: a pinned `esm.sh` URL is version-locked, so a review's rendered output
is reproducible without a service-owned chunk.

## Consequences

- **FB-118 closes with less mechanism.** No `island/` convention, no per-review
  build, no new store producers — just VST-R65 + the thin-shell lazy boundary that
  already exist. This is the more principled outcome the redesign sought.
- **Decision 0043 (telemetry island) becomes a legacy special case.** Its
  service-internal Grafana bundle predates VST-R65; it remains for that one component
  but is **not** the pattern for new heavy components, which use `esm.sh` + lazy.
  A later cleanup could migrate it onto the `esm.sh` path or leave it grandfathered.
- **Accepted trade-off (VST-R65's).** `esm.sh` is a serve-time network dependency and
  can be slow for very heavy bundles. This is accepted as the cost of zero
  per-review build ceremony; if it ever proves untenable for a specific component,
  the response is to **expose** that dependency in `vista-deps` by curation (a
  system concern), not to reintroduce a per-review build.
- **Authoring guidance is the main deliverable.** The work is documentation +
  examples (a heavy component using pinned `esm.sh` behind a lazy boundary) and
  confirming the import gate + thin-shell lint cover it, not new build machinery.
