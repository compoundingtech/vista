/**
 * `vista debug app` view (decision 0063): a single app row as a key-value block.
 * `title`/`template`/`updated` are optional on the wire — rendered only when
 * present.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { BoolField, Field, Heading } from '../block.tsx'
import type { AppStateType } from './schema.ts'

/** Props supplying the reactive app-state atom that the inspector view observes. */
export interface AppViewProps {
  readonly stateAtom: Atom.Atom<AppStateType>
}

/**
 * Renders an inspector listing the app slug, owner, resource URI, latest version, retired flag,
 * and any optional metadata fields from the current state.
 */
export const AppView = ({ stateAtom }: AppViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Heading>app</Heading>
      <Field label="app" value={s.slug} />
      <Field label="owner" value={s.owner} />
      <Field label="resource" value={s.resource.uri} />
      <Field label="latest" value={s.latest === null ? 'none' : `v${s.latest}`} />
      <BoolField label="retired" value={s.retired} />
      {s.title === undefined ? null : <Field label="title" value={s.title} />}
      {s.template === undefined ? null : <Field label="template" value={s.template} />}
      {s.updated === undefined ? null : <Field label="updated" value={s.updated} />}
    </Box>
  )
}
