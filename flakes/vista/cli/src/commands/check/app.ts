import { makeDisplayApp } from '../display-app.ts'
import { CheckState, checkInitial } from './schema.ts'

/**
 * Display app for the check command that starts from checkInitial state and exits with status 1
 * when the terminal state is failed.
 */
export const CheckApp = makeDisplayApp({
  stateSchema: CheckState,
  initial: checkInitial,
  exitCode: (state) => (state._tag === 'failed' ? 1 : undefined),
})
