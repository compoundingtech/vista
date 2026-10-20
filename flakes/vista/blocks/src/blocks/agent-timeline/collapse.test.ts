import { expect, test } from 'vitest'

import { nearestVisibleCollapsedAncestorId } from './collapse.ts'

const parents = new Map<string, string | null>([
  ['root', null],
  ['child', 'root'],
  ['grandchild', 'child'],
  ['other-child', 'root'],
  ['other-grandchild', 'other-child'],
  ['sibling', 'root'],
])

test('a hidden lane rolls up only to its own nearest visible collapsed ancestor', () => {
  const expanded = new Set(['root'])
  expect(nearestVisibleCollapsedAncestorId('grandchild', parents, expanded)).toBe('child')
  expect(nearestVisibleCollapsedAncestorId('other-grandchild', parents, expanded)).toBe(
    'other-child',
  )
  expect(nearestVisibleCollapsedAncestorId('sibling', parents, expanded)).toBeNull()
})

test('an outer collapse owns descendants of nested collapsed rows', () => {
  const expanded = new Set<string>()
  expect(nearestVisibleCollapsedAncestorId('child', parents, expanded)).toBe('root')
  expect(nearestVisibleCollapsedAncestorId('grandchild', parents, expanded)).toBe('root')
  expect(nearestVisibleCollapsedAncestorId('root', parents, expanded)).toBeNull()
})
