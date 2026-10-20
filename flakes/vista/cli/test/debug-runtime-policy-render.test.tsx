import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

/** `vista debug runtime-policy` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'

import {
  RuntimePolicyApp,
  RuntimePolicyState,
  RuntimePolicyView,
  type RuntimePolicyStateType,
} from '../src/commands/debug-runtime-policy/mod.ts'
import { runView } from '../src/commands/display-app.ts'

const fixture: RuntimePolicyStateType = {
  schemaVersion: 2,
  publicImportRoots: ['@vista/blocks', 'react'],
  serviceOwnedImportRoots: ['@vista/data'],
  optimizeInclude: ['react'],
  cssImports: ['@vista/ui/document.css'],
  aliases: [
    { specifier: '@vista/blocks', target: '/nix/store/vista/blocks', public: true },
    { specifier: '@vista/data', target: '/nix/store/vista/service/data', public: false },
  ],
  remoteImports: [{ name: 'esm.sh', pattern: 'https://esm.sh/*', description: 'pinned esm CDN' }],
  ssrExternal: ['node:fs'],
  dedupe: ['react', 'react-dom'],
  installed: {
    packageNames: ['@vista/ui', '@vista/blocks', 'react'],
    workspaceClosureDirs: ['/nix/store/vista/blocks'],
  },
}
const golden = Schema.encodeSync(Schema.fromJsonString(RuntimePolicyState))(fixture)
const runPolicy = (s: RuntimePolicyStateType) =>
  runView(
    RuntimePolicyApp,
    React.createElement(RuntimePolicyView, { stateAtom: RuntimePolicyApp.stateAtom }),
    s,
  )
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista debug runtime-policy render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({
      commandFn: runPolicy,
      options: { args: fixture, mode, schema: RuntimePolicyState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('renders a CRITICAL for a public root lacking a package or public alias (tty)', async () => {
    const missing: RuntimePolicyStateType = { ...fixture, publicImportRoots: ['react', 'preact'] }
    const r = await runTestCommand({
      commandFn: runPolicy,
      options: { args: missing, mode: 'tty', schema: RuntimePolicyState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({
      commandFn: runPolicy,
      options: { args: fixture, mode: 'json', schema: RuntimePolicyState },
    })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
