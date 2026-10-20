/**
 * `vista debug service` view (decision 0063): the enriched service inspector —
 * problems-first (writability/closure diagnostics), then the service transport
 * block, filesystem roots, and diagnostics. The three transport URLs are
 * display-only props (not in the wire schema); everything else derives from the
 * fetched `ServiceInfo` state.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Blank, Field, Heading, PathsDiagnostics, Problems, pathsProblems } from '../block.tsx'
import type { ServiceInfoStateType } from './schema.ts'

/**
 * Combines the state atom with the service, RPC, and public URLs the view prints as connection
 * details.
 */
export interface ServiceInfoViewProps {
  readonly stateAtom: Atom.Atom<ServiceInfoStateType>
  readonly serviceUrl: string
  readonly rpcUrl: string
  readonly publicUrl: string
}

/**
 * Renders service diagnostics first via any path problems, then labeled fields for the service,
 * RPC, and public endpoints so operators can verify reachability.
 */
export const ServiceInfoView = ({
  stateAtom,
  serviceUrl,
  rpcUrl,
  publicUrl,
}: ServiceInfoViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Problems items={pathsProblems(s.paths.diagnostics)} />
      <Heading>service</Heading>
      <Field label="url" value={serviceUrl} />
      <Field label="rpc" value={rpcUrl} />
      <Field label="public" value={publicUrl} />
      <Field label="path" value={s.urlPath} />
      <Field label="apps" value={`${s.apps}`} />
      <Field label="uptime" value={`${Math.round(s.uptimeMs)}ms`} />
      <Blank />
      <PathsDiagnostics
        heading="roots"
        roots={{ root: s.paths.root, apps: s.paths.apps, cache: s.paths.cache, deps: s.paths.deps }}
        diagnostics={s.paths.diagnostics}
      />
    </Box>
  )
}
