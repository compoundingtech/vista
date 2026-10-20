# Review entrypoint is a typed module (`defineReview`), shell is vista-owned

Status: superseded by 0074

The greenfield App entrypoint supersedes `defineReview`, document/registry
props, scaffolded bootstrap, sidecar metadata, and `/_publish`. These mechanisms
remain rationale and evidence only.

## Context

Authoring a review meant hand-writing a boilerplate `index.html` (byte-identical
across all samples except `<title>`) plus a `main.tsx` whose only non-boilerplate
content was `createRoot(el).render(<ReviewShell doc={...} components={...}
dataSources={...} models={...} />)` — all four props required even when empty.
There was no `vista new` scaffold (0028 named only publish/list/open/retire/ask/
await), so authoring was "copy another review's `_staging/` by hand". Dogfooding
this workflow confirmed the ceremony: title duplicated across `index.html` and
`doc.meta.title`; no typed seam for the mount; schema-required fields caught only
by `tsc`, which the author flow doesn't run.

We want the author to write *content*, not plumbing, and the agent skill to focus
on semantics/goals rather than operational steps.

## Decision

The review entrypoint is a typed module, not an HTML file. The author writes one
`review.tsx`:

```ts
export default defineReview({ doc, components?, dataSources?, models? })
```

`defineReview` (kit) is a synchronous typed identity/validator that defaults the
empty registries. Vista **owns the HTML shell**: a new `vista new <slug>` command
stamps `index.html` + a fixed generic `main.tsx` bootstrap that imports the
default export and renders `<ReviewShell {...review} />`. ReviewShell is unchanged.

`doc.meta.title` is the **canonical** title. The rendered page title is set from
it (the bootstrap runs `document.title = review.doc.meta.title`), so the author
never maintains a `<title>` duplicate.

The `vista list` index projection (0028) wants the same single source. The
**target** is to derive title/archetype + status (`deriveStatusCounts`) from
`doc.meta` at publish, in the **service** — publish runs service-side
(`server.ts` `/_publish`), where the `@vista/kit` Vite alias is live and
`vite.ssrLoadModule` is already used (`data/mount.ts`), so the bridge belongs
there, executed once at publish and frozen (never at serve time; preserves 0029).
The **interim** ships the weaker form: `review.json` hand-carries
title/archetype/status for the projection. The principled close is gated on
review modules being eval-safe under `ssrLoadModule`: the `@vista/kit` barrel
itself imports cleanly, but a review module can touch browser globals at module
scope (`data-panel-review` reads `document.baseURI`), so the close needs an
eval-time shim or a no-module-scope-browser-globals rule (see
[[OQ-TITLE-PROJECTION]]). Until then a service test asserts each sample's
`review.json` equals its `doc.meta` projection, so the duplication can't drift.

"Vista owns the shell" means **stamp at `vista new`**, not generate-at-serve.

## Consequences

- Author surface collapses to one typed file; `vista new` removes the copy-by-hand
  step. The skill can drop operational ceremony.
- Serving, the `cpSync` publish freeze, and the `index.html` completeness marker
  (`registry.ts`) are **unchanged** — each frozen `vN` still contains a real,
  self-contained static `index.html` (preserves decision 0029 immutability).
- The rendered title is single-sourced from `doc.meta.title` (runtime
  `document.title`). The server-side list projection is single-sourced only once
  the publish-time `ssrLoadModule` close lands; the interim hand-carries it in
  `review.json` guarded by a sample drift test (see [[OQ-TITLE-PROJECTION]]).
  Either way the derive runs at publish, never at serve time.
- **Rejected — synthesize HTML at serve time / virtual entry (no on-disk
  `index.html`):** would make a published page depend on live vista code and
  require executing the review to derive `<title>`, breaking 0029 self-containment;
  or it collapses into publish-time stamping with extra machinery, while also
  breaking the `index.html`-presence completeness marker. It only saves one file.
- **Rejected — scaffold but keep the raw `createRoot`/`ReviewShell` tail (no
  `defineReview`):** leaves an untyped mount the author still maintains; a
  prerequisite mechanism, strictly worse than pairing it with the typed contract.

Presented and signed off via a Vista options-comparison review
(`/r/vista-entrypoint-redesign/`). Supersedes the hand-authored
`index.html`+`main.tsx` workflow; migrates the 4 samples in the same change.

## Greenfield supersession

The canonical source is `app.tsx`, default-exporting one ordinary zero-prop React
component. Vista owns and synthesizes the shell/bootstrap, derives App metadata,
the semantic manifest, and data bindings, and publishes through the all-or-nothing
control RPC. No definition helper, generated author-facing bootstrap, registry,
metadata sidecar, or command-shaped publish route remains.
