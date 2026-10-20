# Experiment: Mermaid concurrent opposite-theme proof (2026-09-12)

Closes OQ-MERMAID-THEME. Throwaway proof, no commits: temp Storybook story +
Playwright probe, both deleted afterwards, `git status` verified clean.

## Setup

Two `MermaidDiagram`s with identical source (fixture `mermaidSource`),
mounted in the same tick under nested opposite `ThemeProvider`s
(light + dark), then both themes flipped once to catch stale-theme
resolution. React-context theme (`useTheme`) → `themeVars(theme)` →
inline `%%{init:{theme:'base',themeVariables}}%%` directive per render.

## Result

PASS. Light SVGs contained only light hexes
(#eef2ff/#1e293b/#94a3b8/#c7d2fe); dark SVGs only dark hexes
(#1e293b bg fill, #e2e8f0 text, #64748b, #475569). Zero crossover either
direction, initial and flipped renders.

## Conclusion

Per-render theme threading is proven; the process global stays theme-free.
Any future rework of Mermaid theming re-runs this shape (same source,
opposite providers, flip, hex-crossover assert) as its regression gate.
Decision: `vista/.decisions/0083-mermaid-threaded-per-render.md`.
