/**
 * Grafana instance that renders a Vista RPC record's trace. The service resolves it from its
 * environment and hands it to the shell; there is no default host.
 */
export interface GrafanaTraceConfig {
  /** Browser-reachable Grafana origin (optionally with a sub-path), e.g. `https://grafana.example`. */
  readonly baseUrl: string
  /** UID of the Tempo datasource provisioned in that Grafana. */
  readonly tempoDatasourceUid: string
}

/** W3C trace context observed on an RPC record. */
export interface TraceReference {
  readonly traceId: string
  readonly spanId?: string | undefined
}

/**
 * Grafana Explore URL that opens one trace in Tempo, focusing the span when known. Same pane
 * shape as Bonsai's explorer link and the otel-stack `otel-scrape` trace template.
 */
export const grafanaTraceUrl = ({
  grafana,
  traceId,
  spanId,
}: TraceReference & { readonly grafana: GrafanaTraceConfig }): string => {
  const datasource = { type: 'tempo', uid: grafana.tempoDatasourceUid }
  const searchParams = new URLSearchParams({
    orgId: '1',
    schemaVersion: '1',
    panes: JSON.stringify({
      trace: {
        datasource: grafana.tempoDatasourceUid,
        ...(spanId === undefined ? {} : { panelsState: { trace: { spanId } } }),
        queries: [
          {
            datasource,
            query: traceId,
            queryType: 'traceql',
            refId: 'A',
            tableType: 'traces',
          },
        ],
        range: { from: 'now-1h', to: 'now' },
      },
    }),
  })
  return `${grafana.baseUrl.replace(/\/+$/, '')}/explore?${searchParams.toString()}`
}

/** The explorer's `traceHref`, or none when no Grafana is configured (records stay unlinked). */
export const grafanaTraceHref = (
  grafana: GrafanaTraceConfig | undefined,
): ((trace: TraceReference) => string) | undefined =>
  grafana === undefined ? undefined : (trace) => grafanaTraceUrl({ grafana, ...trace })
