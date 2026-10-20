# Hybrid additive content-addressed build for island/frozen reviews

> **Reconciled as a legacy special case by [0059](./0059-heavy-components-via-esm-sh-and-lazy-boundary.md) — new heavy components use `esm.sh` + a lazy boundary; the telemetry island keeps this build path.**

Status: accepted (data-sources telemetry interview Q5)

## Context

Telemetry blocks render via a ~2.5 MB-gzip Grafana React-18 island (decision 0040).
Under the no-build serving model (decision 0029) a published page renders from raw
source through one shared, mutable Vite prebundle, so "frozen" freezes provider
DATA (decision 0031), not pixels — a `@grafana/ui` bump re-renders every past frozen
telemetry page, and published pages are service-dependent (not offline). The
benchmark (`05-data-sources/.experiments/2026-06-27-build-vs-no-build-benchmark.md`)
established: the Vite dev server is required regardless (drafts + live providers), so
a build is strictly additive, never a replacement (full per-version build is
dominated); storage is a wash between the shared prebundle and a content-hash-dedup'd
build; and a built artifact renders offline via a plain static server.

## Decision

Keep no-build as the **default serving path**. At publish, **additionally**
`vite build` a pixel-durable, offline artifact for reviews that carry heavy/frozen
islands (telemetry today), writing content-hashed chunks into a **shared
content-addressed / hardlinked chunk store** so the ~9.7 MB substrate dedups to one
on-disk copy across versions. This activates the optional static-export escape hatch
decision 0029 already anticipated; it does not overturn 0029.

## Consequences

- Frozen telemetry becomes pixel-durable and service-independent: a `vN` holds its
  `index.html` + ~90 KB entry chunk + links into the shared store; a later
  `@grafana/ui` bump cannot re-render an already-published version.
- **Parity divergence (load-bearing downside).** The draft is served via the dev
  server (ESM + esbuild prebundle); the published artifact is Rollup-bundled +
  minified — not byte-identical. This undercuts Vista's freeze-symmetry; the
  built artifact, not the draft, is authoritative for a published version, and the
  publish flow should surface that the frozen pixels come from the build.
- Adds publish-time cost only for built reviews (~19 s for an island review; plain
  reviews stay ms and no-build).
- New machinery: the shared chunk store needs ref-counting / GC on version
  retirement; a naïve cross-filesystem copy or tarball of a version dir re-inflates
  to full size (the store is the unit of portability, not the version dir).
- True offline requires copying the few Grafana unicon glyph SVGs
  (`/public/build/img/icons/unicons/*.svg`) into the built artifact.
- The default no-build path is unchanged for non-island reviews; data-freeze
  semantics (0031/0041) are unchanged — the build adds pixel-freeze on top.

## Implementation note

The realised form pins the island **chunk** rather than `vite build`-ing the whole
review per version: the island chunk is the only artifact whose rebuild changes
pixels, so `publish` content-addresses the current built `dist/island.js` into a
shared store (`service/src/data/island-store.ts`) and the published server resolves
a version's island import to its pinned hash; the review doc/prose still serves from
immutable source (0029). This satisfies the pixel-durability goal and decision
0046's "content-address the chunk" while staying additive to 0029. Two concretions
of the open choices in this decision: the store entry is a **copy**, not a hardlink
(a content-addressed entry must be immutable and independent of the mutable live
chunk's inode); and GC / ref-counting on version-retire is **deferred**
(`// TODO(OQ-CHUNK-STORE)`) — the store only grows for now. Resolves the mechanism
half of OQ-BUILD-PARITY (built chunk is authoritative for a published version) and
the store-shape half of OQ-CHUNK-STORE (content-addressed copy; retention open).
