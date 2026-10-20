# Pull-request review is a read-only viewer over captured data

Status: accepted

## Context

Reviewing a whole pull request in an App was previously assembled per document
from the `diff` and `file-tree` blocks, with `gh-previews` composing a preview
over a `gh` provider. That is adequate for citing one change, but a reviewer
asked to judge a pull request needs the whole thing in one surface: the request's
identity and description, a navigable file rail with per-file status, request
churn totals, and a multi-file diff that stays oriented while scrolling.

Building that surface forces a prior question. A pull-request surface can be a
review *client* that talks to the forge — fetching the request, resolving the
latest head, submitting comments — or a review *surface* that shows a capture. The
answer determines whether a published AppVersion stays self-contained.

## Evidence and Argument

Vista is render-only (decision 0001) and a published AppVersion is a
self-contained static directory whose Provider results are frozen (decisions 0075
and 0031). A surface that fetched at read time would break both: the same pinned
URL would show different content over time, publication would depend on network
and forge credentials at read time rather than at capture time, and the frozen
snapshot model would have an exception with no bounded shape.

The read-only shape is also the one the medium actually needs. A Vista App is an
argument about a change, and a reviewer's decision belongs in the App's ask and
sign-off surfaces, not in a forge comment box embedded in a document that may be
read months later at a pinned version.

The heavy lifting already exists behind decision 0024's wrapped-dependency seam:
`@pierre/diffs` ships a multi-file, virtualized viewer with sticky per-file
headers, and `@pierre/trees` supplies the path-first rail. A bespoke multi-file
viewer would re-derive virtualization, hunk expansion, word-level diffing, and
syntax themes that are already proven and already themed through Vista's single
bridge to those libraries.

## Options

| Option | Tradeoffs |
| --- | --- |
| Live pull-request client (fetch, refresh, comment) | Always current and interactive; breaks AppVersion immutability, adds read-time credentials and network dependency, and duplicates the forge |
| Read-only viewer over a captured, serializable payload | Immutable, offline, and self-contained; the reader sees exactly the change the author reviewed, and staleness must be conveyed by the surrounding App |
| Keep composing `diff` plus `file-tree` per App | No new block; every author re-invents PR chrome, cross-file navigation, and roll-up counts, inconsistently |

## Decision

The `pull-request` block is a read-only review surface. It renders exclusively
from a static, serializable payload captured at authoring time: the request's
number, title, URL, author, state, optional body, and an ordered set of changed
files, each carrying its path, change status, optional previous path, and either
a unified patch or an old/new content pair. There is no fetching, no comment
submission, and no edit mode.

Vista owns the authored model. Projection from that model into the wrapped
libraries' shapes lives behind the block as a pure, testable step, and both the
diff pane and the file rail are themed through the single bridge that serves
every wrapped surface (MED.BLK-R07). The document stays portable and the
dependency stays swappable, exactly as for `diff` and `file-tree`.

The block renders precisely the files it was given. A file the projection cannot
render is reported in place as a bounded, reviewer-readable line rather than
dropped or silently blank, and nothing in the surface implies that missing
content can be fetched.

View state — unified or split, word-level granularity, selected file, hunk
expansion, scroll position — is presentation state below the block. It emits no
SemanticNode and changes none.

## Consequences

- `gh-previews` remains the lightweight citation of a change; `pull-request` is
  the full read. They coexist rather than one replacing the other.
- Capture is an authoring concern: what the author captured is what every future
  reader sees at that pinned version, including a request that has since moved
  on.
- The block owns its own viewport and virtualization behavior, because a full
  pull request cannot be sized by the document flow.
- Payloads are bounded by the capture, so an App's static size stays predictable
  and publication remains one self-contained directory.

## Verification

Catalog coverage must show unified and split views, word-level granularity, file
selection from the rail by pointer and by keyboard, a multi-file request large
enough to exercise virtualization and sticky file headers, added, deleted, and
renamed files, an unrenderable file's in-place explanation, and light and dark
theme parity with the rest of the library. The model-to-library projection must
be covered by pure unit tests, including that the authored status — not the
patch framing — decides the rendered change type.

## Amendment 1 — Content capture and checks liveness are separate

The pull request's identity, description, commits, files, and patches remain the
captured payload described above. They do not gain a refresh or forge-write
path.

Pull-request checks are a separate typed domain Block with a `subscription`
DataBinding. It ships its own folded Snapshot for instant paint and may catch up
through the standing service. Checks liveness does not mutate, replace, or imply
freshness of the captured pull-request content.
