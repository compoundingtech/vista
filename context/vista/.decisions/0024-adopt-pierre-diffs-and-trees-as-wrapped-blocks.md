# Adopt @pierre/diffs and @pierre/trees, wrapped as Vista blocks

Status: accepted (kit-scope interview Q1)

## Context

The kit needs first-class diff and file-tree components. `@pierre/diffs`
(diffs.com) and `@pierre/trees` (trees.software), both open-source React libraries
from Pierre Computer Company built on Shiki, are state-of-the-art for exactly these
(unified/split diffs, char/word-level, merge-conflict UI, accept/reject,
annotations; path-first file trees with `gitStatus`, `flattenEmptyDirectories`,
context menus). CLAUDE.md defaults to avoiding external deps, so adopting them is a
deliberate override the user asked for.

## Decision

Adopt `@pierre/diffs` and `@pierre/trees` as dependencies, **wrapped behind Vista
block interfaces** `diff` and `file-tree`. The block interface encapsulates the
dependency: the review document references diff/tree content by Vista's own typed
block shape (portable, MED.AUTH-R25), and the `@pierre` libraries are an implementation
detail of those blocks. This gives state-of-the-art quality now and an insulation
seam if we ever replace them.

- `diff` block: authored from a unified-diff/patch string or old/new file pair;
  split⇄unified toggle, word-level, collapsible hunks; large diffs resolve-by-key.
- `file-tree` block: authored from a path list + per-path `gitStatus`;
  `flattenEmptyDirectories`.
- Both are consumed by `gh-previews` (PR diff + changed-file tree) and the
  code-recap / architecture archetypes.

## Consequences

- New external deps (`@pierre/*`), currently **beta** — pin exact versions, vendor-
  review the API, and treat the beta status as a watch item.
- **Theme reconciliation is an acceptance criterion:** `@pierre`'s Shiki themes +
  Shadow DOM must be reconciled with our Tailwind v4 `data-theme` tokens so
  diffs/trees match the rest of the kit in light/dark. This is the main integration
  risk and a gate for "done".
- The block interface keeps the document portable and the dependency swappable.

## Amendment: current dependency and theming reality

The adoption and the wrapping seam stand; two clauses above are historical.

**Theme reconciliation.** The Tailwind v4 `data-theme` token set named above was
replaced by Geist semantic tokens realized in StyleX with explicit theme classes
(decision 0036). Reconciliation is therefore not per-block CSS: Vista registers
its own Shiki themes and tree styles once, through a single bridge that every
wrapped surface uses, so a diff, a tree, and a full pull request read as one
product surface in both dark and light. The acceptance gate itself is unchanged
(MED.BLK-R07).

**Beta status.** The blanket "currently beta" watch item no longer applies to
both libraries. The diff library is consumed at a pinned stable release; the tree
library remains a pinned prerelease and is the remaining watch item. Exact
pinning still applies to both, and the wrapping seam is what makes either
replaceable.

**Wrapped surfaces.** Three blocks now sit behind this seam, not two: `diff`,
`file-tree`, and the read-only `pull-request` viewer built on the diff library's
multi-file code view (decision 0080).
