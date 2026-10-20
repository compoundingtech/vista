# Render dependency-serving benchmark: include-list vs discovery vs bundled-dev

Date: 2026-07-01. Evidence for [decision 0052](../../.decisions/0052-render-via-rolldown-bundled-dev-everywhere.md).
Method: headless (Nix Playwright) render-proof of the `chart-review` sample
(Renderer→ChartBlock→recharts→es-toolkit, the transitive-CJS discriminator),
N=5 medians, cold/warm labeled. Full data + harness under `tmp/vista-benchmark/`.

## Result (published serving)

| | include-list | discovery | bundled-dev |
|---|---|---|---|
| mounts? | yes (svg=3) | yes (svg=3) | **no (404, svg=0)** |
| console errors / WebSockets | 0 / 0 | 0 / 0 | 404 / — |
| startup→ready | 3407 ms | **411 ms** | — |
| cold render | 2810 ms | 3658 ms | — |
| warm render | ~1800 ms | ~1980 ms | — |

## The discriminator (decisive)

- **include-list with `recharts` dropped from the hand-list → BLANK** (200 but
  svg=0, exact `es-toolkit/compat/get.js does not provide an export named
  'default'`) — reproduces the production blank-render category.
- **discovery on the same case, no hand-list → renders** (svg=3, 0 errors).

The hand-list is a standing correctness hazard: a statically-imported transitive
CJS dep missing from it silently blanks the page. Discovery crawls the true graph.

## Other findings

- **Churn-safe:** a v2 with a new lazy dep cold-renders clean under both, and a
  held-open v1 page stays mounted+clean during v2's re-optimize (caveat: the churn
  dep tested was ESM, so it doesn't exercise a *new transitive CJS* dep — the
  hand-list gap remains the decisive evidence).
- **Draft HMR:** near-parity; discovery's only penalty is a one-time first-edit
  warm-up per fresh draft.
- **bundled-dev:** every published GET 404s (nested-MPA entries unresolvable) —
  disqualified for published (proof-harness only).

## Verdict (→ decision 0052)

Discovery wins on reliability (renders the closure with zero hand-list, holds the
published invariant, churn-safe) at a perf wash (8× faster startup for ~850ms
more cold; warm/HMR equivalent). Cold is rare (per-server-start/per-new-dep), so
pre-warm is optional. Unmeasured (accepted, monitor): sustained multi-version RSS
+ a possible re-optimize 504 window (0029's original rationale for the hand-list).
