import { implement, mountProvider } from '@vista/data/provider'
import { Effect } from 'effect'

import { note } from './note.query.ts'
import { NoteStore, NoteStoreLive } from './note.store.ts'

const implementation = implement(note, {
  purity: 'pure',
  handlers: {
    read: ({ message }) => Effect.flatMap(NoteStore, (store) => store.read(message)),
  },
})

export default mountProvider(implementation, NoteStoreLive)
