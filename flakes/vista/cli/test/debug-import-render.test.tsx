/** `vista debug import` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'
import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { runView } from '../src/commands/display-app.ts'
import {
  ImportDiagnosticApp,
  ImportDiagnosticState,
  ImportDiagnosticView,
  type ImportDiagnosticStateType,
} from '../src/commands/debug-import/mod.ts'

const fixture: ImportDiagnosticStateType = {
  specifier: 'react',
  allowed: true,
  classification: { _tag: 'provided', specifier: 'react', reason: 'in the service dependency closure' },
  message: 'import allowed',
  guidance: 'no action needed',
}
const golden = Schema.encodeSync(Schema.fromJsonString(ImportDiagnosticState))(fixture)
const runImport = (s: ImportDiagnosticStateType) =>
  runView(ImportDiagnosticApp, React.createElement(ImportDiagnosticView, { stateAtom: ImportDiagnosticApp.stateAtom }), s)
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista debug import render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({ commandFn: runImport, options: { args: fixture, mode, schema: ImportDiagnosticState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('renders a blocked import as CRITICAL with its guidance (tty)', async () => {
    const blocked: ImportDiagnosticStateType = {
      specifier: 'left-pad',
      allowed: false,
      classification: { _tag: 'remote-unpinned', specifier: 'left-pad', reason: 'not pinned to a version' },
      message: 'import blocked',
      guidance: 'pin the import to a versioned esm.sh URL',
    }
    const r = await runTestCommand({ commandFn: runImport, options: { args: blocked, mode: 'tty', schema: ImportDiagnosticState } })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({ commandFn: runImport, options: { args: fixture, mode: 'json', schema: ImportDiagnosticState } })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
