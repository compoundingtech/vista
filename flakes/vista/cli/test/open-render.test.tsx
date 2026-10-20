/** `vista open` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'
import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { runView } from '../src/commands/display-app.ts'
import { OpenApp, OpenState, OpenView, type OpenStateType } from '../src/commands/open/mod.ts'

const fixture: OpenStateType = {
  slug: 'alpha-review',
  version: 'v3',
  url: 'https://vista.test-tailnet.ts.net/r/o-646576332e6f776e6572/alpha-review/v3/',
  canonical: true,
}
const golden = Schema.encodeSync(Schema.fromJsonString(OpenState))(fixture)
const runOpen = (s: OpenStateType) =>
  runView(OpenApp, React.createElement(OpenView, { stateAtom: OpenApp.stateAtom }), s)
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista open render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({ commandFn: runOpen, options: { args: fixture, mode, schema: OpenState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({ commandFn: runOpen, options: { args: fixture, mode: 'json', schema: OpenState } })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
  it('renders the non-canonical loopback note when canonical=false (tty)', async () => {
    const r = await runTestCommand({
      commandFn: runOpen,
      options: { args: { ...fixture, canonical: false }, mode: 'tty', schema: OpenState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
})
