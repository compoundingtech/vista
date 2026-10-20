import { Exit, Schema } from 'effect'
import React from 'react'
import { describe, expect, it } from 'vitest'

/** `vista debug publish-plan` view render + `--output json` fidelity (decision 0063 / AGT.CLI-R68). */
import { runTestCommand, type TestModePreset } from '@overeng/tui-react'

import {
  PublishPlanApp,
  PublishPlanState,
  PublishPlanView,
  type PublishPlanStateType,
} from '../src/commands/debug-publish-plan/mod.ts'
import { runView } from '../src/commands/display-app.ts'

const fixture: PublishPlanStateType = {
  owner: 'dev3.alpha',
  slug: 'alpha-review',
  draftExists: true,
  publishable: true,
  latest: 2,
  nextVersion: 3,
  source: { appTsx: true },
  freeze: {
    total: 2,
    frozen: 1,
    live: 1,
    subscription: 0,
    effectfulAcknowledged: 0,
    unresolved: 0,
    blocks: [
      {
        id: 'data-summary',
        title: 'Data summary',
        providerId: 'metrics',
        rpcTag: 'vista.metrics.summary',
        policy: { mode: 'frozen' },
        providerMounted: true,
      },
    ],
  },
  providers: { mounted: ['metrics'], missing: [] },
  problems: [],
}
const golden = Schema.encodeSync(Schema.fromJsonString(PublishPlanState))(fixture)
const runPlan = (s: PublishPlanStateType) =>
  runView(
    PublishPlanApp,
    React.createElement(PublishPlanView, { stateAtom: PublishPlanApp.stateAtom }),
    s,
  )
const VISUAL: readonly TestModePreset[] = ['tty', 'ci', 'log']

describe('vista debug publish-plan render', () => {
  it.each(VISUAL)('renders without crashing in %s mode', async (mode) => {
    const r = await runTestCommand({
      commandFn: runPlan,
      options: { args: fixture, mode, schema: PublishPlanState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('renders AppSource problems + missing providers as CRITICAL (tty)', async () => {
    const blocked: PublishPlanStateType = {
      ...fixture,
      publishable: false,
      providers: { mounted: [], missing: ['metrics'] },
      problems: ['app.tsx is missing'],
    }
    const r = await runTestCommand({
      commandFn: runPlan,
      options: { args: blocked, mode: 'tty', schema: PublishPlanState },
    })
    expect(Exit.isSuccess(r.exit)).toBe(true)
  })
  it('emits the exact wire struct in json mode (AGT.CLI-R68 fidelity)', async () => {
    const r = await runTestCommand({
      commandFn: runPlan,
      options: { args: fixture, mode: 'json', schema: PublishPlanState },
    })
    expect(r.jsonOutput).toHaveLength(1)
    expect(r.jsonOutput[0]).toBe(golden)
    expect(r.finalState).toEqual(fixture)
  })
})
