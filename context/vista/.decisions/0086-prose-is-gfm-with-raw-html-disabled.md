# Prose is complete GFM with raw HTML disabled

Status: accepted

## Context

Superseded decision 0015 introduced Markdown as a prose-leaf mechanism but
left its dialect undefined. Ordinary React authoring under decision 0074 kept
Markdown as a presentation Block. Its dialect therefore drifted toward whatever
the renderer happened to handle, while agents wrote the Markdown they use
everywhere else — tables, task lists, fenced code, autolinks, and footnotes. A
prose leaf that silently drops a table or renders a checklist as literal
asterisks makes the medium feel broken at the cheapest part of the surface.

The second question is raw HTML. Markdown renderers commonly allow embedded HTML,
optionally behind a sanitizer. Vista publishes durable AppVersions whose meaning
is projected into a SemanticManifest and whose look is Geist-native, so
interpreted HTML inside a prose leaf would be markup that escapes theming,
heading discipline, and the semantic projection at once.

## Evidence and Argument

GFM is the dialect our agents and repository docs are already written in, so
supporting it exactly removes a class of authoring surprise rather than adding a
feature. The grammar families that matter in review prose — headings, emphasis,
strikethrough, inline and fenced code, tables with column alignment, ordered and
nested lists, task lists, blockquotes, thematic breaks, autolinks, footnotes —
are all covered by GFM and by the block's own tests.

Allowing raw HTML has no matching upside. Trusted authorship (decision 0009) is
about who may publish, not about whether published markup should be able to
bypass the medium: an interpreted `<h1>`, `<script>`, or inline-styled `<div>` in
a prose leaf would break the single-heading rule of decision 0078, sidestep the
Geist token system, and add a sanitizer as a permanent correctness liability.
Showing HTML as literal text is both the safe behavior and the honest one — an
author who pasted markup sees exactly what they pasted.

Deep links need anchors that survive republication. GitHub-style slugs assigned
in document order, with deterministic numeric suffixes for duplicates, are
stable for unchanged prose and are the anchors readers already expect from the
same source text on GitHub.

## Options

| Option | Tradeoffs |
| --- | --- |
| CommonMark only | Smallest grammar; silently mangles the tables and task lists agents write constantly |
| GFM with raw HTML interpreted (with or without a sanitizer) | Maximum expressiveness; markup escapes theming, heading discipline, and the semantic projection, and a sanitizer must be maintained forever |
| GFM with raw HTML shown as literal text | Matches how authors already write; no bypass of the medium, no sanitizer; authors who genuinely need custom markup must use a component instead |
| MDX in prose leaves | Componentized prose; revives the MDX-specific boundary that decision 0074 superseded, while ordinary React already supplies the component escape hatch |

## Decision

Prose renders complete GFM. Raw HTML is never interpreted: HTML source folds into
literal text.

Prose headings render one level below the document `h1` (decision 0078), capped
at `h6`, and carry a stable GitHub-style anchor assigned in document order with
deterministic suffixes for duplicates, plus the label and depth metadata the
shell outline reads.

Link and image URLs are restricted to an allow-list — `http`, `https`, `mailto`,
`tel`, and in-document, absolute-path, or relative references. A rejected URL
renders as inert text carrying the link or alt text; it never becomes a live
target. External links opt out of referrer and opener leakage.

Prose emits no SemanticNode. It is a presentation leaf whose only durable
contributions are its anchors and its outline metadata.

## Consequences

- Deep links into prose are stable while the heading text and order are stable,
  and change when the heading text changes. Anchors are derived, not authored
  identities; an anchor is never a stable SemanticNode ID.
- Authors needing markup beyond GFM write an ordinary React component, which is
  the medium's existing escape hatch, rather than embedding HTML in prose.
- No HTML-passthrough or sanitizer dependency enters the eager graph.
- The one-`h1` rule holds for any prose a reviewer can paste, including prose
  that starts at `#`.

## Verification

Prose coverage must exercise each GFM grammar family, the anchor rules including
duplicate suffixes, literal rendering of raw HTML, inert rendering of unsafe URL
protocols, and the empty-source state. Catalog coverage must show prose in light
and dark themes, including a table wide enough to scroll and a long fenced code
block.
