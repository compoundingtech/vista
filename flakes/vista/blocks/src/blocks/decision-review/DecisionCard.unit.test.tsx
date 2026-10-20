import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AppRoot, extractSemanticManifest } from '../../authoring.tsx'
import { CiChart } from './CiChart.tsx'
import { DecisionCard, decisionVisual } from './DecisionCard.tsx'
import { defineDecisions } from './DecisionOverview.tsx'

const review = defineDecisions([
  {
    id: 'capacity',
    title: 'Capacity choice',
    situation: 'Measured demand exceeds capacity.',
    visual: decisionVisual(CiChart, {
      rows: [{ label: 'Current', point: 12, lo: 10, hi: 15 }],
      threshold: { value: 8, label: 'Capacity' },
      unit: 'requests',
    }),
    options: [
      { label: 'Increase capacity', next: 'Add capacity.', cost: 'Additional operating cost.' },
    ],
    recommended: 'Increase capacity',
    why: ['Capacity is below the observed interval.'],
    risk: 'Demand may change.',
    evidence: <p>Measurement notes.</p>,
    status: 'awaiting-sign-off',
  },
])

const App = () => (
  <AppRoot title="Capacity review" template="options-comparison" scope="Capacity">
    <review.Overview />
    {review.cards.map((card) => (
      <DecisionCard key={card.id} {...card} />
    ))}
  </AppRoot>
)

describe('decision cards and derived overview', () => {
  it('keeps evidence collapsed and shows every next step and cost', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('<details')
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/)
    expect(html).toContain('Measurement notes.')
    expect(html).toContain('Add capacity.')
    expect(html).toContain('Additional operating cost.')
    expect(html).toContain('Awaiting sign-off')
    expect(html).toContain('href="#capacity"')
  })

  it('registers the existing Decision, Ask and Evidence identities and status', () => {
    const manifest = extractSemanticManifest(<App />)
    expect(manifest.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'capacity',
          kind: 'decision',
          status: 'awaiting-sign-off',
          label: 'Capacity choice',
        }),
        expect.objectContaining({ id: 'capacity-ask', kind: 'ask', refs: ['capacity'] }),
        expect.objectContaining({ id: 'capacity-evidence', kind: 'evidence' }),
      ]),
    )
  })
})
