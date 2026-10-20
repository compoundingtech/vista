/**
 * `vista debug import` view (decision 0063): problems-first (a blocked import
 * surfaces its guidance as the fix), then the classification block.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Field, Heading, Problems, type Problem } from '../block.tsx'
import type { ImportDiagnosticStateType } from './schema.ts'

/** Props supplying the reactive import-diagnostic state atom that the view observes. */
export interface ImportDiagnosticViewProps {
  readonly stateAtom: Atom.Atom<ImportDiagnosticStateType>
}

/**
 * Renders the import policy verdict, surfacing a blocked-import problem with its fix guidance when
 * disallowed along with the diagnostic's classification details.
 */
export const ImportDiagnosticView = ({
  stateAtom,
}: ImportDiagnosticViewProps): React.ReactElement => {
  const d = useTuiAtomValue(stateAtom)
  const problems: readonly Problem[] = d.allowed
    ? []
    : [{ name: `blocked import: ${d.specifier}`, fix: d.guidance }]
  // oxlint-disable-next-line no-underscore-dangle -- `_tag` is the schema's classification field
  const classification = d.classification._tag
  return (
    <Box flexDirection="column">
      <Problems items={problems} />
      <Heading>import</Heading>
      <Field label="specifier" value={d.specifier} />
      <Field label="status" value={d.allowed ? 'allowed' : 'blocked'} />
      <Field label="classification" value={classification} />
      <Field label="reason" value={d.classification.reason} />
      <Field label="guidance" value={d.guidance} />
    </Box>
  )
}
