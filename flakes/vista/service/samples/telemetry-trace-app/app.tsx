import { AppRoot, Evidence, Section, TraceQuery } from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot title="Telemetry trace" template="telemetry-exploration" scope="Typed trace binding">
      <Section>
        <p>One typed trace query owns live and frozen behavior.</p>
      </Section>
      <Section>
        <Evidence id="trace-checkout">
          <TraceQuery traceId="a7ccc272f7d9452ee360040c5ec24f0f" />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
