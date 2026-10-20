# Content-aware Block viewports preserve latent resize intent

Status: accepted

## Context

A resizable Block can expose more than one kind of space. Finite scroll content
stops being useful once all content is visible, while a graph canvas can use
additional area indefinitely and natural-flow prose should remain in document
flow. Treating all three as the same authored min/max rectangle left a short
Diff at roughly `224px` of useful content inside a `607px` viewport.

A content cap also creates a temporal problem. If stable content shrinks below a
user's chosen size and the current numeric size is overwritten, later content
regrowth cannot distinguish the user's target from the temporary projection.

## Evidence and Argument

The [content-aware Block viewport experiment](../02-medium/05-blocks/.experiments/2026-09-20-content-aware-block-viewports.md)
combined the live short-Diff measurement, a source audit, and a bounded
three-policy enumeration. Authored-only bounds reproduced the empty space.
Destructively clamping one stored number fixed the momentary layout but lost the
user's target on the shortest shrink/regrowth trace. A tagged intent projected
through current bounds satisfied finite-scroll, canvas, natural-flow, and
regrowth cases.

## Options

| Direction | Tradeoffs |
| --- | --- |
| Authored min/default/max only | Simple and predictable; cannot remove dead space below an authored minimum and ignores content meaning |
| Clamp and store the current pixel size | Removes dead space immediately; converts a temporary content constraint into a user choice and loses intent on regrowth |
| Project tagged intent through authored, safety, and content bounds | Preserves meaning and regrowth; requires content semantics, stable useful measurement, and an explicit projection model |

## Decision

A resizable Block is a BlockViewport governed by four separate inputs: authored
policy, viewport safety, content semantics, and ResizeIntent. Content semantics
are `natural-flow`, `finite-scroll`, or `canvas`. Natural-flow renders no resize
affordance. Stable finite-scroll content caps the range at UsefulExtent, even
below the authored minimum. Canvas has no content-derived cap.

ResizeIntent is `default`, `explicit(px)`, `minimum`, or `maximum-useful`.
Pointer drag and Arrow keys select exact pixels; Home selects `minimum`; End
selects symbolic `maximum-useful`. Bounds project intent without rewriting it,
so stable shrink contracts the trailing edge and regrowth restores the latent
choice where possible.

ARIA values expose the effective projected bounds and size. When the effective
minimum and maximum coincide, no movable range exists and the visible and
focusable separator is removed.

## Consequences

- Authored minimum is a policy preference, not permission to preserve empty
  finite-content space.
- Blocks must declare content semantics; the generic splitter cannot infer them.
- Finite-scroll Blocks must supply a same-epoch settled UsefulExtent, while
  canvas Blocks must not synthesize one.
- `maximum-useful` remains meaningful as content and viewport bounds change;
  it is not an alias for the pixel value observed when End was pressed.
- App content width persists by canonical owner and slug. ResizeIntent persists
  by resolved immutable AppVersion and stable Block id.
- Reset is an explicit native button beside the separator. It deletes the
  stored intent and restores `default`.

## Verification

The experiment records the `607px`/`~224px` live case, the three-policy bounded
enumeration, the shortest destructive-clamp counterexample, and the source
findings. The normative projection and collapsed-range behavior are specified
under [Useful Block viewports](../02-medium/05-blocks/spec.md#useful-block-viewports)
and trace to MED.BLK-R78.
