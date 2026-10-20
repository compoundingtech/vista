/** `vista rehydrate` view (decision 0063): the rehydrated-version summary + next steps. */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Blank, Field, Heading, Item } from '../block.tsx'
import type { RehydrateStateType } from './schema.ts'

/** Supplies the atom containing the rehydrated app's state for the view to read. */
export interface RehydrateViewProps {
  readonly stateAtom: Atom.Atom<RehydrateStateType>
}

/**
 * Renders the rehydrated app's slug, version, AppSource, and files, then lists concrete next steps
 * such as editing the app entry point.
 */
export const RehydrateView = ({ stateAtom }: RehydrateViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Heading>rehydrate</Heading>
      <Field label="app" value={s.slug} />
      <Field label="version" value={`v${s.version}`} />
      <Field label="AppSource" value={s.appSource} />
      <Field label="files" value={s.files.join(', ')} />
      <Blank />
      <Heading>next</Heading>
      <Item>{`edit ${s.appSource}/app.tsx`}</Item>
      <Item>{`vista publish ${s.slug} -m "<change summary>"`}</Item>
    </Box>
  )
}
