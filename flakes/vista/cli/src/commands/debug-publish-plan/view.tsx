/**
 * `vista debug publish-plan` view (decision 0063): problems-first (AppSource
 * problems + missing providers), then the publish-plan summary block. The
 * `·`-separated freeze line is a plain, un-dimmed literal.
 */
import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, useTuiAtomValue } from '@overeng/tui-react'

import { BoolField, Field, Heading, Problems, type Problem } from '../block.tsx'
import type { PublishPlanStateType } from './schema.ts'

const yesNo = (value: boolean): string => (value ? 'yes' : 'no')

/**
 * Passes the atom holding the resolved publish-plan state so the view can subscribe to updates
 * without owning the data.
 */
export interface PublishPlanViewProps {
  readonly stateAtom: Atom.Atom<PublishPlanStateType>
}

/**
 * Renders the publish plan by merging state-reported problems and missing providers into
 * actionable Problem entries, each paired with a suggested fix referencing the app's owner and
 * slug.
 */
export const PublishPlanView = ({ stateAtom }: PublishPlanViewProps): React.ReactElement => {
  const p = useTuiAtomValue(stateAtom)
  const problems: readonly Problem[] = [
    ...p.problems.map((problem: string) => ({
      name: problem,
      fix: `update canonical source for ${p.owner}/${p.slug}`,
    })),
    ...p.providers.missing.map((provider: string) => ({
      name: `missing provider: ${provider}`,
      fix: 'mount the provider in the Vista service or change the app freeze block',
    })),
  ]
  return (
    <Box flexDirection="column">
      <Problems items={problems} />
      <Heading>publish plan</Heading>
      <Field label="app" value={p.slug} />
      <Field label="status" value={p.publishable ? 'publishable' : 'blocked'} />
      <BoolField label="draft" value={p.draftExists} />
      <Field label="AppSource" value={`app.tsx=${yesNo(p.source.appTsx)}`} />
      <Field label="next" value={p.nextVersion === null ? 'n/a' : `v${p.nextVersion}`} />
      <Field
        label="freeze"
        value={`${p.freeze.frozen} frozen · ${p.freeze.live} live · ${p.freeze.subscription} subscription · ${p.freeze.unresolved} unresolved`}
      />
    </Box>
  )
}
