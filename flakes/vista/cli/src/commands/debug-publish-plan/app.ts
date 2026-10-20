/** `vista debug publish-plan` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { PublishPlanState, publishPlanInitial } from './schema.ts'

/**
 * Registers the debug publish-plan screen as a read-only display app by binding its validated
 * state schema to the initial snapshot the command starts from.
 */
export const PublishPlanApp = makeDisplayApp({
  stateSchema: PublishPlanState,
  initial: publishPlanInitial,
})
