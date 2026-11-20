import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { Effect, Schema, Stream } from 'effect'
import { ChildProcess } from 'effect/process'

import { PublishFailed, type PublishInput } from './control.ts'
import { root } from './paths.ts'
import { PublishWorkerRequestJson, PublishWorkerResponseJson } from './publish-worker-protocol.ts'

/** Includes startup, the complete transaction, cleanup, and process exit. */
export const PUBLISH_WORKER_TIMEOUT_MS = 10 * 60 * 1_000

export const publishInWorker = (input: PublishInput, renderBaseUrl?: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const parentSpan = yield* Effect.currentSpan
      const request = yield* Schema.encodeEffect(PublishWorkerRequestJson)({
        version: 1,
        input,
        ...(renderBaseUrl === undefined ? {} : { renderBaseUrl }),
        parentSpan: {
          traceId: parentSpan.traceId,
          spanId: parentSpan.spanId,
          sampled: parentSpan.sampled,
        },
      })
      // The packaged service is bundled, but its source workspace is also shipped.
      // Resolve from that contract, not from this module's bundled import.meta.url.
      const worker = join(root(), 'flakes', 'vista', 'service', 'src', 'publish-worker.ts')
      const handle = yield* ChildProcess.make(process.execPath, [...process.execArgv, worker], {
        env: process.env,
        stdin: Stream.make(new TextEncoder().encode(request)),
        stdout: 'inherit',
        stderr: 'inherit',
        additionalFds: { fd3: { type: 'output' } },
        forceKillAfter: '5 seconds',
      })
      // fd3 is reserved for the Schema envelope; build/provider logs keep their
      // normal stdout/stderr. Drain it concurrently and NEVER acknowledge early.
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
      return outcome.result
    }),
  ).pipe(
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
  )
