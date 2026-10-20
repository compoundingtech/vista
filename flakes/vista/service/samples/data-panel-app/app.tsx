import { AppRoot, Decision, Evidence, MetricQuery, Section } from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="Request rate — frozen telemetry panel"
      template="telemetry-exploration"
      scope="One typed metric query drives capture and rendering"
    >
      <Section>
        <p>Published data is captured from the typed metric query below.</p>
      </Section>
      <Section>
        <Evidence id="otel-rate">
          <MetricQuery query="rate(http_requests_total[5m])" stepSeconds={60} points={30} />
        </Evidence>
      </Section>
      <Decision id="set-freeze" status="locked">
        Publication captures the same query the draft renders live.
      </Decision>
    </AppRoot>
  )
}
