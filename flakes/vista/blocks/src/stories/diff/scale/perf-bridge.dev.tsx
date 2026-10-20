import { Cause, Effect, Exit, Fiber, Schema, Scope } from 'effect'
import * as React from 'react'

import type { Meters } from '@overeng/meters'
import { MeasureError, MeasureResult, type Measurement } from '@overeng/meters/headless'

/** Story-local measurement authority; no global or product bridge. */
export interface MetersTestBridge {
  readonly acquire: () => Promise<string>
  readonly finish: (options: {
    readonly token: string
    readonly settleFrames: number
  }) => Promise<typeof MeasureResult.Encoded>
  readonly cancel: (options: { readonly token: string }) => Promise<void>
  readonly counters: () => Readonly<Record<string, number>>
  readonly ready: () => boolean
}

/** DOM boundary revoked synchronously on unmount. */
export interface BridgeHost extends HTMLDivElement {
  metersTestBridge?: MetersTestBridge
}

/** Imported only behind the runtime's import.meta.env.DEV boundary. */
export const MetersTestHost = ({ meters }: { readonly meters: Meters }) => {
  const attach = React.useCallback(
    (host: HTMLDivElement | null) => {
      if (host === null) return
      const boundary: BridgeHost = host
      let registered = true
      const register = Effect.gen(function* () {
        yield* meters.start
        const parent = yield* Effect.scope
        const runPromise = Effect.runPromiseWith(yield* Effect.context<never>())
        const open = new Map<
          string,
          {
            readonly measurement: Measurement
            readonly scope: Scope.Closeable
            readonly before: Readonly<Record<string, number>>
            finishing: boolean
          }
        >()
        const ready = () => {
          const snapshot = meters.headless.snapshot()
          const frames = snapshot.frames
          const counters = Object.values(snapshot.counters)
          // Every declared boundary must have produced a real Profiler callback before zero deltas count.
          return (
            registered &&
            frames._tag === 'Value' &&
            frames.value.calibration._tag === 'Calibrated' &&
            counters.length > 0 &&
            counters.every((value) => Number.isFinite(value) && value > 0)
          )
        }
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            if (!registered) return
            boundary.metersTestBridge = {
              ready,
              counters: () => meters.headless.snapshot().counters,
              acquire: () =>
                runPromise(
                  Effect.uninterruptible(
                    Effect.gen(function* () {
                      if (!ready())
                        return yield* new MeasureError({
                          reason: 'NotRunning',
                          message: 'Bridge is closed or frames are not calibrated',
                        })
                      const scope = yield* Scope.fork(parent)
                      const acquired = yield* Effect.exit(
                        Scope.provide(meters.headless.measurement, scope),
                      )
                      if (Exit.isFailure(acquired)) {
                        yield* Scope.close(scope, acquired)
                        return yield* Effect.failCause(acquired.cause)
                      }
                      // Unmount can race the scoped acquisition while its finalizer is running.
                      if (!registered) {
                        yield* Scope.close(scope, Exit.succeed(undefined))
                        return yield* new MeasureError({
                          reason: 'ScopeClosed',
                          message: 'Bridge unmounted during acquisition',
                        })
                      }
                      const token = crypto.randomUUID()
                      open.set(token, {
                        measurement: acquired.value,
                        scope,
                        before: meters.headless.snapshot().counters,
                        finishing: false,
                      })
                      return token
                    }),
                  ),
                ),
              finish: ({ token, settleFrames }) =>
                runPromise(
                  Effect.uninterruptibleMask((restore) =>
                    Effect.gen(function* () {
                      const entry = open.get(token)
                      if (!registered || entry === undefined)
                        return yield* new MeasureError({
                          reason: 'ScopeClosed',
                          message: 'Bridge token is not active',
                        })
                      if (entry.finishing)
                        return yield* new MeasureError({
                          reason: 'AlreadyEnded',
                          message: 'Bridge token is already finishing',
                        })
                      entry.finishing = true
                      const ended = yield* Effect.exit(
                        restore(entry.measurement.end({ settleFrames })),
                      )
                      const after = meters.headless.snapshot().counters
                      open.delete(token)
                      yield* Scope.close(entry.scope, ended)
                      if (Exit.isFailure(ended)) return yield* Effect.failCause(ended.cause)
                      const result = ended.value
                      if (result._tag !== 'Complete')
                        return yield* Schema.encodeEffect(MeasureResult)(result)
                      const counterDelta: Record<string, number> = {}
                      // Public deltas are sparse. Explicit zero requires two matching cumulative reads,
                      // not a fallback for an absent measurement key or undeclared instrumentation.
                      if (Object.keys(after).length !== Object.keys(entry.before).length)
                        return yield* Effect.die(
                          'Declared counter evidence changed during measurement',
                        )
                      for (const [key, before] of Object.entries(entry.before)) {
                        const current = after[key]
                        if (
                          !Object.hasOwn(after, key) ||
                          current === undefined ||
                          !Number.isFinite(before) ||
                          !Number.isFinite(current) ||
                          current < before
                        )
                          return yield* Effect.die(
                            `Counter evidence changed during measurement: ${key}`,
                          )
                        if (!Object.hasOwn(result.data.counterDelta, key) && current !== before)
                          return yield* Effect.die(`Missing nonzero counter delta: ${key}`)
                        counterDelta[key] = current - before
                      }
                      for (const [key, delta] of Object.entries(result.data.counterDelta)) {
                        if (!Object.hasOwn(counterDelta, key) || counterDelta[key] !== delta)
                          return yield* Effect.die(
                            `Counter evidence disagrees with measurement: ${key}`,
                          )
                      }
                      return yield* Schema.encodeEffect(MeasureResult)({
                        ...result,
                        data: { ...result.data, counterDelta },
                      })
                    }),
                  ),
                ),
              cancel: ({ token }) =>
                runPromise(
                  Effect.uninterruptible(
                    Effect.gen(function* () {
                      const entry = open.get(token)
                      if (entry === undefined) return
                      open.delete(token)
                      yield* Scope.close(entry.scope, Exit.succeed(undefined))
                    }),
                  ),
                ),
            }
          }),
          () =>
            Effect.gen(function* () {
              registered = false
              delete boundary.metersTestBridge
              for (const entry of open.values())
                yield* Scope.close(entry.scope, Exit.succeed(undefined))
              open.clear()
            }),
        )
        return yield* Effect.never
      }).pipe(
        Effect.tapCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.void
            : Effect.logError('Meters test bridge failed', cause),
        ),
        Effect.scoped,
      )
      const fiber = Effect.runFork(register)
      return () => {
        // Synchronous revocation precedes asynchronous fiber interruption and scope closure.
        registered = false
        delete boundary.metersTestBridge
        Effect.runFork(Fiber.interrupt(fiber))
      }
    },
    [meters],
  )
  return <div ref={attach} data-testid="meters-test-host" hidden />
}
