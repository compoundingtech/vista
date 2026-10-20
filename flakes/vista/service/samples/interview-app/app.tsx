import {
  AppRoot,
  Ask,
  Decision,
  Fork,
  InterviewQuestion,
  RuntimeIsland,
  Ref,
  Section,
} from '@vista/blocks'

export default function VistaApp() {
  return (
    <AppRoot
      title="Interview round-trip — answer the decision-question in place"
      template="architecture-review"
      scope="Bounded structured-answer round-trip"
    >
      <Section>
        <p>Answer the agent's explicit structured question below.</p>
      </Section>
      <Section>
        <Fork id="fork-transport">
          <Decision id="b-rearm" status="open">
            Re-arm a bounded watch.
          </Decision>
          <Decision id="b-longpoll" status="open">
            Hold one long poll.
          </Decision>
        </Fork>
      </Section>
      <Section>
        <Ask id="interview">
          <Ref target="fork-transport" />
          <RuntimeIsland id="interview-runtime">
            <InterviewQuestion appId="interview-demo" />
          </RuntimeIsland>
        </Ask>
      </Section>
    </AppRoot>
  )
}
