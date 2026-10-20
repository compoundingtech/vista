import { describe, expect, it } from 'vitest'

import { listChips, type RecordValue } from './RecordDiff.tsx'

const tags = (...values: readonly string[]): readonly RecordValue[] =>
  values.map((value) => ({ _tag: 'text', value }))

const shown = (before: readonly RecordValue[], after: readonly RecordValue[]) =>
  listChips(before, after).map(({ item, kind }) => [
    item._tag === 'text' ? item.value : item._tag,
    kind,
  ])

describe('list chips', () => {
  // `a b c` is the longest common run, so the `x`s are removed in front and added behind.
  it('keeps a net removal of a duplicate visible next to its move', () => {
    expect(shown(tags('x', 'x', 'a', 'b', 'c'), tags('a', 'b', 'c', 'x'))).toEqual([
      ['x', 'removed'],
      ['a', 'unchanged'],
      ['b', 'unchanged'],
      ['c', 'unchanged'],
      ['x', 'moved'],
    ])
  })

  it('keeps a net addition of a duplicate visible next to its move', () => {
    expect(shown(tags('x', 'a', 'b', 'c'), tags('a', 'b', 'c', 'x', 'x'))).toEqual([
      ['a', 'unchanged'],
      ['b', 'unchanged'],
      ['c', 'unchanged'],
      ['x', 'moved'],
      ['x', 'added'],
    ])
  })

  it('shows a single relocated value once, as moved', () => {
    expect(shown(tags('a', 'b', 'c'), tags('b', 'c', 'a'))).toEqual([
      ['b', 'unchanged'],
      ['c', 'unchanged'],
      ['a', 'moved'],
    ])
  })
})
