# Mermaid theme travels per render, not through the process global

Status: accepted

## Context

OQ-MERMAID-THEME asked whether the process-global `mermaid.initialize` state
could stay correct for concurrent diagrams or had to be replaced by an
explicitly threaded per-render theme boundary. The block already carried the
replacement (theme-free global init at `MermaidDiagram.tsx:95`, per-render
`%%{init}` directive at :56-59, unique render ids) — but the claim was unproven.

## Evidence and Argument

Throwaway concurrency proof, 2026-09-12 (subagent, no commits; story + probe
deleted afterwards, tree verified clean): two identical sources rendered
concurrently under nested opposite `ThemeProvider`s plus one theme flip.
Light SVGs contained only light hexes (#eef2ff/#1e293b/#94a3b8/#c7d2fe),
dark SVGs only dark hexes (#1e293b/#e2e8f0/#64748b/#475569), zero crossover
either direction, before and after the flip. Full record:
`02-mermaid/.experiments/2026-09-12-concurrent-theme-proof.md`.

## Options

| Mechanism | Tradeoffs |
| --- | --- |
| Process-global init carries theme | Single call site; last-writer-wins across concurrent renders |
| Threaded per-render directive | Theme travels with render input; immune to scheduling; proven |

## Decision

Threaded per-render theme boundary is the mechanism; the global init stays
theme-free (`{startOnLoad:false, securityLevel:'strict'}`). OQ-MERMAID-THEME
closes.

## Consequences

- Any future Mermaid theme bug is a directive-threading bug, not global state.
- The proof pattern (opposite-theme concurrent render + hex-crossover assert)
  is the regression shape if theme handling is ever reworked.
