import { renderToStaticMarkup } from 'react-dom/server'
/**
 * End-to-end wiring test for facet-scoped default-hide (decision 0068, MED.BLK.TREE-R73):
 * a lens's `hiddenFacets` must seed the exclusion filter through the real `Treemap`
 * component, so the resting "N hidden" badge shows the count at zero interaction (the
 * MED.BLK.TREE-R61 honesty affordance). SSR (`renderToStaticMarkup`) is enough — the seed
 * and the badge are synchronous; `useTheme` defaults to light and `project` clamps size,
 * so no browser is needed (matches the `kit.test.tsx` render idiom).
 */
import { expect, test } from 'vitest'

import type { TreemapLens, TreemapModel } from '../../model.ts'
import { Treemap } from './Treemap.tsx'

const model: TreemapModel = {
  unit: 'lines',
  valueNoun: 'churn',
  root: {
    id: 'r',
    label: 'PR',
    children: [
      { id: 'r/ci.yml', label: 'ci.yml', value: 2000, facets: { provenance: 'generated' } },
      { id: 'r/app.ts', label: 'app.ts', value: 40, facets: { provenance: 'authored' } },
      { id: 'r/util.ts', label: 'util.ts', value: 10, facets: { provenance: 'authored' } },
    ],
  },
}

const render = (lenses: readonly TreemapLens[]): string =>
  renderToStaticMarkup(<Treemap id="t" model={model} lenses={lenses} />)

test('a hiddenFacets lens seeds the filter and shows the resting "N hidden" badge', () => {
  const html = render([
    { id: 'l', layout: 'treemap', maxDepth: 3, hiddenFacets: { provenance: ['generated'] } },
  ])
  expect(html).toContain('>1 hidden</span>')
})

test('a lens without hiddenFacets hides nothing — no badge', () => {
  const html = render([{ id: 'l', layout: 'treemap', maxDepth: 3 }])
  expect(html).not.toContain(' hidden</span>')
})
