# Code Blocks — Requirements

The `code` block family realizes the `diff`, `file-tree`, and `pull-request` blocks:
reading a code change as a diff, a repository as a path-first tree, and a captured
pull request or stack as a composable read-only review, plus Provider-backed
pull-request review and checks over captured data. It is a realization over the
[render contract](../../02-renderer/requirements.md) — the blocks are semantic React
members that resolve their content by key so the document stays portable.

Builds on the [block-library requirements](../requirements.md) and this node's
[spec.md](./spec.md); the render contract is
[../../02-renderer/requirements.md](../../02-renderer/requirements.md); terms in
[glossary.md](./glossary.md). IDs are path-scoped (`MED.BLK.CODE-*`); each
requirement `refines:` its parent. Decisions: 0024 (adopt @pierre), 0036
(Geist-native visual system), 0087 (pull-request review is read-only over captured
data), 0088 (pull-request review composes parts; zoom is scope).

## Requirements

- **MED.BLK.CODE-R47 Diff, file-tree, and pull-request blocks:** The library must
  provide first-class `diff`, `file-tree`, and `pull-request` blocks, wrapping
  `@pierre/diffs` and `@pierre/trees` behind Vista's own typed block interfaces so
  the document stays portable (MED.AUTH-R25, MED.REND-R04) and the dependency is
  swappable. The `pull-request` block must compose its review parts (identity,
  description, stack navigation, treemap, file rail, diff pane) under shared
  provider state over a captured, serializable payload; it never fetches, comments,
  or edits (decisions 0087 and 0088). Their Shiki themes must be reconciled with the
  library's Vista UI-native `data-theme` tokens (MED.BLK-R07; decisions 0024 and 0036).
  `refines: MED.REND-R04`

- **MED.BLK.CODE-R80 Snapshot-first pull-request review and checks:** The library
  must provide a Provider-backed pull-request review over the same captured
  `PullRequestData` consumed by the read-only review surface, plus a
  pull-request-checks Block that paints captured folded state before opening its
  subscription, makes CatchingUp and Live provenance visible, highlights changes
  from the captured state, and retains the last valid checks on typed stream
  failure. Both the frozen review and the subscription's frozen seed require
  explicit effectful-capture acknowledgement; the checks path refines
  subscription continuity rather than introducing fetch logic into presentation.
  `refines: MED.DATA-R47`

## Acceptance

A `diff` renders unified/split with word-level and collapsible hunks; a `file-tree`
renders a path-first tree with per-path `gitStatus`; both resolve their content by
string key; both match the library's Vista UI-native theme in dark and light. A
`pull-request` renders a captured request or stack whose header, description, stack
navigation, treemap, file rail, and diff pane share the active request, directory
scope, hidden set, commit focus, and diff layout: pinning a directory in the treemap
scopes rail and diff; one focused commit shows its own diff and several show each
commit's diff in order; generated files start hidden and stay revealable. A
Provider-backed review renders the same model as the hand-captured path; checks
paint from the Snapshot with no initial live request, then catch up and render
changed statuses without losing the captured value on failure.
