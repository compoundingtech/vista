import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

/** `vista rehydrate` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'

import { runView } from '../src/commands/display-app.ts'
import {
  RehydrateApp,
  RehydrateState,
  RehydrateView,
  type RehydrateStateType,
} from '../src/commands/rehydrate/mod.ts'

const fixture: RehydrateStateType = {
  owner: 'dev3.alpha',
  slug: 'alpha-review',
  version: 3,
  appSource: '/sources/_owned.v1/dev3.alpha/alpha-review',
  files: ['app.tsx'],
}
const golden = Schema.encodeSync(Schema.fromJsonString(RehydrateState))(fixture)
const runRehydrate = (s: RehydrateStateType) =>
  runView(
    RehydrateApp,
    React.createElement(RehydrateView, { stateAtom: RehydrateApp.stateAtom }),
    s,
  )
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista rehydrate render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({
      commandFn: runRehydrate,
      options: { args: fixture, mode, schema: RehydrateState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({
      commandFn: runRehydrate,
      options: { args: fixture, mode: 'json', schema: RehydrateState },
    })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
