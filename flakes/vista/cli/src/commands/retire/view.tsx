/** `vista retire` view (decision 0063): the retire confirmation block. */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Field, Heading } from '../block.tsx'
import type { RetireStateType } from './schema.ts'

/** Provides the atom holding the retired app's state for the confirmation view. */
export interface RetireViewProps {
  readonly stateAtom: Atom.Atom<RetireStateType>
}

/**
 * Renders the retirement confirmation, showing status retired, versions preserved, and public
 * surfaces returning 410 so operators know what was and was not deleted.
 */
export const RetireView = ({ stateAtom }: RetireViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Heading>retire</Heading>
      <Field label="app" value={s.slug} />
      <Field label="status" value="retired" />
      <Field label="versions" value="preserved" />
      <Field label="surfaces" value="410" />
    </Box>
  )
}
