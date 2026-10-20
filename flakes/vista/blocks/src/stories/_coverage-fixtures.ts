/**
 * Extra deterministic fixtures for the exhaustive review-coverage stories: long
 * content, wide/awkward inputs, and the chart-kind matrix. Kept apart from
 * `_fixtures.ts` so the canonical narrative fixtures stay small and stable.
 *
 * Everything here is authored or derived by pure arithmetic — no `Math.random`,
 * no `Date.now()` — so two loads of the same story are pixel-identical.
 */
import type {
  ChartSpec,
  FileTreeEntry,
  GitStatus,
  SettledDecision,
  TreemapLens,
  TreemapModel,
} from '../model.ts'

const HUNK_COUNT = 6
const HUNK_LINES = 6

/**
 * A long unified patch (six hunks over one file) for scroll/virtualization and
 * narrow-viewport review. Deterministic: line bodies are index-derived.
 */
export const longPatch = `--- a/src/runtime/scheduler.ts
+++ b/src/runtime/scheduler.ts
${Array.from({ length: HUNK_COUNT }, (_unused, hunk) => {
  const start = 1 + hunk * 40
  const body = Array.from({ length: HUNK_LINES }, (_u, line) => {
    const n = hunk * HUNK_LINES + line
    if (line % 3 === 0) return `-  const budget${n} = wait(${n * 10})`
    if (line % 3 === 1) return `+  const budget${n} = wait(${n * 10}, { deadline: true })`
    return `   log.debug('tick', ${n})`
  }).join('\n')
  return `@@ -${start},${HUNK_LINES} +${start},${HUNK_LINES} @@ scheduler hunk ${hunk + 1}\n${body}`
}).join('\n')}
`

/** A patch whose two sides differ only inside one identifier — the word/char-level case. */
export const subtlePatch = `--- a/src/reap.ts
+++ b/src/reap.ts
@@ -1,3 +1,3 @@
 export const reapGroup = (pid: number) =>
-  process.kill(-pid, 'SIGTERM')
+  process.kill(-pid, 'SIGKILL')
`

/** A patch with no hunks at all: a rename-only change. */
export const renameOnlyPatch = `--- a/src/old-name.ts
+++ b/src/new-name.ts
`

const STATUS_CYCLE: readonly GitStatus[] = [
  'modified',
  'added',
  'deleted',
  'renamed',
  'untracked',
  'ignored',
]

/**
 * A wide, deeply nested changed-file list (48 paths across 8 packages) that
 * exercises every `GitStatus` marker and forces the tree to scroll.
 */
export const wideFileTreeEntries: readonly FileTreeEntry[] = Array.from(
  { length: 48 },
  (_unused, i) => {
    const pkg = `packages/pkg-${String(i % 8)}`
    const leaf = `src/module-${String(Math.floor(i / 8))}/file-${String(i)}.ts`
    return { path: `${pkg}/${leaf}`, status: STATUS_CYCLE[i % STATUS_CYCLE.length]! }
  },
)

/** A single-chain tree: every directory has exactly one child (the flatten case). */
export const singleChainFileTreeEntries: readonly FileTreeEntry[] = [
  { path: 'a/b/c/d/e/only.ts', status: 'added' },
]

/** Paths long enough to test truncation/wrapping in a narrow column. */
export const longPathFileTreeEntries: readonly FileTreeEntry[] = [
  {
    path: 'services/agent-run-viewer/src/infrastructure/persistence/repositories/session-transcript-repository.ts',
    status: 'modified',
  },
  {
    path: 'services/agent-run-viewer/src/infrastructure/persistence/repositories/session-transcript-repository.test.ts',
    status: 'added',
  },
  { path: 'README.md' },
]

const chartData = [
  { label: '00:00', values: { alpha: 42, beta: 18, gamma: 7 } },
  { label: '00:05', values: { alpha: 48, beta: 22, gamma: 5 } },
  { label: '00:10', values: { alpha: 39, beta: 27, gamma: 11 } },
  { label: '00:15', values: { alpha: 31, beta: 33, gamma: 16 } },
  { label: '00:20', values: { alpha: 44, beta: 20, gamma: 9 } },
  { label: '00:25', values: { alpha: 51, beta: 14, gamma: 4 } },
]

