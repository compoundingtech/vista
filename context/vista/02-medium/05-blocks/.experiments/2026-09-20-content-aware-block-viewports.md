# Experiment: content-aware Block viewports (2026-09-20)

## Question

Can one resize model remove useless finite-content space without confusing authored
bounds, viewport safety, content meaning, or the user's latent sizing choice?

## Method

Three bounded checks covered the live symptom, the existing source boundary, and
the state model.

1. A short rendered Diff was measured after its rows settled. Its viewport was
   approximately `607px` high while the complete useful border-box content was
   approximately `224px` high.
2. `ResizableSplit.tsx`, `Diff.tsx`, and the system-explorer source were audited
   for bounds, intent, ARIA, and content-measurement ownership.
3. Three policies were enumerated over representative authored minima
   `{0, 256}`, safety/authored maxima `{320, 607}`, finite UsefulExtents
   `{224, 607}`, all four intents, and stable shrink/regrowth traces up to three
   transitions. Natural-flow, finite-scroll, and canvas semantics were checked
   independently.

## Result

The live short Diff devoted about `383px` (`607 - 224`) to empty viewport. Its
authored minimum could not solve that case: useful content was shorter than the
minimum, so honoring the minimum preserved the waste.

| Policy | Short finite content | Stable shrink then regrowth | Canvas | Result |
| --- | --- | --- | --- | --- |
| Authored bounds only | Keeps the `607px` viewport because content is not an input | Preserves the numeric size | Correctly allows growth | Rejected: immediately reproduces the measured empty space |
| Destructive numeric clamp | Shrinks to the content cap | Overwrites the user's target and stays small after regrowth | Correctly allows growth when uncapped | Rejected: content changes silently become user choices |
| Tagged intent projected through current bounds | Shrinks to UsefulExtent, even below authored minimum | Retains the latent tag and reprojects it when bounds regrow | Omits the content cap | Selected |

The shortest temporal counterexample for destructive clamping was:

```text
explicit(500) -> stable UsefulExtent 224 -> stable UsefulExtent 607
expected rendered sizes: 500 -> 224 -> 500
numeric-clamp sizes:      500 -> 224 -> 224
```

The bounded model found no counterexample for tagged projection. `minimum` and
`maximum-useful` followed moving bounds; `explicit(px)` returned to its latent
pixel target; `default` followed the authored responsive default. For a finite
case with authored minimum `256` and UsefulExtent `224`, projection produced
`lower = upper = 224`; removing the separator was the only truthful interaction.
Natural-flow produced no resize affordance, and canvas accepted all space up to
authored and viewport-safety bounds.

### Source findings

- `ResizableSplit.tsx` derived bounds only from authored strings, container, and
  viewport. Its `isUserSized` boolean distinguished default from user-sized but
  could not distinguish exact pixels, minimum, or maximum-useful.
- Measurement clamped and stored the current number, so a content-derived clamp
  added to that shape would destroy latent intent on regrowth.
- End committed the current numeric maximum; double-click committed a measured
  initial number. The keyboard reset mapping therefore remains a separate
  design question.
- The separator remained mounted for a one-value range, and its initial
  `aria-valuenow` could precede measurement. A content-aware implementation must
  expose only projected bounds and remove a collapsed-range control.
- `Diff.tsx` accepted only authored `initialSize`/`minSize`/`maxSize` and wrapped
  every configured Diff in a splitter; it supplied no stable useful extent.
- System Explorer is a persistent graph canvas. No finite content-height
  measurement exists or should exist: additional area remains useful for
  layout and focus context.

## Conclusion

Adopt content-aware BlockViewport projection with distinct authored policy,
viewport safety, content semantics, and tagged ResizeIntent. Stable finite
content caps the useful range; canvas content does not; natural-flow content has
no handle. A stable shrink changes only the projection, and a collapsed range
removes the separator.

## VRS Impact

The contract is recorded in MED.BLK-R78, the Blocks spec, and [decision
0097](../../../.decisions/0097-content-aware-block-viewports.md). The
persistence scope, keyboard reset mapping, and stable-content-settled signal
remain open rather than being inferred from this experiment.
