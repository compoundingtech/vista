import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

/** `vista debug app` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'

import { AppApp, AppState, AppView, type AppStateType } from '../src/commands/debug-app/mod.ts'
import { runView } from '../src/commands/display-app.ts'

const fixture: AppStateType = {
  owner: 'dev3.alpha',
  slug: 'alpha-review',
  resource: {
    _tag: 'vista-app',
    uri: 'dev.schickling.vista-app://primary/dev3.alpha/alpha-review',
  },
  latest: 3,
  retired: false,
  title: 'Alpha',
  template: 'system-explorer',
  status: { locked: 1, open: 2, awaiting: 0 },
  updated: '2026-07-01T09:30:00.000Z',
}
const golden = Schema.encodeSync(Schema.fromJsonString(AppState))(fixture)
const runApp = (s: AppStateType) =>
  runView(AppApp, React.createElement(AppView, { stateAtom: AppApp.stateAtom }), s)
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista debug app render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({
      commandFn: runApp,
      options: { args: fixture, mode, schema: AppState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('renders a draft (no version, no optionals) without crashing (tty)', async () => {
    const draft: AppStateType = {
      owner: 'dev3.beta',
      slug: 'beta-draft',
      resource: {
        _tag: 'vista-app',
        uri: 'dev.schickling.vista-app://primary/dev3.beta/beta-draft',
      },
      latest: null,
      retired: false,
    }
    const r = await runTestCommand({
      commandFn: runApp,
      options: { args: draft, mode: 'tty', schema: AppState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({
      commandFn: runApp,
      options: { args: fixture, mode: 'json', schema: AppState },
    })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
