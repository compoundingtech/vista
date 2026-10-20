/**
 * `vista debug app` output state (decision 0063 / AGT.CLI-R68): a single app's
 * index row. The state IS the machine-output wire schema (`AppRow`), so
 * `--output json` stays byte-identical.
 */
import { AppRow } from '@vista/service/control'

/** The `vista debug app` machine-output schema (the `--output json` wire anchor). */
export const AppState = AppRow

export type AppStateType = typeof AppState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const appInitial: AppStateType = {
  owner: 'dev3.placeholder',
  slug: '',
  resource: {
    _tag: 'vista-app',
    uri: 'dev.schickling.vista-app://primary/dev3.placeholder/placeholder',
  },
  latest: null,
  retired: false,
}
