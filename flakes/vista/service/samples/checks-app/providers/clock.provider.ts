import { implement, mountProvider } from '@vista/data/provider'
import { Effect, Layer, Schedule, Stream } from 'effect'

import { type ClockEvent, type ClockState, clock } from './clock.query.ts'

/**
 * Well-known symbol on globalThis used as a counter key so tests can observe how many times the
 * clock driver has started.
 */
export const clockDriverStarts = Symbol.for('vista.samples.clock.driverStarts')

const countDriverStart = Effect.sync(() => {
  const current = Reflect.get(globalThis, clockDriverStarts)
  Reflect.set(globalThis, clockDriverStarts, typeof current === 'number' ? current + 1 : 1)
})

const cursorNumber = (cursor: string): number => {
  const value = Number(cursor.replace(/^tick-/, ''))
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

const initial = (): Effect.Effect<ClockState> => Effect.succeed({ cursor: 'tick-0', ticks: 0 })

const ticks = (_args: { readonly lane: string }, since: string): Stream.Stream<ClockEvent> => {
  const start = cursorNumber(since)
  return Stream.iterate(start + 1, (value) => value + 1).pipe(
    Stream.schedule(Schedule.spaced('25 millis')),
    Stream.map((value) => ({
      _tag: 'Tick' as const,
      cursor: `tick-${value}`,
      ticks: value,
    })),
  )
}

const implementation = implement(clock, {
  purity: 'pure',
  handlers: {
    clockStream: ({ lane, since }) => ticks({ lane }, since ?? 'tick-0'),
  },
  live: {
    clockStream: {
      _tag: 'subscribable',
      initial: ({ lane: _lane }) => initial(),
      stream: ({ lane }, since) => ticks({ lane }, since).pipe(Stream.onStart(countDriverStart)),
    },
  },
})

export default mountProvider(implementation, Layer.empty)
