# Code Blocks — Spec

Specifies the `diff`, `file-tree`, `pull-request`, and `pull-request-checks`
blocks. Builds on [requirements.md](./requirements.md); their
React/semantic-manifest boundary is
[../../02-renderer/spec.md](../../02-renderer/spec.md); packaging /
theming is [../spec.md](../spec.md). Requirement IDs are path-scoped in
`./requirements.md`.

## Status

Draft.

## Blocks

- **`diff`** renders one code diff (unified or split, word-level, collapsible
  hunks) by wrapping `@pierre/diffs` behind Vista's typed block interface. Its
  serializable content is resolved by string key (MED.REND-R04).
- **`file-tree`** renders a path-first tree with per-path `gitStatus` by wrapping
  `@pierre/trees` behind Vista's typed block interface and resolving the model by
  key.
- **`pull-request`** renders a captured pull request or stack as a read-only
  review. It never fetches, comments, or edits. An unrenderable file remains in
  the review with a bounded explanation rather than being dropped (decision
  0087).

All three keep `@pierre` behind Vista-owned types and share the bridge that
registers Shiki themes and tree styles against Geist semantic tokens
(MED.BLK-R07; decisions 0024 and 0036). `gh-previews` remains the lightweight
change citation; `pull-request` is the full review.

## Pull-request authored model

```ts
interface PullRequestData {
  number: number
  title: string
  url: string
  author: string
  state: string
  repository?: string
  baseRef?: string
  headRef?: string
  additions?: number
  deletions?: number
  body?: string
  files: readonly PullRequestFile[]
  commits?: readonly PullRequestCommit[] // oldest → newest
}

interface PullRequestFile {
  path: string
  status: GitStatus
  previousPath?: string
  patch?: string
  oldContents?: string
  newContents?: string
  additions?: number
  deletions?: number
  provenance?: "authored" | "generated" | "vendored"
}

interface PullRequestCommit {
  sha: string
  message: string
  author: string
  date: string
  files: readonly PullRequestFile[] // this commit's own changes
}
```

`repository` identifies the forge repository as `owner/repo`; `baseRef` and
`headRef` identify the captured branch edge. Forge-reported request and file
churn wins over counts parsed from a patch, so omitted or truncated patches do
not erase known magnitude. `provenance` is frozen from the head revision's
`.gitattributes`. A commit contains its own file changes, not a projection of
the request-level file list.

The pure projection produces an authored-order file rail, renderable
`@pierre/diffs` items, churn totals, and bounded problems. View state such as
unified or split layout, word granularity, selection, expansion, scope, hidden
files, and scroll position is presentation state and emits no SemanticNode.

## Composable review surface

```text
PullRequestReview (shared provider)
├── PullRequestStackNav
├── PullRequestHeader
├── PullRequestBody
├── PullRequestTreemap
├── PullRequestFileRail
└── PullRequestDiffPane
```

`PullRequestReview` owns the active request and the view state shared by every
part. Authors may arrange the header, description, stack navigation, treemap,
file rail, and diff pane without prop-threading or state divergence. The default
composition places the treemap above a file rail adjacent to the diff pane.

