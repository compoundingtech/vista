# The document owns the heading; the shell echoes it and offers a right-edge outline

Status: accepted

## Context

A published App is read as one long document in a browser. The shell must supply
identity, App/AppVersion navigation, and theme control without competing with the
App's own opening, and a long App needs orientation while the reader is deep in
it. Two coupled questions follow: where the document's single semantic `h1`
lives, and how section navigation appears without permanently spending reading
width.

Both answers are load-bearing beyond styling. The heading question decides
document accessibility semantics and which surface is allowed to be a heading at
all; the navigation question decides whether Vista owns a persistent structural
chrome or a peripheral affordance.

## Evidence and Argument

A Storybook variant study judged three title placements against a realistic
multi-section App fixture, at first paint and scrolled, with the outline rail
pinned collapsed, pinned open, and left in its real pointer/focus behavior:

- **Shell-owned title.** The header repeats what the document already says at
  first paint, and permanently spends header width that navigation and theme
  controls need.
- **Document-only title.** Reads best at first paint, but a scrolled reader has
  no identity anywhere on screen, which is exactly when a reviewer switching
  windows needs it.
- **Document-owned title with a scroll-triggered header echo.** One heading
  exists, the document opens the way an author wrote it, and identity returns
  precisely at the moment it was lost.

For navigation, a persistent left table of contents charges every reader
permanent width for an affordance used occasionally, and pushes the document off
center. A right-edge rail costs only a narrow gutter: collapsed depth-encoding
ticks are enough to show where the reader is, and the labels are one hover or
one focus away.

The prose renderer already shifts markdown headings one level below the document
title and emits per-heading outline metadata in the DOM, so an outline can be
derived from what is rendered rather than from a second authored structure.

## Options

| Title placement | Tradeoffs |
| --- | --- |
| Shell header owns the title at all scroll positions | Identity is always visible, but duplicates the document opening and crowds the header; the document either repeats a heading or starts headless |
| Document owns the title, header never carries it | Cleanest first paint, no duplication; identity disappears for most of the reading session |
| Document owns the sole `h1`, header reveals a compact echo after it scrolls away | One heading, honest document structure, identity restored exactly when lost; needs scroll observation and a non-heading echo element |

| Outline placement | Tradeoffs |
| --- | --- |
| Persistent left table of contents | Always legible; permanently consumes reading width and decenters the document |
| Collapsed right-edge rail that opens on hover or focus | Near-zero resting cost, position always visible via ticks; labels require an interaction and the gutter must stay reachable by keyboard |
| No outline | Nothing to build; long Apps lose orientation, which is the common Vista shape |

## Decision

The AppRoot title is the document's sole semantic `h1` and is rendered in the
document. Shell chrome never renders a competing heading element: the bar is
sticky and compact, carries identity, authorship, App/AppVersion navigation, and
theme control, and reveals a compact echo of the title only once that `h1` has
left the viewport. The echo is decorative and hidden from assistive technology,
so the accessible heading structure is the same at every scroll position.

Section navigation is a right-edge outline rail. At rest it is a column of ticks
whose length encodes depth and whose single inked tick marks the section being
read. It expands into a floating labeled panel while the pointer is in the right
gutter or any rail entry holds focus. Expansion is state, not choreography:
labels stay mounted and are merely clipped while collapsed, so assistive
technology reads one outline list in both states and there is no reveal or
dismissal timer. Below the width where a gutter exists, the rail is replaced by
an outline control in the sticky bar rather than by a left sidebar, so the
document never loses reading width.

Outline entries are the App's headings and semantic markers in document
order. An entry's label resolves in a fixed order: an explicit authored label,
otherwise the heading that titles that marker, otherwise a humanized form of its
stable ID. The label is optional and purely nominal — it is carried alongside
the SemanticNode it names, never creates one, and never substitutes for an ID,
so an unlabeled structural section stays unaddressable (MED.AUTH-R76). The rail
is navigation chrome: it emits no SemanticNode and adds no semantic capability.

## Consequences

- Prose headings render at `h2` and below, and the shell's echo is not a
  heading. Exactly one `h1` exists in a rendered App, at every scroll position.
- Semantic markers accept an optional label. Stable IDs remain reserved for
  addressable concepts, so a label is never a substitute for an ID and an ID is
  never invented to obtain an outline entry. The label is an additive, optional
  field: adding it does not change the SemanticManifest schema version.
- The outline is derived from rendered structure, not from a parallel authored
  table of contents; an App gains an outline by being written normally.
- The rail is peripheral by construction, so it must be operable from the
  keyboard and legible to assistive technology while collapsed.
- Identity and authorship belong to the sticky bar, so the App needs no separate
  attribution footer.

## Verification

Catalog coverage must show, at minimum: first paint and scrolled bar states; the
rail collapsed, expanded by pointer, and expanded by keyboard focus; the active
entry tracking the section being read; the narrow-viewport outline control; and
light and dark themes. A rendered App must contain exactly one `h1` at every
scroll position, and the bar's echo must be neither a heading nor exposed to
assistive technology. Label resolution must be exercised for all three cases —
explicit label, titling-heading fallback, humanized-ID fallback.
