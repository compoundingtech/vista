import { Context, Effect, Layer, Ref } from 'effect'

import { Note } from './note.query.ts'

/** Context service tag whose implementation supplies a read effect that turns a message into a Note. */
export class NoteStore extends Context.Service<
  NoteStore,
  { readonly read: (message: string) => Effect.Effect<Note> }
>()('Vista/SampleNoteStore') {}

/**
 * Layer implementing NoteStore with a shared counter so each read returns the given message with
 * an incremented revision, making calls observable.
 */
export const NoteStoreLive = Layer.effect(
  NoteStore,
  Effect.map(Ref.make(0), (revision) => ({
    read: (message: string) =>
      Effect.map(
        Ref.updateAndGet(revision, (value) => value + 1),
        (value) => new Note({ message, revision: value }),
      ),
  })),
)
