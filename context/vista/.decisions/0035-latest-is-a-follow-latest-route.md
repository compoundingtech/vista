# Latest is a follow-latest route

Status: accepted

## Context

The Vista shell now needs a first-class review/version selector. The selector has
two distinct user intents:

- "show me this immutable version"
  (`/r/<encoded-owner>/<local-slug>/vN/`)
- "keep me on the newest version of this review"
  (`/r/<encoded-owner>/<local-slug>/latest`)

Decision [0005](./0005-single-canonical-url-with-path-routing.md) originally made
`latest` a router-level 302 to `vN` to avoid a second render. That was adequate
while `latest` meant "open newest once", but it collapses the browser-visible
state to a pinned version and cannot represent "stay on latest" after refresh,
sharing, or a later publish.

## Evidence and Argument

User input for the shell milestone explicitly requires both an "open newest" action
when a pinned viewer falls behind and a way to stay on `/latest` so the page can
auto-update if a new version appears.

The current implementation shape in [spec.md](../spec.md) already has one global
Vite server rooting the whole `reviews/` tree at `base='/r/'` and rebuilding the
registry from disk. Resolving the current latest version at request or refresh time
does not require per-version mounts or a second dependency prebundle; it is a
router dispatch decision over the same immutable `vN` source.

The immutable-version invariant remains intact: content still lives in `vN`
directories, and pinned `vN` URLs remain stable. Only the alias route's browser
semantics change from redirect-once to follow-pointer.

## Options

| Option | Tradeoffs |
| --- | --- |
| A. Make `/latest` a canonical follow-latest route | Accurately represents the viewer's intent, supports refresh/share/auto-update semantics, and keeps pinned links immutable. Requires revising the 0005 redirect clause and adding shell/service metadata for current vs newest. |
| B. Keep `/latest` as a 302 and emulate follow-latest in client state | Smaller server change, but reloads and shared URLs collapse to pinned `vN`, making "stay on latest" unreliable and surprising. |
| C. Keep `/latest` as "open newest once" and defer live-follow to a later mode | Preserves the old contract, but does not satisfy the shell milestone and would force a second future interaction model for the same intent. |

## Decision

Choose option A. `/r/<encoded-owner>/<local-slug>/latest` is a canonical
follow-latest route (identity segments amended by decision 0077): it keeps
`latest` in the browser-visible URL and resolves the currently latest immutable
version underneath. When the viewer is on `/latest`, Vista may refresh registry
metadata and advance the rendered version if the review publishes again. When the
viewer is on a pinned `vN`, Vista must not silently move them; the shell may show an
explicit "open newest" action if the registry reports a newer version.

This supersedes only the `latest` redirect clause of
[0005](./0005-single-canonical-url-with-path-routing.md). It preserves single-host
path routing, immutable `vN` URLs, and the one global Vite server model.

## Consequences

- The shell selector must distinguish "Latest" from concrete versions even when
  both currently render the same `vN` content.
- The service needs a review-navigation projection that exposes each review's
  latest version, available versions, and current selection.
- Auto-update is opt-in by URL state: `/latest` follows the pointer; `/vN/` remains
  pinned and explicit.
