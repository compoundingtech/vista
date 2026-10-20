/**
 * `vista debug paths` view (decision 0063): problems-first (writability/closure
 * diagnostics), then the filesystem roots and their diagnostics.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { PathsDiagnostics, Problems, pathsProblems } from '../block.tsx'
import type { ServicePathsStateType } from './schema.ts'

/** Props supplying the reactive service-paths state atom that the view observes. */
export interface ServicePathsViewProps {
  readonly stateAtom: Atom.Atom<ServicePathsStateType>
}

/**
 * Renders path diagnostics as problems alongside the resolved root, apps, cache, and deps
 * directories from the current state.
 */
export const ServicePathsView = ({ stateAtom }: ServicePathsViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Problems items={pathsProblems(s.diagnostics)} />
      <PathsDiagnostics
        heading="paths"
        roots={{ root: s.root, apps: s.apps, cache: s.cache, deps: s.deps }}
        diagnostics={s.diagnostics}
      />
    </Box>
  )
}
