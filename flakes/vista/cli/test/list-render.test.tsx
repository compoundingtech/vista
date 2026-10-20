/**
 * `vista list` view render + machine-contract fidelity (decision 0063 / AGT.CLI-R68).
 *
 * Two guarantees, exercised headlessly (no running service) via
 * `runTestCommand` over the `runListView` render program:
 *   1. The view renders without crashing across every output mode
 *      (`ALL_OUTPUT_TABS`: tty/ci/log/json/ndjson) — the story-test coverage vista
 *      lacked.
 *   2. In machine modes the emitted bytes are the historical `--json` wire shape:
 *      a bare `AppRow[]` array, byte-identical to `Schema.encode(fromJsonString(
 *      Schema.Array(AppRow)))(rows)`. This is the AGT.CLI-R68 drift guard — if a
 *      future edit wraps the payload in view state, this fails.
 */
import { AppRow } from '@vista/service/control'
import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { runTestCommand, type TestModePreset } from '@overeng/tui-react'

import { runView } from '../src/commands/display-app.ts'
import { ListApp, ListView } from '../src/commands/list/mod.ts'
import { ListState, type ListStateType } from '../src/commands/list/schema.ts'

const runList = (rows: ListStateType) =>
  runView(ListApp, React.createElement(ListView, { stateAtom: ListApp.stateAtom }), rows)

const fixtureRows: ListStateType = [
  {
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
  },
  {
    owner: 'dev3.beta',
    slug: 'beta-draft',
    resource: {
      _tag: 'vista-app',
      uri: 'dev.schickling.vista-app://primary/dev3.beta/beta-draft',
    },
    latest: null,
    retired: false,
    updated: '2026-07-02T12:00:00.000Z',
  },
  {
    owner: 'dev3.gamma',
    slug: 'gamma-old',
    resource: {
      _tag: 'vista-app',
      uri: 'dev.schickling.vista-app://primary/dev3.gamma/gamma-old',
    },
    latest: 5,
    retired: true,
    template: 'treemap',
    updated: '2026-06-20T08:00:00.000Z',
  },
]

// The exact machine-output the pre-tui-react `--json` branch produced: the rows
// encoded through the WIRE schema (not the view). This is the oracle.
const goldenJson = Schema.encodeSync(Schema.fromJsonString(Schema.Array(AppRow)))(fixtureRows)

/** Visual render modes (the machine modes json/ndjson are asserted separately). */
const VISUAL_MODES: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista list render', () => {
  it.each(VISUAL_MODES)('renders without crashing in %s mode', async (mode) => {
    const result = await runTestCommand({
      commandFn: (rows: ListStateType) => runList(rows),
      options: { args: fixtureRows, mode, schema: ListState },
    })
    expect(Exit.isSuccess(result.exit)).toBe(true)
  })

  it('renders the empty state without crashing (tty)', async () => {
    const result = await runTestCommand({
      commandFn: (rows: ListStateType) => runList(rows),
      options: { args: [], mode: 'tty', schema: ListState },
    })
    expect(Exit.isSuccess(result.exit)).toBe(true)
  })

  it('emits the bare AppRow[] wire shape in json mode (AGT.CLI-R68 fidelity)', async () => {
    const result = await runTestCommand({
      commandFn: (rows: ListStateType) => runList(rows),
      options: { args: fixtureRows, mode: 'json', schema: ListState },
    })
    expect(Exit.isSuccess(result.exit)).toBe(true)
    // One final-state line, byte-identical to the historical `--json` encoding.
    expect(result.jsonOutput).toHaveLength(1)
    expect(result.jsonOutput[0]).toBe(goldenJson)
    expect(result.finalState).toEqual(fixtureRows)
  })

  it('emits a bare array (not wrapped view state) in json mode', async () => {
    const result = await runTestCommand({
      commandFn: (rows: ListStateType) => runList(rows),
      options: { args: fixtureRows, mode: 'json', schema: ListState },
    })
    const parsed = JSON.parse(result.jsonOutput[0]!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(3)
  })
})
