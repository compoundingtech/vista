# One-command publish with derived context and a single metadata source

Status: accepted

Decisions 0074–0077 supersede the project-local `tmp`, directory-derived slug,
`doc.meta`, sidecar, dry-run confirmation, and rehydration assumptions below.
These mechanisms remain historical evidence. The current happy path is exact
owner plus local slug, one default App component, and one all-or-nothing
`vista publish <local-slug>` RPC.

## Context

Usage mining of past agent sessions
([.experiments/2026-07-01-vista-usage-mining.md](../03-agent-interface/01-cli/.experiments/2026-07-01-vista-usage-mining.md))
showed the real workflow — create → author one file → publish → get URL →
verify — was buried under ceremony and rework:

- `publish : new = 26 : 12` — every review was republished ~1.2 extra times, and
  the two dominant reasons were **title desync** and **blank render**, not
  content. On two reviews, 3 of 7 versions were pure workaround.
- **Title is authored twice**: `review.tsx` sets `document.title` from
  `doc.meta.title`, but the `vista list` index reads a separate `review.json`
  `title` seeded as `"TODO: <slug>"`. Agents shipped v1 with the TODO title,
  noticed it in `list`, hand-edited `review.json`, and republished solely to
  sync metadata — the exact OQ-TITLE-PROJECTION "two-bucket" drift trap.
- Agents guessed across four URL shapes (see 0051); ran `vista new` then
  immediately authored + `publish` every time; ran `debug publish-plan` as a
  preflight that never once blocked in observed flows; and called `open` just to
  read a URL `publish` already knew. 7 throwaway "does it even render" slugs were
  published-then-retired because the render was not trusted.

The maintainer's target: an agent authors the review file(s) in the
project-local canonical `tmp` dir, runs **one** `vista` command, and gets back a
working canonical URL — for most situations that is the whole interaction.

## Decision

- **One-command publish (AGT.CLI-R56).** `vista publish <review-dir>` is the whole happy
  path. It creates-or-updates keyed on the review-dir identity (no separate
  `vista new` required), derives the slug, title, and canonical URL from the
  review + context, runs preflight **inline** and surfaces problems only when
  non-empty, and prints the canonical URL on success (folding in `open`). Because
  slug/title/URL are now derived rather than typed, `vista publish --dry-run`
  must preview the derived slug, title, canonical URL, and target version (new vs
  update) so the agent can confirm before publishing — insurance for the
  derivation, not preflight ceremony. `new`/`open`/`retire` remain thin,
  non-mandatory helpers.
- **Author in the project-local canonical `tmp` dir.** The mutable working copy
  of a review lives in the repo's `tmp/` (git-ignored, disposable); `publish`
  snapshots it into Vista's durable, immutable, versioned store (SVC-R10) and serves
  it. The agent authors where it already works; the durable artifact is the
  published version, not the scratch dir. This removes the scaffold-in-hidden-
  state-dir step and the second editable metadata surface that caused drift.
- **Single metadata source (SVC-R57).** Title, archetype, and the `vista list`
  projection derive from the review's `doc.meta` (single source), via
  publish-time `ssrLoadModule` in the service (where the `@vista/kit` alias is
  live). `review.json` is reduced to freeze-only data and is never a
  hand-maintained title/archetype/status copy. This resolves OQ-TITLE-PROJECTION
  and eliminates the most common wasted republish.
- **Derive, don't type — with a stable identity anchor.** The **review-dir is the
  stable identity anchor**: the slug derives from it and it is the
  create-vs-update key, so re-publishing the same review-dir appends a new
  version (not a new review) and two distinct reviews never collide onto one
  slug. Branch/PR/purpose are display enrichment, not identity — branches rename
  and commonly carry many reviews, so they cannot be the key. Title (from
  `doc.meta`), canonical URL (0051), and version (auto) are likewise derived, not
  authored. Change summaries stay agent-authored (SVC-R12) but must not be required
  to restate mechanical actions.

## Consequences

- Collapses the observed real workflow to essentially `vista publish` +
  `vista list`; removes the top two rework sources (title desync, URL guessing)
  by construction.
- The publish-time `ssrLoadModule` projection must handle review modules that
  touch browser globals at module eval (the OQ-TITLE-PROJECTION gate): provide a
  minimal eval-time shim or forbid module-scope browser-global access. Carries
  forward the interim drift-pinning guard until derivation lands.
- Reliability is a precondition, not a nicety: printing a canonical URL only
  helps if the page renders (SVC-R58/0052) and the URL is canonical (SVC-R55/0051).
  Together these three make "get the vista url" mean "get a working page,"
  removing the throwaway render-probe slugs.
- Because the editable copy lives in git-ignored, disposable `tmp` (reclaimed by
  host GC on dev3), `vista` must be able to rehydrate a published version's
  source back into `tmp` so an author can iterate on a review whose scratch dir
  was cleaned.
- Refines AGT.CLI-R06 (thin CLI) and AGT.CLI-R08 (near-zero ceremony) toward a single derived
  command; the cold-start orientation tax (rediscovering allowed imports / CSS
  vocabulary) is a separate surface the tool should provide, tracked separately.

## Greenfield amendment

Canonical source is `$XDG_STATE_HOME/vista/sources/<host>/<seat>/<local-slug>/app.tsx`.
Its default export is one ordinary zero-prop React App. Vista derives metadata,
the semantic manifest, and data/freeze bindings during trusted in-process
evaluation, then builds and verifies a complete immutable AppVersion with its
PublicationReceipt. The transaction returns the owner-scoped pinned URL or
publishes nothing.
