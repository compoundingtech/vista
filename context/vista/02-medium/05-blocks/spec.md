# Blocks — Spec

This node owns curated Blocks, packaging, curation, and shared theming.
Requirements are in [requirements.md](./requirements.md); terms in
[ontology.md](../../ontology.md). Individual Block contracts live in their
children and source.

## Public surface

All public Blocks use `@vista/blocks`. They are ordinary React components with
typed JSX interfaces, including visual AskBlock and ForkBlock. The package
does not impose another authoring model; current surfaces belong to the package
and catalog, not a frozen inventory here.

Typed domain Blocks derive internal DataBindings. Presentation Blocks emit no
SemanticNode; addressable Blocks satisfy SemanticManifest/DOM correspondence.

Host boundaries are explicit: `@vista/blocks/contract` exposes schema-only
contracts, and `@vista/blocks/explore` exposes the shared exploration picker.
The component barrel applies no document reset; `@vista/blocks/shell` owns the
reset for Vista-owned pages. `VistaHostRuntimeProvider` injects optional telemetry
and interview runtimes. Without an injected runtime, the affected Block renders
its unavailable-in-this-host state rather than importing a service-only module.
Vista-owned shells supply the lazy service runtimes.

## Realization index

| Node                                               | Public Blocks                                                                                                                                                      | Realization                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [01-code](./01-code/spec.md)                       | `Diff`, `FileTree`, `PullRequestViewer`, `PullRequestReviewBlock`, `PullRequestChecks`                                                                             | Code changes, captured pull-request reviews, and snapshot-first check subscriptions |
| [02-mermaid](./02-mermaid/spec.md)                 | `MermaidDiagram`                                                                                                                                                   | Interactive Mermaid diagrams                                                        |
| [03-system-explorer](./03-system-explorer/spec.md) | `SystemExplorer`                                                                                                                                                   | Lens-driven exploration of typed system graphs                                      |
| [04-treemap](./04-treemap/spec.md)                 | `Treemap`, `DiskTreemap`                                                                                                                                           | Value hierarchies and provider-derived disk-usage projections                       |
| [05-telemetry](./05-telemetry/spec.md)             | `MetricQuery`, trace and flamegraph Blocks                                                                                                                         | Frozen or live telemetry rendered through the isolated visualization substrate      |
| [06-fork](./06-fork/spec.md)                       | `ForkBlock`                                                                                                                                                        | Structured option comparison                                                        |
| [08-usage](./08-usage/spec.md)                     | `SpendByProject`, `UsageOverTime`                                                                                                                                  | Trust-preserving OMP usage and API-equivalent cost views                            |
| [10-diff](./10-diff/spec.md)                       | `SemanticDiff`, `DiffPage`, diff lenses (`ImageDiff`, `PageSetDiff`, `TextDiff`, `CodeDiff`, `RecordDiff`, `DocumentDiff`, `TreeDiff`, `TraceDiff`, `DiagramDiff`) | Data-first semantic comparison of two versions of structured content                |

Thin Blocks that need no realization node remain part of this package's public
surface and Storybook catalog. The table indexes the subsystem contracts; it is
not an exhaustive export registry.

## Taste kit

The taste kit realizes the doctrine's taste rules as default Blocks, so pages
get context, choices and proof from components rather than page-local CSS.
Each takes the fewest props that carry its meaning; none has modes or config
objects.

