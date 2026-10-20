import { AppRoot, Evidence, RuntimeIsland, Section } from '@vista/blocks'
import { Suspense, lazy } from 'react'

const ChartBlock = lazy(() =>
  import('@vista/blocks').then(({ ChartBlock: Component }) => ({ default: Component })),
)

const chart = {
  title: 'Throughput',
  kind: 'line' as const,
  xLabel: 'day',
  yLabel: 'requests',
  unit: 'req',
  series: [
    { key: 'served', label: 'Served', intent: 'success' as const },
    { key: 'failed', label: 'Failed', intent: 'error' as const },
  ],
  data: [
    { label: 'Mon', values: { served: 1200, failed: 8 } },
    { label: 'Tue', values: { served: 1340, failed: 5 } },
    { label: 'Wed', values: { served: 1510, failed: 12 } },
  ],
}

export default function VistaApp() {
  return (
    <AppRoot
      title="Chart block real-closure interop proof (recharts -> es-toolkit)"
      template="architecture-review"
      scope="Direct typed chart props"
    >
      <Section>
        <p>This app exercises the real Recharts browser closure.</p>
      </Section>
      <Section>
        <Evidence id="chart-throughput">
          <RuntimeIsland id="chart-throughput-runtime">
            <Suspense fallback={<div role="status">Loading chart…</div>}>
              <ChartBlock id="chart" chart={chart} caption="Requests served per day" />
            </Suspense>
          </RuntimeIsland>
        </Evidence>
      </Section>
    </AppRoot>
  )
}
