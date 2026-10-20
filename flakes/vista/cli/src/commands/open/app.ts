/** `vista open` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { OpenState, openInitial } from './schema.ts'

/**
 * Registers the open screen as a read-only display app seeded with a pre-fetch placeholder state
 * that is replaced once the URL resolves.
 */
export const OpenApp = makeDisplayApp({ stateSchema: OpenState, initial: openInitial })
