/** `vista debug paths` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'
import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { runView } from '../src/commands/display-app.ts'
import {
  ServicePathsApp,
  ServicePathsState,
  ServicePathsView,
  type ServicePathsStateType,
} from '../src/commands/debug-paths/mod.ts'

const fixture: ServicePathsStateType = {
  root: '/nix/store/vista-root',
  apps: '/nix/store/vista-root/apps',
  cache: '/var/cache/vista',
  deps: '/nix/store/vista-deps',
  diagnostics: {
    rootInNixStore: true,
    rootWritable: true,
    reviewsWritable: true,
    cacheWritable: true,
    depsExists: true,
  },
}
const golden = Schema.encodeSync(Schema.fromJsonString(ServicePathsState))(fixture)
const runPaths = (s: ServicePathsStateType) =>
  runView(ServicePathsApp, React.createElement(ServicePathsView, { stateAtom: ServicePathsApp.stateAtom }), s)
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista debug paths render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({ commandFn: runPaths, options: { args: fixture, mode, schema: ServicePathsState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('renders the CRITICAL block when the deps closure is missing (tty)', async () => {
    const blocked: ServicePathsStateType = {
      ...fixture,
      diagnostics: { ...fixture.diagnostics, depsExists: false },
    }
    const r = await runTestCommand({ commandFn: runPaths, options: { args: blocked, mode: 'tty', schema: ServicePathsState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({ commandFn: runPaths, options: { args: fixture, mode: 'json', schema: ServicePathsState } })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
