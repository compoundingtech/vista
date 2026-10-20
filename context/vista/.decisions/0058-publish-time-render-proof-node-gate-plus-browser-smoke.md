# Publish-time render proof: node projection gate + per-review browser smoke

Status: accepted

The implemented `render-smoke.ts` pipeline strengthens SVC-R58. FB-100
motivates the guarantee. The guarantee couples to VST-R64/0057 because a blank
review forces another publish loop, and to decision 0049 because the browser
smoke uses the Nix Playwright browser.

> **Greenfield amendment:** The two proof stages remain within one all-or-nothing
> publish RPC, now evaluating `app.tsx`'s default zero-prop App and smoke-loading
> the staged self-contained static build before atomic exposure. The
> `review.tsx`/metadata projection mechanism below is historical.

## Context

SVC-R58 requires it be "structurally impossible to serve a review that fails to
mount." Today two things stand in for that guarantee, and neither closes it
per-review:

- The **publish-time node projection** (`derive-projection.ts`, `ssrLoadModule` of
  `vN/review.tsx`) evaluates the review under node to derive its title/archetype/
  status. It fails loud when the module cannot be evaluated — good — but it only
  exercises the node/SSR realm, not the browser dep-optimizer or client ESM
  interop. A review can pass node eval and still blank in a browser.
- The **SVC-R58 CI guard** (`chart-interop.browser.test.ts`) renders one fixed sample
  in a real browser. It proves the guarantee for that one closure, not for an
  arbitrary freshly-published review.

FB-100 was a review that blanked in the browser (client-side dep resolution),
which neither stand-in would have caught at publish. The reviewer's observed
workflow already pays for this gap: agents published 7 throwaway "does it even
render" slugs because publish output could not be trusted (decision 0053 context).

## Decision

The publish-time render proof is **two gates, both per-review**:

1. **Node projection gate (keep, already present).** The fast fail: evaluate the
   freshly-copied `vN/review.tsx` under node during publish. Catches module-scope
   / node-eval failures (MED.AUTH-R59 violations, un-evaluable graphs) before any browser
   cost. Retained unchanged.
2. **Browser mount smoke (add).** After the version is frozen, headless-load its
   canonical URL and fail the publish — tearing the version down (freeze symmetry
   with `finalizeIslandPin`) — if `#root` stays empty or the page logs
   module-resolution / import-interop console errors. This makes SVC-R58's
   "structurally impossible to serve a non-mounting review" true for every
   published review, not just the CI sample.

The browser is the Nix-managed Playwright/Chromium already used for the SVC-R58 CI
guard (decision 0049), invoked by the service at publish. A review that fails the
smoke never acquires a `latest` pointer.

## Consequences

- **Publish latency + a browser in the render path.** Each publish pays a headless
  mount (~seconds). Acceptable: it replaces the agent's manual "does it render"
  re-publish loop (0053) with a single authoritative check, and VST-R64 counts a
  blank-on-publish as ceremony, not just a bug.
- **The standing service's closure gains a browser.** Whether the smoke runs
  in-service or as a spawned check step (reusing the CI harness) is an
  implementation choice; either way the browser must be on the service host's
  Nix closure, GC-rooted with the service.
- **The node gate stays the first, cheap line.** Most failures (MED.AUTH-R59, bad imports)
  are caught before the browser is ever launched.
- **Interacts with the deps self-heal (FB-100 fix).** The smoke would have caught
  the stale-`node_modules` blank at publish; the self-heal prevents it at the
  source. Defense in depth: fix the wiring, and prove the render.
- **The residual risk is narrower than "any blank page."** Decision 0054's
  thin-shell already degrades a broken *lazy* heavy block to its own error boundary
  rather than blanking the page, and VST-R65/decision 0059 route heavy/interactive
  deps through that same lazy boundary. So the browser smoke's real job is to catch
  failures in the **eager** graph (the shell, bootstrap, and eagerly-imported
  blocks) and whole-page mount failures — not lazy-block dep failures, which are
  already contained. The implementation should scope its assertion accordingly and
  not build a heavy per-publish check for the mostly-closed lazy-block hole.