const chartSeries = [
  { key: 'alpha', label: 'alpha', intent: 'success' as const },
  { key: 'beta', label: 'beta', intent: 'neutral' as const },
  { key: 'gamma', label: 'gamma', intent: 'error' as const },
]

/** The same payload under every `ChartKind` — the kind axis, one variable changed. */
export const chartKindSpecs: readonly ChartSpec[] = (
  ['line', 'area', 'bar', 'stacked-area', 'stacked-bar'] as const
).map((kind) => ({
  title: `kind: ${kind}`,
  kind,
  yLabel: 'Runs',
  unit: 'runs',
  series: chartSeries,
  data: chartData,
}))

/** A single-point series: the degenerate-but-valid chart case. */
export const singlePointChart: ChartSpec = {
  title: 'Single sample',
  description: 'One datum — axes and legend must still resolve.',
  kind: 'line',
  xLabel: 'Captured at',
  yLabel: 'Latency',
  unit: 'ms',
  series: [{ key: 'p50', label: 'p50' }],
  data: [{ label: '00:00', values: { p50: 82 } }],
}

/** A dense series (60 points) for label-collision and small-multiple review. */
export const denseChart: ChartSpec = {
  title: 'Dense series',
  description: '60 samples: axis labels must thin out rather than collide.',
  kind: 'line',
  unit: 'ms',
  series: [{ key: 'p95', label: 'p95', intent: 'warning' }],
  data: Array.from({ length: 60 }, (_unused, i) => ({
    label: `t${String(i)}`,
    values: { p95: 120 + ((i * 37) % 90) },
  })),
}

const LONG_SUMMARY =
  'The supervisor owns the process group and reaps it on exit, so a crashed provider can never outlive the run that created it; the viewer attaches to the group only through the supervisor, which keeps a single owner for lifetime and a single place to observe termination.'

/** Settled decisions with long titles and long summaries (the wrapping case). */
export const longSettledDecisions: readonly SettledDecision[] = [
  {
    id: 'sd-long-1',
    title:
      'Bounded graceful shutdown with an operator-visible reap counter, escalating to SIGKILL after the grace window elapses',
    summary: LONG_SUMMARY,
  },
  {
    id: 'sd-long-2',
    title: 'Projection stays an adapter',
    summary: LONG_SUMMARY,
  },
]

/** Long prose for callout/body wrapping review. */
export const longCalloutBody = `${LONG_SUMMARY} ${LONG_SUMMARY}`

/**
 * A small tree whose leaves carry a `provenance` facet, so the default-hide
 * lens (`hiddenFacets`) and the "N hidden" filter affordance are reviewable —
 * the narrative fixtures carry no facets.
 */
export const facetedTreemapModel: TreemapModel = {
  unit: 'lines',
  valueNoun: 'churn',
  root: {
    id: 'faceted-root',
    label: 'repo',
    children: [
      {
        id: 'faceted-src',
        label: 'src',
        children: [
          {
            id: 'faceted-src-app',
            label: 'app.ts',
            value: 420,
            facets: { provenance: 'authored' },
          },
          {
            id: 'faceted-src-model',
            label: 'model.ts',
            value: 260,
            facets: { provenance: 'authored' },
          },
          {
            id: 'faceted-src-gen',
            label: 'schema.generated.ts',
            value: 1840,
            facets: { provenance: 'generated' },
          },
        ],
      },
      {
        id: 'faceted-lock',
        label: 'pnpm-lock.yaml',
        value: 3200,
        facets: { provenance: 'generated' },
      },
      {
        id: 'faceted-docs',
        label: 'docs',
        children: [
          {
            id: 'faceted-docs-readme',
            label: 'README.md',
            value: 180,
            facets: { provenance: 'authored' },
          },
          {
            id: 'faceted-docs-api',
            label: 'api.md',
            value: 90,
            facets: { provenance: 'generated' },
          },
        ],
      },
    ],
  },
}

/**
 * Pair of treemap lens fixtures that contrast facet filtering, one hiding generated provenance and
 * one including everything, for demonstrating facet-driven treemap variants.
 */
export const facetedTreemapLenses: readonly TreemapLens[] = [
  {
    id: 'authored-only',
    layout: 'treemap',
    maxDepth: 3,
    colorBy: 'group',
    hiddenFacets: { provenance: ['generated'] },
  },
  { id: 'everything', layout: 'treemap', maxDepth: 3, colorBy: 'value' },
]
