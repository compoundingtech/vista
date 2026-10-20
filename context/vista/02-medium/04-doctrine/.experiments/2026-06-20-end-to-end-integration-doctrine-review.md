# Experiment: end-to-end integration + first doctrine review (2026-06-20)

Tied the platform + kit spikes together: authored the real `cl2-storm`
provider-capabilities-registry architecture review under the settled doctrine
(HEADER · ASK · BODY · SETTLED), rendered via the kit's `DocRenderer` (reusing kit
source, not a copy). (Spike source was under `tmp/proto-integration/`, since
reclaimed.) Validates the platform↔kit seam, the doctrine on real content, and the
kit's expressiveness.

## Verdict: it works, and it's more decision-driving

The doctrine version puts the 2 recommendations + 5 open questions first with
one-click in-doc evidence anchors, lays architecture out overview→zoom, makes
rejected option branches first-class, and collapses settled context. The original
"by artifact type" app splits content across views/.decisions/options tabs so the
reviewer reconstructs "what am I asked + what's the evidence" by hand. Confirmed:
ask-first + archetype body works on real content; evidence-reachable-from-an-ask is
satisfied via the kit's `BlockView` id anchors.

## Central doctrine finding — a decision is in exactly one status bucket

The source had **locked** the headline architecture axis (`D-archA`), yet the
review wants it surfaced as a recommendation *awaiting sign-off*; the other axis
(daemon-spine) has **no decision record**, existing only as a recommended option.
So "awaiting sign-off" and "locked/settled" overlapped on the same decision (first
pass double-placed `D-archA` and double-counted the status line). Reconciled:
architecture is *awaiting sign-off*, dropped from SETTLED → `5 locked · 5 open · 2
awaiting`. Rule the doctrine must enforce: **each decision occupies exactly one
status bucket (locked | open | awaiting-sign-off)** — resolves the
one-ask-vs-per-axis ambiguity (decision 0019).

## Block-model gaps (kit additions the doctrine needs)

Prototyped four via the `custom` escape hatch (the graduation path), now graduation
candidates (decision 0020):

- **`AskBlock`** — the BLUF: `recommendations[]{title,lean,evidenceRef,awaitingSignoff}`
  + `openQuestions[]{code,question,lean,evidenceRef}`. The single most load-bearing
  thing the model lacks (ask-first).
- **`ForkBlock`** — `axis` + `driver` + `branches[]{label,name,thesis,verdict:
  chosen|rejected|deferred,why,pros?,cons?}`. The existing `options-grid` renders a
  **flat peer card grid** — it cannot subordinate rejected branches or root the
  shared driver, which is the whole point of options-comparison.
- **`StatusLine`** — N locked · M open · K awaiting, for the HEADER.
- **`SettledBlock`** — collapsed-by-default. Finding: the first-class `decision-log`
  *groups by status in place and auto-expands non-rejected*, but the doctrine
  *places by status* and wants locked **collapsed** — block-groups-by-status vs
  doctrine-places-by-status is a mismatch; split the data (open→ASK, locked→SETTLED).

## Platform↔kit seam friction (a real build must fix → OQ-INTEGRATION-SEAM)

1. **Kit isn't a package** — reviews reach it by relative source path; needs
   `node_modules` symlink + `resolve.dedupe:['react','react-dom']` (or invalid-hook
   landmine). → the kit must be a real importable package (couples OQ-KIT-PACKAGING).
2. **`server.fs.allow`** must include the kit dir (cross-root source imports
   rejected by default) — the platform allow-list doesn't include a sibling kit dir.
3. **Tailwind v4 silent unstyling** — with Vite root = the app, the v4 plugin only
   auto-scans from root; kit classes silently don't generate. Needs explicit
   `@source` for the kit dir.
4. **`ReviewShell` not parameterized** — hardcodes its own component registry; needs
   a `components` prop so a review can inject doctrine blocks.
5. **Platform service can't host a kit review as-is** — service `node_modules` lacks
   `tailwindcss`/`@tailwindcss/vite`/`svg-pan-zoom`, and `mountVersion`/`mountDraft`
   register only `react()`, not `tailwindcss()`. The `vista-deps` closure
   (decision 0017) must include the kit's full toolchain and the mount must register
   the Tailwind plugin.

## Ranked open decisions surfaced

The cl2-storm review's own open questions (for reference): O-backend-fields
(undecided, highest leverage), O-vrs-rs (undecided), O-capable (lean predicate-only),
O-forge (lean consume), O-work-rs (sequencing-gated). Plus the 2 recommendations
awaiting sign-off (architecture Option A, daemon-spine Option A).
