import { expect, test } from 'vitest'

import { nextSelection } from './selection.ts'

const order = ['a', 'b', 'c', 'd', 'e'] as const
const none = { shift: false, meta: false, alt: false }

test('solo selection is idempotent for plain and explicit alt+shift clicks', () => {
  for (const clicked of order) {
    for (const modifiers of [none, { ...none, alt: true, shift: true }]) {
      const once = nextSelection({ prev: new Set(order), order, clicked, anchor: 'a', modifiers })
      const twice = nextSelection({
        prev: once.next,
        order,
        clicked,
        anchor: once.anchor,
        modifiers,
      })
      expect([...once.next]).toEqual([clicked])
      expect(twice).toEqual(once)
    }
  }
})

test('alt exclusion is idempotent', () => {
  for (const clicked of order) {
    const once = nextSelection({
      prev: new Set(order),
      order,
      clicked,
      anchor: 'a',
      modifiers: { ...none, alt: true },
    })
    const twice = nextSelection({
      prev: once.next,
      order,
      clicked,
      anchor: once.anchor,
      modifiers: { ...none, alt: true },
    })
    expect(twice).toEqual(once)
    expect(twice.next.has(clicked)).toBe(false)
  }
})

test('range selection is symmetric around its anchor', () => {
  for (const anchor of order) {
    for (const clicked of order) {
      const forward = nextSelection({
        prev: new Set<string>(),
        order,
        clicked,
        anchor,
        modifiers: { ...none, shift: true },
      })
      const reverse = nextSelection({
        prev: new Set<string>(),
        order,
        clicked: anchor,
        anchor: clicked,
        modifiers: { ...none, shift: true },
      })
      expect(forward.next).toEqual(reverse.next)
    }
  }
})

test('meta toggle is its own inverse for every item and starting selection', () => {
  const startingSelections = [new Set<string>(), new Set(['a', 'c']), new Set(order)]
  for (const prev of startingSelections) {
    for (const clicked of order) {
      const once = nextSelection({
        prev,
        order,
        clicked,
        anchor: undefined,
        modifiers: { ...none, meta: true },
      })
      const twice = nextSelection({
        prev: once.next,
        order,
        clicked,
        anchor: once.anchor,
        modifiers: { ...none, meta: true },
      })
      expect(twice.next).toEqual(prev)
    }
  }
})
