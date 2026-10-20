/** `vista open` view (decision 0063): the canonical URL for an app. */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Field, Heading, NonCanonicalNote } from '../block.tsx'
import type { OpenStateType } from './schema.ts'

/** Feeds the view the atom holding the already-fetched open state so rendering never races the fetch. */
export interface OpenViewProps {
  readonly stateAtom: Atom.Atom<OpenStateType>
}

/**
 * Renders the resolved app slug, version, and URL, appending the non-canonical warning note
 * whenever the URL is not shareable across hosts.
 */
export const OpenView = ({ stateAtom }: OpenViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Heading>open</Heading>
      <Field label="app" value={s.slug} />
      <Field label="version" value={s.version} />
      <Field label="url" value={s.url} />
      <NonCanonicalNote canonical={s.canonical} />
    </Box>
  )
}
