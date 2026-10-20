/**
 * Deterministic, semantically-consistent story fixtures for the Vista kit.
 *
 * The data models a single coherent app — an `axe` provider-registry
 * architecture app — so the doctrine blocks (ask / fork / settled) and the
 * composition story all refer to the same decisions and evidence anchors. IDs,
 * status buckets, and counts agree with each other (the doctrine invariants the
 * advisory linter would check).
 */
import type {
  FileTreeEntry,
  ForkBranch,
  GhPreview,
  InterfaceRow,
  OpenQuestion,
  ChartSpec,
  MetricData,
  OptionCard,
  ProfileData,
  Recommendation,
  ResponsibilityRow,
  SettledDecision,
  SystemLens,
  SystemModel,
  TraceData,
} from '../model.ts'

/**
 * Fixture list of recommendation records with titles, rationale, evidence refs, and sign-off flags
 * used to exercise recommendation-rendering blocks.
 */
export const recommendations: readonly Recommendation[] = [
  {
    id: 'rec-supervised-pty',
    title: 'Adopt the supervised-PTY embed composition for the agent-run viewer',
    lean: 'survives viewer failure; provider process group is reaped on shutdown',
    evidenceRef: 'fork-viewer-composition',
    awaitingSignoff: true,
  },
  {
    id: 'rec-bounded-shutdown',
    title: 'Use bounded graceful provider shutdown (5s) before SIGKILL',
    lean: 'avoids orphaned esbuild children without hanging the supervisor',
    evidenceRef: 'interfaces-shutdown',
    awaitingSignoff: true,
  },
]

/**
 * Fixture list of open questions, each carrying a tracking code, a lean, and an evidence
 * reference, for driving open-question block stories.
 */
export const openQuestions: readonly OpenQuestion[] = [
  {
    id: 'oq-outer-projection',
    code: 'O-outer-projection',
    question: 'Should the outer-environment projection adapter be pluggable per host?',
    lean: 'yes — keep it an adapter so non-tmux hosts slot in',
    evidenceRef: 'callout-projection',
  },
  {
    id: 'oq-evict-policy',
    code: 'O-evict-policy',
    question: 'What triggers mount eviction — idle time, count cap, or both?',
    lean: 'count cap first; idle later',
  },
]

/**
 * Fixture list of already-decided items with a short title and one-line summary for rendering
 * settled-decision views.
 */
export const settledDecisions: readonly SettledDecision[] = [
  {
    id: 'set-terminate-provider',
    title: 'Terminate provider on post-launch visual-TUI failure',
    summary: 'A visual-TUI failure after launch terminates the provider rather than leaking it.',
  },
  {
    id: 'set-process-group',
    title: 'Terminate the provider process group',
    summary: 'Kill the whole group (KillMode=control-group) so esbuild children are reaped.',
  },
  {
    id: 'set-disposable-viewer',
    title: 'Viewers are disposable; the provider survives viewer failure',
    summary: 'The viewer is a thin, replaceable surface over a supervised provider.',
  },
]

/**
 * Fixture set of fork branch options, each with a thesis, verdict, rationale, and pros/cons, where
 * exactly one branch is marked chosen for fork-visualization stories.
 */
export const forkBranches: readonly ForkBranch[] = [
  {
    id: 'branch-supervised',
    label: 'A',
    name: 'Supervised PTY + disposable viewer',
    thesis: 'Root the provider under a supervisor; the viewer attaches and may die freely.',
    verdict: 'chosen',
    why: 'Survives viewer crashes and reaps the provider group on shutdown — both drivers met.',
    pros: ['viewer failure is non-fatal', 'clean process-group teardown'],
    cons: ['one extra supervision layer'],
  },
  {
    id: 'branch-inline',
    label: 'B',
    name: 'Inline viewer owns the provider',
    thesis: 'The viewer spawns and owns the provider directly — no supervisor.',
    verdict: 'rejected',
    why: 'A viewer crash orphans the provider and its esbuild children.',
    failedDrivers: ['survives-viewer-failure', 'clean-teardown'],
    proofRef: 'set-process-group',
    cons: ['orphaned children on crash'],
  },
  {
    id: 'branch-pipe',
    label: 'C',
    name: 'Pipe-only, no PTY',
    thesis: 'Forgo a PTY and stream stdout/stderr over a pipe.',
    verdict: 'rejected',
    why: 'Visual TUIs need a real terminal; a pipe breaks the post-launch visual path.',
    failedDrivers: ['visual-tui-fidelity'],
    cons: ['no interactive TUI'],
  },
]

