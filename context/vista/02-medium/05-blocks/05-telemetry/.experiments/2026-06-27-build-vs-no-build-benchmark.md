# Build vs no-build publish benchmark

Settles whether published versions stay no-build (decision 0029: raw source served
by the shared programmatic Vite dev server) or move to a per-version `vite build`,
given a frozen telemetry page now imports a ~2.5 MB-gzip `@grafana/ui` island.
Throwaway under `tmp/vista-build-bench/` + the `tmp/island-experiment/` scaffold.

## Decisive fact

The Vite dev server is load-bearing **regardless** — draft HMR and live providers
(0027/0029) need it no matter what. So a build is **strictly additive** ("dev
server + build"), never a replacement. Full per-version build does not remove the
runtime dependence; it bolts a build step on top → dominated.

## Numbers (Vite 7 / Rollup, dual-React scaffold)

- **Build time** (cold ≈ warm; Rollup has no persistent incremental cache):
  plain review **0.65 s**; island review (metric+trace+flame) **19.3 s**.
- **Output**: plain dist 194 KB; island dist 9.996 MB (vendor chunk 9.74 MB /
  ~2.58 MB gzip, vendor css 89 KB, island entry 90 KB — the vendored Jaeger source
  lands in the entry, not the dedup'd vendor chunk).
- **Cross-version dedup (crux)**: content-hashed filenames; a body-only edit leaves
  the 9.74 MB vendor chunk's filename AND sha256 **identical** across builds
  (verified `vendor-Nsv8zTYI.js`). So with a shared content-addressed/hardlinked
  chunk dir it dedups to ONE copy; marginal storage per new version = the changed
  entry chunk only (~90 KB island / ~1.5 KB plain) vs 9.99 MB naïve `cpSync`.
  **Caveat:** realized ONLY with the shared store; today's `cpSync`-per-version
  publish would duplicate the full 9.74 MB. Vendor stays identical only while
  consecutive versions share the dep closure (a real dep bump → new chunk, correct).
- **Storage is a wash** between no-build (one shared prebundle) and dedup'd build
  (one shared vendor chunk). The decision is **pixel-durability + offline vs
  complexity**, not storage. The dedup win is not island-only: a doctrine review's
  heavy `@vista/kit` substrate dedups identically.
- **Offline**: built dist renders via a plain static server, no Vite
  (`tmp/vista-build-bench/static-island.png`). Caveat: a few decorative Grafana
  unicon SVGs 404 at `/public/build/img/icons/unicons/*.svg` — copy them in for
  true offline.

## Current no-build state (grounded from `publish.ts`/`server.ts`)

Publish = atomic `mkdir vN` → `cpSync` raw `_staging` tree → write `meta.json` (+
freeze `snapshot.json`/`published.json` for data reviews) → swap `latest` symlink.
No bundling; ms latency; KB/version; one global dev server roots at `reviews/` so
Vite hashes `root` not `base` → ONE shared mutable prebundle for all slugs ×
versions. Viewing a published version REQUIRES the standing Vite service. "Frozen"
freezes provider DATA (0031), not pixels — a shared-closure dep bump re-renders
every past version.

## Recommendation (adopted → decision 0043): hybrid

Keep no-build as the default serving path; at publish ADDITIONALLY `vite build` a
pixel-durable, offline artifact for reviews carrying heavy/frozen islands, with
content-hashed chunks in a shared content-addressed/hardlinked store. Activates the
optional static-export escape hatch 0029 already anticipated.

**Biggest downside (load-bearing):** preview/publish parity divergence — draft is
dev-server ESM+esbuild, the built artifact is Rollup+minified, not byte-identical,
which undercuts Vista's freeze-symmetry. Second-order: shared-chunk GC/ref-counting
on version retirement; a naïve cross-fs copy/tarball of a version dir re-inflates.
