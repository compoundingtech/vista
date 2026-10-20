# App Taste — Spec

This document specifies the visual authoring contract, refining
[MED.DOC-R32–R35](./requirements.md). The mental model is in
[intuition.md](./intuition.md); the [block library](../05-blocks/spec.md)
realizes the presentation. IDs are path-scoped (`MED.DOC.TASTE-R*`).

## Status

Active.

## Scope

Defines reader-facing composition and its review criteria, not a page template,
a hard word limit, or a publish gate. These rules apply to decision-driving and
informational vistas; the latter explicitly need no reader action.

## Reading grammar

```text
Context: what / why now / reader ask
                  ↓
          One primary visual focus
                  ↓
        Supporting evidence → inspect detail
```

## Rules and review criteria

| ID                                                        | Authoring rule                                                                                                                                                                                                                                               | Observable review criterion                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MED.DOC.TASTE-R01 Context first**                       | The header identifies what this is, why it matters now, and what the reader must decide or understand. An informational vista explicitly says no action is needed.                                                                                           | The opening viewport answers all three without requiring the body or chat history. Refines MED.DOC-R32.                                                                                                                                                                           |
| **MED.DOC.TASTE-R02 One primary focus**                   | Each screenful has one dominant claim, comparison, diagram, or action. Visual weight guides attention from it to subordinate evidence.                                                                                                                       | A reader can identify where to look first; equal-weight cards, badges, and competing accents do not obscure that focus. Refines MED.DOC-R34.                                                                                                                                      |
| **MED.DOC.TASTE-R03 Earned text**                         | Spend the text budget on context, conclusions, and essential labels. Use visuals and structure for relationships before prose; remove any sentence that adds no decision-relevant information. Drafts, logs, and other long artifacts are inspect-on-demand. | The primary path is understandable with those artifacts closed. Relationships are legible in a diagram, comparison, timeline, or other suitable visual rather than reconstructed from paragraphs. No fixed word count or hard publish budget is implied. Refines MED.DOC-R34–R35. |
| **MED.DOC.TASTE-R04 Explicit hierarchy and sequence**     | Show parent/child relationships by nesting and ordered reasoning or events by a visible sequence. Peer alternatives share an aligned comparison.                                                                                                             | Readers can distinguish peers from dependencies and know the next reading step without inferring order from prose. Refines MED.DOC-R35.                                                                                                                                           |
| **MED.DOC.TASTE-R05 Semantic color and consistent icons** | Use color intentionally for stable meanings such as recommendation, risk, and change. Use one consistent icon set when icons improve recognition; pair color with shape or text so it is not the only signal.                                                | The same meaning has the same color/icon treatment throughout; decorative competing accents and mixed icon styles are absent. Refines MED.DOC-R35.                                                                                                                                |
| **MED.DOC.TASTE-R06 Affordances, not pseudo-controls**    | Choices are real bounded controls, not styled text. Image enlargement uses a zoom cursor or consistent icon control, not repeated “Open full size” captions. Controls have accessible names, visible focus, and keyboard operation.                          | A reader can recognize and operate every offered choice or zoom action without instructional prose; text posing as a button is absent. Refines MED.DOC-R32–R35.                                                                                                                   |
| **MED.DOC.TASTE-R07 Familiar grammar, bespoke content**   | Reuse the kit's header, focus, evidence, and disclosure grammar. Choose the body visual for the situation rather than forcing every vista into the same page template.                                                                                       | Orientation and interaction remain recognizable across vistas while the primary visual exposes this situation's actual relationships. Refines MED.DOC-R35.                                                                                                                        |
| **MED.DOC.TASTE-R08 No UI-explaining prose**              | Labels name domain content and actions. Cut prose explaining the layout, where to click, or how to read the UI; make the hierarchy and affordances carry that work. Accessible control names and necessary domain explanations remain.                       | There is no “use the cards below”, “click to inspect”, or narration of the page furniture on the reading path. Refines MED.DOC-R32–R35.                                                                                                                                           |
| **MED.DOC.TASTE-R09 Prove before claiming**               | Before publishing a causal claim, try to run the experiment that proves it. When that experiment is infeasible, publish the claim as a hypothesis together with its next experiment.                                                                         | Every claimed cause either names its proof or renders as a hypothesis with a next experiment; `RankedFindings` shows the difference as solid versus dashed.                                                                                                                       |

## Rationale: Johannes's feedback

The review criteria make the recurring feedback actionable without turning taste
into a hard publish gate.

| Rules    | Source feedback                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01      | incident-composition-bakeoff: “no idea what this vista wants from me, gives me no context.” General: “often the context isn't clear e.g. lacks motivation”.                                       |
| R02      | notion-scan-drift-diff: “too much stuff going on, too much noise, I have a hard time focusing” and “I have no idea where I should look.”                                                          |
| R03      | General: “good design needs to do the heavy lifting for vista. usually vistas are too text heavy/verbose”. pairing-1 v15: “waaaaaay too much text and noise, no useful guidance of my attention”. |
| R04      | afk-ratification v9: “often vistas have a hierarchy or sequence to it, that should be better supported. also my attention should be better guided.”                                               |
| R05      | afk-ratification v9: “we can embrace color a bit more in an intentional way and possibly well chosen icons in a consistent way.”                                                                  |
| R06, R08 | afk-ratification v9, on “Open full size” labels and “Ratify / Revisit” text pseudo-button: “unwanted text labels where proper ui design would have done the job better”.                          |
| R07      | incident-composition-bakeoff: “we need to aim for the right level of 'feels always familiar' and custom/bespoke for the given situation. signal/noise always needs to be on point”.               |
