import { expect, test } from 'vitest'

import { formatCompactAge } from './time.ts'

const NOW = Date.parse('2026-09-18T12:00:00.000Z')

const ago = (milliseconds: number): string => new Date(NOW - milliseconds).toISOString()

test('uses the largest compact whole unit at each age boundary', () => {
  expect([
    formatCompactAge(ago(59_999), NOW),
    formatCompactAge(ago(60_000), NOW),
    formatCompactAge(ago(3 * 60 * 60_000), NOW),
    formatCompactAge(ago(2 * 24 * 60 * 60_000), NOW),
    formatCompactAge(ago(5 * 7 * 24 * 60 * 60_000), NOW),
    formatCompactAge(ago(365 * 24 * 60 * 60_000), NOW),
  ]).toEqual(['now', '1m', '3h', '2d', '5w', '1y'])
})

test('future and invalid dates do not produce negative or non-finite ages', () => {
  expect(formatCompactAge(new Date(NOW + 60_000).toISOString(), NOW)).toBe('now')
  expect(formatCompactAge('not-a-date', NOW)).toBe('now')
})
