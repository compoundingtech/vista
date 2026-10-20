/** `vista debug paths` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { ServicePathsState, servicePathsInitial } from './schema.ts'

/**
 * Display app for the debug-paths command that mounts servicePathsInitial state and its schema for
 * the paths diagnostic screen.
 */
export const ServicePathsApp = makeDisplayApp({
  stateSchema: ServicePathsState,
  initial: servicePathsInitial,
})
