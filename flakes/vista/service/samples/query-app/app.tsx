import {
  AppRoot,
  bind,
  bindingFailureMessage,
  Evidence,
  Section,
  useBinding,
  useRefresh,
} from '@vista/blocks/query'

import { note } from './providers/note.query.ts'
const noteBinding = bind(
  note.ops.read,
  { message: 'frozen first, live on demand' },
  { mode: 'live' },
)

const RefreshNoteButton = () => {
  const refresh = useRefresh(noteBinding)
  return (
    <button type="button" onClick={refresh}>
      Refresh live value
    </button>
  )
}

const NoteBlock = () => {
  const result = useBinding(noteBinding)

  if (result._tag === 'Initial') return <p role="status">Loading note</p>
  if (result._tag === 'Failure') {
    return <p role="alert">Error: {bindingFailureMessage(result)}</p>
  }
  return (
    <div>
      <p data-query-source={result.value._tag.toLowerCase()}>
        {result.value.value.message}; revision {result.value.value.revision}
      </p>
      <RefreshNoteButton />
    </div>
  )
}

export default function VistaApp() {
  return (
    <AppRoot
      title="Query integration"
      template="architecture-review"
      scope="One app-local query with a captured seed and published live refresh"
    >
      <Section>
        <Evidence id="query-result">
          <NoteBlock />
        </Evidence>
      </Section>
    </AppRoot>
  )
}
