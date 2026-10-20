# Vista Roadmap

Non-normative future directions. Timeless intent lives in vision/requirements/
spec; this is the trajectory, not a commitment.

## Feedback capture

Vista is view-first with one realized input boundary: bounded answers to the
agent's explicit finite-choice questions (decisions 0001 and 0013). The canonical
use case is an interview App: the agent renders the scenario and question, the
human selects among the declared choices, and the answer returns through Vista's
browser-backed control path. A later durable receipt layer may add cross-session
resumability through the coding-agent attachment-by-prefix pattern.

General/freeform annotation remains a far-phase possibility that would revisit
decision 0011 and the boundary with `agentation`; it is not part of Vista's
current input contract.

The content model already carries stable ids on every block and sub-entry as the
no-migration attach point.

## Superseding plannotator

Once feedback capture exists, a markdown-review layer on top of Vista's rich
rendering (roughdraft.md-style; see
[.reference/annotation-tools-prior-art.md](./.reference/annotation-tools-prior-art.md))
could supersede `plannotator`'s niche. Until then, coexist (decision 0011).

## Widening from gated toward a default channel

Vista starts gated (decision 0010). As the block library matures and the standing
service + zero-install deps make publishing near-zero ceremony, widen the
when-to-use trigger set toward Vista as a default agent→human medium, measured
against real use.

## Block-library growth

The compounding asset. Roadmap block families (each a candidate
[`05-blocks`](./02-medium/05-blocks/requirements.md) child subsystem): mermaid +
architecture diagrams; a **system explorer** (faceted, multi-dimensional
architecture views over a structured foundation — aspect toggles, semantic zoom,
focus+context; React Flow + elkjs, decision 0018; MED.BLK.SYSX-R42–MED.BLK.SYSX-R44);
live OTel (traces, spans, metrics); GitHub previews (PR / issue / diff); the
App blocks include decision logs, options grids, responsibility/interface tables,
callouts, and the doctrine components ask/fork/status-line/settled. Proven
App-local ordinary React components curate into the block library through
Storybook incubation.

## Optional also-publish to Claude Code Artifacts

A possible distribution nicety (not in scope): `vista publish` could additionally
push to Claude Code Artifacts. Recorded for completeness; Vista remains self-owned
(decision 0003).

## Live data integration depth

Beyond the live/frozen interface, deepen integration with our telemetry and infra
(OTel/Prometheus via `gcx`/`axe otel`, GitHub) so apps can explore real current
data, not just authored snapshots. The system-explorer model aligns with the
`axe vrs` graph-JSON extractor — apps could consume VRS-extracted system graphs
directly (decision 0018).