/**
 * Fixture option cards pairing pros and cons with a verdict, including one flagged as the
 * recommended default.
 */
export const optionCards: readonly OptionCard[] = [
  {
    id: 'opt-supervised',
    name: 'Supervised PTY',
    pros: ['viewer-failure tolerant', 'group teardown'],
    cons: ['extra layer'],
    verdict: 'recommended default',
    recommended: true,
  },
  {
    id: 'opt-inline',
    name: 'Inline viewer-owned',
    pros: ['simplest wiring'],
    cons: ['orphans provider on crash'],
  },
  {
    id: 'opt-pipe',
    name: 'Pipe-only',
    pros: ['no PTY dependency'],
    cons: ['no visual TUI'],
  },
]

/**
 * Fixture responsibility-matrix rows assigning lifecycle duties to owners, with optional notes,
 * for rendering responsibility tables.
 */
export const responsibilityRows: readonly ResponsibilityRow[] = [
  {
    id: 'resp-supervisor',
    owner: 'Supervisor',
    responsibility: 'Owns the provider PTY lifecycle and reaps its process group',
  },
  {
    id: 'resp-viewer',
    owner: 'Viewer',
    responsibility: 'Renders the attached PTY; disposable',
    notes: 'may die without killing the provider',
  },
  {
    id: 'resp-projection',
    owner: 'Projection adapter',
    responsibility: 'Maps the provider onto the outer host environment',
    notes: 'pluggable per host',
  },
]

/**
 * Fixture API documentation rows giving each interface member a signature and a one-line
 * description for interface-table stories.
 */
export const interfaceRows: readonly InterfaceRow[] = [
  {
    id: 'if-attach',
    name: 'attach',
    signature: '(providerId: string) => ViewerHandle',
    description: 'Attach a fresh viewer to a supervised provider.',
  },
  {
    id: 'if-shutdown',
    name: 'shutdown',
    signature: '(opts: { graceMs: number }) => Promise<void>',
    description: 'Bounded graceful shutdown, then SIGKILL the process group.',
  },
  {
    id: 'if-project',
    name: 'project',
    signature: '(provider: Provider, host: OuterEnv) => Scene',
    description: 'Pluggable outer-environment projection adapter.',
  },
]

/**
 * Fixture decision-log entries combining a status (locked or awaiting sign-off) with a short
 * summary for decision-log timeline stories.
 */
export const decisionLogEntries = [
  {
    id: 'dl-terminate',
    title: 'Terminate provider on visual-TUI failure',
    status: 'locked' as const,
    summary: 'Post-launch failure terminates, never leaks.',
  },
  {
    id: 'dl-shutdown',
    title: 'Bounded graceful shutdown',
    status: 'awaiting-sign-off' as const,
    summary: '5s grace then SIGKILL the group.',
  },
  {
    id: 'dl-projection',
    title: 'Pluggable projection adapter',
    status: 'open' as const,
    summary: 'Per-host adapter vs single tmux impl.',
  },
]

/**
 * Mermaid flowchart source string describing how the supervisor spawns the provider, the viewer
 * attaches over a PTY, and the supervisor reaps the provider's group.
 */
export const mermaidSource = `flowchart LR
  Supervisor -->|spawns| Provider
  Provider -->|PTY| Viewer
  Viewer -.attach/detach.-> Provider
  Supervisor -->|reap group| Provider`

// --- diff / file-tree fixtures (decision 0024) ---

/** A small unified-diff patch exercising additions, deletions, context. */
export const samplePatch = `--- a/src/supervisor.ts
+++ b/src/supervisor.ts
@@ -1,8 +1,9 @@
 import { spawn } from 'node:child_process'
+import { reapGroup } from './reap.ts'

 export const supervise = (cmd: string) => {
-  const child = spawn(cmd, { detached: false })
+  const child = spawn(cmd, { detached: true })
   child.on('exit', () => {
-    console.log('child exited')
+    reapGroup(child.pid)
   })
   return child
 }
`

/**
 * Pre-change fixture file representing the old supervisor behavior, where grace is zero and kill
 * exits immediately, used as the 'before' side of diff fixtures.
 */
export const oldFile = `export const grace = 0
export const kill = () => process.exit(1)
`
/**
 * Post-change fixture file where kill applies a 5-second grace and signals the entire process
 * group, serving as the 'after' side of diff fixtures.
 */
