/** `vista rehydrate` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { RehydrateState, rehydrateInitial } from './schema.ts'

/**
 * Registers the rehydrate screen as a read-only display app by binding its state schema to the
 * command's initial snapshot.
 */
export const RehydrateApp = makeDisplayApp({
  stateSchema: RehydrateState,
  initial: rehydrateInitial,
})
