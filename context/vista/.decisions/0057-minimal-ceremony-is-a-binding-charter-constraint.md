# Minimal-ceremony operation is a binding charter constraint

Status: accepted

This decision adds VST-R64 for ceremony and VST-R65 for a closed, zero-install
dependency surface. It generalizes AGT.CLI-R06, AGT.CLI-R08, and AGT.CLI-R56
from the CLI to the full author-facing surface. FB-100 and FB-118 motivate the
decision.

> **Greenfield amendment:** The minimal-ceremony charter stands, but the
> `review.tsx`, optional author shell, bespoke registry/data, and parallel
> interactive-path details below are historical. Current source is one
> owner-scoped `app.tsx` default-exporting an ordinary zero-prop App. Vista owns
> bootstrap, semantic-manifest/binding derivation, and one publication build.

## Context

The vision already bets that "the agent's side stays effortless: a thin skill and
a one-line command … authoring a great review should cost the agent almost
nothing." Two field reports showed the medium violating that bet where it matters
most:

- **FB-118** — the richest reviews (interactive / real-React component reviews)
  had the *most* ceremony: hand-copy source into the service tree and restart the
  service, because the only heavy-component path was a service-internal bundle.
- **FB-100** — a freshly published review could silently fail to render/publish,
  making the one-command promise worthless when the one command quietly did not
  work.

The existing ceremony requirements (AGT.CLI-R08, AGT.CLI-R56) were CLI-scoped; nothing bound the
authoring and service subsystems to the same discipline, and nothing named the
two quantities that measure ceremony. Worse, an early draft of this decision
carved out an "exception" — *a genuinely new heavy dependency requires a
`vista-deps` closure change* — which framed the most cumbersome possible path (an
agent editing the shared closure) as part of the model. That is backwards: an
agent never touches the closure.

## Decision

Two orthogonal requirements, not one:

**VST-R64 — ceremony.** Elevate near-zero ceremony to a charter-level binding
constraint, measured by two minimized quantities:

1. **CLI commands** to go from an authored review to a working canonical URL — the
   common case stays a single `vista publish <review-dir>` (AGT.CLI-R56).
2. **Manual per-review setup** — an agent authors only the review's own content
   (`review.tsx` + any bespoke component/data it declares). Everything generic —
   HTML shell, bootstrap, dependency resolution, and any service-side build or
   registration to serve an interactive/component review — is the system's, done
   at publish, no restart. Holds for every review kind, including the interactive
   path (MED.AUTH-R23).

VST-R64 is a ratchet: any new agent-facing surface must be justified against it.

**VST-R65 — the dependency model (why there is no per-review dep step).** A review
resolves imports only as: local source, a Vista-**exposed** dependency
(`vista-deps`), or a **pinned `esm.sh`** URL. A review never installs, builds, or
registers a dependency, and there is no agent-facing path to modify the exposed
set. `esm.sh` is the **universal** escape hatch — anything not exposed, including
heavy / browser-only / interactive-component deps, is pinned from `esm.sh` and
loaded behind a lazy boundary (MED.AUTH-R59, decision 0054), never via a per-review build
or a closure change. Growth of the exposed set is curation — a system concern,
decoupled from authoring; it never appears as a step in publishing any review.

This is the corrected framing: there is no "heavy-dependency exception" to
ceremony, because the dependency model (VST-R65) is itself zero-ceremony.

## Consequences

- **Publish synthesizes the shell/bootstrap.** A review dir with only `review.tsx`
  publishes one-command; the generic `index.html`/`main.tsx` are supplied by the
  service (author-provided shells honored when present).
- **Heavy/interactive components need no new mechanism.** Under VST-R65 they are just
  lazy-loaded review components importing pinned `esm.sh` deps — the existing
  one-command Tier-A path (Vite already code-splits the lazy import; the thin-shell
  lazy boundary keeps the node projection safe). This is FB-118's principled
  resolution and supersedes the per-review island *build* idea (decision 0059).
- **No closure-change path in the agent model.** The shared closure exists and may
  grow by curation, but that is never a step in authoring or an exception to VST-R64.
- **The one command must be trustworthy.** Serving-path fragility that can blank a
  fresh review is a ceremony failure under VST-R64, not just a bug (backs the FB-100
  self-heal and the publish-time render proof, decision 0058).
- **The VRS names the metrics.** Ceremony regressions in either quantity, and any
  drift from the closed dep surface, are now measurable against VST-R64/VST-R65.