export const newFile = `export const grace = 5_000
export const kill = (signal = 'SIGTERM') => {
  process.kill(-process.pid, signal)
}
`

/**
 * Fixture file-tree entries with mixed git statuses (modified, added, deleted, and one
 * unspecified) for exercising file-tree block stories.
 */
export const fileTreeEntries: readonly FileTreeEntry[] = [
  { path: 'src/supervisor.ts', status: 'modified' },
  { path: 'src/reap.ts', status: 'added' },
  { path: 'src/viewer/attach.ts', status: 'modified' },
  { path: 'src/viewer/legacy.ts', status: 'deleted' },
  { path: 'src/projection/tmux.ts', status: 'added' },
  { path: 'docs/agent-run.md', status: 'modified' },
  { path: 'README.md' },
]

// --- system-explorer fixtures (decision 0018) ---

/**
 * The agent-run subsystem as a typed graph: containers with component children
 * (semantic zoom) and parallel edges keyed by aspect (the multi-dimensionality).
 */
export const systemModel: SystemModel = {
  nodes: [
    { id: 'agent-run', label: 'axe agent-run', level: 'context', domain: 'axe' },
    {
      id: 'supervisor',
      label: 'Supervisor',
      level: 'container',
      parent: 'agent-run',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'provider',
      label: 'Provider PTY',
      level: 'container',
      parent: 'agent-run',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'viewer',
      label: 'Viewer',
      level: 'container',
      parent: 'agent-run',
      lifecycle: 'beta',
      trust: 'trusted',
    },
    {
      id: 'projection',
      label: 'Projection adapter',
      level: 'container',
      parent: 'agent-run',
      lifecycle: 'experimental',
      trust: 'sandboxed',
    },
    // Supervisor components (drill targets).
    {
      id: 'sup-lifecycle',
      label: 'Lifecycle',
      level: 'component',
      parent: 'supervisor',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'sup-reaper',
      label: 'Group reaper',
      level: 'component',
      parent: 'supervisor',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    // Provider components.
    {
      id: 'prov-pty',
      label: 'PTY host',
      level: 'component',
      parent: 'provider',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'prov-esbuild',
      label: 'esbuild child',
      level: 'component',
      parent: 'provider',
      lifecycle: 'stable',
      trust: 'sandboxed',
    },
    // Viewer components.
    {
      id: 'view-render',
      label: 'Renderer',
      level: 'component',
      parent: 'viewer',
      lifecycle: 'beta',
      trust: 'trusted',
    },
  ],
  edges: [
    // dataflow
    { id: 'e-d1', source: 'provider', target: 'viewer', aspect: 'dataflow', label: 'PTY stream' },
    { id: 'e-d2', source: 'prov-pty', target: 'view-render', aspect: 'dataflow', label: 'bytes' },
    { id: 'e-d3', source: 'projection', target: 'viewer', aspect: 'dataflow', label: 'scene' },
    // controlflow
    { id: 'e-c1', source: 'supervisor', target: 'provider', aspect: 'controlflow', label: 'spawn' },
    {
      id: 'e-c2',
      source: 'sup-lifecycle',
      target: 'prov-pty',
      aspect: 'controlflow',
      label: 'start',
    },
    {
      id: 'e-c3',
      source: 'sup-reaper',
      target: 'prov-esbuild',
      aspect: 'controlflow',
      label: 'reap group',
    },
    {
      id: 'e-c4',
      source: 'viewer',
      target: 'provider',
      aspect: 'controlflow',
      label: 'attach/detach',
    },
    // ownership
    { id: 'e-o1', source: 'supervisor', target: 'provider', aspect: 'ownership', label: 'owns' },
    // telemetry
    { id: 'e-t1', source: 'provider', target: 'projection', aspect: 'telemetry', label: 'spans' },
    { id: 'e-t2', source: 'viewer', target: 'projection', aspect: 'telemetry', label: 'events' },
  ],
}

/**
 * Fixture system-explorer lenses varying aspect selection while keeping the container-level
 * layered-right layout, for demonstrating aspect-driven views.
 */
export const systemLenses: readonly SystemLens[] = [
  {
    id: 'overview',
    aspects: ['dataflow', 'controlflow'],
    maxLevel: 'container',
    layout: 'layered-right',
  },
  {
    id: 'all-aspects',
    aspects: ['dataflow', 'controlflow', 'ownership', 'telemetry'],
    maxLevel: 'container',
    layout: 'layered-right',
  },
  {
    id: 'drill-supervisor',
    aspects: ['controlflow'],
    maxLevel: 'container',
    expanded: ['supervisor', 'provider'],
    layout: 'layered-down',
  },
]

/**
 * Fixture system model of an incident-era architecture whose nodes span context and container
 * levels and carry domain, lifecycle, and trust metadata for explorer stories.
 */
export const incidentSystemModel: SystemModel = {
  nodes: [
    { id: 'edge', label: 'Edge network', level: 'context', domain: 'ingress' },
    {
      id: 'gateway',
      label: 'API gateway',
      level: 'container',
      parent: 'edge',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'auth',
      label: 'Auth service',
      level: 'container',
      parent: 'edge',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'planner',
      label: 'Workflow planner',
      level: 'container',
      parent: 'edge',
      lifecycle: 'beta',
      trust: 'trusted',
    },
    {
      id: 'queue',
      label: 'Durable queue',
      level: 'container',
      parent: 'edge',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'runner',
      label: 'Runner fleet',
      level: 'container',
      parent: 'edge',
      lifecycle: 'stable',
      trust: 'sandboxed',
    },
    {
      id: 'mimir',
      label: 'Mimir',
      level: 'container',
      parent: 'edge',
      lifecycle: 'stable',
      trust: 'trusted',
    },
    {
      id: 'grafana',
      label: 'Grafana',
      level: 'container',
      parent: 'edge',
      lifecycle: 'stable',
      trust: 'trusted',
    },
  ],
  edges: [
    { id: 'inc-d1', source: 'gateway', target: 'auth', aspect: 'controlflow', label: 'verify' },
    { id: 'inc-d2', source: 'gateway', target: 'planner', aspect: 'dataflow', label: 'job spec' },
    { id: 'inc-d3', source: 'planner', target: 'queue', aspect: 'controlflow', label: 'enqueue' },
    { id: 'inc-d4', source: 'queue', target: 'runner', aspect: 'controlflow', label: 'dispatch' },
    { id: 'inc-t1', source: 'gateway', target: 'mimir', aspect: 'telemetry', label: 'http spans' },
    { id: 'inc-t2', source: 'planner', target: 'mimir', aspect: 'telemetry', label: 'queue lag' },
    { id: 'inc-t3', source: 'runner', target: 'mimir', aspect: 'telemetry', label: 'run spans' },
    { id: 'inc-t4', source: 'mimir', target: 'grafana', aspect: 'telemetry', label: 'alerts' },
    { id: 'inc-o1', source: 'planner', target: 'queue', aspect: 'ownership', label: 'owns schema' },
  ],
}

/**
 * Fixture lenses for the incident model, including a blast-radius lens focused on the planner that
 * mutes untrusted nodes and a pipeline-run lens over data and control flow.
 */
export const incidentSystemLenses: readonly SystemLens[] = [
  {
    id: 'incident-blast-radius',
    aspects: ['controlflow', 'telemetry'],
    maxLevel: 'container',
    focus: 'planner',
    muteBy: { key: 'trust', keep: 'trusted' },
    layout: 'layered-right',
  },
  {
    id: 'pipeline-run',
    aspects: ['dataflow', 'controlflow'],
    maxLevel: 'container',
    layout: 'layered-right',
  },
  {
    id: 'telemetry-overlay',
    aspects: ['telemetry', 'ownership'],
    maxLevel: 'container',
    layout: 'layered-down',
  },
]

// --- chart fixtures ---

/**
 * Fixture area-chart spec plotting p50 and p95 viewer-attach latency (in ms) across a deploy
 * window, with the p95 series styled as a warning.
 */
export const latencyChart: ChartSpec = {
  title: 'Attach latency',
  description: 'p50/p95 viewer attach latency over the last deploy window.',
  kind: 'area',
  yLabel: 'Latency',
  unit: 'ms',
  series: [
    { key: 'p50', label: 'p50', intent: 'neutral' },
    { key: 'p95', label: 'p95', intent: 'warning' },
  ],
  data: [
    { label: '00:00', values: { p50: 82, p95: 210 } },
    { label: '00:05', values: { p50: 79, p95: 188 } },
    { label: '00:10', values: { p50: 91, p95: 260 } },
    { label: '00:15', values: { p50: 104, p95: 344 } },
    { label: '00:20', values: { p50: 88, p95: 220 } },
    { label: '00:25', values: { p50: 76, p95: 171 } },
  ],
}

/**
 * Story fixture defining a stacked-bar chart of per-minute run outcomes whose ok, queued, and
 * error series keep error as the only strong-hued intent.
 */
export const throughputChart: ChartSpec = {
  title: 'Run outcomes',
  description: 'Stacked run outcomes by minute with errors kept as the only strong hue.',
  kind: 'stacked-bar',
  unit: 'runs',
  series: [
    { key: 'ok', label: 'ok', intent: 'success' },
    { key: 'queued', label: 'queued', intent: 'neutral' },
    { key: 'error', label: 'error', intent: 'error' },
  ],
  data: [
    { label: '00:00', values: { ok: 42, queued: 8, error: 1 } },
    { label: '00:05', values: { ok: 48, queued: 6, error: 0 } },
    { label: '00:10', values: { ok: 39, queued: 11, error: 2 } },
    { label: '00:15', values: { ok: 31, queued: 18, error: 6 } },
    { label: '00:20', values: { ok: 44, queued: 9, error: 1 } },
  ],
}

// --- telemetry fixtures (Grafana island; decisions 0040/0041/0042/0046) ---

/**
 * A representative PromQL-`matrix`-faithful metric series (`MetricData`). AUTHORED
 * here, not copied: the `telemetry-island` sample is fed by the LIVE `otel`
 * provider and ships no frozen `snapshot.json`, so there is no existing metric
 * fixture to reuse (unlike the trace/flamegraph samples, which carry inline
 * consts). Shape matches the otel provider's success series exactly: `t` is unix
 * SECONDS, `v` the sample value. A node-CPU-rate curve over a 5-minute window at a
 * 15s step.
 */
const CPU_T0_SECONDS = 1_700_000_000
const cpuSamples = [
  0.18, 0.21, 0.24, 0.33, 0.41, 0.39, 0.46, 0.52, 0.61, 0.58, 0.55, 0.49, 0.43, 0.47, 0.54, 0.62,
  0.71, 0.68, 0.64, 0.59,
].map((v, i) => ({ t: CPU_T0_SECONDS + i * 15, v }))

/**
 * Story fixture providing a single node CPU usage metric series for one instance and mode, backed
 * by the shared cpuSamples array.
 */
export const metricData: MetricData = {
  series: [
    {
      metric: 'node_cpu_usage_rate',
      labels: { instance: 'dev3', mode: 'user' },
      samples: cpuSamples,
    },
  ],
}

/** A clean multi-service trace: one root, an error leaf, a nested DB span (telemetry-trace sample). */
const TRACE_T0_NANOS = 1_700_000_000_000_000_000n
const traceNano = (msOffset: number): string =>
  String(TRACE_T0_NANOS + BigInt(msOffset) * 1_000_000n)

/**
 * Story fixture representing a multi-service checkout trace whose root gateway span anchors child
 * spans with explicit nanosecond timings and status codes.
 */
export const checkoutTrace: TraceData = {
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spans: [
    {
      spanId: 's1',
      parentSpanId: '',
      name: 'POST /v1/checkout',
      serviceName: 'gateway',
      kind: 'SPAN_KIND_SERVER',
      startTimeUnixNano: traceNano(0),
      endTimeUnixNano: traceNano(150),
      statusCode: 'STATUS_CODE_OK',
      attributes: [
        { key: 'http.method', value: 'POST' },
        { key: 'http.status_code', value: '200' },
      ],
    },
    {
      spanId: 's2',
      parentSpanId: 's1',
      name: 'authz.check',
      serviceName: 'auth',
      kind: 'SPAN_KIND_CLIENT',
      startTimeUnixNano: traceNano(8),
      endTimeUnixNano: traceNano(40),
      statusCode: 'STATUS_CODE_OK',
      attributes: [{ key: 'cache.hit', value: 'true' }],
    },
    {
      spanId: 's3',
      parentSpanId: 's1',
      name: 'cart.load',
      serviceName: 'cart',
      kind: 'SPAN_KIND_INTERNAL',
      startTimeUnixNano: traceNano(42),
      endTimeUnixNano: traceNano(120),
      statusCode: 'STATUS_CODE_OK',
      events: [{ name: 'cache.miss', timeUnixNano: traceNano(50) }],
    },
    {
      spanId: 's4',
      parentSpanId: 's3',
      name: 'SELECT items',
      serviceName: 'postgres',
      kind: 'SPAN_KIND_CLIENT',
      startTimeUnixNano: traceNano(50),
      endTimeUnixNano: traceNano(110),
      statusCode: 'STATUS_CODE_OK',
      attributes: [{ key: 'db.system', value: 'postgresql' }],
    },
    {
      spanId: 's5',
      parentSpanId: 's1',
      name: 'payments.charge',
      serviceName: 'payments',
      kind: 'SPAN_KIND_CLIENT',
      startTimeUnixNano: traceNano(122),
      endTimeUnixNano: traceNano(148),
      statusCode: 'STATUS_CODE_ERROR',
      attributes: [{ key: 'retry.count', value: '2' }],
      events: [{ name: 'exception', timeUnixNano: traceNano(140) }],
    },
  ],
}

/**
 * A rootless/partial trace: every top span references a parent absent from the
 * payload (the common Tempo case). The island's adapter synthesizes ONE
 * placeholder root and repoints the orphans under it (telemetry-trace sample).
 */
export const partialTrace: TraceData = {
  traceId: '00000000000000000000000000000abc',
  spans: [
    {
      spanId: 'b1',
      parentSpanId: 'absent-parent-0000',
      name: 'process.job',
      serviceName: 'worker',
      kind: 'SPAN_KIND_CONSUMER',
      startTimeUnixNano: traceNano(0),
      endTimeUnixNano: traceNano(90),
      statusCode: 'STATUS_CODE_OK',
    },
    {
      spanId: 'b2',
      parentSpanId: 'absent-parent-0000',
      name: 'query batch',
      serviceName: 'db',
      kind: 'SPAN_KIND_CLIENT',
      startTimeUnixNano: traceNano(10),
      endTimeUnixNano: traceNano(70),
      statusCode: 'STATUS_CODE_ERROR',
    },
    {
      spanId: 'b3',
      parentSpanId: 'b1',
      name: 'cache.get',
      serviceName: 'cache',
      kind: 'SPAN_KIND_CLIENT',
      startTimeUnixNano: traceNano(15),
      endTimeUnixNano: traceNano(35),
      statusCode: 'STATUS_CODE_OK',
    },
  ],
}

/**
 * A small, valid CPU flamebearer: `main` → `handler` → `db.query`, plus a sibling
 * `serialize`. `levels` are BFS; each node is `[offsetDelta, total, self,
 * nameIndex]` (telemetry-flamegraph sample).
 */
export const cpuProfile: ProfileData = {
  profileTypeId: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds',
  names: ['total', 'main', 'handler', 'db.query', 'serialize'],
  levels: [
    [0, 100, 0, 0],
    [0, 100, 10, 1],
    [0, 60, 20, 2, 0, 30, 30, 4],
    [0, 40, 40, 3],
  ],
  total: 100,
  maxSelf: 40,
  unit: 'ns',
}

/** A small heap-allocation flamebearer: `serve` → `decode` + `cache.put` (telemetry-flamegraph sample). */
export const allocProfile: ProfileData = {
  profileTypeId: 'memory:alloc_space:bytes:space:bytes',
  names: ['total', 'serve', 'decode', 'cache.put'],
  levels: [
    [0, 200, 0, 0],
    [0, 200, 20, 1],
    [0, 120, 50, 2, 0, 60, 60, 3],
  ],
  total: 200,
  maxSelf: 60,
  unit: 'bytes',
}

// --- gh-previews fixture (frozen payload, decision 0024) ---

/**
 * Story fixture describing an open pull-request preview, including metadata, description body, and
 * per-file patches, for exercising the GitHub preview block.
 */
export const ghPreview: GhPreview = {
  kind: 'pull-request',
  number: 312,
  title: 'fix(agent-run): reap the provider process group on shutdown',
  url: 'https://github.com/schickling/axe/pull/312',
  author: 'schickling-assistant',
  state: 'open',
  body: 'Detaches the provider so the supervisor can reap the whole group, closing the esbuild-orphan leak.',
  files: [
    { path: 'src/supervisor.ts', status: 'modified', patch: samplePatch },
    {
      path: 'src/reap.ts',
      status: 'added',
      patch: `--- /dev/null
+++ b/src/reap.ts
@@ -0,0 +1,3 @@
+export const reapGroup = (pid?: number) => {
+  if (pid) process.kill(-pid, 'SIGTERM')
+}
`,
    },
    { path: 'src/viewer/legacy.ts', status: 'deleted' },
  ],
}
