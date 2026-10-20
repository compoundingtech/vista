/** `vista retire` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { RetireState, retireInitial } from './schema.ts'

/**
 * Registers the retire screen as a read-only display app by binding its state schema to the
 * command's initial snapshot.
 */
export const RetireApp = makeDisplayApp({ stateSchema: RetireState, initial: retireInitial })
