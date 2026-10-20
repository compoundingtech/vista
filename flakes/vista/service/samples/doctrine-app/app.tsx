import {
  AppRoot,
  Ask,
  Callout,
  Decision,
  Evidence,
  Fork,
  Markdown,
  Ref,
  Section,
} from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="Published apps served from immutable source"
      template="architecture-review"
      scope="Receipt-backed static publication"
    >
      <Section>
        <Markdown source="Vista builds one self-contained static version from this React component." />
      </Section>
      <Section>
        <Ask id="ask">
          <p>Confirm the immutable publication boundary.</p>
        </Ask>
      </Section>
      <Section>
        <Fork id="fork-serving">
          <Decision id="static-build" status="locked">
            <Ref target="build-proof">Receipt-backed static output</Ref>
          </Decision>
        </Fork>
        <Evidence id="build-proof">
          <Callout
            id="single-source"
            kind="finding"
            title="One source"
            body="The manifest and browser render come from the same default component."
          />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
