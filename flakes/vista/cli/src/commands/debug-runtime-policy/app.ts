/** `vista debug runtime-policy` TUI app definition (decision 0063). */
import { makeDisplayApp } from '../display-app.ts'
import { RuntimePolicyState, runtimePolicyInitial } from './schema.ts'

/**
 * Registers the debug runtime-policy screen as a read-only display app by binding its validated
 * state schema to the command's initial snapshot.
 */
export const RuntimePolicyApp = makeDisplayApp({
  stateSchema: RuntimePolicyState,
  initial: runtimePolicyInitial,
})
