import { expect, test } from 'vitest'

import { followTraceWindow, hiddenValues, shownValues } from './refresh.ts'

const HOUR = 3_600_000
const previousWindow = { start: 0, end: 24 * HOUR }
const nextWindow = { start: 60_000, end: 24 * HOUR + 60_000 }

test('a full view follows the moved window', () => {
  expect(followTraceWindow({ viewport: previousWindow, previousWindow, nextWindow })).toEqual(
    nextWindow,
  )
})

test('a zoomed view touching the right edge slides with now', () => {
  const viewport = { start: 23 * HOUR, end: 24 * HOUR - 30_000 }
  expect(followTraceWindow({ viewport, previousWindow, nextWindow })).toEqual({
    start: 23 * HOUR + 60_000,
    end: 24 * HOUR + 30_000,
  })
})

test('a view zoomed into the past keeps its absolute times', () => {
  const viewport = { start: 10 * HOUR, end: 12 * HOUR }
  expect(followTraceWindow({ viewport, previousWindow, nextWindow })).toEqual(viewport)
})

test('a past view that the window start overtakes is clamped into the new window', () => {
  const viewport = { start: 0, end: HOUR }
  expect(followTraceWindow({ viewport, previousWindow, nextWindow })).toEqual({
    start: 60_000,
    end: HOUR + 60_000,
  })
})

test('values first seen after a refresh are shown; hidden values stay hidden', () => {
  const hidden = hiddenValues(['main', 'subagent'], new Set(['main']))
  expect([...hidden]).toEqual(['subagent'])
  expect([...shownValues(['advisor', 'main', 'subagent'], hidden)]).toEqual(['advisor', 'main'])
})
