import type { Atom } from 'effect/reactivity'
import React from 'react'

import { Box, Text, useTuiAtomValue } from '@overeng/tui-react'

import type { CheckStateType } from './schema.ts'

/** Props supplying the reactive check-state atom that the view subscribes to for re-rendering. */
export interface CheckViewProps {
  readonly stateAtom: Atom.Atom<CheckStateType>
}

/** Props carrying the current check state to render as a static snapshot of terminal content. */
export interface CheckContentProps {
  readonly state: CheckStateType
}

/**
 * Renders the check outcome, printing a green ready line with path, semantic-node, and
 * data-request counts when ready, otherwise a detailed failure layout.
 */
export const CheckContent = ({ state }: CheckContentProps): React.ReactElement => {
  if (state._tag === 'ready') {
    return (
      <Box flexDirection="column">
        {state.warnings.map((warning) => (
          <Box key={warning.code} flexDirection="column">
            <Text bold color="yellow">{`WARNING [${warning.code}]`}</Text>
            <Text>{warning.message}</Text>
          </Box>
        ))}
        <Text>
          <Text color="green">ready</Text>
          {`  ${state.path} · ${state.semanticNodes} semantic nodes · ${state.dataRequests} data requests`}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold color="red">
        CRITICAL
      </Text>
      <Text bold>{state.diagnostic.message}</Text>
      <Text dim>{`  at ${state.path}`}</Text>
      {state.diagnostic.consequences.map((consequence: string) => (
        <Text key={consequence} dim>{`  ${consequence}`}</Text>
      ))}
    </Box>
  )
}

/**
 * Subscribes to the check-state atom via useTuiAtomValue and renders CheckContent with its latest
 * value.
 */
export const CheckView = ({ stateAtom }: CheckViewProps): React.ReactElement => (
  <CheckContent state={useTuiAtomValue(stateAtom)} />
)
