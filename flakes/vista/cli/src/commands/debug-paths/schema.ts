/**
 * `vista debug paths` output state (decision 0063 / AGT.CLI-R68): the service's
 * filesystem roots + writability diagnostics. The state IS the machine-output
 * wire schema (`ServicePaths`), so `--output json` stays byte-identical.
 */
import { ServicePaths } from '@vista/service/control'

/** The `vista debug paths` machine-output schema (the `--output json` wire anchor). */
export const ServicePathsState = ServicePaths

export type ServicePathsStateType = typeof ServicePathsState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const servicePathsInitial: ServicePathsStateType = {
  root: '',
  apps: '',
  cache: '',
  deps: '',
  diagnostics: {
    rootInNixStore: false,
    rootWritable: false,
    reviewsWritable: false,
    cacheWritable: false,
    depsExists: false,
  },
}