| Block            | Role                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ContextHeader`  | Page opening: what, why now, the reader's ask (or "No action needed"), and an optional `verdict` bottom line                                                                                                                                                                                                                                                                                                 |
| `ChoiceCards`    | A registered Ask answered with radio cards and a copyable answer; `multiple` adds checkbox cards and a sticky dock with a copyable pick string. The recommended mark stays quiet and never resembles selection                                                                                                                                                                                               |
| `RankedFindings` | Findings ranked by measured gap on a shared axis that switches to log for spreads of 100× or more. A finding is proven only when it names `proof`; otherwise it renders as a dashed hypothesis with its `next` experiment                                                                                                                                                                                    |
| `TimeTrack`      | Durations on one axis that switches to log for spreads of 100× or more, the slowest row in the risk tone; authors supply only rows                                                                                                                                                                                                                                                                           |
| `Comparison`     | Peers measured on the same rows, with what they share said once                                                                                                                                                                                                                                                                                                                                              |
| `InspectRow`     | A closed row that opens its detail in place                                                                                                                                                                                                                                                                                                                                                                  |
| `Mark`, `Icon`   | Tone marks (icon plus word, never color alone) and the curated Lucide icon set                                                                                                                                                                                                                                                                                                                               |
| `MissionGraph`   | A mission as lanes × ranks on React Flow: one lane per `assignedTo` seat (human lanes first), steps ranked by their longest `dependsOn` path, and gates from an optional `overlay`. Nodes sharing a lane and rank are packed across the lane in stable ID order; lanes grow to fit parallel work in either orientation. Only steps and gates are drawn; selecting a node reveals its details below the graph |
| `ProgressLanes`  | Parallel work state, one row per lane; a lane waiting on the reader carries the you tone and finished lanes recede                                                                                                                                                                                                                                                                                           |
| `Note`           | Says what the wrapped element means; renders no box of its own and shows nothing until the reader turns on the shell's Explain overlay                                                                                                                                                                                                                                                                       |

The shell derives completion from rendered asks. ChoiceCards completes an ask
only after a successful clipboard write; a failed copy remains open and announces
"Copy failed". Both copy outcomes use a polite live region. Interview questions
use the same completion marker only after the service accepts the answer.

Tones are a CSS-variable layer (`--tone-recommend`, `--tone-you`,
`--tone-risk`, `--tone-done`, `--tone-muted`) declared on the App root and on
kit Blocks, never on `:root`, so theme switches recolor them.

App source imports icons as `Icon` from `@vista/blocks`. `lucide-react` is not
provided: an esm.sh copy would load a second React, so the import policy rejects
it and names the `Icon` path.

`AskBlock`, `Settled`, `StatusLine` and `OptionsGrid` remain exported for
published AppSources; new pages use `ContextHeader` with `ChoiceCards`,
`InspectRow`, the shell's ask counter, and `ChoiceCards` or `Comparison`.

## Code snippets

`CodeBlock` is the canonical read-only snippet, including Markdown fences.
It syntax-highlights by default through the existing Pierre/Shiki renderer,
using the shared Geist `--ds-*` theme bridge. The renderer is lazy and grammars
load on demand. `language` overrides filename inference; unlabelled snippets
remain plain text. KDL, TypeScript, TSX, JSON, Nix, Bash and Rust are supported.
Copy is an accessible icon action. Long lines scroll horizontally by default;
`wrap` and `lineNumbers` are explicit presentation options.

## Shell surface

Vista owns the chrome around an App and never interprets its content tree. The
bar is sticky and compact: identity, authorship, App and AppVersion navigation,
theme control, and — only once the document's `h1` has left the viewport — a
compact echo of the title. The echo is decorative and hidden from assistive
technology, so the App keeps its single `h1` and its heading structure does not
depend on scroll position (decision 0078). The App carries no separate
attribution footer.

Published bootstrap accepts explicit `?theme=light` or `?theme=dark` host
preferences and passes the selected scheme to the theme provider.

The product changelog is build-scoped and copied unchanged into published
AppVersions. An entry may carry a non-empty list of authored contributors:
exact native Smalltalk subject or historical dotted-label agent identity, optional verified name, and optional short
`repo/branch-leaf` worktree. The shell keeps the release summary compact and
shows contributors in a keyboard-accessible “Change context” disclosure.
Entries without contributors show no disclosure. No field is derived from
the viewer's current agent or worktree.

Both light and dark shell logos use build-resolved `?url` imports. Publication
emits their SVGs as static assets; the shell needs no duplicate asset route.

The bar also carries a content-width control (MED.BLK-R48). `full` is the
default and lets the authored content frame use the responsive page width;
`contained` centers that frame with a `72rem` maximum. The control exposes its
current pressed state and an action naming the other state. This preference
changes only the authored content frame: SourceInspector remains full width in
both states. The preference is scoped to the canonical App owner and slug and
is shared by all AppVersions.
Annotation mode is explicit review chrome. Agentation is unmounted by default;
an icon button named `Annotate` in the bar mounts or unmounts it. The choice is
persisted as UI state per owner/slug App, never as authored content or semantic
state. Automated browsers follow the same opt-in contract rather than receiving
a separate environment-based default.

RPC diagnostics are optional Vista host chrome, beside `Inspect source` in the
bar, never authored App content or a SemanticNode. Opening the inspector
subscribes to the service-wide, same-origin
[`/_rpc-inspector`](../../01-service/spec.md#viewer-rpc-diagnostics-svc-r17)
NDJSON stream. The initial view filters events to the currently viewed App
(owner and local slug); `Clear` removes that filter and exposes the eligible
service-wide events. Switching Apps resets the default to the newly viewed App.
The inspector distinguishes an empty filtered view from a disconnected or
unavailable stream. It never displays headers or `PtyApi` events, including
under a cleared filter. An unmapped app-local RPC remains identifiable by its
app, Provider, and RPC descriptor rather than being omitted from the view.

The inspector uses `@overeng/devbar` to switch between RPC diagnostics and a
visibility-aware FPS meter. Its tools follow the active light/dark theme.

Orientation is a right-edge outline rail. At rest it shows depth-encoding ticks,
with longer you-tone ticks for unanswered asks and the section being read inked;
it expands into a floating labeled panel while the pointer is in the right gutter
or a rail entry holds focus. Labels
remain mounted and merely clipped while collapsed, so assistive technology
reads one outline in either state and expansion needs no timers. Entries are
the App's headings and semantic markers in document order, labeled by an
explicit label, else the heading titling the marker, else a humanized ID. Where
the viewport has no gutter the rail becomes an outline control in the bar, never
a left sidebar. The rail is navigation chrome: it emits no SemanticNode.
The reading label follows live target geometry at the reading edge through
IntersectionObserver; at the document bottom, the final entry is active.
The header derives a segmented ask counter from rendered asks and their answer
markers, showing “need you” and “answered” counts only when nonzero and hiding
the counter on pages without asks.
The header shows an Explain toggle only while the page renders at least one
`Note`. It starts off and has no modes; turning it on dims the page except
the noted elements and draws every note as a numbered callout. Escape, the
toggle, or a press on the dimmed page turns it off.

## Prose

Prose leaves render complete GFM — headings, emphasis, strikethrough, inline and
fenced code, tables with column alignment, ordered, nested, and task lists,
blockquotes, thematic breaks, autolinks, and footnotes. Raw HTML is shown as
literal text and never interpreted. Headings render below the document `h1` and
carry stable GitHub-style anchors assigned in document order, with deterministic
suffixes for duplicates, plus the metadata the outline reads. Link and image
targets are limited to safe protocols and in-document or relative references; a
rejected target renders as inert text. Prose emits no SemanticNode
(decision 0086).

## Useful Block viewports

This section realizes MED.BLK-R78 and decision 0097.

```text
AuthoredPolicy ─┐
ViewportSafety ─┼─> project(intent) ─> rendered extent + ARIA range
ContentSemantics┤
ResizeIntent ───┘
```

The four inputs remain separate:

| Input             | Contract                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Authored policy   | Axis, default size, minimum, and optional maximum; it expresses desired layout, not content meaning |
| Viewport safety   | The largest extent the current layout can expose without clipping an unreachable pane or control    |
| Content semantics | `natural-flow`, `finite-scroll`, or `canvas`                                                        |
| ResizeIntent      | `default`, `explicit(px)`, `minimum`, or `maximum-useful`                                           |

Natural-flow content participates in document layout and renders no resize
separator. A finite-scroll Block reports a settled UsefulExtent: its
border-box extent on the resize axis that exposes all currently useful content
without adding empty viewport. Internal fixed chrome and scroll content are
both included. A canvas Block reports no UsefulExtent because more canvas
remains useful.

For a resizable finite-scroll or canvas Block, projection computes:

```text
authoredUpper = authored maximum, or ViewportSafety when absent
contentUpper  = settled UsefulExtent for finite-scroll content, otherwise infinity
upper         = max(0, min(ViewportSafety, authoredUpper, contentUpper))
lower         = min(max(0, authored minimum or 0), upper)
rendered      = project(ResizeIntent, default size, [lower, upper])
```

`default` reprojects the authored responsive default. `explicit(px)` clamps for
rendering but retains the exact latent pixel target. `minimum` tracks `lower`;
`maximum-useful` tracks `upper`. Pointer drag and Arrow-key steps produce
`explicit(px)` intent. Home produces `minimum`; End produces
`maximum-useful`, rather than storing the current numeric upper bound.

Bounds changes never rewrite ResizeIntent. A stable content shrink contracts the
trailing edge while preserving a user's latent explicit target, and later
regrowth restores that target up to the new bounds. Symbolic `minimum` and
`maximum-useful` follow their respective bounds during both transitions.

AppShell stores its `full`/`contained` content-width preference by canonical
App owner and slug. ResizeIntent stores by resolved immutable AppVersion and
stable Block id. The `latest` route resolves to the current immutable version
before reading the preference. Reset is an explicit native button beside the
separator; it deletes the stored intent and restores `default`.

The separator's `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` expose the
current projected pixel range and size, with orientation and controlled pane
kept accurate. When `lower === upper`, the range has no movable value: the
Block renders at that extent and removes the visible and focusable separator.
A finite-scroll UsefulExtent affects projection only after an explicit
same-epoch settled signal. Pending, stale, zero, non-finite, and unsupported
measurements fail open. Diff obtains its logical extent from Pierre's
post-render producer sample, including virtualization buffers, then adds
Vista-owned toolbar, caption, and border chrome.

## Packaging and curation

The library is one versioned workspace package. Heavy browser/runtime slices
declare optional-loading policy at the package boundary and remain below
RuntimeIslands where required.

Shared Storybook is the public review surface for the library, not a sampler.
It is organized so a reader can find a component by what it does, and each
component's stories cover the axes its own contract exposes (MED.BLK-R77):
meaningful states including empty, loading, error, and failure; the
interactions and keyboard paths it claims; responsive behavior where layout
adapts; and both themes wherever appearance is contract-relevant. Shell,
prose, and code surfaces are covered there like any other component, including
the scroll, reveal, and selection behaviors described above. Curation promotes
a proven local component to that surface without granting new semantic
capability.

Vista-owned Blocks and shell surfaces use co-located StyleX and Geist semantic
tokens. Foreign markup may use the narrowest scoped stylesheet needed to join
the theme. App-local StyleX is ordinary authoring; Vista owns document-wide
theme and base styles.

## Shared agent timeline rendering

```text
@overeng/agent-timeline core -> Vista AgentTimeline / provider contracts
                           -> compact (Span, CursorReadout, CompactSpend)
                           -> detail (SpanDetails -> SpendPanel)
