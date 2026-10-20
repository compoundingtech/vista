import type {
  BindingPolicy,
  Operation,
  SnapshotEntry,
  SnapshotKey,
} from '@vista/blocks/internal/data-contract'
import { canonicalJson, encodeBinding, Snapshot } from '@vista/blocks/internal/data-contract'
import type { Context } from 'effect'
import { Cause, DateTime, Effect, Exit, Metric, Schema, type Tracer } from 'effect'

import { freezeBlocks, freezeDuration, freezeOperations, trackDuration } from '../metrics.ts'
import type { CapturePlan, SemanticCaptureBinding } from './app.ts'
import { resolveProvider, type ProviderRegistry } from './mount.ts'
import { assertNoSecrets, type SecretFinding } from './secrets.ts'

const emptyCapturePlan: CapturePlan = { flatMapSelectors: new Map() }

/**
 * Immutable record of a single data-provider invocation frozen during capture, pairing the
 * provider id and RPC tag with its raw arguments and the snapshot key under which the result is
 * stored.
 */
export interface CapturedCall {
  readonly providerId: string
  readonly rpcTag: string
  readonly args: unknown
  readonly key: SnapshotKey
}

/**
 * Discriminated union for one block's freeze outcome, tagged 'captured' with the recorded
 * CapturedCall for that blockId or 'failed' when capture of the block could not be completed.
 */
export type BlockCaptureResult =
  | { readonly _tag: 'captured'; readonly blockId: string; readonly call: CapturedCall }
  | {
      readonly _tag: 'failed'
      readonly blockId: string
      readonly providerId: string
      readonly rpcTag: string
      readonly error: string
    }
  | {
      readonly _tag: 'secret-blocked'
      readonly blockId: string
      readonly findings: ReadonlyArray<SecretFinding>
    }
  | {
      readonly _tag: 'effectful-refused'
      readonly blockId: string
      readonly providerId: string
      readonly rpcTag: string
    }

/**
 * Aggregates the result of a frozen capture run, combining the produced snapshot, the per-block
 * outcomes, and the calls that were successfully recorded.
 */
export interface CaptureReport {
  readonly snapshot: Snapshot
  readonly results: ReadonlyArray<BlockCaptureResult>
  readonly recorded: ReadonlyArray<CapturedCall>
}

const unknownOperation = (
  providerId: string,
  tag: string,
  operations: Record<string, Operation<string, unknown, unknown, unknown>>,
): Operation<string, unknown, unknown, unknown> | undefined => operations[tag]

type CapturedValue = {
  readonly _tag: 'captured'
  readonly call: CapturedCall
  readonly entry: SnapshotEntry
  readonly value: unknown
  readonly identity: string
  readonly fresh: boolean
}
type CaptureAttempt =
  | CapturedValue
  | {
      readonly _tag: 'failed'
      readonly providerId: string
      readonly rpcTag: string
      readonly error: string
    }
  | { readonly _tag: 'secret-blocked'; readonly findings: ReadonlyArray<SecretFinding> }
  | { readonly _tag: 'effectful-refused'; readonly providerId: string; readonly rpcTag: string }

