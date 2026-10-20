import {
  AppRoot,
  bind,
  bindingFailureMessage,
  Evidence,
  Section,
  useBinding,
} from '@vista/blocks/query'

import { clockStream } from './providers/clock.query.ts'

const clockBinding = bind(clockStream, { lane: 'publish-checks' }, { mode: 'subscription' })

/**
 * Renders the clock binding as a status paragraph, showing a loading message, an error alert, or
 * the current tick count and cursor tagged by its source.
 */
export const ClockTicks = () => {
  const result = useBinding(clockBinding)
  if (result._tag === 'Initial') return <p role="status">Loading clock</p>
  if (result._tag === 'Failure') {
    return <p role="alert">Error: {bindingFailureMessage(result)}</p>
  }
  return (
    <p data-clock-source={result.value._tag.toLowerCase()}>
      Tick {result.value.value.ticks} ({result.value.value.cursor})
    </p>
  )
}

export default function VistaApp() {
  return (
    <AppRoot
      title="Live checks"
      template="architecture-review"
      scope="Captured clock state followed by one shared live subscription"
    >
      <Section>
        <Evidence id="clock-ticks">
          <ClockTicks />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
