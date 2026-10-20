import type { Operation, Snapshot } from '@vista/blocks/internal/data-contract'
import {
  type CanonicalJsonError,
  readSnapshotBinding,
  FrozenEntryMissing,
  SchemaMismatch,
} from '@vista/blocks/internal/data-contract'
import { Effect, Schema } from 'effect'

/** Decode a captured seed through the operation's strict success schema. */
export const readFrozen = <Tag extends string, Args, A, E>(
  snapshot: Snapshot,
  operation: Operation<Tag, Args, A, E>,
  args: Args,
): Effect.Effect<
  A,
  CanonicalJsonError | FrozenEntryMissing | Schema.SchemaError | SchemaMismatch
> =>
  Effect.gen(function* () {
    const { key, entry } = yield* readSnapshotBinding(snapshot, {
      operation,
      args,
      policy: { mode: 'frozen' },
    })
    if (entry === undefined) return yield* new FrozenEntryMissing({ key })
    if (entry.provider !== operation.providerId || entry.operation !== operation.tag) {
      return yield* new SchemaMismatch({
        provider: operation.providerId,
        operation: operation.tag,
        key,
        message: `snapshot entry '${key}' belongs to ${entry.provider}.${entry.operation}`,
      })
    }
    return yield* Schema.decodeUnknownEffect(operation.successSchema, {
      onExcessProperty: 'error',
    })(entry.encodedValue).pipe(
      Effect.mapError(
        (error) =>
          new SchemaMismatch({
            provider: operation.providerId,
            operation: operation.tag,
            key,
            message: String(error),
          }),
      ),
    )
  })
