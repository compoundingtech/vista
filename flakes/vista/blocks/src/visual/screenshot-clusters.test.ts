import { expect, test } from 'vitest'

import { selectDominantPair } from './screenshot-clusters.ts'

const equivalent = (left: string, right: string): boolean => left === right

test('rejects a rare shared frame that hides a dominant candidate change', () => {
  expect(selectDominantPair(['A', 'A', 'A', 'A'], ['A', 'A', 'A', 'B'], equivalent, 3)).toEqual([
    'A',
    'A',
  ])

  expect(() =>
    selectDominantPair(['A', 'A', 'A', 'A'], ['B', 'B', 'B', 'A'], equivalent, 3),
  ).toThrow('Dominant reference and candidate frame clusters differ')
})
