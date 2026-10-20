/** `vista debug service` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { ServiceInfoState, serviceInfoInitial } from './schema.ts'

/**
 * Registers the debug service screen as a read-only display app by binding its validated state
 * schema to the command's initial snapshot.
 */
export const ServiceInfoApp = makeDisplayApp({
  stateSchema: ServiceInfoState,
  initial: serviceInfoInitial,
})
