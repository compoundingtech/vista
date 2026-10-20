/** `vista debug service` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'
import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { runView } from '../src/commands/display-app.ts'
import {
  ServiceInfoApp,
  ServiceInfoState,
  ServiceInfoView,
  type ServiceInfoStateType,
} from '../src/commands/debug-service/mod.ts'

const fixture: ServiceInfoStateType = {
  urlPath: '/_rpc/control',
  apps: 4,
  uptimeMs: 123456,
  paths: {
    root: '/nix/store/vista-root',
    apps: '/nix/store/vista-root/apps',
    cache: '/var/cache/vista',
    deps: '/nix/store/vista-deps',
    diagnostics: {
      rootInNixStore: true,
      rootWritable: false,
      reviewsWritable: true,
      cacheWritable: true,
      depsExists: true,
    },
  },
}
const urls = {
  serviceUrl: 'http://127.0.0.1:4319',
  rpcUrl: 'http://127.0.0.1:4319/_rpc/control',
  publicUrl: 'https://vista.test-tailnet.ts.net',
}
const golden = Schema.encodeSync(Schema.fromJsonString(ServiceInfoState))(fixture)
const runService = (s: ServiceInfoStateType) =>
  runView(
    ServiceInfoApp,
    React.createElement(ServiceInfoView, { stateAtom: ServiceInfoApp.stateAtom, ...urls }),
    s,
  )
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista debug service render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({ commandFn: runService, options: { args: fixture, mode, schema: ServiceInfoState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('renders the writability CRITICAL block when a root is not writable (tty)', async () => {
    const blocked: ServiceInfoStateType = {
      ...fixture,
      paths: { ...fixture.paths, diagnostics: { ...fixture.paths.diagnostics, reviewsWritable: false } },
    }
    const r = await runTestCommand({ commandFn: runService, options: { args: blocked, mode: 'tty', schema: ServiceInfoState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({ commandFn: runService, options: { args: fixture, mode: 'json', schema: ServiceInfoState } })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
