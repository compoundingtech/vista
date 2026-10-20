# Default to the OS color scheme via CSS `light-dark()`

> **Superseded by [0036](./0036-geist-native-dark-first-visual-system.md) — the product default is Geist-native dark-first, not OS-following `light-dark()`. Light/dark support and the `data-theme` contract are retained.**

Status: superseded by [0036](./0036-geist-native-dark-first-visual-system.md)

## Context

Kit theming (KR07) renders all blocks off Tailwind v4 `data-theme` tokens, with
the active theme threaded through React context rather than read from the DOM
(OQ-MERMAID-THEME, so concurrent Mermaid diagrams never read a stale/foreign
attribute). The initial theme defaulted to `light` regardless of the viewer's OS
preference, so a reviewer on a dark-mode machine always got a light review until
they hit the manual toggle.

We want the OS preference (`prefers-color-scheme`) to be the default, while the
toggle still pins an explicit choice. The constraint: a published review is a
static MPA entry with no server-side render and no single HTML template (each
review's `index.html` is copied verbatim; decision 0029, 0031), so there is no
one place to inject a pre-hydration theme `<script>`. Any JS-based default also
risks a flash of the wrong theme before React mounts.

## Decision

Resolve the default theme in **CSS**, not JS, using `color-scheme` +
`light-dark()`:

- `:root { color-scheme: light dark }` — the palette follows the OS by default.
- `[data-theme="light"|"dark"] { color-scheme: light|dark }` — the shell's toggle
  pins `data-theme` (as before), which pins `color-scheme`, which makes
  `light-dark()` resolve to that branch.
- Each palette token is defined once as `light-dark(<light>, <dark>)` on `:root`.

The kit still mirrors the active theme onto `data-theme` and threads it through
context; `getSystemTheme()` resolves the OS preference to a concrete `light`/`dark`
so the context consumer (Mermaid) gets a real value. `ReviewShell` lazy-inits its
theme to `initialTheme ?? getSystemTheme()`.

## Consequences

- The default honors the viewer's OS with **zero** server/template/per-review
  changes — it works for published reviews, drafts, samples, and Storybook alike,
  because they all share the kit stylesheet.
- **FOUC-free**: `light-dark()` resolves at CSS parse, before React mounts, so the
  first paint already matches the OS. This is why no pre-hydration script is
  needed despite the verbatim-copied `index.html` (and is independent of any
  future move to a vista-owned HTML shell).
- **One source of truth** per token (its light + dark value on one line) — fewer
  CSS lines than the prior two-block split, no duplicated dark palette.
- Refines KR07: theming is still `data-theme`-token-based; `data-theme` now means
  "explicit pin", and its absence means "follow OS".
- Live OS theme switches *after* load are not followed on the default path
  (`getSystemTheme()` snapshots at mount and the mirror pins `data-theme`); this
  was deliberately out of scope (no requirement for it).
- **Compromise:** `light-dark()`/`color-scheme` are Baseline-2024 — a pre-2024
  browser gets unresolved tokens. Accepted for a tailnet-internal review tool.

Verified in-browser (Playwright `prefers-color-scheme` emulation, doctrine-review
sample with a Mermaid block): default follows the OS in both modes; the toggle
pins both directions; Mermaid renders in the matching theme.

## Superseded note

Decision 0036 keeps the light/dark support and explicit `data-theme` contract but
changes Vista's product default to dark-first and moves the palette/component
contract to `@overeng/geist-design-system`. The OS-following default described
here is historical context, not the current Vista target.
