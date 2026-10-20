# Rolldown bundled-dev vs the CJS-interop blank-render category

Date: 2026-07-01. Evidence for [decision 0052](../../.decisions/0052-render-via-rolldown-bundled-dev-everywhere.md).
Method: isolated headless prototype (baseline repro + fix arm) + npm version
ground-truth. Throwaway prototype under `tmp/vista-rolldown-experiment/`.

## Question

Published reviews render blank: a transitive CJS dep served raw by the dev
server exposes no `default` export → React never mounts. Does adopting the
newest Rolldown-powered Vite with **dev-time bundling** kill the category, and
can drafts + published share one bundler path?

## Findings

**Reframe.** Vista is already on `vite@8`, whose default GA bundler is Rolldown.
The `rolldown-vite` npm package (7.3.1) is a Vite-*7* backport — adopting it is a
downgrade. The real lever is Vite 8's **bundled dev mode**
(`experimental.bundledDev: true` / `--experimental-bundle`), present already in
the pinned version — **no bump**.

**Baseline reproduced.** Plain Vite 8 + `optimizeDeps.noDiscovery:true` + a
first-hop-only `include` → blank page, console
`... does not provide an export named 'default'`, `#root` empty.

**Fix arm works.** Same app + `bundledDev:true` → `#root` mounts, recharts SVG
renders, CJS default-import resolves, **0 console errors**, one client bundle.
Categorical because whole-graph Rolldown bundling subsumes any transitive CJS
specifier — the include list stops being load-bearing.

**Constraint verdicts (headless evidence):** HMR ✓ (true hot-patch, state
survived); SSR `ssrLoadModule` ✓ (only the client env is bundled; the ssr
provider env is untouched — contradicts the older "no SSR features" caveat for
`ssrLoadModule` specifically); dual-React per-importer island ✓ (needs the island
excluded from `dedupe:['react']`); plugin API ✓ (`@vitejs/plugin-react`, custom
`resolveId`/`load`, `transformIndexHtml` all fired). Migration ≈ one config line;
Rolldown's native binary is already in `vista-deps` (vite 8) → no new dep.

**Two gating risks (→ decision 0052 de-risk gate):**
1. **0043 regression** — bundled-dev inlines the ~2.5 MB island into each
   version's single bundle, losing the shared content-hashed cross-version chunk.
2. **Teardown crash** — `server.close()` throws an uncaught `Failed to get
   bundle state` under bundled-dev; safe for the long-lived published server but
   dangerous for the per-slug draft lifecycle.
   Plus: bundled-dev is `experimental` (8.x API-churn risk), and the prototype
   proved the category with a synthetic CJS dep, not Vista's real `vista-deps`
   es-toolkit/recharts closure.

## Verdict (→ decision 0052)

bundled-dev kills the interop category (high confidence). Adopt it for both
drafts and published (one path, maximal simplification), **gated** on a proof
that preserves the 0043 island chunk (or accepts a measured regression), hardens
the draft teardown, reproduces against real `vista-deps`, and states an
experimental-API-churn mitigation. Backed by SVC-R58's CI mount guard.
