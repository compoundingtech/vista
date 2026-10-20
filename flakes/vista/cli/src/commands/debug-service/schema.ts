/**
 * `vista debug service` output state (decision 0063 / AGT.CLI-R68): the running
 * service's control-RPC info. The state IS the machine-output wire schema
 * (`ServiceInfo`), so `--output json` stays byte-identical. The transport URLs
 * the human render surfaces (serviceUrl/rpcUrl/publicUrl) are NOT part of the
 * wire payload — the handler enriches them from the client, so the view takes
 * them as display-only props (they never affect json, which is headless).
 */
import { ServiceInfo } from '@vista/service/control'

/** The `vista debug service` machine-output schema (the `--output json` wire anchor). */
export const ServiceInfoState = ServiceInfo

export type ServiceInfoStateType = typeof ServiceInfoState.Type

/** Pre-fetch placeholder (never rendered: fetch precedes render). */
export const serviceInfoInitial: ServiceInfoStateType = {
  urlPath: '/_rpc/control',
  apps: 0,
  uptimeMs: 0,
  paths: {
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
  },
}
