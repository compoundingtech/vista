import { Exit, Schema } from 'effect'
import { Atom, AtomRegistry } from 'effect/reactivity'
import React from 'react'
import { describe, expect, it } from 'vitest'

/** `vista new` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import {
  renderToString,
  runTestCommand,
  TuiRegistryContext,
  type TestModePreset,
} from '@overeng/tui-react'

import { runView } from '../src/commands/display-app.ts'
import {
  NewAppApp,
  NewAppState,
  NewAppView,
  type NewAppStateType,
} from '../src/commands/new/mod.ts'

const fixture: NewAppStateType = {
  owner: 'dev3.alpha',
  slug: 'alpha-review',
  appSource: '/sources/_owned.v1/dev3.alpha/alpha-review',
  files: ['app.tsx'],
  dryRun: false,
  writes: [],
}
const serviceUrl = 'https://vista.test-tailnet.ts.net'
const golden = Schema.encodeSync(Schema.fromJsonString(NewAppState))(fixture)
const runNew = (s: NewAppStateType) =>
  runView(
    NewAppApp,
    React.createElement(NewAppView, { stateAtom: NewAppApp.stateAtom, serviceUrl }),
    s,
  )
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']
const renderNew = (state: NewAppStateType) => {
  const registry = AtomRegistry.make()
  return renderToString({
    element: (
      <TuiRegistryContext.Provider value={registry}>
        <NewAppView stateAtom={Atom.make(state)} serviceUrl={serviceUrl} />
      </TuiRegistryContext.Provider>
    ),
    options: { width: 160 },
  })
}

describe('vista new render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({
      commandFn: runNew,
      options: { args: fixture, mode, schema: NewAppState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('guides context-first authoring, check, and publish without unavailable commands', async () => {
    const output = await renderNew(fixture)
    expect(output).toContain('what / why now / reader ask and one primary visual focus')
    expect(output).toContain(`vista check ${fixture.appSource}`)
    expect(output).toContain(`vista publish ${fixture.slug}`)
    expect(output).toContain('replace scaffold slot comments with real context and content')
    expect(output).not.toContain('vista review')
    expect(output.indexOf('vista check')).toBeLessThan(output.indexOf('vista publish'))
    expect(output).not.toContain('forthcoming')
  })
  it('renders the dry-run writes list (tty)', async () => {
    const dry: NewAppStateType = {
      ...fixture,
      dryRun: true,
      writes: ['/sources/_owned.v1/dev3.alpha/alpha-review/app.tsx'],
    }
    const r = await runTestCommand({
      commandFn: runNew,
      options: { args: dry, mode: 'tty', schema: NewAppState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('keeps authoring steps out of dry-run output', async () => {
    const output = await renderNew({ ...fixture, dryRun: true })
    expect(output).not.toContain('vista review')
    expect(output).not.toContain('vista check')
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({
      commandFn: runNew,
      options: { args: fixture, mode: 'json', schema: NewAppState },
    })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
