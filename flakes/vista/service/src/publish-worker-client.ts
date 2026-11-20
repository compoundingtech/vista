import { randomUUID } from 'node:crypto'

import { NodeServices } from '@effect/platform-node'
import { Effect, Schema, Semaphore, Stream } from 'effect'
import { ChildProcess } from 'effect/process'

import { PublishFailed, type PublishInput } from './control.ts'
import type { ProviderRegistryManager } from './data/mount.ts'
import { PublishWorkerLauncher, publishWorkerLauncherLayer } from './publish-worker-launcher.ts'
import { PublishWorkerRequestJson, PublishWorkerResponseJson } from './publish-worker-protocol.ts'
import { acknowledgePublishAttempt, rollbackPublishAttempt } from './publish.ts'

/** Includes startup, the complete transaction, cleanup, and process exit. */
export const PUBLISH_WORKER_TIMEOUT_MS = 10 * 60 * 1_000

// Only active/queued attempts occupy this map. Different apps remain parallel.
const publicationLocks = new WeakMap<
  ProviderRegistryManager,
  Map<string, { semaphore: Semaphore.Semaphore; users: number }>
>()

export const publishInWorker = (
  input: PublishInput,
  providers: ProviderRegistryManager,
  renderBaseUrl?: string,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const lock = yield* Effect.acquireRelease(
        Effect.sync(() => {
          let locks = publicationLocks.get(providers)
          if (locks === undefined) {
            locks = new Map()
            publicationLocks.set(providers, locks)
          }
          const key = `${input.owner}\0${input.slug}`
          const entry = locks.get(key) ?? { semaphore: Semaphore.makeUnsafe(1), users: 0 }
          locks.set(key, entry)
          entry.users += 1
          return { locks, key, entry }
        }),
        ({ locks, key, entry }) =>
          Effect.sync(() => {
            entry.users -= 1
            if (entry.users === 0) locks.delete(key)
          }),
      )
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const attemptId = randomUUID()
          // Registered before spawn: kill/reap FIRST, then roll back owned state.
          yield* Effect.addFinalizer(() =>
            Effect.promise(() =>
              rollbackPublishAttempt(input.owner, input.slug, attemptId, providers),
            ),
          )
          const parentSpan = yield* Effect.currentSpan
          const request = yield* Schema.encodeEffect(PublishWorkerRequestJson)({
            version: 1,
            input,
            attemptId,
            ...(renderBaseUrl === undefined ? {} : { renderBaseUrl }),
            parentSpan: {
              traceId: parentSpan.traceId,
              spanId: parentSpan.spanId,
              sampled: parentSpan.sampled,
            },
          })
          const launcher = yield* PublishWorkerLauncher
          const handle = yield* ChildProcess.make(launcher.command, [...launcher.args], {
            env: process.env,
            stdin: Stream.make(new TextEncoder().encode(request)),
            stdout: 'inherit',
            stderr: 'inherit',
            additionalFds: { fd3: { type: 'output' } },
            forceKillAfter: '5 seconds',
          })
          // fd3 is reserved for the envelope; logs retain stdout/stderr. Drain
          // concurrently and never acknowledge before the child has exited.
          const [response, exitCode] = yield* Effect.all(
            [Stream.mkString(Stream.decodeText(handle.getOutputFd(3))), handle.exitCode],
            { concurrency: 2 },
          )
          if (exitCode !== 0) {
            return yield* new PublishFailed({
              owner: input.owner,
              slug: input.slug,
              message: `publish worker exited with code ${exitCode}`,
            })
          }
          const outcome = yield* Schema.decodeEffect(PublishWorkerResponseJson)(response)
          if (outcome._tag === 'Failed') return yield* outcome.error
          yield* Effect.sync(() => acknowledgePublishAttempt(input.owner, input.slug, attemptId))
          return outcome.result
        }),
      ).pipe(Semaphore.withPermit(lock.entry.semaphore))
    }),
  ).pipe(
    // Includes time queued for the per-app permit. An interrupted waiter never
    // enters the inner scope, creates an attempt record, or spawns a worker.
    Effect.timeoutOrElse({
      duration: PUBLISH_WORKER_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new PublishFailed({
            owner: input.owner,
            slug: input.slug,
            message: `publish worker timed out after ${PUBLISH_WORKER_TIMEOUT_MS} ms`,
          }),
        ),
    }),
    Effect.mapError((cause) =>
      cause instanceof PublishFailed
        ? cause
        : new PublishFailed({
            owner: input.owner,
            slug: input.slug,
            message: cause instanceof Error ? cause.message : String(cause),
            cause: String(cause),
          }),
    ),
    Effect.provide(NodeServices.layer),
    Effect.provide(publishWorkerLauncherLayer()),
  )
