/** Service-side Grafana resolution for the shell's RPC trace links (`grafana-config.ts`). */
import { expect, test } from 'vitest'

import { resolveVistaGrafanaConfig } from './grafana-config.ts'

test('without VISTA_GRAFANA_URL there is no Grafana, whatever else is set', () => {
  expect(resolveVistaGrafanaConfig({})).toBeUndefined()
  expect(
    resolveVistaGrafanaConfig({
      VISTA_GRAFANA_URL: '  ',
      VISTA_GRAFANA_TEMPO_DATASOURCE_UID: 'tempo-main',
    }),
  ).toBeUndefined()
})

test('a configured URL uses the configured Tempo datasource UID', () => {
  expect(
    resolveVistaGrafanaConfig({
      VISTA_GRAFANA_URL: ' https://grafana.example.test ',
      VISTA_GRAFANA_TEMPO_DATASOURCE_UID: ' tempo-main ',
    }),
  ).toEqual({ baseUrl: 'https://grafana.example.test', tempoDatasourceUid: 'tempo-main' })
})

test('the Tempo datasource UID falls back to the provisioned `tempo`', () => {
  expect(
    resolveVistaGrafanaConfig({
      VISTA_GRAFANA_URL: 'https://grafana.example.test',
      VISTA_GRAFANA_TEMPO_DATASOURCE_UID: '',
    }),
  ).toEqual({ baseUrl: 'https://grafana.example.test', tempoDatasourceUid: 'tempo' })
})
