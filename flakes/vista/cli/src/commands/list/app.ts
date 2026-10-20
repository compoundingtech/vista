/** `vista list` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { ListState, listInitial } from './schema.ts'

/** The `list` display app: state is the `AppRow[]` wire payload. */
export const ListApp = makeDisplayApp({ stateSchema: ListState, initial: listInitial })
