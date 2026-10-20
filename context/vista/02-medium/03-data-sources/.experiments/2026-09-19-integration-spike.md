# Real-codebase integration spike and cold-draft measurement — durable evidence

This durable copy records evidence established on 2026-09-19 in a disposable worktree
(branch `schickling-assistant/2026-09-19-vista-query-spike`, report `flakes/vista/SPIKE-REPORT.md`
at commit a0869e6) and during T1 integration on the `schickling/2026-09-19-vista-rsc` branch. The
spike code is reference only and is not part of the VRS.

## Question

Whether the rpc-first query primitive slots into Vista's production seams — semantic extraction,
Vite SSR single-realm provider mount, freeze, publish, the `/_data` route on pinned versions — and
what the cold draft load costs once the browser data runtime is part of the eager graph.

## Method

The spike ported `PullRequestFiles` and `MetricQuery` to `bind`/`useBinding`, added `implement`/
`mountProvider`, app-local `providers/*.query.ts` + `*.provider.ts`, and published a real sample
through the service's control RPC; the published page was driven with `playwright-cli`. During T1
integration the telemetry-island draft was loaded cold (fresh dep cache) against a baseline
worktree and the T1 branch, counting optimizer passes, outdated-dependency reloads, and time to
first canvas.

## Result

The seams held: one publish captured the app-local live binding, the page painted from
`snapshot.json` with zero `/_data` requests and refreshed through the pinned route. Cold draft
load regressed from 12 s (baseline) to 65 s: the effect reactivity and RPC subpaths enlarged the
eager closure and auto-discovery re-bundled it once per lazily discovered dependency family
(three passes). A second defect surfaced under that load: parallel cold-load requests created two
draft Vite servers, attaching two HMR upgrade listeners, after which optimizer reloads could not
recover. Coalescing draft creation removed the double listener; seeding `optimizeDeps.include`
from the Genie-projected `optimizeInclude` (discovery still on) collapsed the passes to one:
6 s to first canvas with no outdated-dependency reloads, measured on a host at load average 19–38.

## Conclusion

The rpc-first primitive integrates without a parallel manifest or transport. The cold-draft cost of
the larger closure is real and is answered by a derived optimizer seed, not by a hand-maintained
list; draft creation must be idempotent per app.

## VRS Impact

Amend decision 0052 (seeded discovery), keep decision 0044's `optimizeInclude` projection as the
seed's source, and require coalesced draft creation in the service spec.
