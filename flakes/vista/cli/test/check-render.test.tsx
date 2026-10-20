import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Exit, Schema } from 'effect'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderComponentToText, runTestCommand, type TestModePreset } from '@overeng/tui-react'

import {
  CheckApp,
  CheckContent,
  CheckState,
  CheckView,
  type CheckStateType,
} from '../src/commands/check/mod.ts'
import { runView } from '../src/commands/display-app.ts'
import { runCheck } from '../src/index.ts'

const ready: CheckStateType = {
  _tag: 'ready',
  path: '/work/review/app.tsx',
  title: 'Review',
  semanticNodes: 7,
  dataRequests: 2,
  warnings: [],
}
const failed: CheckStateType = {
  _tag: 'failed',
  path: '/work/review/app.tsx',
  diagnostic: {
    code: 'evaluation',
    message: 'duplicate semantic id "risk"',
    consequences: ['manifest node "risk" must have exactly one matching DOM semantic target'],
  },
}
const runCheckView = (state: CheckStateType) =>
  runView(CheckApp, React.createElement(CheckView, { stateAtom: CheckApp.stateAtom }), state)
const roots: string[] = []

const writeValidApp = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'vista-cli-check-'))
  roots.push(root)
  writeFileSync(
    join(root, 'app.tsx'),
    `import { AppRoot, Section } from '@vista/blocks'
export default function VistaApp() {
  return <AppRoot title="CLI check" template="architecture-review" scope="cli"><Section>Ready</Section></AppRoot>
}
`,
  )
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('vista check output', () => {
  it.each(['tty', 'ci', 'log'] satisfies readonly TestModePreset[])(
    'renders without failure in %s mode',
    async (mode) => {
      const result = await runTestCommand({
        commandFn: runCheckView,
        options: { args: ready, mode, schema: CheckState },
      })
      expect(Exit.isSuccess(result.exit)).toBe(true)
    },
  )

  it('renders a compact ready summary', async () => {
    const output = await renderComponentToText({ element: <CheckContent state={ready} /> })
    expect(output).toBe('ready  /work/review/app.tsx · 7 semantic nodes · 2 data requests')
  })
  it('shows advisory scaffold warnings first while keeping the report ready', async () => {
    const state: CheckStateType = {
      ...ready,
      warnings: [
        {
          code: 'scaffold-slots',
          message: 'Unfilled scaffold slots: primary-focus.',
        },
      ],
    }
    const output = await renderComponentToText({ element: <CheckContent state={state} /> })
    expect(output).toContain('WARNING [scaffold-slots]\nUnfilled scaffold slots: primary-focus.')
    expect(output).toContain('ready  /work/review/app.tsx')
    const result = await runTestCommand({
      commandFn: runCheckView,
      options: { args: state, mode: 'json', schema: CheckState },
    })
    expect(Exit.isSuccess(result.exit)).toBe(true)
    expect(result.jsonOutput).toEqual([Schema.encodeSync(Schema.fromJsonString(CheckState))(state)])
    expect(JSON.parse(result.jsonOutput[0]!).warnings).toEqual(state.warnings)
  })

  it('renders one problems-first root and grouped consequences', async () => {
    const output = await renderComponentToText({ element: <CheckContent state={failed} /> })
    expect(output).toBe(
      'CRITICAL\nduplicate semantic id "risk"\n  at /work/review/app.tsx\n  manifest node "risk" must have exactly one matching DOM semantic target',
    )
  })

  it('emits the exact schema-owned result in json mode', async () => {
    const result = await runTestCommand({
      commandFn: runCheckView,
      options: { args: failed, mode: 'json', schema: CheckState },
    })
    expect(result.jsonOutput).toEqual([
      Schema.encodeSync(Schema.fromJsonString(CheckState))(failed),
    ])
  })

  it('runs locally without managed-agent identity or a service', async () => {
    const root = writeValidApp()
    const previous = {
      CATALOG: process.env.CATALOG,
      ST_AGENT: process.env.ST_AGENT,
      VISTA_URL: process.env.VISTA_URL,
    }
    delete process.env.CATALOG
    delete process.env.ST_AGENT
    delete process.env.VISTA_URL
    try {
      const result = await runTestCommand({
        commandFn: ({ path }: { readonly path: string }) => runCheck(path),
        options: { args: { path: root }, mode: 'json', schema: CheckState },
      })
      expect(Exit.isSuccess(result.exit)).toBe(true)
      expect(JSON.parse(result.jsonOutput[0]!)).toEqual(
        expect.objectContaining({ _tag: 'ready', title: 'CLI check' }),
      )
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }, 141_000)
})
