# Pull-request review composes parts and zoom is scope

Status: accepted

## Context

The read-only capture boundary remains defined by
[decision 0087](./0087-pull-request-review-is-a-read-only-viewer-over-captured-data.md).
Inside that boundary, a full review must keep request identity, description,
stack navigation, churn map, file navigation, and diff content coherent while
allowing an App to fit them to its argument and available space.

The treemap creates a second navigation hierarchy beside the file rail. A
directory can be only a visual zoom target, or it can define which files the
rail and diff contain. Treating these as independent states permits the map to
say “packages” while the adjacent review still shows the whole request.

## Evidence and Argument

The review parts depend on the same small state: active request, directory
scope, hidden files, commit focus, selected file, and diff layout. A shared
provider gives each part the same projection without fixing their layout or
threading an expanding prop surface through arbitrary compositions.

A directory treemap already has the strongest available statement of context:
its displayed root and breadcrumb. Reusing that root as the review scope makes
the map, file rail, and diff pane agree by construction. It also makes widening
scope one breadcrumb action rather than a separate chip or mode. File
activation remains distinct: a file opens its diff, while a directory changes
the review boundary.

## Options

| Direction | Tradeoffs |
| --- | --- |
| Scope chip / global map | Keeps the whole-request map visible and makes scope explicit in separate chrome; duplicates state, permits the chip and map to disagree, and spends space on a second scope indicator |
| Zoom-is-scope | Uses the map root and breadcrumb as the single scope control; map, rail, and diff stay aligned, at the cost of losing global geometry while scoped |
| Inspect-then-activate | A click only inspects and a second action applies scope; preserves exploratory inspection but adds a mode-like step and leaves the adjacent review unchanged after the apparent navigation |

## Decision

The `pull-request` surface is a composition of independently placeable parts
under `PullRequestReview`, a shared review provider. The provider owns the
active request and all cross-part presentation state. The default composition
is one policy over those parts, not a second implementation.

Treemap zoom is review scope. A directory action sets the controlled treemap
root and applies the same path boundary to the file rail and diff pane. An
ancestor breadcrumb widens scope and the model-root breadcrumb clears it. A
file action selects and opens that file without introducing a file-shaped
scope.

The shared hidden set and commit focus are applied before scope, so every part
continues to describe the same visible projection. Layout is composed with the
generic `ResizableSplit`; the review parts do not own bespoke splitter state.

## Consequences

- Apps may omit, reorder, or resize review parts while retaining one state
  machine and one authored payload.
- A scoped review intentionally trades the global treemap overview for exact
  agreement between the map, rail, and diff. The breadcrumb is the scope
  indicator and widening control.
- Stack changes clear request-local scope and commit focus; the next request
  cannot inherit an invalid directory or commit identity.
- Hidden-file and commit projections remain orthogonal to scope and apply to
  both single and stacked per-commit diffs.
- No part weakens decision 0087: all state is presentation over captured data,
  with no forge access or write path.

## Verification

Storybook `Vista/Compositions/Pull Request Review` verifies the composed
contract through `TreemapScopesDiff`, `StackSwitch`, `CommitFocus`, and
`FilterHidesEverywhere`. Pure behavior is covered by
`pull-request-stack.test.ts` and `selection.test.ts`.
