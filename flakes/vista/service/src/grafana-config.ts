import type { GrafanaTraceConfig } from '@vista/blocks/shell'

/** Browser-reachable Grafana base URL; unset leaves the RPC explorer's trace IDs unlinked. */
export const VISTA_GRAFANA_URL_ENV = 'VISTA_GRAFANA_URL'
/** UID of the Tempo datasource in that Grafana. */
export const VISTA_GRAFANA_TEMPO_DATASOURCE_UID_ENV = 'VISTA_GRAFANA_TEMPO_DATASOURCE_UID'
/** The UID every provisioned Grafana in this fleet gives its Tempo datasource. */
const DEFAULT_TEMPO_DATASOURCE_UID = 'tempo'

/**
 * Grafana the shell links RPC trace IDs to, read from the service environment. There is no
 * default host: without `VISTA_GRAFANA_URL` the shell renders trace IDs as plain text.
 */
export const resolveVistaGrafanaConfig = (
  env: NodeJS.ProcessEnv = process.env,
): GrafanaTraceConfig | undefined => {
  const baseUrl = env[VISTA_GRAFANA_URL_ENV]?.trim()
  if (baseUrl === undefined || baseUrl === '') return undefined
  const uid = env[VISTA_GRAFANA_TEMPO_DATASOURCE_UID_ENV]?.trim()
  return {
    baseUrl,
    tempoDatasourceUid: uid === undefined || uid === '' ? DEFAULT_TEMPO_DATASOURCE_UID : uid,
  }
}