The generic `ResizableSplit` composes horizontal, vertical, and viewport-edge
splits under the parent [Useful Block viewport
contract](../spec.md#useful-block-viewports). A height-resizable `diff` is
`finite-scroll`: after its patch layout settles, the Diff reports the
border-box extent that contains its toolbar, rendered rows, and caption as its
UsefulExtent. Short diffs may therefore collapse below the authored minimum and
lose the separator when the effective range has one value. Pointer drag and
Arrow keys retain exact-pixel intent, while Home and End select the symbolic
minimum and maximum-useful intents. The default review uses the same primitive
for the treemap/review split, file-rail/diff split, and review viewport; each
composition declares its own content semantics rather than inheriting them from
the splitter.

## Stack projection

A stack is ordered base to top by following each request's
`baseRef` → `headRef` edge: a request stacked above another has a `baseRef`
equal to the lower request's `headRef`. Requests with missing, disconnected,
duplicate, or cyclic refs remain present in authored order after derivable
chains. Per-request overlap records every path also changed by another request;
stack navigation reports aggregate request, file, churn, and shared-path counts.
Changing the active request changes every review part and clears request-local
scope and commit focus.

## Scope and hidden files

**Zoom is scope.** The active directory scope is the controlled treemap root and
the common path prefix for the file rail and diff pane. Selecting a directory
tile sets that scope; selecting a file opens that file; choosing an ancestor or
the model root widens or clears the scope. The treemap, rail, and diff therefore
always describe the same subset.

The provider owns one hidden leaf-id set per request. The set is seeded from
files whose `provenance` is `generated`, remains revealable through the filter,
and filters the treemap, rail, and diff together. Hiding removes leaves before
treemap layout and re-sums the visible hierarchy; it does not mutate captured
data.

Selection surfaces use one modifier vocabulary:

| Input | Meaning |
| --- | --- |
| Shift | Select the contiguous range from the anchor |
| Command/Ctrl | Toggle one item without replacing the selection |
| Option/Alt | Exclude the item from the visible set |
| Option/Alt + Shift | Solo the item by excluding every other item |

A plain click keeps each surface's primary meaning: it replaces selection in a
multi-selection list, scopes or selects in the treemap, and opens a file in the
rail. Surfaces without an ordered range do not invent one.

## Commit focus

No commit focus means the request-level projection. Focusing exactly one commit
uses that commit's own file list and patches. If a commit capture omits a patch,
the pane may fall back to the request-level patch for that path and labels the
fallback.

Focusing several commits does not synthesize a range diff. The rail and treemap
show the union of touched paths with churn summed from the selected commits; the
diff pane renders one section per selected commit in capture order, each with
its own heading and diff. Scope and the hidden set apply identically to every
section.

The `validatePatch(patch)` authoring helper (a wrong `@@ -a,b +c,d @@` header renders
garbled with no error) is a doctrine authoring-helper concern; see
[../../04-doctrine/intuition.md](../../04-doctrine/intuition.md).

## Provider-backed review and checks

The `gh` Provider turns the authored review model into two typed domain Blocks
without adding network behavior to `PullRequestViewer`:

```text
PullRequestReviewBlock(repo, pr)
  -> frozen gh.pullRequest capture
  -> PullRequestData
  -> PullRequestViewer

PullRequestChecks(repo, pr)
  -> subscription gh.checksStream
  -> folded ChecksState + cursor
  -> snapshot paint -> CatchingUp -> Live
```

`PullRequestStackSummary` is the thin stack-level navigation Block. It accepts an
ordered PR-number list, repository, optional tier labels, and controlled
`selected` / `onSelect` or an uncontrolled persisted default. Each dense row
projects the captured `ChecksState` summary into PR title/number, tier, state,
mergeability, latest checks conclusion, head-ref chip, and PR/run links. State
glyphs carry text alternatives; row click, Enter, and arrow navigation all
select. The uncontrolled selection is UI state scoped to the published App and
repository, not a data Operation.

The Block registers each row's frozen checks seed plus the review and
subscription bindings needed by a selected detail, but renders no expanded
detail itself. An authored stack view mounts exactly one
`PullRequestReviewBlock` and one `PullRequestChecks` for the selected PR. Thus
changing selection is a pure client projection over captured data and only one
live checks subscription is mounted; no stack-specific Provider Operation
exists.

`PullRequestReviewBlock` binds `gh.ops.pullRequest` with `{ repo, pr }` in
frozen mode and acknowledges effectful capture. The Provider returns the
`PullRequestData` model above, including request-level files, per-commit files,
patch or old/new content, rename and churn metadata, and available provenance.
The existing `pullRequest` prop path remains the explicit hand-captured escape
hatch; both paths render through the same `PullRequestViewer`.

`PullRequestChecks` binds `gh.ops.checksStream` with `{ repo, pr }` in
subscription mode and acknowledges effectful capture of its frozen seed. A
published value is current folded state, not event history. In addition to the
legacy check-row fallback, `ChecksState` contains `run`, the latest workflow run
whose `headSha` equals the pull request head:

```ts
interface ChecksState {
  readonly checks: Readonly<Record<string, CheckRun>>
  readonly run: {
    readonly id: number
    readonly attempt: number
    readonly status: "queued" | "in_progress" | "completed"
    readonly conclusion: CheckConclusion
    readonly createdAt: string
    readonly startedAt: string | null
    readonly updatedAt: string
    readonly url: string
    readonly jobs: ReadonlyArray<{
      readonly id: number
      readonly name: string
      readonly status: "queued" | "in_progress" | "completed"
      readonly conclusion: CheckConclusion
      readonly createdAt: string
      readonly startedAt: string | null
      readonly completedAt: string | null
      readonly runner: string
      readonly url: string
      readonly steps: ReadonlyArray<{
        readonly number: number
        readonly name: string
        readonly status: "queued" | "in_progress" | "completed"
        readonly conclusion: CheckConclusion
        readonly startedAt: string | null
        readonly completedAt: string | null
      }>
    }>
  } | null
  readonly cursor: string
}
```

The Provider selects only the latest run of the current PR head. It pages
`actions/runs/<id>/jobs?per_page=100` under the same shared Provider budget as
the existing PR and run-list reads, strictly decodes every projected page, and
includes the complete job and step breakdown in both the frozen seed and live
state. The stream emits `Synced { state }` whenever replay cannot cover `since`
or the run breakdown changes, then retains `CheckUpdated { check, cursor }`
deltas for row-only changes. The pure fold replaces state on `Synced` and
updates the record by check name on `CheckUpdated`; its cursor lives in the
value and never in Snapshot identity.

When `run` is present, the Block renders a Vista-native SVG
[checks waterfall](./glossary.md#checks-waterfall), not an embedded Grafana
surface. Every job shares one time axis. Queue wait is hatched and execution is
solid; solid bars are coloured by conclusion while status and conclusion remain
visible as text. A job action drills into its steps inline, and each step links
to the GitHub log anchor. Arrow keys navigate jobs, Enter drills in, and Escape
returns. Summary evidence names the observed critical path, wall time versus
summed job run time, slowest job, and first failing job or step.

Queued and running bars grow only to `run.updatedAt`; the browser clock never
changes captured evidence. Live state highlights jobs and steps changed since
capture. If `run` is absent, the existing check rows, workflow fallback, and
typed empty state remain. A typed stream failure retains the last decoded state
instead of blanking the view.

Attempt history/selection and stack-level roll-up are intentionally outside
this Block. `attempt` is captured only as identity of the selected latest run;
the UI does not fetch or aggregate earlier attempts.
