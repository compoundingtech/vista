import { MermaidDiagram } from '../MermaidDiagram.tsx'
import { DecisionCard, decisionVisual, type DecisionCardProps } from './DecisionCard.tsx'
import { DecisionOverview, defineDecisions } from './DecisionOverview.tsx'

const card = {
  id: 'decision',
  title: 'Decision',
  situation: 'A decision is needed.',
  visual: decisionVisual(MermaidDiagram, { id: 'flow', source: 'flowchart LR\n A --> B' }),
  options: [{ label: 'Proceed', next: 'Take the next step.', cost: 'Time.' }],
  recommended: 'Proceed',
  why: ['It addresses the situation.'],
  risk: 'It may not work.',
  evidence: <p>Source material.</p>,
  status: 'open',
} as const satisfies DecisionCardProps

const review = defineDecisions([card])

/** Positive and rejected authoring fixtures, typechecked but never executed. */
export const decisionReviewTypeControls = () => {
  const valid = (
    <>
      <review.Overview />
      <DecisionCard {...review.cards[0]} />
    </>
  )
  const missingCost = (
    // @ts-expect-error Every option must declare its cost.
    <DecisionCard {...card} options={[{ label: 'Proceed', next: 'Take the next step.' }]} />
  )
  const handwrittenRows = (
    <DecisionOverview
      // @ts-expect-error Overview rows are derived, never supplied by the author.
      rows={[{ title: 'Different decision', recommended: 'Proceed', status: 'open' }]}
    />
  )
  // @ts-expect-error JSX erases element types; only decisionVisual constructs the visual slot.
  const rawImage = <DecisionCard {...card} visual={<img src="./figure.png" alt="Figure" />} />
  // @ts-expect-error The recommendation must name an option.
  const unknownRecommendation = <DecisionCard {...card} recommended="Unknown" />
  // @ts-expect-error The definition also checks recommendations against its option labels.
  const unknownDefinition = defineDecisions([{ ...card, recommended: 'Unknown' }])
  // @ts-expect-error The factory cannot construct an intrinsic image element.
  const rawFactory = decisionVisual('img', { src: './figure.png' })
  return {
    valid,
    missingCost,
    handwrittenRows,
    rawImage,
    unknownRecommendation,
    unknownDefinition,
    rawFactory,
  }
}