```

`flakes/vista/agent-timeline` owns the domain-specific timeline schemas, projection,
labels, visual encodings, SVG Span, and compact/detail renderers. It is a
dotfiles workspace library, not foundational effect-utils UI: Vista and
workbench consumers share the agent ledger domain without depending on Vista
shell or provider orchestration.

The root export is model/projection/labels/types only. The `compact` entrypoint
exports CursorReadout, CompactSpend and Span without importing SpanDetails or
React Aria detail tables/tabs. `detail` exports SpanDetails and its props/tab
contract; `spend` exposes the separate SpendPanel. Renderers receive an explicit
light/dark theme, which Vista supplies from its existing theme context.
CompactSpend separates session cost from all descendant cost and labels
retained chart evidence when exact totals exceed retained marks.

### Data identity and compatibility

The canonical data contract is `agentTimeline`, with provider id
`agent-timeline`. `@vista/blocks` retains deprecated `AgentTrace` and
`projectAgentTrace` aliases. The service's `resolveProvider` boundary accepts
`agent-trace` queries and live-hub table lookups while resolving the canonical
provider. Requests to `/_data/agent-trace` retain the failure wire tag
`AgentTraceError`; canonical requests use `AgentTimelineError`. The legacy wire
codec delegates to the same mounted provider core, admission policy and scope,
so retained clients receive compatible success and failure payloads without a
second runtime.

Immutable snapshots retain their original entries and keys. The shared
`readSnapshotBinding` boundary in `blocks/src/data-contract.ts`, used by the
service frozen client and Blocks data queries, reads retained `agent-trace`
bindings for the canonical contract. Snapshot keys are
`SHA256(canonicalJson([providerId, tag, encodedArgs]))`; schema annotation names
are not key inputs. Renaming those annotations requires no persisted hash
migration. The OMP Usage ledger remains `omp-usage/ledger.sqlite`; the timeline
provider is unary and has no persisted live-hub cursors.

The legacy snapshot-reader deletion signal is an inventory of every retained
immutable `vN` publication tree showing no `snapshot.json` entry with
`provider: 'agent-trace'`, together with a test proving canonical-only snapshots
need no legacy reader. A date or the absence of newly authored legacy bindings
is not that signal. This signal does not authorize removing the deprecated
exports or old query-id support.

