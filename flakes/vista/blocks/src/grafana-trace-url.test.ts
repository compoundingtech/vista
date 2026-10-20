/** Grafana Explore links for RPC explorer trace IDs (`grafana-trace-url.ts`). */
import { expect, test } from 'vitest'

import { grafanaTraceHref, grafanaTraceUrl } from './grafana-trace-url.ts'

const grafana = { baseUrl: 'https://grafana.example.test/', tempoDatasourceUid: 'tempo-main' }
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736'

const decodePanes = (href: string) => {
  const url = new URL(href)
  return { url, panes: JSON.parse(url.searchParams.get('panes')!) }
}

test('an unconfigured Grafana yields no traceHref, so trace IDs stay plain text', () => {
  expect(grafanaTraceHref(undefined)).toBeUndefined()
})

test('a configured Grafana opens the trace in Explore against its Tempo datasource', () => {
  const href = grafanaTraceHref(grafana)!({ traceId })
  const { url, panes } = decodePanes(href)
  expect(`${url.origin}${url.pathname}`).toBe('https://grafana.example.test/explore')
  expect(url.searchParams.get('orgId')).toBe('1')
  expect(url.searchParams.get('schemaVersion')).toBe('1')
  expect(panes).toEqual({
    trace: {
      datasource: 'tempo-main',
      queries: [
        {
          datasource: { type: 'tempo', uid: 'tempo-main' },
          query: traceId,
          queryType: 'traceql',
          refId: 'A',
          tableType: 'traces',
        },
      ],
      range: { from: 'now-1h', to: 'now' },
    },
  })
})

test('a known span is focused in the trace panel', () => {
  const { panes } = decodePanes(grafanaTraceUrl({ grafana, traceId, spanId: '00f067aa0ba902b7' }))
  expect(panes.trace.panelsState).toEqual({ trace: { spanId: '00f067aa0ba902b7' } })
})

test('a Grafana served under a sub-path keeps it', () => {
  const href = grafanaTraceUrl({
    grafana: { ...grafana, baseUrl: 'https://ops.example.test/grafana' },
    traceId,
  })
  expect(href.startsWith('https://ops.example.test/grafana/explore?')).toBe(true)
})

test('pane JSON is query-encoded so reserved characters cannot break the URL', () => {
  const hostile = 'a&b=c#d "e"'
  const href = grafanaTraceUrl({ grafana, traceId: hostile, spanId: 'x&y' })
  expect(href).not.toContain('#')
  expect(href).not.toContain('"')
  expect(href).not.toContain(' ')
  const { url, panes } = decodePanes(href)
  expect([...url.searchParams.keys()]).toEqual(['orgId', 'schemaVersion', 'panes'])
  expect(panes.trace.queries[0].query).toBe(hostile)
  expect(panes.trace.panelsState.trace.spanId).toBe('x&y')
})
