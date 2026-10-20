import { AppRoot, Evidence, ProfileQuery, Section } from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="Telemetry flamegraph"
      template="telemetry-exploration"
      scope="Typed profile binding"
    >
      <Section>
        <p>One typed profile query owns live and frozen behavior.</p>
      </Section>
      <Section>
        <Evidence id="flamegraph-cpu">
          <ProfileQuery
            profileTypeId="process_cpu:cpu:nanoseconds:cpu:nanoseconds"
            from={1_700_000_000_000}
            until={1_700_003_600_000}
          />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
