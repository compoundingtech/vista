import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import * as React from 'react'

import { Ask, Decision, Evidence, type DecisionProps } from '../../authoring.tsx'
import { ChartBlock, type ChartBlockProps } from '../ChartBlock.tsx'
import { MermaidDiagram, type MermaidDiagramProps } from '../MermaidDiagram.tsx'
import {
  AnnotatedImage,
  type AnnotatedImageElement,
  type AnnotatedImageProps,
} from './AnnotatedImage.tsx'
import { CiChart, type CiChartElement, type CiChartProps } from './CiChart.tsx'

const visualBrand = Symbol('DecisionVisual')
type VisualElement =
  | AnnotatedImageElement
  | CiChartElement
  | React.ReactElement<ChartBlockProps, typeof ChartBlock>
  | React.ReactElement<MermaidDiagramProps, typeof MermaidDiagram>

/** Construct with decisionVisual; JSX alone does not preserve a component's type. */
export interface DecisionVisual {
  readonly [visualBrand]: true
  readonly element: VisualElement
}

interface DecisionVisualFactory {
  (component: typeof AnnotatedImage, props: AnnotatedImageProps): DecisionVisual
  (component: typeof CiChart, props: CiChartProps): DecisionVisual
  (component: typeof ChartBlock, props: ChartBlockProps): DecisionVisual
  (component: typeof MermaidDiagram, props: MermaidDiagramProps): DecisionVisual
}

/** Select a supported visual and pass its typed props. */
export const decisionVisual: DecisionVisualFactory = (
  component: typeof AnnotatedImage | typeof CiChart | typeof ChartBlock | typeof MermaidDiagram,
  props: AnnotatedImageProps | CiChartProps | ChartBlockProps | MermaidDiagramProps,
): DecisionVisual => {
  // The overloads retain each component/props pairing; JSX would erase it to any.
  if (
    component !== AnnotatedImage &&
    component !== CiChart &&
    component !== ChartBlock &&
    component !== MermaidDiagram
  ) {
    throw new Error('Decision visuals must use a supported Vista visual block')
  }
  const element = React.createElement(
    component as React.ComponentType<typeof props>,
    props,
  ) as VisualElement
  return { [visualBrand]: true, element }
}

/** One available action with its next step and explicit cost. */
export interface DecisionOption {
  readonly label: string
  readonly next: string
  readonly cost: string
}

/** Non-empty options whose labels constrain the recommended action. */
export type DecisionOptions = readonly [DecisionOption, ...DecisionOption[]]

/** One addressable decision, with its situation, visual, costs and supporting evidence. */
export interface DecisionCardProps<TOptions extends DecisionOptions = DecisionOptions> {
  readonly id: string
  readonly title: string
  /** State the situation briefly. */
  readonly situation: string
  readonly visual: DecisionVisual
  /** Every option states what happens next and its cost. */
  readonly options: TOptions
  readonly recommended: NoInfer<TOptions[number]['label']>
  /** Give a short list of reasons for the recommendation. */
  readonly why: readonly [string, ...string[]]
  readonly risk: string
  /** Supporting material is collapsed initially. */
  readonly evidence: React.ReactNode
  readonly status: DecisionProps['status']
}

/** Present an addressable decision with options, recommendation and evidence. */
export const DecisionCard = <const TOptions extends DecisionOptions>({
  id,
  title,
  situation,
  visual,
  options,
  recommended,
  why,
  risk,
  evidence,
  status,
}: DecisionCardProps<TOptions>): React.ReactElement => {
  if (!options.some((option) => option.label === recommended)) {
    throw new Error(`Decision "${id}" recommends an unknown option "${recommended}"`)
  }
  return (
    <article {...stylex.props(styles.card)}>
      <Decision id={id} label={title} status={status} refs={[`${id}-evidence`]}>
        <p {...stylex.props(styles.situation)}>{situation}</p>
        <div {...stylex.props(styles.visual)}>{visual.element}</div>
        <div {...stylex.props(styles.options)}>
          {options.map((option) => (
            <section
              key={option.label}
              {...stylex.props(styles.option)}
              aria-label={`Option ${option.label}`}
            >
              <h3 {...stylex.props(styles.optionTitle)}>
                {option.label}
                {option.label === recommended ? ' · recommended' : ''}
              </h3>
              <p {...stylex.props(styles.text)}>{option.next}</p>
              <p {...stylex.props(styles.text)}>
                <strong>Cost: </strong>
                {option.cost}
              </p>
            </section>
          ))}
        </div>
        <Ask id={`${id}-ask`} refs={[id]}>
          <p {...stylex.props(styles.text)}>
            <strong>Recommended: </strong>
            {recommended}
          </p>
          <ul {...stylex.props(styles.reasons)}>
            {why.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p {...stylex.props(styles.text)}>
            <strong>Risk: </strong>
            {risk}
          </p>
        </Ask>
        <Evidence id={`${id}-evidence`}>
          <details {...stylex.props(styles.evidence)}>
            <summary {...stylex.props(styles.summary)}>Evidence</summary>
            <div {...stylex.props(styles.evidenceBody)}>{evidence}</div>
          </details>
        </Evidence>
      </Decision>
    </article>
  )
}

const styles = stylex.create({
  card: {
    minWidth: 0,
    maxWidth: '100%',
    marginBlock: scale.space6,
    padding: scale.space6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-400'],
    borderRadius: scale.radiusDefault,
    backgroundColor: tokens['--ds-background-100'],
    color: tokens['--ds-gray-1000'],
  },
  situation: { marginBlock: scale.space4, fontSize: '1rem', lineHeight: 1.6 },
  visual: { minWidth: 0, maxWidth: '100%', marginBlock: scale.space6 },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))',
    gap: scale.space4,
    marginBlock: scale.space6,
  },
  option: {
    minWidth: 0,
    padding: scale.space4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens['--ds-gray-400'],
    borderRadius: scale.radiusDefault,
  },
  optionTitle: { margin: 0, fontSize: '1rem', fontWeight: 600 },
  text: { marginBlock: scale.space3, lineHeight: 1.6, overflowWrap: 'anywhere' },
  reasons: { paddingInlineStart: scale.space6, lineHeight: 1.6 },
  evidence: {
    marginBlockStart: scale.space6,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: tokens['--ds-gray-400'],
  },
  summary: { cursor: 'pointer', paddingBlock: scale.space4, fontWeight: 600 },
  evidenceBody: { paddingBlockEnd: scale.space4, overflowWrap: 'anywhere' },
})
