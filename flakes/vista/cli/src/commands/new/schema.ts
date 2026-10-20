/**
 * `vista new` output state (decision 0063 / AGT.CLI-R68): the scaffold-ok
 * payload. The state IS the machine-output wire schema (`NewAppOk`), so
 * `--output json` stays byte-identical. The service URL the human render
 * surfaces is NOT part of the wire payload — the handler enriches it from the
 * client, so the view takes it as a display-only prop (never affects json).
 */
import { NewAppOk } from '@vista/service/control'

/** The `vista new` machine-output schema (the `--output json` wire anchor). */
export const NewAppState = NewAppOk

export type NewAppStateType = typeof NewAppState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const newAppInitial: NewAppStateType = {
  owner: 'dev3.placeholder',
  slug: '',
  appSource: '',
  files: [],
  dryRun: false,
  writes: [],
}
