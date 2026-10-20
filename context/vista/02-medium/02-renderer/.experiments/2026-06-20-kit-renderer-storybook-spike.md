# Experiment: component-kit / renderer / Storybook spike (2026-06-20)

End-to-end throwaway spike validating the Vista rendering layer: a typed content
model, a shared declarative renderer, a real-React escape hatch, the live/frozen
data interface, and a Storybook incubation surface. Built with Vite + React 19 +
Tailwind v4 + Storybook 10; both `vite build` and `storybook build` passed; 7
screenshots. (Spike source was under `tmp/proto-kit/`, since reclaimed.)

## What it validates (seeds the kit subsystem spec)

- **Typed content model.** `ReviewDoc` = metadata + `Section[]`; each section a
  flat `Block[]`. `Block` is a **tagged union on `_tag`** (repo idiom): `rich-text`,
  `mermaid-diagram`, `decision-log` (status locked|open|rejected), `options-grid`
  (pros/cons/verdict/recommended), `responsibilities-table`, `interfaces-table`,
  `callout` (finding|tradeoff|constraint|open-question), `otel-panel`, `custom`.
- **Feedback-readiness hook.** Every block and every addressable sub-entry
  (decision, option card, callout) carries a stable `id`, unused by rendering
  today but the no-migration attach point for future structured feedback.
- **Portable doc.** `otel-panel` and `custom` carry only string keys
  (`sourceKey` / `componentKey`), never embedded data or component refs; the host
  resolves keys via registries. This is what enables live/frozen swap and the
  escape hatch while keeping the doc serializable.
- **Renderer + escape hatch unified.** `Renderer` is an exhaustive `switch` on
  `_tag` (`assertNever` backs it) plus a host `RenderContext = { dataSources,
  components }`. The `custom` escape hatch and first-class blocks render through
  the same path. A genuine one-off (`RiskMatrix`, an interactive likelihood×impact
  quadrant) composes inline between declarative blocks.
- **Graduation path (mechanical).** `custom`+props → prove reusable (incubate in
  Storybook `Kit/Explore/`) → lift props into a typed block in `model.ts` → the
  exhaustive switch goes red until a `case` is added → authoring flips from
  stringly `custom` to a typed block; the component is reused unchanged.
- **Live/frozen data interface.** `OtelDataSource { mode: 'live'|'frozen';
  fetch(): Promise<Loadable<OtelSeries>> }` with `Loadable<T>` a tagged
  loading|error|empty|loaded state shared by UI and stories. `liveSource` mocks a
  PromQL/OTel query (no real infra; injectable `run` to force any state);
  `frozenSource` inlines a snapshot. `freeze(source)` snapshots the last loaded
  payload → the dual-mode primitive.
- **Mermaid-in-React** handles all three failure modes: unique render id per call
  (`mmd-${id}-${seq++}`) for StrictMode double-invoke; try/catch → raw-source
  `<pre>` fallback; theme reactivity via a `MutationObserver` on
  `documentElement[data-theme]` (found+fixed a missing-effect-dep bug; switched
  `theme: 'neutral'`→`'base'` so `primaryColor` is honored). Interactive zoom/pan
  via `svg-pan-zoom` (rendered, not interaction-tested).
- **Storybook 10** via `@storybook/react-vite` (Vite 8 fine); `viteFinal` re-adds
  `@tailwindcss/vite` so stories use the real styling pipeline; light/dark via the
  app's own `data-theme` attribute; hierarchy `Kit/Blocks` (regression),
  `Kit/Compositions/ReviewShell` (the real page), `Kit/Explore` (incubation);
  `addon-a11y` wired.

## New open decisions surfaced (→ open-questions.md, kit subsystem)

1. **Bespoke prop typing** — resolved by decision 0016 (effect Schema + typed
   registry). (was OQ-CUSTOM-TYPING)
2. **Registry key typing** — `sourceKey`/`componentKey` resolve at runtime to a
   `MissingResource` placeholder; compile-time generated key union vs runtime
   flexibility. (OQ-REGISTRY-KEYS)
3. **Rich-text model** — resolved by decision 0015 (hybrid; MDX in prose leaves).
   (was OQ-RICHTEXT)
4. **Freeze-on-publish default** for live panels (proposed: freeze by default for
   reproducibility, opt-in live). (OQ-FREEZE-DEFAULT)
5. **Mermaid theme via React context** vs DOM-read (the global `mermaid.initialize`
   singleton makes DOM-read fragile with concurrent diagrams). (OQ-MERMAID-THEME)
6. **Shared Storybook config + tokens as importable modules** so review artifacts
   scaffold consistently (the shared helper was workspace-coupled / unreachable
   standalone). (OQ-KIT-PACKAGING)
7. **`--color-fg-faint` contrast** ~4.0:1 on dark, under AA 4.5:1 — token bump vs
   accept for de-emphasized metadata. (OQ-A11Y-FAINT)