const captureOne = (
  registry: ProviderRegistry,
  capturedByKey: ReadonlyMap<SnapshotKey, CapturedValue>,
  requestedProviderId: string,
  rpcTag: string,
  encodedManifestArgs: unknown,
  policy: BindingPolicy,
): Effect.Effect<CaptureAttempt> =>
  Effect.gen(function* () {
    const mounted = resolveProvider(registry, requestedProviderId)
    if (mounted === undefined) {
      return {
        _tag: 'failed' as const,
        providerId: requestedProviderId,
        rpcTag,
        error: `unknown provider '${requestedProviderId}'`,
      }
    }
    const providerId = mounted.id
    if (
      mounted.purity === 'effectful' &&
      (!('effectfulCapture' in policy) || policy.effectfulCapture !== 'acknowledged')
    ) {
      return { _tag: 'effectful-refused' as const, providerId, rpcTag }
    }
    const operation = unknownOperation(
      providerId,
      rpcTag,
      mounted.contract.ops as Record<string, Operation<string, unknown, unknown, unknown>>,
    )
    if (operation === undefined) {
      return { _tag: 'failed' as const, providerId, rpcTag, error: `unknown rpc '${rpcTag}'` }
    }
    if (Reflect.get(operation, 'kind') === 'command') {
      return {
        _tag: 'failed' as const,
        providerId,
        rpcTag,
        error: `command operation '${providerId}.${rpcTag}' is live-only and cannot be captured`,
      }
    }
    const exit = yield* Effect.exit(
      Effect.gen(function* () {
        const args = yield* Schema.decodeUnknownEffect(operation.payloadSchema, {
          onExcessProperty: 'error',
        })(encodedManifestArgs)
        const { encodedArgs, key } = yield* encodeBinding({ operation, args, policy })
        const argsFindings = assertNoSecrets(encodedArgs)
        if (argsFindings.length > 0) {
          return { _tag: 'secret-blocked' as const, findings: argsFindings }
        }

        const identity = yield* canonicalJson([providerId, rpcTag, encodedArgs])
        const existing = capturedByKey.get(key)
        if (existing !== undefined) {
          return existing.identity === identity
            ? { ...existing, fresh: false }
            : {
                _tag: 'failed' as const,
                providerId,
                rpcTag,
                error: `conflicting captured material for snapshot key '${key}'`,
              }
        }

        const value = yield* mounted.call(rpcTag, args, 'capture')
        const encodedValue = yield* Schema.encodeUnknownEffect(operation.successSchema)(value)
        const valueFindings = assertNoSecrets(encodedValue)
        if (valueFindings.length > 0) {
          return { _tag: 'secret-blocked' as const, findings: valueFindings }
        }
        const capturedAt = DateTime.formatIso(yield* DateTime.now)
        return {
          _tag: 'captured' as const,
          call: { providerId, rpcTag, args, key },
          entry: { provider: providerId, operation: rpcTag, encodedArgs, encodedValue, capturedAt },
          value,
          identity,
          fresh: true,
        }
      }),
    )
    if (Exit.isFailure(exit)) {
      return { _tag: 'failed' as const, providerId, rpcTag, error: Cause.pretty(exit.cause) }
    }
    return exit.value
  })

const blockResult = (
  blockId: string,
  attempt: Exclude<CaptureAttempt, CapturedValue>,
): BlockCaptureResult => {
  switch (attempt._tag) {
    case 'secret-blocked':
      return { _tag: 'secret-blocked', blockId, findings: attempt.findings }
    case 'effectful-refused':
      return {
        _tag: 'effectful-refused',
        blockId,
        providerId: attempt.providerId,
        rpcTag: attempt.rpcTag,
      }
    case 'failed':
      return {
        _tag: 'failed',
        blockId,
        providerId: attempt.providerId,
        rpcTag: attempt.rpcTag,
        error: attempt.error,
      }
  }
}

