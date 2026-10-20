import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

/** `vista retire` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'

import { runView } from '../src/commands/display-app.ts'
import {
  RetireApp,
  RetireState,
  RetireView,
  type RetireStateType,
} from '../src/commands/retire/mod.ts'

const fixture: RetireStateType = { owner: 'dev3.alpha', slug: 'alpha-review' }
const golden = Schema.encodeSync(Schema.fromJsonString(RetireState))(fixture)
const runRetire = (s: RetireStateType) =>
  runView(RetireApp, React.createElement(RetireView, { stateAtom: RetireApp.stateAtom }), s)
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista retire render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({
      commandFn: runRetire,
      options: { args: fixture, mode, schema: RetireState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({
      commandFn: runRetire,
      options: { args: fixture, mode: 'json', schema: RetireState },
    })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
