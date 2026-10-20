# Zero-install deps via a shared node_modules symlink

> **Amended:** the zero-install shared `node_modules` closure stands. Historical
> clauses below: the "no alias map" detail (superseded by
> [0044](./0044-runtime-composition-is-manifest-derived.md)), the
> `index.html` + `main.tsx` + `vr publish` authoring ceremony and the
> declarative-renderer/escape-hatch pairing (superseded by the ordinary zero-prop
> `app.tsx` App and Vista-owned bootstrap,
> [0074](./0074-ordinary-react-components-project-semantic-primitives.md) and
> [0077](./0077-owner-scoped-source-with-automatic-typed-receipts.md)), and the
> broad `fs.allow` breadth (superseded by SVC-R21's exact source app root).

Status: accepted

Evidence: the platform spike.

## Context

The standing service exists to remove per-session ceremony (decision 0002). A
review must be able to `import` React, Vite, mermaid, and the component kit
**without** the agent running a per-review `install`. The spike compared a
hardcoded `resolve.alias` map against a shared-`node_modules` symlink.

## Decision

The service owns one `node_modules`. A single `node_modules` symlink at the
reviews root points to it; Vite's natural node_modules walk-up from each review
root then resolves **every** bare specifier with no alias map and no per-dep
config. `resolve.dedupe: ['react','react-dom']` keeps React a singleton, so no
invalid-hook-call can arise across composed components. (Historically this was
phrased as the declarative renderer versus the React escape hatch; current
authoring has one ordinary React path.) `server.fs.allow` historically included
the whole apps root and the service dir; the current boundary is the shared
dependency closure plus the exact source app root (SVC-R21).

Agent ceremony measured at the time: write `index.html` + `main.tsx`, run `vr
publish`, with no `package.json`, install, or per-review `node_modules`. Only the
zero-install dependency result carries forward: current authoring is one
`app.tsx` published by `vista publish <local-slug> --message <summary>`, and
Vista owns the shell and bootstrap.

Under Nix this shared set is the read-only `vista-deps` store closure (decision
0017); reviews symlink into it.

## Consequences

- New shared deps / the whole component kit become importable "for free" — the
  alias-map approach would need an entry per dep (rejected).
- The service is the single owner/upgrader of the dependency set.
- `fs.allow` breadth is a security surface to tighten (OQ-FSALLOW).
- Reviews are not standalone-buildable in isolation; they are bound to the
  service's dep set by design.
- **Location constraint:** the reviews root must sit where Vite's node_modules
  walk-up actually reaches the shared closure — the resolution depends on the reviews
  root being a parent (via its root `node_modules` symlink) of the closure, not on any
  alias map. In production the mutable reviews root (`/var/lib/vista`) resolves against
  the Nix `vista-deps` store closure through that symlink (decision 0017).
- **Superseded detail:** this decision's "no alias map" claim was too broad for
  first-party workspace packages with pnpm injected-package layout. Decision 0044
  keeps zero-install shared deps but makes first-party workspace/runtime aliases a
  manifest-derived service concern.
