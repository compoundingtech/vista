/** `vista debug app` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { AppState, appInitial } from './schema.ts'

/**
 * Display app for the debug-app command that mounts appInitial state and its schema for the app
 * inspector screen.
 */
export const AppApp = makeDisplayApp({ stateSchema: AppState, initial: appInitial })
