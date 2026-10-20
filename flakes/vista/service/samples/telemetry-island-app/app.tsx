import { AppRoot, Evidence, MetricQuery, Section } from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="Telemetry island — metric visualization"
      template="telemetry-exploration"
      scope="Direct typed telemetry component"
    >
      <Section>
        <p>Drafts render live; publication captures the same typed query.</p>
      </Section>
      <Section>
        <Evidence id="otel-cpu">
          <MetricQuery query="rate(process_cpu_seconds_total[5m])" stepSeconds={60} points={30} />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
