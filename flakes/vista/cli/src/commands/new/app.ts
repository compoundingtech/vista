/** `vista new` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { NewAppState, newAppInitial } from './schema.ts'

/**
 * Registers the new-app screen as a read-only display app by binding its state schema to the
 * command's initial snapshot.
 */
export const NewAppApp = makeDisplayApp({ stateSchema: NewAppState, initial: newAppInitial })
