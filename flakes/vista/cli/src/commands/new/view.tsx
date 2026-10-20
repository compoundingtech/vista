/**
 * `vista new` view (decision 0063): the scaffold summary. A dry-run lists the
 * planned writes; a real scaffold lists the next authoring steps. The service
 * URL is a display-only prop (not in the wire schema).
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { Blank, Field, Heading, Item } from '../block.tsx'
import type { NewAppStateType } from './schema.ts'

/**
 * Provides the state atom plus the service URL that the view shows alongside the pending
 * app-creation details.
 */
export interface NewAppViewProps {
  readonly stateAtom: Atom.Atom<NewAppStateType>
  readonly serviceUrl: string
}

/**
 * Renders the new app's slug, AppSource, files, and service URL, switching to a preview layout
 * when dryRun is enabled so no mutation is implied.
 */
export const NewAppView = ({ stateAtom, serviceUrl }: NewAppViewProps): React.ReactElement => {
  const s = useTuiAtomValue(stateAtom)
  return (
    <Box flexDirection="column">
      <Heading>{s.dryRun ? 'new app preview' : 'new app'}</Heading>
      <Field label="app" value={s.slug} />
      <Field label="AppSource" value={s.appSource} />
      <Field label="service" value={serviceUrl} />
      <Field label="files" value={s.files.join(', ')} />
      {s.dryRun ? (
        <Box flexDirection="column">
          <Blank />
          <Heading>writes</Heading>
          {s.writes.map((write) => (
            <Item key={write}>{write}</Item>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Blank />
          <Heading>next</Heading>
          <Item>{`edit ${s.appSource}/app.tsx`}</Item>
          <Item>{'author the what / why now / reader ask and one primary visual focus'}</Item>
          <Item>{`vista check ${s.appSource}`}</Item>
          <Item>{`vista publish ${s.slug} -m "<change summary>"`}</Item>
          <Item>
            {'replace scaffold slot comments with real context and content before sharing'}
          </Item>
        </Box>
      )}
    </Box>
  )
}
