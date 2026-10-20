# Vista authoring-friction evaluation

Date: 2026-08-10. Current implementation evidence for decision
[0077](../../../.decisions/0077-owner-scoped-source-with-automatic-typed-receipts.md).

## Question

How many commands and how much latency does the current documented Vista path
require, and which validation, mutation, and ownership guarantees does it provide?

## Method

The documented AppDoc path was exercised with narrative, data-backed interactive,
and bespoke system-explorer apps. An independent verifier repeated the representative
scaffold, dry-run, and duplicate-ID controls in a separate directory. No real publish
or production mutation was performed.

## Result

The documented session path was three CLI calls: service preflight, scaffold, and
publish dry-run. The verifier measured 30.428 s, 30.333 s, and 30.338 s respectively,
or 91.099 s total. Each call spent about 30 seconds in configured OTLP finalization;
disabling the exporter reduced the scaffold control to 336 ms.

A scaffolded three-file app was byte-identical before and after dry-run. Separately,
an `app.tsx`-only directory passed dry-run but gained generated `index.html` and
`main.tsx`, so dry-run was not source-read-only in that case. Dry-run returned success
for duplicate IDs and an unknown block tag; TODO scaffold content was also accepted.
Because preflight evaluates only enough module state for metadata/status, its success
did not establish that the browser could render the app.

The optional scaffold claim was otherwise confirmed: `app.tsx` alone reached a plan.
Current source was project-local under `tmp/vista/<slug>` and published identity used
a global store; no Agent Spec used `resources/vista` or declared a Vista resource.

## Conclusion

The common path must require only `vista publish <local-slug>` from canonical owner-scoped
source. It validates type/schema, stable semantic IDs/references, compilation, and
render viability before returning a plan or mutating source/service state. An optional
`vista preview <slug>` may provide the same validation with HMR. Telemetry export
finalization must be nonblocking and bounded so observability cannot dominate the
authoring loop.

## VRS Impact

Decision 0077 adopts owner-scoped `vista-source` resolution and automatic receipts.
VST-R64, AGT.CLI-R56/R69, and OBS-R73 carry the one-command, fail-before-mutation,
and bounded-finalization requirements.
