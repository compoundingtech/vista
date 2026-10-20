import * as stylex from '@stylexjs/stylex'
import { scale, tokens } from '@vista/ui/tokens.stylex'
import type * as React from 'react'

import type { DecisionCardProps } from './DecisionCard.tsx'

const decisionsBrand = Symbol('DecisionSet')

/** Shared non-empty decision definitions and their derived overview component. */
export interface DecisionSet {
  readonly [decisionsBrand]: true
  readonly cards: readonly [DecisionCardProps, ...DecisionCardProps[]]
  readonly Overview: () => React.ReactElement
}

/** The overview reads the same definitions as the cards; it accepts no rows. */
export interface DecisionOverviewProps {
  readonly decisions: DecisionSet
}

/** Summarize recommendations and statuses from the same definitions as the cards. */
export const DecisionOverview = ({ decisions }: DecisionOverviewProps): React.ReactElement => (
  <section {...stylex.props(styles.overview)} aria-label="Decision overview">
    <h2 {...stylex.props(styles.heading)}>Decisions</h2>
    <div {...stylex.props(styles.scroll)}>
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr>
            <th {...stylex.props(styles.cell)}>Decision</th>
            <th {...stylex.props(styles.cell)}>Recommended</th>
            <th {...stylex.props(styles.cell)}>Status</th>
          </tr>
        </thead>
        <tbody>
          {decisions.cards.map((card) => (
            <tr key={card.id}>
              <th scope="row" {...stylex.props(styles.cell)}>
                <a href={`#${card.id}`}>{card.title}</a>
              </th>
              <td {...stylex.props(styles.cell)}>{card.recommended}</td>
              <td {...stylex.props(styles.cell)}>
                {card.status === 'awaiting-sign-off'
                  ? 'Awaiting sign-off'
                  : card.status === 'locked'
                    ? 'Locked'
                    : 'Open'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

type CheckRecommendations<TCards extends readonly DecisionCardProps[]> = {
  readonly [TIndex in keyof TCards]: TCards[TIndex] & {
    readonly recommended: TCards[TIndex]['options'][number]['label']
  }
}

/** Define the cards once, then render their derived Overview and the cards. */
export const defineDecisions = <
  const TCards extends readonly [DecisionCardProps, ...DecisionCardProps[]],
>(
  cards: TCards & CheckRecommendations<TCards>,
): DecisionSet & { readonly cards: TCards } => {
  const decisions: DecisionSet & { readonly cards: TCards } = {
    [decisionsBrand]: true,
    cards,
    Overview: () => <DecisionOverview decisions={decisions} />,
  }
  return decisions
}

const styles = stylex.create({
  overview: { color: tokens['--ds-gray-1000'], marginBlock: scale.space6, maxWidth: '100%' },
  heading: { marginBlock: scale.space4, fontSize: '1.125rem', fontWeight: 600 },
  scroll: { maxWidth: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', lineHeight: 1.5 },
  cell: {
    padding: scale.space4,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens['--ds-gray-400'],
    textAlign: 'left',
    overflowWrap: 'anywhere',
  },
})
