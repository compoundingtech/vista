import { contract } from '@vista/blocks/query'
import { Schema } from 'effect'
import * as Rpc from 'effect/rpc/Rpc'
import * as RpcGroup from 'effect/rpc/RpcGroup'

/** Tagged error carrying a message string, used as the failure channel for note read operations. */
export class NoteError extends Schema.TaggedError<NoteError>()('NoteError', {
  message: Schema.String,
}) {}

/** Schema class describing a note as a message string paired with a finite revision number. */
export class Note extends Schema.Class<Note>('Note')({
  message: Schema.String,
  revision: Schema.Finite,
}) {}

/**
 * RPC group exposing a single read request that accepts a message and succeeds with a Note or
 * fails with a NoteError.
 */
export const NoteApi = RpcGroup.make(
  Rpc.make('read', {
    payload: { message: Schema.String },
    success: Note,
    error: NoteError,
  }),
)

/** Provider contract registered under the id "sample-note" that exposes the NoteApi group to clients. */
export const note = contract({ id: 'sample-note', group: NoteApi })