/** Capture frozen seeds for frozen, live, and subscription bindings. */
export const captureFrozenEffect = (
  registry: ProviderRegistry,
  bindings: ReadonlyArray<SemanticCaptureBinding>,
  capturePlan: CapturePlan = emptyCapturePlan,
): Effect.Effect<CaptureReport> =>
  Effect.gen(function* () {
    const recorded: CapturedCall[] = []
    const entries: Record<SnapshotKey, SnapshotEntry> = {}
    const capturedByKey = new Map<SnapshotKey, CapturedValue>()
    const frozenAt = DateTime.formatIso(yield* DateTime.now)

    const results = yield* Effect.forEach(
      bindings,
      (binding): Effect.Effect<BlockCaptureResult> =>
        Effect.gen(function* () {
          const parent = yield* captureOne(
            registry,
            capturedByKey,
            binding.provider,
            binding.operation,
            binding.args,
            binding.policy,
          )
          if (parent._tag !== 'captured') return blockResult(binding.semanticId, parent)

          const captures: CapturedValue[] = [parent]
          const pendingByKey = new Map(capturedByKey)
          pendingByKey.set(parent.call.key, parent)
          if (binding.dependency !== undefined) {
            const expectedEdge = `${parent.call.key}::flatMap::${binding.dependency.id}`
            if (binding.dependency.edge !== expectedEdge) {
              return {
                _tag: 'failed',
                blockId: binding.semanticId,
                providerId: binding.provider,
                rpcTag: binding.operation,
                error: `flatMap edge mismatch: expected '${expectedEdge}'`,
              } satisfies BlockCaptureResult
            }
            const select = capturePlan.flatMapSelectors.get(binding.dependency.edge)
            if (select === undefined) {
              return {
                _tag: 'failed',
                blockId: binding.semanticId,
                providerId: binding.provider,
                rpcTag: binding.operation,
                error: `flatMap selector '${binding.dependency.id}' is not registered`,
              } satisfies BlockCaptureResult
            }
            const selectedExit = yield* Effect.exit(Effect.sync(() => select(parent.value)))
            if (Exit.isFailure(selectedExit)) {
              return {
                _tag: 'failed',
                blockId: binding.semanticId,
                providerId: binding.provider,
                rpcTag: binding.operation,
                error: Cause.pretty(selectedExit.cause),
              } satisfies BlockCaptureResult
            }
            const selected = selectedExit.value
            const child = yield* captureOne(
              registry,
              pendingByKey,
              selected.operation.providerId,
              selected.operation.tag,
              selected.args,
              binding.policy,
            )
            if (child._tag !== 'captured') return blockResult(binding.semanticId, child)
            captures.push(child)
          }

          for (const capture of captures) {
            if (!capture.fresh) continue
            recorded.push(capture.call)
            entries[capture.call.key] = capture.entry
            capturedByKey.set(capture.call.key, capture)
          }
          return {
            _tag: 'captured',
            blockId: binding.semanticId,
            call: captures.at(-1)!.call,
          } satisfies BlockCaptureResult
        }).pipe(
          Effect.withSpan('vista.freeze.block.capture', {
            attributes: {
              'span.label': binding.semanticId,
              'vista.freeze.block_id': binding.semanticId,
              'vista.provider.id': binding.provider,
              'vista.provider.rpc': binding.operation,
            },
          }),
        ),
    )

    yield* Effect.forEach(
      results,
      (result) => Metric.update(Metric.withAttributes(freezeBlocks, { outcome: result._tag }), 1),
      { discard: true },
    )
    const snapshot = yield* Schema.decodeEffect(Snapshot, { onExcessProperty: 'error' })({
      apiVersion: 2,
      frozenAt,
      entries,
    }).pipe(Effect.orDie)
    return { snapshot, results, recorded }
  }).pipe(
    Effect.withSpan('vista.freeze.capture', {
      attributes: { 'span.label': 'freeze.capture', 'vista.freeze.blocks': bindings.length },
    }),
    trackDuration(freezeDuration),
    Effect.tap(() => Metric.update(freezeOperations, 1)),
  )

/**
 * Supplies the Effect runtime context and parent span so a capture can continue an existing
 * distributed trace rather than starting its own.
 */
export interface FreezeTraceContext {
  readonly runtime: Context.Context<never>
  readonly parentSpan: Tracer.AnySpan
}

/**
 * Executes the frozen capture over the given registry and bindings as a promise, attaching it to
 * the supplied parent span when a trace context is provided and running standalone otherwise.
 */
export const captureFrozen = (
  registry: ProviderRegistry,
  bindings: ReadonlyArray<SemanticCaptureBinding>,
  capturePlan: CapturePlan = emptyCapturePlan,
  trace?: FreezeTraceContext,
): Promise<CaptureReport> => {
  const effect = captureFrozenEffect(registry, bindings, capturePlan)
  return trace === undefined
    ? Effect.runPromise(effect)
    : Effect.runPromiseWith(trace.runtime)(effect.pipe(Effect.withParentSpan(trace.parentSpan)))
}
