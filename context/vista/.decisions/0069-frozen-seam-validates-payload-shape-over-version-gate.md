# Frozen seam validates payload shape; the version-gate only bounds `apiVersion`

Status: accepted

## Context

Decision 0061 wraps the disposable frozen `snapshot.json` in one
`{ apiVersion, payload }` envelope, read fail-closed; 0068 scoped the version-gate
to that disposable contract class. But the envelope reader (`readEnvelope`) checks
only the `apiVersion` boundary and hands back the inner `payload` opaque — the
consuming frozen seam (`resolveSnapshotMode`) then treats a present, current-version
envelope as `frozen` and passes its payload through. A snapshot that is present and
current-version but whose *payload* is structurally broken (e.g. missing
`providers`/`frozenAt`) clears the envelope check and would render as `frozen` with
undefined fields — a silent partial render, the exact failure the visible half of
OQ-FROZEN-SKEW-VISIBLE exists to stop.

## Evidence and Argument

Two independent things can be wrong with a persisted snapshot, and they live at two
different boundaries. The **contract version** is what two independently deployed
parties (or a code-vs-disk pair) must agree on — that is the envelope's job, and a
mismatch there is `skew`. The **payload shape** is what the consumer must actually
render — that is the seam's job, and a current-version payload that does not satisfy
the `Snapshot` schema is not a version skew but is equally un-renderable. Both belong
in the same visible `unsupported` bucket; neither may fall through to a `frozen`
render with undefined fields or (worse) to a live `absent` render. The `absent`
signal stays reserved for a genuinely missing file (the import throws — a draft).

## Decision

- **Version boundary at the envelope.** `readEnvelope` enforces only `apiVersion`:
  `ok` (current) / `skew` (present, non-current) / `malformed` (not a well-formed
  envelope). It does not vouch for the inner payload's shape.
- **Payload shape at the consuming seam.** `resolveSnapshotMode` additionally decodes
  the inner payload against the `Snapshot` schema. A present, current-version payload
  that fails that decode resolves to `unsupported` (a `malformed` reason) — never
  `frozen`.
- **The three render outcomes hold, fail-closed and visible:** `absent` (no file — a
  draft → render live); `frozen` (present **and** current-version **and**
  schema-valid → render the immutable copy); `unsupported` (present but skewed, or a
  malformed envelope, or a malformed payload → a visible unsupported notice, never
  live, never a partial render).
- **Refines 0068/0061.** Layering the checks — version boundary at the envelope,
  payload shape at the seam — is the full-strength visible half of
  OQ-FROZEN-SKEW-VISIBLE.

## Consequences

- `resolveSnapshotMode` owns the `Snapshot`-shape decode; `readFrozen`'s per-rpc
  success-schema decode still validates each block entry downstream (defense in
  depth). A structurally broken snapshot is caught at the seam, before any block.
- Strengthens SVC-R58 (render guarantee) at the frozen seam: a published version can
  never present a partial `frozen` render from a broken payload.
- Pairs with the loud half of OQ-FROZEN-SKEW-VISIBLE (the server-side skew metric):
  this decision makes the failure visible in the page; the metric makes it visible to
  the operator.
- Cross-references: 0068 (identity carve-out / version-gate scope), 0061 (envelope +
  data-loss contract), 0058 (render proof), SVC-R58.
