/**
 * `vista rehydrate` output state (decision 0063 / AGT.CLI-R68): the
 * rehydrate-ok payload. The state IS the machine-output wire schema
 * (`RehydrateOk`), so `--output json` stays byte-identical.
 */
import { RehydrateOk } from '@vista/service/control'

/** The `vista rehydrate` machine-output schema (the `--output json` wire anchor). */
export const RehydrateState = RehydrateOk

export type RehydrateStateType = typeof RehydrateState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const rehydrateInitial: RehydrateStateType = {
  owner: 'dev3.placeholder',
  slug: '',
  version: 0,
  appSource: '',
  files: [],
}
